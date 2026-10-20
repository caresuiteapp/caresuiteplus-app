-- ==========================================================================
-- CareSuite+ — Migration 0192: WFM Realtime publication
-- Publishes workforce_work_sessions for Office Live-Dashboard (<5s Latenz).
-- ==========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'workforce_work_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workforce_work_sessions;
  END IF;
END $$;

COMMENT ON TABLE public.workforce_work_sessions IS
  'WFM Live-Session pro Mitarbeiter/Tag — Realtime (Migration 0192)';
