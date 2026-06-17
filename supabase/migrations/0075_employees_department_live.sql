-- ==========================================================================
-- CareSuite+ — Migration 0075: Abteilung (department) auf Live-Schema
-- Live public.employees (FlutterFlow) fehlt department — Abteilungs-Chips
-- aus Katalog employee_department werden nicht persistiert.
-- Idempotent: ADD COLUMN IF NOT EXISTS (sicher für Produktion).
-- ==========================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS department TEXT;

COMMENT ON COLUMN public.employees.department IS 'Abteilung (Katalog employee_department, z. B. assist_aussendienst → Assist / Außendienst)';
