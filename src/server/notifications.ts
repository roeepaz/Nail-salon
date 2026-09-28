import { createServerFn } from "@tanstack/react-start";
import type { NotificationType } from "@/lib/notifications/types";

export const dispatchNotificationServerFn = createServerFn({ method: "POST" })
  .validator((data: { appointmentId: string; type: NotificationType }) => data)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { NotificationService } = await import("@/lib/notifications/service");

      const { appointmentId, type } = data;
      const notificationService = new NotificationService(supabaseAdmin);
      const results = await notificationService.sendNotification({
        appointmentId,
        type,
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
