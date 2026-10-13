-- Preserve the installed collector and add the singleton predicate required by safeupdate.
-- No grants, policies, table data or function security attributes are changed here.
DO $observation_safeupdate_fix$
DECLARE
  function_oid oid := to_regprocedure('public.platform_collect_observation(jsonb,uuid,text)');
  function_definition text;
  old_statement CONSTANT text := 'UPDATE platform_observation_private.collection SET first_event_at=coalesce(first_event_at,now()),last_event_at=now();';
  fixed_statement CONSTANT text := 'UPDATE platform_observation_private.collection SET first_event_at=coalesce(first_event_at,now()),last_event_at=now() WHERE singleton IS TRUE;';
  old_occurrences integer;
  fixed_occurrences integer;
BEGIN
  IF function_oid IS NULL THEN
    RAISE EXCEPTION 'platform_collect_observation is missing; no changes applied';
  END IF;

  function_definition := pg_get_functiondef(function_oid);
  old_occurrences := (length(function_definition) - length(replace(function_definition, old_statement, ''))) / length(old_statement);
  fixed_occurrences := (length(function_definition) - length(replace(function_definition, fixed_statement, ''))) / length(fixed_statement);

  -- Repeating the migration after the exact correction is a harmless no-op.
  IF old_occurrences = 0 AND fixed_occurrences = 1 THEN
    RETURN;
  END IF;

  -- Do not overwrite a changed or otherwise unexpected installed definition.
  IF old_occurrences <> 1 OR fixed_occurrences <> 0 THEN
    RAISE EXCEPTION 'Unexpected platform_collect_observation definition: old statements %, fixed statements %; no changes applied', old_occurrences, fixed_occurrences;
  END IF;

  EXECUTE replace(function_definition, old_statement, fixed_statement);
END;
$observation_safeupdate_fix$;
