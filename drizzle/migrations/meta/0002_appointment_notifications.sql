-- 0002_appointment_notifications.sql
-- Notification preferences, push subscriptions, notification logs, and business settings

-- 1. Notification Preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  web_push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT true,
  appointment_confirmation boolean NOT NULL DEFAULT true,
  appointment_cancellation boolean NOT NULL DEFAULT true,
  appointment_reminder_24h boolean NOT NULL DEFAULT true,
  appointment_reminder_1h boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_notification_preferences_user_id UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can read own notification preferences" ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own notification preferences" ON public.notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own notification preferences" ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);


-- 2. Push Subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_push_subscriptions_endpoint UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can read own push subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- 3. Notification Logs (Idempotency and tracking)
CREATE TABLE IF NOT EXISTS public.notification_logs (
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

CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON public.notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_appointment_id ON public.notification_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON public.notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON public.notification_logs(created_at DESC);

GRANT SELECT ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notification logs and Admins all" ON public.notification_logs;
CREATE POLICY "Users can view own notification logs and Admins all" ON public.notification_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));


-- 4. Business Notification Settings
CREATE TABLE IF NOT EXISTS public.business_notification_settings (
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

INSERT INTO public.business_notification_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.business_notification_settings TO anon, authenticated;
GRANT ALL ON public.business_notification_settings TO service_role;

ALTER TABLE public.business_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read business notification settings" ON public.business_notification_settings;
CREATE POLICY "Public read business notification settings" ON public.business_notification_settings
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage business notification settings" ON public.business_notification_settings;
CREATE POLICY "Admins manage business notification settings" ON public.business_notification_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- 5. Trigger / Backfill for notification_preferences
CREATE OR REPLACE FUNCTION public.handle_user_notification_preferences()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_preferences ON auth.users;
CREATE TRIGGER on_auth_user_created_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_notification_preferences();

-- Backfill preferences for existing users
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
