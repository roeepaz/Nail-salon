import assert from "node:assert/strict";
import {
  evaluateAppointmentReminder,
  getAppointmentUtcTimestamp,
} from "../src/lib/notifications/scheduler";
import { NotificationService } from "../src/lib/notifications/service";
import { normalizePhoneNumber, isValidE164 } from "../src/lib/phone-utils";
import type {
  EmailProvider,
  EmailSendOptions,
} from "../src/lib/notifications/providers/email";
import type {
  WhatsAppProvider,
} from "../src/lib/notifications/providers/whatsapp";
import type {
  PushProvider,
  PushSubscriptionRecord,
  PushPayload,
} from "../src/lib/notifications/providers/push";
import type { NotificationResult } from "../src/lib/notifications/types";

// In-memory Mock Supabase Client for testing business logic, preferences, and idempotency
class MockSupabaseClient {
  public notificationLogs: any[] = [];
  public appointments: any[] = [];
  public profiles: any[] = [];
  public preferences: any[] = [];
  public businessSettings: any = {
    id: "default",
    appointment_confirmation: true,
    appointment_cancellation: true,
    appointment_reminder_24h: true,
    appointment_reminder_1h: true,
  };
  public pushSubscriptions: any[] = [];

  from(table: string) {
    const self = this;
    return {
      select: (_cols?: string) => ({
        eq: (col: string, val: any) => ({
          eq: (col2: string, val2: any) => ({
            eq: (col3: string, val3: any) => ({
              maybeSingle: async () => {
                const item = (self as any)[self.getTableName(table)]?.find(
                  (r: any) => r[col] === val && r[col2] === val2 && r[col3] === val3,
                );
                return { data: item || null, error: null };
              },
            }),
            maybeSingle: async () => {
              const item = (self as any)[self.getTableName(table)]?.find(
                (r: any) => r[col] === val && r[col2] === val2,
              );
              return { data: item || null, error: null };
            },
          }),
          maybeSingle: async () => {
            if (table === "business_notification_settings") {
              return { data: self.businessSettings, error: null };
            }
            const item = (self as any)[self.getTableName(table)]?.find(
              (r: any) => r[col] === val,
            );
            return { data: item || null, error: null };
          },
          then: (resolve: any) => {
            const items = (self as any)[self.getTableName(table)]?.filter(
              (r: any) => r[col] === val,
            );
            resolve({ data: items || [], error: null });
          },
        }),
      }),
      upsert: async (record: any) => {
        const tableName = self.getTableName(table);
        const list = (self as any)[tableName] as any[];
        if (table === "notification_logs") {
          const idx = list.findIndex(
            (r) =>
              r.appointment_id === record.appointment_id &&
              r.type === record.type &&
              r.channel === record.channel,
          );
          if (idx >= 0) {
            list[idx] = { ...list[idx], ...record };
          } else {
            list.push({ id: `log-${Date.now()}-${Math.random()}`, ...record });
          }
        }
        return { data: record, error: null };
      },
      delete: () => ({
        eq: (col: string, val: any) => ({
          eq: async () => ({ error: null }),
        }),
      }),
    };
  }

  private getTableName(t: string): string {
    if (t === "notification_logs") return "notificationLogs";
    if (t === "appointments") return "appointments";
    if (t === "profiles") return "profiles";
    if (t === "notification_preferences") return "preferences";
    if (t === "push_subscriptions") return "pushSubscriptions";
    return t;
  }
}

async function runTests() {
  console.log("=== RUNNING NOTIFICATION SYSTEM TEST SUITE ===\n");

  // ---------------------------------------------------------
  // TEST 1: Scheduling & Window Calculations
  // ---------------------------------------------------------
  console.log("TEST 1: Reminder Scheduling & Window Calculations");

  const baseDate = new Date("2026-10-15T10:00:00Z");

  // 1a: Appointment 25 hours away -> NO 24h reminder yet
  const apt25h = {
    id: "apt-25h",
    appointment_date: "2026-10-16",
    appointment_time: "11:00",
    status: "confirmed",
    user_id: "user-1",
    client_name: "Sarah Test",
    client_phone: "0501234567",
  };
  const decision25h = evaluateAppointmentReminder(apt25h, {
    now: baseDate,
    windowMinutes24h: 10,
    windowMinutes1h: 10,
    timezone: "UTC",
  });
  assert.strictEqual(
    decision25h.send24hReminder,
    false,
    "Appointment 25h away should NOT trigger 24h reminder",
  );
  console.log("  ✓ 25 hours away -> no 24h reminder");

  // 1b: Appointment 24 hours away -> SEND 24h reminder
  const apt24h = {
    id: "apt-24h",
    appointment_date: "2026-10-16",
    appointment_time: "10:00",
    status: "confirmed",
    user_id: "user-1",
    client_name: "Sarah Test",
    client_phone: "0501234567",
  };
  const decision24h = evaluateAppointmentReminder(apt24h, {
    now: baseDate,
    windowMinutes24h: 10,
    windowMinutes1h: 10,
    timezone: "UTC",
  });
  assert.strictEqual(
    decision24h.send24hReminder,
    true,
    "Appointment exactly 24h away SHOULD trigger 24h reminder",
  );
  console.log("  ✓ 24 hours away -> triggers 24h reminder");

  // 1c: Appointment 1 hour away -> SEND 1h reminder
  const apt1h = {
    id: "apt-1h",
    appointment_date: "2026-10-15",
    appointment_time: "11:00",
    status: "confirmed",
    user_id: "user-1",
    client_name: "Sarah Test",
    client_phone: "0501234567",
  };
  const decision1h = evaluateAppointmentReminder(apt1h, {
    now: baseDate,
    windowMinutes24h: 10,
    windowMinutes1h: 10,
    timezone: "UTC",
  });
  assert.strictEqual(
    decision1h.send1hReminder,
    true,
    "Appointment 1h away SHOULD trigger 1h reminder",
  );
  console.log("  ✓ 1 hour away -> triggers 1h reminder");

  // 1d: Canceled appointment -> NO reminder
  const aptCanceled = { ...apt24h, status: "canceled" };
  const decisionCanceled = evaluateAppointmentReminder(aptCanceled, {
    now: baseDate,
    timezone: "UTC",
  });
  assert.strictEqual(decisionCanceled.send24hReminder, false);
  assert.strictEqual(decisionCanceled.send1hReminder, false);
  console.log("  ✓ Canceled appointments are skipped");

  // ---------------------------------------------------------
  // TEST 2: Duplicate Prevention & Idempotency
  // ---------------------------------------------------------
  console.log("\nTEST 2: Duplicate Prevention & Idempotency");

  const mockDb = new MockSupabaseClient();
  mockDb.appointments.push({
    id: "apt-idem-1",
    user_id: "user-1",
    client_name: "Rachel Green",
    client_phone: "0501234567",
    service_type: "Gel Polish",
    appointment_date: "2026-10-20",
    appointment_time: "14:00",
    status: "confirmed",
  });
  mockDb.profiles.push({
    id: "user-1",
    full_name: "Rachel Green",
    phone: "+972501234567",
    email: "rachel@example.com",
  });

  let emailSendCount = 0;
  const mockEmailProvider: EmailProvider = {
    sendEmail: async (_opt: EmailSendOptions): Promise<NotificationResult> => {
      emailSendCount++;
      return { channel: "email", status: "sent", providerMessageId: `msg-${emailSendCount}` };
    },
  };

  let waSendCount = 0;
  const mockWaProvider: WhatsAppProvider = {
    sendTemplateMessage: async (): Promise<NotificationResult> => {
      waSendCount++;
      return { channel: "whatsapp", status: "sent", providerMessageId: `wa-${waSendCount}` };
    },
  };

  const mockPushProvider: PushProvider = {
    sendPush: async (): Promise<{ success: boolean }> => ({ success: true }),
  };

  const notificationService = new NotificationService(
    mockDb as any,
    mockEmailProvider,
    mockWaProvider,
    mockPushProvider,
  );

  // First run: should send notification
  const firstRun = await notificationService.sendNotification({
    appointmentId: "apt-idem-1",
    type: "appointment_confirmation",
    channels: ["email", "whatsapp"],
  });

  assert.strictEqual(emailSendCount, 1, "First run should send 1 email");
  assert.strictEqual(waSendCount, 1, "First run should send 1 WhatsApp message");
  assert.strictEqual(firstRun.every((r) => r.status === "sent"), true);

  // Second run immediately following (e.g. scheduler runs again 5 minutes later):
  const secondRun = await notificationService.sendNotification({
    appointmentId: "apt-idem-1",
    type: "appointment_confirmation",
    channels: ["email", "whatsapp"],
  });

  assert.strictEqual(
    emailSendCount,
    1,
    "Second run must NOT send duplicate email (must be idempotent)",
  );
  assert.strictEqual(
    waSendCount,
    1,
    "Second run must NOT send duplicate WhatsApp message (must be idempotent)",
  );
  assert.strictEqual(
    secondRun.every((r) => r.status === "skipped"),
    true,
    "Second run results must be marked as skipped",
  );
  console.log("  ✓ Exactly 1 notification sent across 2 runs (0 duplicates)");

  // ---------------------------------------------------------
  // TEST 3: Notification Preferences
  // ---------------------------------------------------------
  console.log("\nTEST 3: User Notification Preferences");

  // User with email disabled
  mockDb.preferences.push({
    id: "pref-user-2",
    user_id: "user-2",
    web_push_enabled: true,
    email_enabled: false, // DISABLED
    whatsapp_enabled: true,
    appointment_confirmation: true,
    appointment_cancellation: true,
    appointment_reminder_24h: true,
    appointment_reminder_1h: true,
  });
  mockDb.appointments.push({
    id: "apt-user-2",
    user_id: "user-2",
    client_name: "Monica Geller",
    client_phone: "0529998877",
    service_type: "Structure Gel",
    appointment_date: "2026-10-22",
    appointment_time: "10:00",
    status: "confirmed",
  });
  mockDb.profiles.push({
    id: "user-2",
    full_name: "Monica Geller",
    phone: "+972529998877",
    email: "monica@example.com",
  });

  const emailCallsBefore = emailSendCount;
  const prefResults = await notificationService.sendNotification({
    appointmentId: "apt-user-2",
    type: "appointment_confirmation",
    channels: ["email", "whatsapp"],
  });

  assert.strictEqual(
    emailSendCount,
    emailCallsBefore,
    "Email provider must not be called when email_enabled is false",
  );
  const emailResult = prefResults.find((r) => r.channel === "email");
  assert.strictEqual(emailResult?.status, "skipped");
  console.log("  ✓ email_enabled = false respects user preference (email skipped)");

  // ---------------------------------------------------------
  // TEST 4: Provider Failure Isolation
  // ---------------------------------------------------------
  console.log("\nTEST 4: Provider Failure Isolation");

  // Create a service where WhatsApp throws a provider error
  const failingWaProvider: WhatsAppProvider = {
    sendTemplateMessage: async (): Promise<NotificationResult> => {
      return {
        channel: "whatsapp",
        status: "failed",
        errorMessage: "Meta Graph API 500: Internal server error",
      };
    },
  };

  const resilientService = new NotificationService(
    mockDb as any,
    mockEmailProvider,
    failingWaProvider,
    mockPushProvider,
  );

  mockDb.appointments.push({
    id: "apt-resilient-1",
    user_id: "user-1",
    client_name: "Phoebe Buffay",
    client_phone: "0541112233",
    service_type: "Pedicure",
    appointment_date: "2026-10-25",
    appointment_time: "15:00",
    status: "confirmed",
  });

  const failureResults = await resilientService.sendNotification({
    appointmentId: "apt-resilient-1",
    type: "appointment_confirmation",
    channels: ["email", "whatsapp"],
  });

  const waRes = failureResults.find((r) => r.channel === "whatsapp");
  const emRes = failureResults.find((r) => r.channel === "email");

  assert.strictEqual(waRes?.status, "failed");
  assert.strictEqual(emRes?.status, "sent", "Email should still succeed even if WhatsApp fails");
  console.log("  ✓ WhatsApp failure is gracefully handled, email still succeeds");

  // ---------------------------------------------------------
  // TEST 5: Phone Number Normalization & E.164 Validation
  // ---------------------------------------------------------
  console.log("\nTEST 5: Phone Number Normalization & E.164");

  assert.strictEqual(normalizePhoneNumber("050-123-4567"), "+972501234567");
  assert.strictEqual(normalizePhoneNumber("0501234567"), "+972501234567");
  assert.strictEqual(normalizePhoneNumber("+972501234567"), "+972501234567");
  assert.strictEqual(normalizePhoneNumber("972501234567"), "+972501234567");
  assert.strictEqual(normalizePhoneNumber("+1 (555) 234-5678"), "+15552345678");

  assert.strictEqual(isValidE164("+972501234567"), true);
  assert.strictEqual(isValidE164("+15552345678"), true);
  assert.strictEqual(isValidE164("0501234567"), false);
  assert.strictEqual(isValidE164("invalid"), false);
  console.log("  ✓ Phone normalization converts local format to valid E.164 (+972...)");

  // ---------------------------------------------------------
  // TEST 6: Security Verification (Zero Client Secrets)
  // ---------------------------------------------------------
  console.log("\nTEST 6: Security Verification");

  const forbiddenClientKeys = [
    "VITE_RESEND_API_KEY",
    "VITE_WHATSAPP_ACCESS_TOKEN",
    "VITE_SUPABASE_SERVICE_ROLE_KEY",
    "VITE_VAPID_PRIVATE_KEY",
  ];

  for (const key of forbiddenClientKeys) {
    assert.strictEqual(
      process.env[key],
      undefined,
      `Security violation: ${key} must NEVER be defined or exposed to client`,
    );
  }
  console.log("  ✓ Zero server credentials or service keys exposed in client env");

  console.log("\n=== ALL NOTIFICATION SYSTEM TESTS PASSED SUCCESSFULLY! ===\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
