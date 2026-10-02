-- 0005_sms_notifications.sql
-- Allow 'sms' in notification_logs channel check constraint
ALTER TABLE public.notification_logs DROP CONSTRAINT IF EXISTS notification_logs_channel_check;
ALTER TABLE public.notification_logs ADD CONSTRAINT notification_logs_channel_check 
  CHECK (channel IN ('push', 'email', 'whatsapp', 'sms'));

-- Add sms_enabled to notification_preferences if not exists
ALTER TABLE public.notification_preferences 
  ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT true;
