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
