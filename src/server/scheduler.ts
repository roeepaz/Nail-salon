import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { NotificationService } from "@/lib/notifications/service";
import { getAppointmentUtcTimestamp } from "@/lib/notifications/scheduler";

export const runReminderSchedulerFn = createServerFn({ method: "POST" }).handler(async () => {
  try {
    // 1. Fetch business notification settings
    const { data: businessSettings } = await supabaseAdmin
      .from("business_notification_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    const window24h = Number(
      process.env["REMINDER_24H_WINDOW_MINUTES"] ||
      businessSettings?.reminder_24h_window_minutes ||
      10,
    );
    const window1h = Number(
      process.env["REMINDER_1H_WINDOW_MINUTES"] ||
      businessSettings?.reminder_1h_window_minutes ||
      10,
    );
    const timezone =
      process.env["SALON_TIMEZONE"] ||
      businessSettings?.timezone ||
      "Asia/Jerusalem";

    const enable24h = businessSettings ? businessSettings.appointment_reminder_24h : true;
    const enable1h = businessSettings ? businessSettings.appointment_reminder_1h : true;

    // 2. Fetch upcoming non-canceled appointments
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const futureDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const futureStr = futureDate.toISOString().slice(0, 10);

    const { data: appointments, error: aptError } = await supabaseAdmin
      .from("appointments")
      .select("*")
      .neq("status", "canceled")
      .gte("appointment_date", todayStr)
      .lte("appointment_date", futureStr);

    if (aptError) {
      throw new Error(`Failed to query appointments: ${aptError.message}`);
    }

    const notificationService = new NotificationService(supabaseAdmin);
    const stats = {
      evaluated: appointments?.length || 0,
      reminders24hTriggered: 0,
      reminders1hTriggered: 0,
      errors: [] as string[],
    };

    const nowMs = Date.now();

    for (const apt of appointments || []) {
      const aptUtcMs = getAppointmentUtcTimestamp(
        apt.appointment_date,
        apt.appointment_time,
        timezone,
      );

      const diffMs = aptUtcMs - nowMs;
      const diffMinutes = diffMs / (60 * 1000);

      // Check 24-hour reminder (1440 minutes)
      const is24hWindow =
        enable24h &&
        diffMinutes >= 1440 - window24h &&
        diffMinutes <= 1440 + window24h;

      // Check 1-hour reminder (60 minutes)
      const is1hWindow =
        enable1h &&
        diffMinutes >= 60 - window1h &&
        diffMinutes <= 60 + window1h;

      if (is24hWindow) {
        try {
          const res = await notificationService.sendNotification({
            appointmentId: apt.id,
            type: "appointment_reminder_24h",
          });
          const sent = res.some((r) => r.status === "sent");
          if (sent) stats.reminders24hTriggered++;
        } catch (err) {
          stats.errors.push(`24h reminder error for apt ${apt.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (is1hWindow) {
        try {
          const res = await notificationService.sendNotification({
            appointmentId: apt.id,
            type: "appointment_reminder_1h",
          });
          const sent = res.some((r) => r.status === "sent");
          if (sent) stats.reminders1hTriggered++;
        } catch (err) {
          stats.errors.push(`1h reminder error for apt ${apt.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return { success: true, stats };
  } catch (error) {
    console.error("[runReminderSchedulerFn] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
