-- 0001_add_user_profiles.sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles 
  FOR SELECT TO authenticated 
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles 
  FOR UPDATE TO authenticated 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = id);

-- Trigger to automatically create profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users
INSERT INTO public.profiles (id, full_name, phone, email)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', 'Admin User'), 
  COALESCE(raw_user_meta_data->>'phone', ''), 
  COALESCE(email, '')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Add user_id to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update appointment policies
DROP POLICY IF EXISTS "Anyone can book" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can book" ON public.appointments;
CREATE POLICY "Authenticated users can book" ON public.appointments 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can read own appointments and Admins read all" ON public.appointments;
CREATE POLICY "Users can read own appointments and Admins read all" ON public.appointments 
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users update own or Admins update all" ON public.appointments;
CREATE POLICY "Users update own or Admins update all" ON public.appointments 
  FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
