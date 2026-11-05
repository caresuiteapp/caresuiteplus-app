DO $target$ BEGIN
 IF NOT EXISTS(SELECT FROM supabase_migrations.schema_migrations WHERE version='20261105061732' AND name='gkv_staging_canonical_sources_and_invoice_bridge' AND encode(sha256(convert_to(statements[1],'UTF8')),'hex')='e88e5d9f44f0ac4e66b00970ace0e02ab519a265a2bc5d01cb7baf1d11107e7a') OR to_regclass('public.gkv_monthly_proofs') IS NOT NULL THEN RAISE EXCEPTION 'Unreviewed staging monthly target'; END IF;
END $target$;
