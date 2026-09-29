-- Add end_time to blocked_slots to support blocking ranges of hours within a date
ALTER TABLE public.blocked_slots ADD COLUMN IF NOT EXISTS end_time time;

DROP INDEX IF EXISTS public.blocked_slots_unique;

CREATE UNIQUE INDEX IF NOT EXISTS blocked_slots_unique ON public.blocked_slots (
  block_date,
  COALESCE(block_time, '00:00:00'::time),
  COALESCE(end_time, '00:00:00'::time),
  (block_time IS NULL)
);
