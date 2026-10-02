import { normalizePhoneNumber, isValidE164 } from "@/lib/phone-utils";
import type { NotificationResult } from "../types";

export interface WhatsAppProvider {
  sendTemplateMessage(
    phoneNumber: string,
    templateName: string,
    languageCode: string,
    parameters: string[],
  ): Promise<NotificationResult>;
}

export class MetaWhatsAppCloudProvider implements WhatsAppProvider {
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string;
  private maxRetries: number;

  constructor(
    accessToken?: string,
    phoneNumberId?: string,
    apiVersion?: string,
    maxRetries = 2,
  ) {
    this.accessToken = accessToken || process.env["WHATSAPP_ACCESS_TOKEN"] || "";
    this.phoneNumberId = phoneNumberId || process.env["WHATSAPP_PHONE_NUMBER_ID"] || "";
    this.apiVersion = apiVersion || process.env["WHATSAPP_API_VERSION"] || "v21.0";
    this.maxRetries = maxRetries;
  }

  async sendTemplateMessage(
    phoneNumber: string,
    templateName: string,
    languageCode = "en_US",
    parameters: string[] = [],
  ): Promise<NotificationResult> {
    if (!this.accessToken || !this.phoneNumberId) {
      return {
        channel: "whatsapp",
        status: "skipped",
        errorMessage: "WhatsApp credentials (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID) are not configured.",
      };
    }

    const normalizedTo = normalizePhoneNumber(phoneNumber);
    if (!normalizedTo || !isValidE164(normalizedTo)) {
      return {
        channel: "whatsapp",
        status: "failed",
        errorMessage: `Invalid recipient phone number: ${phoneNumber}. Must be valid E.164.`,
      };
    }

    // Meta Cloud API accepts phone number without the leading '+' or with it, but without '+' is standard for Meta Graph API
    const recipientClean = normalizedTo.replace(/^\+/, "");

    const bodyComponents =
      parameters.length > 0
        ? [
            {
              type: "body",
              parameters: parameters.map((param) => ({
                type: "text",
                text: String(param),
              })),
            },
          ]
        : [];

    const requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientClean,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        ...(bodyComponents.length > 0 ? { components: bodyComponents } : {}),
      },
    };

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    let attempt = 0;
    let lastError: string | undefined;

    while (attempt <= this.maxRetries) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify(requestBody),
        });

        const data = (await response.json()) as {
          messages?: Array<{ id: string }>;
          error?: { message: string; code: number; error_subcode?: number };
        };

        if (!response.ok || data.error) {
          const isTransient = response.status === 429 || response.status >= 500;
          const errorMsg = data.error?.message || `WhatsApp Cloud API error (${response.status})`;
          lastError = errorMsg;

          if (isTransient && attempt < this.maxRetries) {
            attempt++;
            const delay = Math.pow(2, attempt) * 500;
            await new Promise((res) => setTimeout(res, delay));
            continue;
          }

          return {
            channel: "whatsapp",
            status: "failed",
            errorMessage: errorMsg,
          };
        }

        const messageId = data.messages && data.messages[0] ? data.messages[0].id : undefined;

        return {
          channel: "whatsapp",
          status: "sent",
          providerMessageId: messageId,
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
          channel: "whatsapp",
          status: "failed",
          errorMessage: `Network error connecting to WhatsApp Cloud API: ${lastError}`,
        };
      }
    }

    return {
      channel: "whatsapp",
      status: "failed",
      errorMessage: lastError || "Failed to send WhatsApp message after retries",
    };
  }
}
