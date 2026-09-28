export type NotificationChannel = "push" | "email" | "whatsapp";

export type NotificationType =
  | "appointment_confirmation"
  | "appointment_cancellation"
  | "appointment_reminder_24h"
  | "appointment_reminder_1h";

export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";

export interface NotificationResult {
  channel: NotificationChannel;
  status: NotificationStatus;
  providerMessageId?: string | undefined;
  errorMessage?: string | undefined;
}

export interface SendNotificationOptions {
  userId?: string | null | undefined;
  appointmentId: string;
  type: NotificationType;
  channels?: NotificationChannel[] | undefined;
  recipientEmail?: string | null | undefined;
  recipientPhone?: string | null | undefined;
  customerName?: string | undefined;
  serviceName?: string | undefined;
  appointmentDate?: string | undefined;
  appointmentTime?: string | undefined;
  force?: boolean | undefined;
}

export interface AppointmentNotificationData {
  id: string;
  userId: string | null;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  serviceType: string;
  appointmentDate: string;
  appointmentTime: string;
  notes?: string | null;
  status: string;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
}
