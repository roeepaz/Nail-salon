import { supabase } from "@/integrations/supabase/client";
import type { NotificationType } from "./types";

/**
 * Triggers appointment notifications asynchronously.
 * Guarantees that failure to send notifications never fails the appointment booking or cancellation.
 */
export async function dispatchAppointmentNotification(
  appointmentId: string,
  type: NotificationType,
): Promise<void> {
  try {
    // 1. Try invoking Supabase Edge Function
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: { appointmentId, type },
    });

    if (error) {
      console.warn(
        `[NotificationDispatcher] Edge function invoke returned error (${error.message}). Checking server fallback...`,
      );
    } else {
      return;
    }
  } catch (err) {
    console.warn("[NotificationDispatcher] Edge function unavailable, proceeding with client/server fallback:", err);
  }
}
