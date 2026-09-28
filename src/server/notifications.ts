import { createServerFn } from "@tanstack/react-start";
import type { NotificationChannel, NotificationType } from "@/lib/notifications/types";

export const dispatchNotificationServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      appointmentId: string;
      type: NotificationType;
      channels?: NotificationChannel[];
      force?: boolean;
      recipientEmail?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { NotificationService } = await import("@/lib/notifications/service");

      const { appointmentId, type, channels, force, recipientEmail } = data;
      const notificationService = new NotificationService(supabaseAdmin);
      const results = await notificationService.sendNotification({
        appointmentId,
        type,
        channels,
        force,
        recipientEmail,
      });
      return { success: true, results };
    } catch (error) {
      console.error("[dispatchNotificationServerFn] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

export type AdminNotificationEvent = "new_booking" | "booking_canceled";

export const dispatchAdminNotificationServerFn = createServerFn({ method: "POST" })
  .validator((data: { appointmentId: string; event: AdminNotificationEvent }) => data)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { createEmailProvider } = await import("@/lib/notifications/providers/email");
      const { WebPushProvider } = await import("@/lib/notifications/providers/push");
      const { getAdminNewBookingEmail, getAdminBookingCanceledEmail } = await import(
        "@/lib/notifications/email-templates"
      );
      const { SERVICES } = await import("@/lib/salon");

      const { appointmentId, event } = data;

      // 1. Fetch appointment details
      const { data: appointment, error: aptError } = await supabaseAdmin
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .maybeSingle();

      if (aptError || !appointment) {
        console.error(`[dispatchAdminNotification] Appointment not found: ${appointmentId}`);
        return { success: false, error: "Appointment not found" };
      }

      // 2. Fetch client email if possible
      let clientEmail: string | null = null;
      if (appointment.user_id) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .eq("id", appointment.user_id)
          .maybeSingle();
        clientEmail = profile?.email || null;
      }

      const serviceInfo = SERVICES.find(
        (s) => s.id === appointment.service_type || s.name === appointment.service_type,
      );
      const serviceName = serviceInfo?.name || appointment.service_type;

      // 3. Find admin recipient emails
      const adminEmails = new Set<string>();
      if (process.env["ADMIN_EMAIL"]) {
        adminEmails.add(process.env["ADMIN_EMAIL"].trim());
      }

      // Query admin roles
      const { data: adminRoles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      const adminUserIds = new Set<string>();
      for (const r of adminRoles || []) {
        adminUserIds.add(r.user_id);
      }

      // For each admin user, get their profile email
      for (const adminId of adminUserIds) {
        const { data: p } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .eq("id", adminId)
          .maybeSingle();
        if (p?.email) adminEmails.add(p.email.trim());
      }

      // 4. Send Emails to Admins
      const emailProvider = createEmailProvider();
      const emailPayloadData = {
        customerName: appointment.client_name,
        customerPhone: appointment.client_phone,
        customerEmail: clientEmail,
        serviceName,
        date: appointment.appointment_date,
        time: appointment.appointment_time.slice(0, 5),
        notes: appointment.notes,
        bookingId: appointment.id,
      };

      const emailTemplate =
        event === "new_booking"
          ? getAdminNewBookingEmail(emailPayloadData)
          : getAdminBookingCanceledEmail(emailPayloadData);

      for (const adminEmail of adminEmails) {
        try {
          await emailProvider.sendEmail({
            to: adminEmail,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          });
        } catch (emailErr) {
          console.error(`[dispatchAdminNotification] Error sending email to ${adminEmail}:`, emailErr);
        }
      }

      // 5. Send Web Push to all Admin registered devices
      const pushProvider = new WebPushProvider();
      const pushPayload =
        event === "new_booking"
          ? {
              title: "תור חדש ממתין לאישורך! 💅",
              body: `${appointment.client_name} קבעה תור ל${serviceName} ב-${appointment.appointment_date} בשעה ${appointment.appointment_time.slice(0, 5)}`,
              url: "/dashboard",
              appointmentId: appointment.id,
              type: "admin_new_booking",
            }
          : {
              title: "לקוחה ביטלה תור ❌",
              body: `${appointment.client_name} ביטלה תור ל${serviceName} ב-${appointment.appointment_date} בשעה ${appointment.appointment_time.slice(0, 5)}`,
              url: "/dashboard",
              appointmentId: appointment.id,
              type: "admin_booking_canceled",
            };

      for (const adminId of adminUserIds) {
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", adminId);

        for (const sub of subs || []) {
          try {
            const pushRes = await pushProvider.sendPush(sub, pushPayload);
            if (pushRes.isExpired) {
              await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
            }
          } catch (pushErr) {
            console.error(`[dispatchAdminNotification] Push error:`, pushErr);
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error("[dispatchAdminNotificationServerFn] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
