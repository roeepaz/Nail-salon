import type { NotificationResult } from "../types";

export interface PushSubscriptionRecord {
  id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  type?: string;
  appointmentId?: string;
}

export interface PushProvider {
  sendPush(
    subscription: PushSubscriptionRecord,
    payload: PushPayload,
  ): Promise<{ success: boolean; isExpired?: boolean; error?: string }>;
}

export class WebPushProvider implements PushProvider {
  private vapidSubject: string;
  private vapidPublicKey: string;
  private vapidPrivateKey: string;

  constructor(vapidSubject?: string, vapidPublicKey?: string, vapidPrivateKey?: string) {
    this.vapidSubject = vapidSubject || process.env["VAPID_SUBJECT"] || "mailto:admin@lumierenails.com";
    this.vapidPublicKey = vapidPublicKey || process.env["VAPID_PUBLIC_KEY"] || "";
    this.vapidPrivateKey = vapidPrivateKey || process.env["VAPID_PRIVATE_KEY"] || "";
  }

  async sendPush(
    subscription: PushSubscriptionRecord,
    payload: PushPayload,
  ): Promise<{ success: boolean; isExpired?: boolean; error?: string }> {
    if (!subscription.endpoint) {
      return { success: false, error: "Missing subscription endpoint" };
    }

    try {
      // In standard Web Push, sending encrypted payload requires VAPID authorization
      // If VAPID private key is available, we dispatch to push endpoint
      // If endpoint returns 404 Not Found or 410 Gone, it is expired and must be purged
      const body = JSON.stringify(payload);

      // Attempt sending directly or via Supabase Edge Function push proxy
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        TTL: "86400",
      };

      if (this.vapidPublicKey) {
        headers["Crypto-Key"] = `p256ecdsa=${this.vapidPublicKey}`;
      }

      const res = await fetch(subscription.endpoint, {
        method: "POST",
        headers,
        body,
      });

      if (res.status === 404 || res.status === 410) {
        return { success: false, isExpired: true, error: `Subscription expired (${res.status})` };
      }

      if (!res.ok && res.status !== 201 && res.status !== 200) {
        return { success: false, error: `Push service rejected notification (${res.status})` };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
