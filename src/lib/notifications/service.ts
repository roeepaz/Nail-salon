import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  NotificationChannel,
  NotificationResult,
  NotificationType,
  SendNotificationOptions,
} from "./types";
import { ResendEmailProvider, type EmailProvider } from "./providers/email";
import { MetaWhatsAppCloudProvider, type WhatsAppProvider } from "./providers/whatsapp";
import { WebPushProvider, type PushProvider } from "./providers/push";
import {
  get1hReminderEmail,
  get24hReminderEmail,
  getCancellationEmail,
  getConfirmationEmail,
} from "./email-templates";

export class NotificationService {
  private db: SupabaseClient<Database>;
  private emailProvider: EmailProvider;
  private whatsappProvider: WhatsAppProvider;
  private pushProvider: PushProvider;

  constructor(
    db: SupabaseClient<Database>,
    emailProvider?: EmailProvider,
    whatsappProvider?: WhatsAppProvider,
    pushProvider?: PushProvider,
  ) {
    this.db = db;
    this.emailProvider = emailProvider || new ResendEmailProvider();
    this.whatsappProvider = whatsappProvider || new MetaWhatsAppCloudProvider();
    this.pushProvider = pushProvider || new WebPushProvider();
  }

  async sendNotification(options: SendNotificationOptions): Promise<NotificationResult[]> {
    const { appointmentId, type, userId } = options;
    const results: NotificationResult[] = [];

    try {
      // 1. Fetch appointment details
      const { data: appointment, error: aptError } = await this.db
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .maybeSingle();

      if (aptError || !appointment) {
        console.error(`[NotificationService] Appointment not found: ${appointmentId}`, aptError);
        return [
          {
            channel: "email",
            status: "failed",
            errorMessage: `Appointment ${appointmentId} not found`,
          },
        ];
      }

      // 2. Fetch user profile if user_id is present
      const targetUserId = userId || appointment.user_id;
      let userProfile: { full_name: string; phone: string; email: string } | null = null;

      if (targetUserId) {
        const { data: profile } = await this.db
          .from("profiles")
          .select("*")
          .eq("id", targetUserId)
          .maybeSingle();
        if (profile) userProfile = profile;

        if (!userProfile?.email) {
          try {
            const { data: authUser } = await this.db.auth.admin.getUserById(targetUserId);
            if (authUser?.user?.email) {
              userProfile = {
                full_name: (authUser.user.user_metadata?.["full_name"] as string) || appointment.client_name,
                phone: (authUser.user.user_metadata?.["phone"] as string) || appointment.client_phone,
                email: authUser.user.email,
              };
            }
          } catch {
            // fallback lookup failure
          }
        }
      }

      const customerName = options.customerName || userProfile?.full_name || appointment.client_name;
      const customerEmail = options.recipientEmail || userProfile?.email;
      const customerPhone = options.recipientPhone || userProfile?.phone || appointment.client_phone;
      const serviceName = options.serviceName || appointment.service_type;
      const appointmentDate = options.appointmentDate || appointment.appointment_date;
      const appointmentTime = options.appointmentTime || appointment.appointment_time;

      // 3. Check business notification settings
      const { data: businessSettings } = await this.db
        .from("business_notification_settings")
        .select("*")
        .eq("id", "default")
        .maybeSingle();

      if (businessSettings && !options.force) {
        if (type === "appointment_confirmation" && !businessSettings.appointment_confirmation) {
          return [{ channel: "email", status: "skipped", errorMessage: "Confirmation notifications disabled by studio." }];
        }
        if (type === "appointment_cancellation" && !businessSettings.appointment_cancellation) {
          return [{ channel: "email", status: "skipped", errorMessage: "Cancellation notifications disabled by studio." }];
        }
        if (type === "appointment_reminder_24h" && !businessSettings.appointment_reminder_24h) {
          return [{ channel: "email", status: "skipped", errorMessage: "24h reminders disabled by studio." }];
        }
        if (type === "appointment_reminder_1h" && !businessSettings.appointment_reminder_1h) {
          return [{ channel: "email", status: "skipped", errorMessage: "1h reminders disabled by studio." }];
        }
      }

      // 4. Check user preferences
      let prefs: {
        web_push_enabled: boolean;
        email_enabled: boolean;
        whatsapp_enabled: boolean;
        appointment_confirmation: boolean;
        appointment_cancellation: boolean;
        appointment_reminder_24h: boolean;
        appointment_reminder_1h: boolean;
      } = {
        web_push_enabled: true,
        email_enabled: true,
        whatsapp_enabled: true,
        appointment_confirmation: true,
        appointment_cancellation: true,
        appointment_reminder_24h: true,
        appointment_reminder_1h: true,
      };

      if (targetUserId) {
        const { data: userPrefs } = await this.db
          .from("notification_preferences")
          .select("*")
          .eq("user_id", targetUserId)
          .maybeSingle();
        if (userPrefs) {
          prefs = userPrefs;
        }
      }

      // If user disabled this notification type entirely, skip (unless forced by admin test)
      if (!options.force) {
        if (type === "appointment_confirmation" && !prefs.appointment_confirmation) {
          return [{ channel: "email", status: "skipped", errorMessage: "User disabled confirmation notifications." }];
        }
        if (type === "appointment_cancellation" && !prefs.appointment_cancellation) {
          return [{ channel: "email", status: "skipped", errorMessage: "User disabled cancellation notifications." }];
        }
        if (type === "appointment_reminder_24h" && !prefs.appointment_reminder_24h) {
          return [{ channel: "email", status: "skipped", errorMessage: "User disabled 24h reminders." }];
        }
        if (type === "appointment_reminder_1h" && !prefs.appointment_reminder_1h) {
          return [{ channel: "email", status: "skipped", errorMessage: "User disabled 1h reminders." }];
        }
      }

      // Determine requested channels
      const candidateChannels: NotificationChannel[] = options.channels || ["push", "email", "whatsapp"];

      // Process channels in parallel with isolated try/catch (Requirement 13)
      await Promise.all(
        candidateChannels.map(async (channel) => {
          try {
            // Check idempotency in notification_logs (bypassed if forced test)
            if (!options.force) {
              const { data: existingLog } = await this.db
                .from("notification_logs")
                .select("*")
                .eq("appointment_id", appointmentId)
                .eq("type", type)
                .eq("channel", channel)
                .maybeSingle();

              if (existingLog && (existingLog.status === "sent" || existingLog.status === "pending")) {
                results.push({
                  channel,
                  status: "skipped",
                  errorMessage: `Notification already processed or pending (idempotency guard)`,
                });
                return;
              }
            }

            // Route by channel
            if (channel === "email") {
              if (!prefs.email_enabled && !options.force) {
                await this.recordLog(targetUserId, appointmentId, type, "email", "skipped", undefined, "User disabled email notifications");
                results.push({ channel: "email", status: "skipped", errorMessage: "Email disabled by user preferences" });
                return;
              }
              if (!customerEmail) {
                await this.recordLog(targetUserId, appointmentId, type, "email", "skipped", undefined, "No customer email available");
                results.push({ channel: "email", status: "skipped", errorMessage: "No recipient email available" });
                return;
              }

              const emailData = {
                customerName,
                serviceName,
                date: appointmentDate,
                time: appointmentTime,
                bookingId: appointment.id,
                notes: appointment.notes,
              };

              let template: { subject: string; html: string };
              switch (type) {
                case "appointment_confirmation":
                  template = getConfirmationEmail(emailData);
                  break;
                case "appointment_reminder_24h":
                  template = get24hReminderEmail(emailData);
                  break;
                case "appointment_reminder_1h":
                  template = get1hReminderEmail(emailData);
                  break;
                case "appointment_cancellation":
                  template = getCancellationEmail(emailData);
                  break;
              }

              const emailRes = await this.emailProvider.sendEmail({
                to: customerEmail,
                subject: template.subject,
                html: template.html,
              });

              await this.recordLog(
                targetUserId,
                appointmentId,
                type,
                "email",
                emailRes.status,
                emailRes.providerMessageId,
                emailRes.errorMessage,
              );
              results.push(emailRes);
            } else if (channel === "whatsapp") {
              if (!prefs.whatsapp_enabled) {
                await this.recordLog(targetUserId, appointmentId, type, "whatsapp", "skipped", undefined, "User disabled WhatsApp notifications");
                results.push({ channel: "whatsapp", status: "skipped", errorMessage: "WhatsApp disabled by user preferences" });
                return;
              }
              if (!customerPhone) {
                await this.recordLog(targetUserId, appointmentId, type, "whatsapp", "skipped", undefined, "No customer phone available");
                results.push({ channel: "whatsapp", status: "skipped", errorMessage: "No recipient phone number available" });
                return;
              }

              const templateName = this.getWhatsAppTemplateName(type);
              const params = [customerName, serviceName, appointmentDate, appointmentTime];

              const waRes = await this.whatsappProvider.sendTemplateMessage(
                customerPhone,
                templateName,
                "en_US",
                params,
              );

              await this.recordLog(
                targetUserId,
                appointmentId,
                type,
                "whatsapp",
                waRes.status,
                waRes.providerMessageId,
                waRes.errorMessage,
              );
              results.push(waRes);
            } else if (channel === "push") {
              if (!prefs.web_push_enabled) {
                await this.recordLog(targetUserId, appointmentId, type, "push", "skipped", undefined, "User disabled Web Push notifications");
                results.push({ channel: "push", status: "skipped", errorMessage: "Push disabled by user preferences" });
                return;
              }
              if (!targetUserId) {
                await this.recordLog(null, appointmentId, type, "push", "skipped", undefined, "Anonymous appointment (no user_id)");
                results.push({ channel: "push", status: "skipped", errorMessage: "No user account linked for push notification" });
                return;
              }

              // Fetch push subscriptions for user
              const { data: subs } = await this.db
                .from("push_subscriptions")
                .select("*")
                .eq("user_id", targetUserId);

              if (!subs || subs.length === 0) {
                await this.recordLog(targetUserId, appointmentId, type, "push", "skipped", undefined, "No push subscriptions registered");
                results.push({ channel: "push", status: "skipped", errorMessage: "No active push subscriptions for user" });
                return;
              }

              const pushPayload = this.getPushPayload(type, customerName, serviceName, appointmentDate, appointmentTime, appointmentId);

              let pushSentCount = 0;
              for (const sub of subs) {
                const sendRes = await this.pushProvider.sendPush(sub, pushPayload);
                if (sendRes.success) {
                  pushSentCount++;
                } else if (sendRes.isExpired) {
                  // Purge expired push subscription
                  await this.db.from("push_subscriptions").delete().eq("id", sub.id);
                }
              }

              const pushStatus = pushSentCount > 0 ? "sent" : "failed";
              const pushError = pushSentCount === 0 ? "Failed to deliver to all registered push devices" : undefined;

              await this.recordLog(targetUserId, appointmentId, type, "push", pushStatus, undefined, pushError);
              results.push({ channel: "push", status: pushStatus, errorMessage: pushError });
            }
          } catch (channelErr) {
            const errorMsg = channelErr instanceof Error ? channelErr.message : String(channelErr);
            console.error(`[NotificationService] Unexpected error on channel ${channel}:`, errorMsg);
            await this.recordLog(targetUserId, appointmentId, type, channel, "failed", undefined, errorMsg);
            results.push({ channel, status: "failed", errorMessage: errorMsg });
          }
        }),
      );
    } catch (outerErr) {
      console.error("[NotificationService] Fatal notification error:", outerErr);
    }

    return results;
  }

  private getWhatsAppTemplateName(type: NotificationType): string {
    switch (type) {
      case "appointment_confirmation":
        return process.env["WHATSAPP_TEMPLATE_CONFIRMATION"] || "appointment_confirmation";
      case "appointment_reminder_24h":
        return process.env["WHATSAPP_TEMPLATE_REMINDER_24H"] || "appointment_reminder_24h";
      case "appointment_reminder_1h":
        return process.env["WHATSAPP_TEMPLATE_REMINDER_1H"] || "appointment_reminder_1h";
      case "appointment_cancellation":
        return process.env["WHATSAPP_TEMPLATE_CANCELLATION"] || "appointment_cancellation";
    }
  }

  private getPushPayload(
    type: NotificationType,
    customerName: string,
    serviceName: string,
    date: string,
    time: string,
    appointmentId: string,
  ) {
    switch (type) {
      case "appointment_confirmation":
        return {
          title: "Appointment Confirmed ✨",
          body: `Hi ${customerName}, your appointment for ${serviceName} on ${date} at ${time} is confirmed!`,
          url: "/my-bookings",
          appointmentId,
          type,
        };
      case "appointment_reminder_24h":
        return {
          title: "Appointment Reminder 💅",
          body: `Reminder: You have an appointment tomorrow at ${time} for ${serviceName}.`,
          url: "/my-bookings",
          appointmentId,
          type,
        };
      case "appointment_reminder_1h":
        return {
          title: "Appointment in 1 Hour 🌸",
          body: `Your ${serviceName} appointment is in 1 hour at ${time}. We can't wait to see you!`,
          url: "/my-bookings",
          appointmentId,
          type,
        };
      case "appointment_cancellation":
        return {
          title: "Appointment Cancelled",
          body: `Your appointment for ${serviceName} on ${date} at ${time} has been cancelled.`,
          url: "/my-bookings",
          appointmentId,
          type,
        };
    }
  }

  private async recordLog(
    userId: string | null | undefined,
    appointmentId: string,
    type: NotificationType,
    channel: NotificationChannel,
    status: "pending" | "sent" | "failed" | "skipped",
    providerMessageId?: string,
    errorMessage?: string,
  ) {
    try {
      await this.db.from("notification_logs").upsert(
        {
          user_id: userId || null,
          appointment_id: appointmentId,
          type,
          channel,
          status,
          provider_message_id: providerMessageId || null,
          error_message: errorMessage || null,
          sent_at: status === "sent" ? new Date().toISOString() : null,
        },
        { onConflict: "appointment_id,type,channel" },
      );
    } catch (logErr) {
      console.error("[NotificationService] Failed to record log:", logErr);
    }
  }
}
