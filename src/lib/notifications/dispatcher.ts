import {
  dispatchNotificationServerFn,
  dispatchAdminNotificationServerFn,
  type AdminNotificationEvent,
} from "@/server/notifications";
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

/**
 * Triggers instant alerts to salon manager (email + browser push) when a new appointment is requested
 * or canceled, ensuring the manager is immediately aware and can act.
 */
export async function dispatchAdminNotification(
  appointmentId: string,
  event: AdminNotificationEvent,
): Promise<void> {
  try {
    await dispatchAdminNotificationServerFn({
      data: { appointmentId, event },
    });
  } catch (err) {
    console.warn("[NotificationDispatcher] Admin notification dispatch returned non-fatal warning:", err);
  }
}
