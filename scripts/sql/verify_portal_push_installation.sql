-- Read-only. Run as the project administrator after the migration.
SELECT
  to_regclass('public.portal_push_outbox') IS NOT NULL AS warteschlange_vorhanden,
  to_regclass('public.portal_app_releases') IS NOT NULL AS update_freigaben_vorhanden,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='portal_push_devices' AND column_name='app_build_version') AS geraeteversion_vorhanden,
  (SELECT count(*)=6 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('portal_push_visit','portal_push_message','portal_push_proof','portal_push_document','portal_push_notice','portal_push_release')) AS ereignisse_verbunden,
  CASE WHEN to_regprocedure('public.portal_push_claim(integer)') IS NOT NULL THEN NOT has_function_privilege('authenticated','public.portal_push_claim(integer)','EXECUTE') ELSE false END AS portalzugriff_gesperrt;

-- Does not reveal tokens, messages, names, assignment IDs or credentials.
SELECT enabled AS versand_aktiv, worker_token_hash IS NOT NULL AS dienst_geschuetzt
FROM public.portal_push_runtime;
SELECT state AS zustand, count(*) AS anzahl FROM public.portal_push_outbox GROUP BY state ORDER BY state;
