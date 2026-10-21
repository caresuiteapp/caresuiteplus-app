-- Convert the stored hook identity to a portable, schema-qualified name.
-- The staged gateway remains disabled. No PostgREST setting, policy or RPC grant changes.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $$
DECLARE v_type oid;
BEGIN
 SELECT a.atttypid INTO v_type FROM pg_attribute a
 WHERE a.attrelid='academy_family_private.gateway_config'::regclass
   AND a.attname='previous_hook' AND NOT a.attisdropped;
 IF v_type='regprocedure'::regtype THEN
  IF EXISTS(SELECT 1 FROM academy_family_private.gateway_config g
    LEFT JOIN pg_proc p ON p.oid=g.previous_hook::oid
    WHERE g.previous_hook IS NOT NULL AND (p.oid IS NULL OR p.pronargs<>0)) THEN
   RAISE EXCEPTION 'Die gespeicherte Anfragesperre ist keine auflösbare parameterlose Funktion.' USING ERRCODE='55000';
  END IF;
  EXECUTE 'ALTER TABLE academy_family_private.gateway_config ALTER COLUMN previous_hook TYPE text
   USING CASE WHEN previous_hook IS NULL THEN NULL
    ELSE (pg_identify_object(''pg_proc''::regclass,previous_hook::oid,0)).identity END';
 ELSIF v_type IS DISTINCT FROM 'text'::regtype THEN
  RAISE EXCEPTION 'Unerwarteter Datentyp der gespeicherten Anfragesperre.' USING ERRCODE='55000';
 END IF;
END $$;
COMMIT;
