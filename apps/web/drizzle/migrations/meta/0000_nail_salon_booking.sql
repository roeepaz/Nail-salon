-- Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;


-- Appointments
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  client_phone text NOT NULL,
  service_type text NOT NULL,
  notes text,
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','canceled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_date, appointment_time)
);
GRANT INSERT ON public.appointments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can book" ON public.appointments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins read appointments" ON public.appointments FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update appointments" ON public.appointments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete appointments" ON public.appointments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Working hours (0 = Sunday .. 6 = Saturday)
CREATE TABLE public.working_hours (
  day_of_week smallint PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
  is_open boolean NOT NULL DEFAULT true,
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '18:00'
);
GRANT SELECT ON public.working_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.working_hours TO authenticated;
GRANT ALL ON public.working_hours TO service_role;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read working hours" ON public.working_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage working hours" ON public.working_hours FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.working_hours (day_of_week, is_open, open_time, close_time) VALUES
  (0, true, '09:00', '18:00'),
  (1, true, '09:00', '18:00'),
  (2, true, '09:00', '18:00'),
  (3, true, '09:00', '18:00'),
  (4, true, '09:00', '18:00'),
  (5, false, '09:00', '14:00'),
  (6, false, '10:00', '18:00');

-- Blocked slots: whole day when block_time is null
CREATE TABLE public.blocked_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_date date NOT NULL,
  block_time time,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX blocked_slots_unique ON public.blocked_slots (block_date, COALESCE(block_time, '00:00'::time), (block_time IS NULL));
GRANT SELECT ON public.blocked_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_slots TO authenticated;
GRANT ALL ON public.blocked_slots TO service_role;
ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read blocked slots" ON public.blocked_slots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage blocked slots" ON public.blocked_slots FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Public-safe view of taken times
CREATE OR REPLACE FUNCTION public.get_taken_times(_date date)
RETURNS TABLE (taken_time time) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT appointment_time FROM public.appointments
  WHERE appointment_date = _date AND status <> 'canceled'
$$;
GRANT EXECUTE ON FUNCTION public.get_taken_times(date) TO anon, authenticated;