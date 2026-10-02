-- Migration: 0003_admin_settings
-- Adds salon_settings, services, and gallery_images tables for admin control panel

-- 1. salon_settings  (key/value config store)
CREATE TABLE IF NOT EXISTS public.salon_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.salon_settings (key, value) VALUES
  ('salon_name',    'אליאל ביוטי'),
  ('salon_address', 'דיזנגוף 120, תל אביב'),
  ('salon_phone',   '050-000-0000'),
  ('salon_tagline', 'סטודיו בוטיק לציפורניים וטיפוח'),
  ('salon_about',   'סטודיו בוטיק לטיפוח ויצירת ציפורניים מושלמות, בריאות ועמידות לאורך זמן.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.salon_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salon_settings_public_read" ON public.salon_settings
  FOR SELECT USING (true);

CREATE POLICY "salon_settings_admin_write" ON public.salon_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 2. services  (dynamic treatment menu)
CREATE TABLE IF NOT EXISTS public.services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  price       TEXT NOT NULL,
  duration    TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order  INT  NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_public_read" ON public.services
  FOR SELECT USING (true);

CREATE POLICY "services_admin_write" ON public.services
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 3. gallery_images
CREATE TABLE IF NOT EXISTS public.gallery_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url        TEXT NOT NULL,
  alt_text   TEXT NOT NULL DEFAULT '',
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gallery_public_read" ON public.gallery_images
  FOR SELECT USING (true);

CREATE POLICY "gallery_admin_write" ON public.gallery_images
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
