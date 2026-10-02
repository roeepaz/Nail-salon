/**
 * Phone number normalization utilities
 * Validates and converts phone numbers to E.164 international format
 */

export function normalizePhoneNumber(phone: string, defaultCountryCode = "972"): string {
  if (!phone) return "";

  // Strip all non-digit characters except leading plus
  let cleaned = phone.trim().replace(/[^\d+]/g, "");

  // If starts with +, ensure digits follow
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // Remove leading 00 if international format was typed with 00
  if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
    return `+${cleaned}`;
  }

  // Remove local leading 0 (e.g. 0501234567 -> 501234567)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // If already starts with default country code without plus (e.g. 972501234567)
  if (cleaned.startsWith(defaultCountryCode)) {
    return `+${cleaned}`;
  }

  // Otherwise prepend default country code
  return `+${defaultCountryCode}${cleaned}`;
}

export function isValidE164(phone: string): boolean {
  // E.164: + followed by 7 to 15 digits
  return /^\+[1-9]\d{6,14}$/.test(phone);
}
