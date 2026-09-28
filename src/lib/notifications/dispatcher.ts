import { dispatchNotificationServerFn } from "@/server/notifications";
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
    await dispatchNotificationServerFn({
      data: { appointmentId, type },
    });
  } catch (err) {
    console.warn("[NotificationDispatcher] Notification dispatch returned non-fatal warning:", err);
  }
}
