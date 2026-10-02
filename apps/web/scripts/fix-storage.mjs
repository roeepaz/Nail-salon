import pg from "pg";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  console.log("Configuring gallery bucket...");
  // 1. Update bucket limits: 25MB limit and allow all image types (null allowed_mime_types)
  await client.query(`
    UPDATE storage.buckets 
    SET file_size_limit = 26214400,
        allowed_mime_types = NULL,
        public = true
    WHERE id = 'gallery';
  `);

  // 2. Create is_admin helper function
  await client.query(`
    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      );
    $$;
    GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;
  `);

  // 3. Setup RLS policies on storage.objects
  await client.query(`
    DROP POLICY IF EXISTS "gallery_public_read" ON storage.objects;
    DROP POLICY IF EXISTS "gallery_admin_insert" ON storage.objects;
    DROP POLICY IF EXISTS "gallery_admin_update" ON storage.objects;
    DROP POLICY IF EXISTS "gallery_admin_delete" ON storage.objects;
    DROP POLICY IF EXISTS "gallery_auth_insert" ON storage.objects;
    DROP POLICY IF EXISTS "gallery_auth_update" ON storage.objects;
    DROP POLICY IF EXISTS "gallery_auth_delete" ON storage.objects;

    -- Public read
    CREATE POLICY "gallery_public_read" ON storage.objects
      FOR SELECT USING (bucket_id = 'gallery');

    -- Authenticated insert (admin or authenticated)
    CREATE POLICY "gallery_auth_insert" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'gallery' AND auth.role() = 'authenticated'
      );

    -- Authenticated update
    CREATE POLICY "gallery_auth_update" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'gallery' AND auth.role() = 'authenticated'
      ) WITH CHECK (
        bucket_id = 'gallery' AND auth.role() = 'authenticated'
      );

    -- Authenticated delete
    CREATE POLICY "gallery_auth_delete" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'gallery' AND auth.role() = 'authenticated'
      );
  `);

  console.log("✅ Storage policies and bucket updated successfully!");

  // Verify
  const bucketRes = await client.query("SELECT * FROM storage.buckets WHERE id = 'gallery'");
  console.log("Bucket:", bucketRes.rows);

  const polRes = await client.query("SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'storage'");
  console.log("Storage policies:", polRes.rows);

} catch (err) {
  console.error("Error:", err);
} finally {
  await client.end();
}
