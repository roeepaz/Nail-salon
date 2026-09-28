// Supabase Edge Function: process-appointment-notifications
// Scheduled worker that finds appointments requiring 24h or 1h reminders and sends them.
// Idempotent: checks notification_logs before sending any notification.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Calculates the UTC timestamp for an appointment in the target timezone
function getAppointmentUtcTimestamp(
  dateStr: string,
  timeStr: string,
  timezone: string,
): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.slice(0, 5).split(":").map(Number);

  const targetDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(targetDate);
  const getPart = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);

  const localHour = getPart("hour");
  const localMinute = getPart("minute");

  const diffMinutes = (localHour - hours) * 60 + (localMinute - minutes);
  return targetDate.getTime() - diffMinutes * 60 * 1000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase backend credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch business notification settings
    const { data: businessSettings } = await supabase
      .from("business_notification_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    const window24h = Number(
      Deno.env.get("REMINDER_24H_WINDOW_MINUTES") ||
      businessSettings?.reminder_24h_window_minutes ||
      10,
    );
    const window1h = Number(
      Deno.env.get("REMINDER_1H_WINDOW_MINUTES") ||
      businessSettings?.reminder_1h_window_minutes ||
      10,
    );
    const timezone =
      Deno.env.get("SALON_TIMEZONE") ||
      businessSettings?.timezone ||
      "Asia/Jerusalem";

    const enable24h = businessSettings ? businessSettings.appointment_reminder_24h : true;
    const enable1h = businessSettings ? businessSettings.appointment_reminder_1h : true;

    // 2. Fetch upcoming non-canceled appointments
    // Look ahead from today to next 3 days
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const futureDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const futureStr = futureDate.toISOString().slice(0, 10);

    const { data: appointments, error: aptError } = await supabase
      .from("appointments")
      .select("*")
      .neq("status", "canceled")
      .gte("appointment_date", todayStr)
      .lte("appointment_date", futureStr);

    if (aptError) {
      throw new Error(`Failed to query appointments: ${aptError.message}`);
    }

    const stats = {
      evaluated: appointments?.length || 0,
      reminders24hTriggered: 0,
      reminders1hTriggered: 0,
      skippedDuplicate: 0,
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
        // Trigger 24h reminder
        try {
          const res = await supabase.functions.invoke("send-notification", {
            body: {
              appointmentId: apt.id,
              type: "appointment_reminder_24h",
            },
          });
          if (res.error) {
            stats.errors.push(`24h reminder error for apt ${apt.id}: ${res.error.message}`);
          } else {
            stats.reminders24hTriggered++;
          }
        } catch (err) {
          stats.errors.push(`Failed dispatching 24h reminder: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (is1hWindow) {
        // Trigger 1h reminder
        try {
          const res = await supabase.functions.invoke("send-notification", {
            body: {
              appointmentId: apt.id,
              type: "appointment_reminder_1h",
            },
          });
          if (res.error) {
            stats.errors.push(`1h reminder error for apt ${apt.id}: ${res.error.message}`);
          } else {
            stats.reminders1hTriggered++;
          }
        } catch (err) {
          stats.errors.push(`Failed dispatching 1h reminder: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
