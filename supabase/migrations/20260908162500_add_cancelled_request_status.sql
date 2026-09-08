-- Employees may cancel requests that are still pending approval.
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'cancelled';
