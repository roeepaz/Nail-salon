import nodemailer from "nodemailer";
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

export class NodemailerEmailProvider implements EmailProvider {
  private host: string;
  private port: number;
  private user: string;
  private pass: string;
  private defaultFrom: string;

  constructor(host?: string, port?: number, user?: string, pass?: string, defaultFrom?: string) {
    this.host = host || process.env["SMTP_HOST"] || "smtp.gmail.com";
    this.port = Number(port || process.env["SMTP_PORT"] || 465);
    this.user = (user || process.env["SMTP_USER"] || "").trim();
    this.pass = (pass || process.env["SMTP_PASS"] || "").trim().replace(/\s+/g, "");
    this.defaultFrom =
      defaultFrom ||
      process.env["SMTP_FROM"] ||
      (this.user ? `אליאל ביוטי <${this.user}>` : "אליאל ביוטי <admin@elielbeauty.co.il>");
  }

  async sendEmail(options: EmailSendOptions): Promise<NotificationResult> {
    if (!this.user || !this.pass) {
      return {
        channel: "email",
        status: "skipped",
        errorMessage: "Gmail SMTP credentials (SMTP_USER / SMTP_PASS) not configured.",
      };
    }

    if (!options.to || !options.to.includes("@")) {
      return {
        channel: "email",
        status: "failed",
        errorMessage: "Invalid recipient email address.",
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.port === 465,
        auth: {
          user: this.user,
          pass: this.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      const info = await transporter.sendMail({
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      return {
        channel: "email",
        status: "sent",
        providerMessageId: info.messageId,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        channel: "email",
        status: "failed",
        errorMessage: `Gmail SMTP error: ${msg}`,
      };
    }
  }
}

export class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private defaultFrom: string;
  private maxRetries: number;

  constructor(apiKey?: string, defaultFrom?: string, maxRetries = 2) {
    this.apiKey =
      apiKey ||
      process.env["RESEND_API_KEY"] ||
      "";
    this.defaultFrom =
      defaultFrom ||
      process.env["RESEND_FROM_EMAIL"] ||
      "אליאל ביוטי <onboarding@resend.dev>";
    this.maxRetries = maxRetries;
  }

  async sendEmail(options: EmailSendOptions): Promise<NotificationResult> {
    if (!this.apiKey) {
      return {
        channel: "email",
        status: "skipped",
        errorMessage: "Neither RESEND_API_KEY nor SMTP_PASS is configured.",
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
          // If custom domain is not verified yet in Resend, automatically fallback to onboarding@resend.dev
          if (
            (response.status === 403 || response.status === 422) &&
            data.message?.toLowerCase().includes("not verified") &&
            payload.from !== "אליאל ביוטי <onboarding@resend.dev>"
          ) {
            console.warn(`[Resend] Domain ${payload.from} unverified, falling back to onboarding@resend.dev`);
            payload.from = "אליאל ביוטי <onboarding@resend.dev>";
            continue;
          }

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

/**
 * Automatically creates the appropriate email provider based on environment variables.
 * If Gmail SMTP or custom SMTP is configured, uses Nodemailer.
 * Otherwise, falls back to Resend.
 */
export function createEmailProvider(): EmailProvider {
  const smtpHost = process.env["SMTP_HOST"] || "";
  const smtpUser = process.env["SMTP_USER"] || "";
  const smtpPass = process.env["SMTP_PASS"] || "";

  // If Gmail or standard SMTP credentials are provided (and not resend default)
  if (
    smtpHost.includes("gmail") ||
    (smtpUser.includes("@") && !smtpUser.includes("resend") && smtpPass.length > 0)
  ) {
    return new NodemailerEmailProvider();
  }

  return new ResendEmailProvider();
}
