-- CareSuite+ 0266 — administrative Nachbearbeitung live reparieren.
-- Root cause: einzelne produktive Schema-Generationen besitzen assist_visits.updated_by
-- nicht, während die RPCs aus 0255 diese Spalte bei jeder Änderung schreiben.

ALTER TABLE public.assist_visits
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

GRANT SELECT, UPDATE ON public.assist_visits TO authenticated;

-- Die Nachbearbeitung bleibt revisionssicher. Die Oberfläche liefert ab jetzt
-- automatisch diesen technischen Auditgrund; eine manuelle Pflichtbegründung
-- ist für normale administrative Korrekturen nicht mehr erforderlich.
COMMENT ON COLUMN public.assist_visits.updated_by IS
  'Letztes änderndes Profil; Live-Schema-Reparatur für administrative Nachbearbeitung.';

-- RPC-Rechte explizit wiederherstellen, falls ein älterer Remote-Apply die
-- Funktionen zwar angelegt, die Grants aber nicht vollständig übernommen hat.
REVOKE ALL ON FUNCTION public.admin_correct_assist_visit_times(
  UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ,
  INTEGER, INTEGER, TEXT, BOOLEAN
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_request_assist_visit_signature(UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_append_assist_visit_documentation(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_assist_visit_task(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_complete_assist_visit_follow_up(UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_bulk_update_assist_visit_tasks(UUID, JSONB, TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_correct_assist_visit_times(
  UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ,
  INTEGER, INTEGER, TEXT, BOOLEAN
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_request_assist_visit_signature(UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_append_assist_visit_documentation(UUID, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_assist_visit_task(UUID, UUID, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_assist_visit_follow_up(UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bulk_update_assist_visit_tasks(UUID, JSONB, TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
