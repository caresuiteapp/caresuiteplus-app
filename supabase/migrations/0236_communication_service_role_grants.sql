-- E2E/Audit scripts: service_role needs explicit table GRANTs (RLS bypass alone is insufficient).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'communication_threads') THEN
    GRANT SELECT, INSERT, UPDATE ON public.communication_threads TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'communication_messages') THEN
    GRANT SELECT, INSERT, UPDATE ON public.communication_messages TO service_role;
  END IF;
END $$;
