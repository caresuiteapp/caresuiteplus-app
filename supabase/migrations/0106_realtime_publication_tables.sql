-- Enable Supabase Realtime for portal, client, office, and audit tables.
-- Idempotent: only adds tables not already in supabase_realtime publication.

DO $$
DECLARE
  tbl text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;
  END IF;

  FOR tbl IN
    SELECT unnest(ARRAY[
      'portal_requests',
      'portal_activities',
      'portal_uploads',
      'client_documents',
      'clients',
      'employees',
      'invoices',
      'appointments',
      'assignments',
      'audit_logs',
      'notifications'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
