-- Drop the unconditional unique constraint on (appointment_date, appointment_time)
-- which was preventing re-booking of slots where previous appointments were canceled.
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_appointment_date_appointment_time_key;

-- Create partial unique index ensuring slot uniqueness ONLY for active (non-canceled) appointments
CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_slot_unique 
ON public.appointments (appointment_date, appointment_time) 
WHERE status <> 'canceled';
