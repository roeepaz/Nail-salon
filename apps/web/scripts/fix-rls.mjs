import pg from "pg";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const sql = `
-- Fix RLS for salon_settings
DROP POLICY IF EXISTS salon_settings_admin_write ON public.salon_settings;
DROP POLICY IF EXISTS salon_settings_public_read ON public.salon_settings;
DROP POLICY IF EXISTS salon_settings_admin_insert ON public.salon_settings;
DROP POLICY IF EXISTS salon_settings_admin_update ON public.salon_settings;
DROP POLICY IF EXISTS salon_settings_admin_delete ON public.salon_settings;

CREATE POLICY salon_settings_public_read ON public.salon_settings
  FOR SELECT USING (true);

CREATE POLICY salon_settings_admin_insert ON public.salon_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY salon_settings_admin_update ON public.salon_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY salon_settings_admin_delete ON public.salon_settings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Fix RLS for services
DROP POLICY IF EXISTS services_admin_write ON public.services;
DROP POLICY IF EXISTS services_public_read ON public.services;
DROP POLICY IF EXISTS services_admin_insert ON public.services;
DROP POLICY IF EXISTS services_admin_update ON public.services;
DROP POLICY IF EXISTS services_admin_delete ON public.services;

CREATE POLICY services_public_read ON public.services
  FOR SELECT USING (true);

CREATE POLICY services_admin_insert ON public.services
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY services_admin_update ON public.services
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY services_admin_delete ON public.services
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Fix RLS for gallery_images
DROP POLICY IF EXISTS gallery_admin_write ON public.gallery_images;
DROP POLICY IF EXISTS gallery_public_read ON public.gallery_images;
DROP POLICY IF EXISTS gallery_admin_insert ON public.gallery_images;
DROP POLICY IF EXISTS gallery_admin_update ON public.gallery_images;
DROP POLICY IF EXISTS gallery_admin_delete ON public.gallery_images;

CREATE POLICY gallery_public_read ON public.gallery_images
  FOR SELECT USING (true);

CREATE POLICY gallery_admin_insert ON public.gallery_images
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY gallery_admin_update ON public.gallery_images
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY gallery_admin_delete ON public.gallery_images
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
`;

try {
  await client.query(sql);
  console.log("✅ RLS policies fixed successfully!");
  
  // Verify policies
  const { rows } = await client.query(`
    SELECT tablename, policyname, cmd 
    FROM pg_policies 
    WHERE tablename IN ('salon_settings','services','gallery_images')
    ORDER BY tablename, policyname
  `);
  console.log("Policies now active:");
  rows.forEach(r => console.log(` ${r.tablename}: ${r.policyname} (${r.cmd})`));
} catch(e) {
  console.error("Error:", e.message);
} finally {
  await client.end();
}
