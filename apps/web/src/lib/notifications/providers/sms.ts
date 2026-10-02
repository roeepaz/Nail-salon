import type { NotificationResult } from "../types";

export interface SmsSendOptions {
  to: string;
  message: string;
  sender?: string;
}

export interface SmsProvider {
  sendSms(options: SmsSendOptions): Promise<NotificationResult>;
}

export function normalizeIsraeliPhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) {
    digits = "0" + digits.slice(3);
  }
  if (digits.length === 9 && digits.startsWith("5")) {
    digits = "0" + digits;
  }
  return digits;
}

export class Sms4FreeProvider implements SmsProvider {
  private key: string;
  private user: string;
  private pass: string;
  private sender: string;

  constructor(key?: string, user?: string, pass?: string, sender?: string) {
    this.key = (key || process.env["SMS4FREE_KEY"] || "7cy68YLip").trim();
    this.user = (user || process.env["SMS4FREE_USER"] || "0547968774").trim();
    this.pass = (pass || process.env["SMS4FREE_PASS"] || "").trim();
    this.sender = (sender || process.env["SMS4FREE_SENDER"] || "0547968774").trim();
  }

  async sendSms(options: SmsSendOptions): Promise<NotificationResult> {
    if (!this.pass) {
      return {
        channel: "sms",
        status: "skipped",
        errorMessage: "סיסמת SMS4Free (SMS4FREE_PASS) אינה מוגדרת ב-.env",
      };
    }

    const recipient = normalizeIsraeliPhone(options.to);
    if (!recipient || recipient.length !== 10 || !recipient.startsWith("05")) {
      return {
        channel: "sms",
        status: "failed",
        errorMessage: `מספר טלפון לא תקין לשליחת SMS: ${options.to}`,
      };
    }

    try {
      const response = await fetch("https://api.sms4free.co.il/ApiSMS/v2/SendSMS", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: this.key,
          user: this.user,
          pass: this.pass,
          sender: options.sender || this.sender,
          recipient,
          msg: options.message,
        }),
      });

      if (!response.ok) {
        return {
          channel: "sms",
          status: "failed",
          errorMessage: `שגיאת שרת SMS4Free: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json().catch(() => null);

      // Status response check:
      // In SMS4Free, positive number or 0 or message containing success indicates sent.
      const statusNum = Number(data?.status);
      const isFailed = statusNum < 0 || String(data?.status) === "-1";

      if (!isFailed && data) {
        return {
          channel: "sms",
          status: "sent",
          providerMessageId: String(data?.status ?? "OK"),
        };
      }

      return {
        channel: "sms",
        status: "failed",
        errorMessage: `SMS4Free error: ${data?.message || JSON.stringify(data)} (status: ${data?.status})`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        channel: "sms",
        status: "failed",
        errorMessage: `שגיאה בשליחת SMS: ${msg}`,
      };
    }
  }
}
