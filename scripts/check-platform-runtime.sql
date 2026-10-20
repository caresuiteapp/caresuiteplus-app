-- Only new temporary fixtures; no company, account, setting or audit row is changed.
BEGIN;
CREATE TEMP TABLE runtime_settings_fixture(setting_key text PRIMARY KEY,value jsonb NOT NULL CHECK (
  CASE WHEN setting_key IN ('maintenance_mode','allow_new_tenant_signup','registration_enabled')
    THEN jsonb_typeof(value)='boolean'
  WHEN setting_key='platform_notice'
    THEN jsonb_typeof(value)='string' AND char_length(value#>>'{}')<=2000
  ELSE true END));
INSERT INTO pg_temp.runtime_settings_fixture VALUES
 ('maintenance_mode','false'),('allow_new_tenant_signup','true'),('registration_enabled','true'),('platform_notice','""');
CREATE OR REPLACE FUNCTION pg_temp.platform_runtime_fixture()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'platform_forbidden' USING ERRCODE='42501';
  END IF;
  RETURN jsonb_build_object(
    'release','caresuite-platform-runtime-controls-20261007',
    'maintenanceMode',coalesce((SELECT value='true'::jsonb FROM pg_temp.runtime_settings_fixture WHERE setting_key='maintenance_mode'),false),
    'registrationEnabled',coalesce(
      (SELECT value='true'::jsonb FROM pg_temp.runtime_settings_fixture WHERE setting_key='allow_new_tenant_signup'),
      (SELECT value='true'::jsonb FROM pg_temp.runtime_settings_fixture WHERE setting_key='registration_enabled'),true),
    'notice',coalesce((SELECT value#>>'{}' FROM pg_temp.runtime_settings_fixture WHERE setting_key='platform_notice'),'')
  );
END;
$$;

REVOKE ALL ON FUNCTION pg_temp.platform_runtime_fixture() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.platform_runtime_fixture() TO service_role;
GRANT SELECT,UPDATE ON pg_temp.runtime_settings_fixture TO service_role;
DO $schema$
BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO service_role,authenticated',
    (SELECT nspname FROM pg_catalog.pg_namespace WHERE oid=pg_my_temp_schema()));
END;
$schema$;
SET LOCAL ROLE service_role;
DO $check$
DECLARE result jsonb; denials integer:=0;
BEGIN
  result:=pg_temp.platform_runtime_fixture();
  IF result<>jsonb_build_object('release','caresuite-platform-runtime-controls-20261007','maintenanceMode',false,'registrationEnabled',true,'notice','') THEN RAISE EXCEPTION 'runtime_default_projection_failed'; END IF;
  UPDATE pg_temp.runtime_settings_fixture SET value='true' WHERE setting_key='maintenance_mode';
  IF (pg_temp.platform_runtime_fixture()->>'maintenanceMode')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'runtime_maintenance_failed'; END IF;
  UPDATE pg_temp.runtime_settings_fixture SET value='false' WHERE setting_key='allow_new_tenant_signup';
  IF (pg_temp.platform_runtime_fixture()->>'registrationEnabled')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'runtime_registration_legacy_failed'; END IF;
  UPDATE pg_temp.runtime_settings_fixture SET value=to_jsonb('<img src=x onerror=private()>'::text) WHERE setting_key='platform_notice';
  IF pg_temp.platform_runtime_fixture()->>'notice'<>'<img src=x onerror=private()>' THEN RAISE EXCEPTION 'runtime_notice_failed'; END IF;
  BEGIN UPDATE pg_temp.runtime_settings_fixture SET value='"yes"' WHERE setting_key='maintenance_mode'; RAISE EXCEPTION 'accepted_wrong_boolean'; EXCEPTION WHEN check_violation THEN denials:=denials+1; END;
  BEGIN UPDATE pg_temp.runtime_settings_fixture SET value='42' WHERE setting_key='platform_notice'; RAISE EXCEPTION 'accepted_wrong_notice'; EXCEPTION WHEN check_violation THEN denials:=denials+1; END;
  BEGIN UPDATE pg_temp.runtime_settings_fixture SET value=to_jsonb(repeat('x',2001)) WHERE setting_key='platform_notice'; RAISE EXCEPTION 'accepted_long_notice'; EXCEPTION WHEN check_violation THEN denials:=denials+1; END;
  IF denials<>3 THEN RAISE EXCEPTION 'wrong_runtime_constraint_denials'; END IF;
END;
$check$;
RESET ROLE;
DO $acl$
BEGIN
  IF has_function_privilege('anon','pg_temp.platform_runtime_fixture()','EXECUTE') OR has_function_privilege('authenticated','pg_temp.platform_runtime_fixture()','EXECUTE') THEN RAISE EXCEPTION 'runtime_fixture_acl_failed'; END IF;
END;
$acl$;
-- Even an accidental future execute grant must not bypass the service-role guard.
GRANT EXECUTE ON FUNCTION pg_temp.platform_runtime_fixture() TO authenticated;
SET LOCAL ROLE authenticated;
DO $denied$
BEGIN
  BEGIN PERFORM pg_temp.platform_runtime_fixture(); RAISE EXCEPTION 'runtime_role_guard_bypassed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$denied$;
RESET ROLE;
ROLLBACK;
SELECT 'passed; four expected denials' AS verification,
 NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE relnamespace=pg_my_temp_schema() AND relname='runtime_settings_fixture') AS temporary_fixtures_removed;
