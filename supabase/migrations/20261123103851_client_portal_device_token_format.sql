-- The portal login stores hashOpaqueToken as token-sha256:<hex>.
-- Preserve all existing session, tenant, expiry, account and device checks.
DO $migration$
DECLARE
  definition text;
  old_match text := $old$s.session_token IN (encode(extensions.digest(p_portal_session_token,'sha256'),'hex'),p_portal_session_token)$old$;
  new_match text := $new$s.session_token IN ('token-sha256:' || encode(extensions.digest(p_portal_session_token,'sha256'),'hex'),encode(extensions.digest(p_portal_session_token,'sha256'),'hex'),p_portal_session_token)$new$;
BEGIN
  definition := pg_get_functiondef('public.account_security_register_device(text,text,text)'::regprocedure);
  IF position(new_match IN definition) > 0 THEN RETURN; END IF;
  IF position(old_match IN definition) = 0 OR
     (length(definition) - length(replace(definition, old_match, ''))) / length(old_match) <> 1 THEN
    RAISE EXCEPTION 'Device registration token predicate differs from the reviewed baseline';
  END IF;
  EXECUTE replace(definition, old_match, new_match);
END
$migration$;
