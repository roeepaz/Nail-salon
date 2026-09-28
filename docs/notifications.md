# Lumière Nails — Appointment Notification System Documentation

Production-grade, multi-channel appointment notification system supporting **Browser/Web Push Notifications**, **Email (Resend)**, and **Official WhatsApp Business Platform / Cloud API**, with **scheduled reminder workers**, **idempotency & duplicate prevention**, and **strict server-side credential isolation**.

---

## 1. System Architecture

```text
                       +-----------------------------+
                       |        Vite Frontend        |
                       | (Browser Push / UI Settings)|
                       +--------------+--------------+
                                      |
                         Create / Cancel Appointment
                                      |
                                      v
                       +-----------------------------+
                       |      Supabase Postgres      |
                       |  (Appointments & RLS Data)  |
                       +--------------+--------------+
                                      |
            +-------------------------+-------------------------+
            |                                                   |
            v                                                   v
+-----------------------+                           +-----------------------+
|   Edge Function:      |                           |     Edge Function:    |
|   send-notification   |                           |  process-appointment- |
| (Instant confirmation |                           |     notifications     |
|   and cancellation)   |                           |   (Cron every 5m)     |
+-----------+-----------+                           +-----------+-----------+
            |                                                   |
            +-------------------------+-------------------------+
                                      |
              +-----------------------+-----------------------+
              |                       |                       |
              v                       v                       v
      +---------------+       +---------------+       +---------------+
      |   Web Push    |       | Resend Email  |       | Meta WhatsApp |
      |   (VAPID/SW)  |       |  (HTML Email) |       |  (Cloud API)  |
      +---------------+       +---------------+       +---------------+
              |                       |                       |
              +-----------------------+-----------------------+
                                      |
                                      v
                       +-----------------------------+
                       |      notification_logs      |
                       | (Idempotent delivery audit) |
                       +-----------------------------+
```

### Security Boundary
- **Vite Frontend**: Strictly contains only public keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY`). Zero secrets, WhatsApp tokens, or Resend keys are exposed.
- **Backend / Supabase Edge Functions**: Holds privileged operations, private keys (`RESEND_API_KEY`, `WHATSAPP_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`), and handles user permission validation and delivery.

---

## 2. Database Schema

The notification system introduces four core tables managed via Supabase / Drizzle migrations (`drizzle/migrations/meta/0002_appointment_notifications.sql`):

### 1. `notification_preferences`
Controls per-user channel and trigger choices with Row Level Security (RLS).
```sql
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  web_push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  appointment_confirmation boolean NOT NULL DEFAULT true,
  appointment_cancellation boolean NOT NULL DEFAULT true,
  appointment_reminder_24h boolean NOT NULL DEFAULT true,
  appointment_reminder_1h boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 2. `push_subscriptions`
Stores browser Web Push endpoints (multiple per user for multiple devices/browsers).
```sql
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 3. `notification_logs` (Idempotency Engine)
Guarantees duplicate prevention through a composite unique constraint on `(appointment_id, type, channel)`.
```sql
CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('appointment_confirmation', 'appointment_cancellation', 'appointment_reminder_24h', 'appointment_reminder_1h')),
  channel text NOT NULL CHECK (channel IN ('push', 'email', 'whatsapp')),
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT uq_notification_log_idempotent UNIQUE (appointment_id, type, channel)
);
```

### 4. `business_notification_settings`
Studio-level master controls and reminder window configurations.
```sql
CREATE TABLE public.business_notification_settings (
  id text PRIMARY KEY DEFAULT 'default',
  appointment_confirmation boolean NOT NULL DEFAULT true,
  appointment_cancellation boolean NOT NULL DEFAULT true,
  appointment_reminder_24h boolean NOT NULL DEFAULT true,
  appointment_reminder_1h boolean NOT NULL DEFAULT true,
  reminder_24h_window_minutes integer NOT NULL DEFAULT 10,
  reminder_1h_window_minutes integer NOT NULL DEFAULT 10,
  timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 3. How Web Push Works

1. **Permission Request**: Triggered **only** when the user explicitly clicks "Enable browser notifications" in the Notification Settings tab. Never prompted on initial page load.
2. **Registration**: Registers `public/sw.js` at root scope (`/`).
3. **Subscription**:
   - The browser connects to the Push Service using the public VAPID key (`VITE_VAPID_PUBLIC_KEY`).
   - The endpoint and keys (`p256dh`, `auth`) are securely stored in the `push_subscriptions` table for the user.
4. **Push Event**: The service worker receives the push payload, displays an elegant notification with action buttons and custom icons, and on click focuses or opens `/my-bookings`.
5. **Subscription Expiration Cleanup**: When a push service responds with `404 Not Found` or `410 Gone`, the subscription is automatically deleted from `push_subscriptions`.

---

## 4. How to Configure Resend

1. Create a free account at [resend.com](https://resend.com).
2. Generate an API Key under **API Keys** (`re_...`).
3. Add your verified domain (or use `onboarding@resend.dev` for testing).
4. Store the secret in Supabase:
   ```bash
   npx supabase secrets set RESEND_API_KEY="re_your_api_key_here"
   npx supabase secrets set RESEND_FROM_EMAIL="Lumière Nails <appointments@yourdomain.com>"
   ```

---

## 5. How to Configure WhatsApp Business Cloud API

1. Register as a developer on [developers.facebook.com](https://developers.facebook.com).
2. Create an App of type **Business** and add the **WhatsApp** product.
3. In the WhatsApp Getting Started panel:
   - Copy the **Temporary Access Token** (or create a System User with permanent token in Business Manager).
   - Copy the **Phone Number ID**.
4. Configure in Supabase Secrets:
   ```bash
   npx supabase secrets set WHATSAPP_ACCESS_TOKEN="EAAG..."
   npx supabase secrets set WHATSAPP_PHONE_NUMBER_ID="100012345678901"
   npx supabase secrets set WHATSAPP_API_VERSION="v21.0"
   ```

---

## 6. How to Create and Approve WhatsApp Templates

Meta requires pre-approved message templates for business-initiated notifications.

Create the following 4 templates in the **WhatsApp Message Templates** dashboard:

### 1. `appointment_confirmation`
- **Category**: Utility
- **Language**: English (`en_US`)
- **Body Text**:
  ```text
  Hi {{1}}, your appointment for {{2}} on {{3}} at {{4}} has been confirmed at Lumière Nails. We look forward to seeing you!
  ```

### 2. `appointment_reminder_24h`
- **Category**: Utility
- **Body Text**:
  ```text
  Hi {{1}}, friendly reminder that your nail appointment for {{2}} is tomorrow, {{3}} at {{4}}. Please let us know if you need to reschedule.
  ```

### 3. `appointment_reminder_1h`
- **Category**: Utility
- **Body Text**:
  ```text
  Hi {{1}}, your appointment for {{2}} is in 1 hour at {{4}}. We are ready for you at Lumière Nails Studio!
  ```

### 4. `appointment_cancellation`
- **Category**: Utility
- **Body Text**:
  ```text
  Hi {{1}}, your appointment for {{2}} scheduled on {{3}} at {{4}} has been cancelled. You can book a new slot at any time on our website.
  ```

Set environment variable names if using custom template identifiers:
```bash
npx supabase secrets set WHATSAPP_TEMPLATE_CONFIRMATION="appointment_confirmation"
npx supabase secrets set WHATSAPP_TEMPLATE_REMINDER_24H="appointment_reminder_24h"
npx supabase secrets set WHATSAPP_TEMPLATE_REMINDER_1H="appointment_reminder_1h"
npx supabase secrets set WHATSAPP_TEMPLATE_CANCELLATION="appointment_cancellation"
```

---

## 7. How to Configure Supabase Secrets

Set all environment secrets for Supabase Edge Functions:

```bash
npx supabase secrets set \
  RESEND_API_KEY="re_..." \
  RESEND_FROM_EMAIL="Lumière Nails <onboarding@resend.dev>" \
  WHATSAPP_ACCESS_TOKEN="EAAG..." \
  WHATSAPP_PHONE_NUMBER_ID="1000..." \
  WHATSAPP_API_VERSION="v21.0" \
  REMINDER_24H_WINDOW_MINUTES="10" \
  REMINDER_1H_WINDOW_MINUTES="10" \
  SALON_TIMEZONE="Asia/Jerusalem"
```

Verify configured secrets:
```bash
npx supabase secrets list
```

---

## 8. How Scheduled Notifications Work

The automated scheduled notification pipeline runs server-side:

1. **Trigger Interval**: Executed every 5 minutes (via Supabase pg_cron or external scheduler).
2. **Upcoming Appointments**: Evaluates all active, non-canceled appointments in the database.
3. **Timezone Calculation**: Converts `(appointment_date, appointment_time)` accurately to UTC based on the salon's timezone (`Asia/Jerusalem`).
4. **Window Matching**:
   - Checks if appointment is 24 hours away within `±REMINDER_24H_WINDOW_MINUTES`.
   - Checks if appointment is 1 hour away within `±REMINDER_1H_WINDOW_MINUTES`.
5. **Preference & Idempotency Check**:
   - Validates that user preferences allow reminders.
   - Checks `notification_logs` to ensure no reminder has already been sent for `(appointment_id, type, channel)`.
6. **Parallel Dispatch**: Dispatches Web Push, Email, and WhatsApp independently. A failure on WhatsApp does NOT block Email or Push.
7. **Audit Record**: Results are logged in `notification_logs`.

---

## 9. How to Run Locally

### 1. Install dependencies
```bash
npm install
```

### 2. Apply Database Migrations
```bash
npx tsx scripts/migrate.ts
```

### 3. Run Tests
```bash
npx tsx tests/notifications.test.ts
```

### 4. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to view the booking system.

---

## 10. How to Deploy

### 1. Deploy Database Migrations
```bash
npx tsx scripts/migrate.ts
```

### 2. Deploy Supabase Edge Functions
```bash
npx supabase functions deploy send-notification
npx supabase functions deploy process-appointment-notifications
```

### 3. Configure pg_cron for Scheduled Processing
In the Supabase SQL Editor:
```sql
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the processor every 5 minutes
SELECT cron.schedule(
  'process-appointment-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://[your-project-ref].supabase.co/functions/v1/process-appointment-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 4. Build and Deploy Vite Application
```bash
npm run build
```

---

## 11. Troubleshooting Failed Notifications

1. **Inspect Logs in Studio Dashboard**:
   - Go to Studio Dashboard (`/dashboard`) -> **Notifications** tab.
   - View real-time status badges, provider error messages, and message IDs.
2. **Database Query for Failed Notifications**:
   ```sql
   SELECT * FROM public.notification_logs
   WHERE status = 'failed'
   ORDER BY created_at DESC
   LIMIT 20;
   ```
3. **Common Issues**:
   - **Email Skipped**: Missing `RESEND_API_KEY` secret or user has no email address.
   - **WhatsApp Skipped**: Missing `WHATSAPP_ACCESS_TOKEN` or user phone is not in valid E.164 format. The system automatically normalizes local Israeli numbers (`050...` -> `+97250...`).
   - **WhatsApp Template Rejected**: Ensure template names match exactly in Meta Developer Dashboard and environment variables.
   - **Push Denied**: Client blocked notifications in browser settings. Direct them to browser URL lock icon -> Allow notifications.
   - **Duplicate Skipped**: Working as intended. The idempotency guard in `notification_logs` prevented a duplicate send.
