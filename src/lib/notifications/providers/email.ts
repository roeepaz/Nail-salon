import type { NotificationResult } from "../types";

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface EmailProvider {
  sendEmail(options: EmailSendOptions): Promise<NotificationResult>;
}

export class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private defaultFrom: string;
  private maxRetries: number;

  constructor(apiKey?: string, defaultFrom?: string, maxRetries = 2) {
    this.apiKey = apiKey || process.env["RESEND_API_KEY"] || "";
    this.defaultFrom =
      defaultFrom ||
      process.env["RESEND_FROM_EMAIL"] ||
      "Lumière Nails <onboarding@resend.dev>";
    this.maxRetries = maxRetries;
  }

  async sendEmail(options: EmailSendOptions): Promise<NotificationResult> {
    if (!this.apiKey) {
      return {
        channel: "email",
        status: "skipped",
        errorMessage: "RESEND_API_KEY is not configured.",
      };
    }

    if (!options.to || !options.to.includes("@")) {
      return {
        channel: "email",
        status: "failed",
        errorMessage: "Invalid recipient email address.",
      };
    }

    const payload = {
      from: options.from || this.defaultFrom,
      to: [options.to],
      subject: options.subject,
      html: options.html,
    };

    let attempt = 0;
    let lastError: string | undefined;

    while (attempt <= this.maxRetries) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        const data = (await response.json()) as { id?: string; message?: string; name?: string };

        if (!response.ok) {
          const isTransient = response.status === 429 || response.status >= 500;
          lastError = `Resend API error (${response.status}): ${data.message || response.statusText}`;

          if (isTransient && attempt < this.maxRetries) {
            attempt++;
            const delay = Math.pow(2, attempt) * 500;
            await new Promise((res) => setTimeout(res, delay));
            continue;
          }

          return {
            channel: "email",
            status: "failed",
            errorMessage: lastError,
          };
        }

        return {
          channel: "email",
          status: "sent",
          providerMessageId: data.id,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt < this.maxRetries) {
          attempt++;
          const delay = Math.pow(2, attempt) * 500;
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }

        return {
          channel: "email",
          status: "failed",
          errorMessage: `Network error sending email: ${lastError}`,
        };
      }
    }

    return {
      channel: "email",
      status: "failed",
      errorMessage: lastError || "Failed to send email after retries",
    };
  }
}
