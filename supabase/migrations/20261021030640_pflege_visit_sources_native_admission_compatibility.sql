DO $repair$
DECLARE definition text; before_acl aclitem[];
BEGIN
 SELECT pg_get_functiondef(p.oid), p.proacl INTO definition,before_acl
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='care_private' AND p.proname='visit_sources' AND p.pronargs=2;
 IF definition IS NULL THEN RAISE EXCEPTION 'Expected visit_sources signature missing'; END IF;
 IF (length(definition)-length(replace(definition,'(s.admission_id IS NULL OR id=s.admission_id)','')))/length('(s.admission_id IS NULL OR id=s.admission_id)')<>2 THEN
 RAISE EXCEPTION 'Unexpected visit_sources definition; manual review required';
 END IF;
 definition:=replace(definition,'(s.admission_id IS NULL OR id=s.admission_id)',
 '(to_jsonb(s)->>''admission_id'' IS NULL OR id::text=to_jsonb(s)->>''admission_id'')');
 EXECUTE definition;
 IF (SELECT proacl FROM pg_proc WHERE oid='care_private.visit_sources(uuid,uuid)'::regprocedure) IS DISTINCT FROM before_acl THEN
 RAISE EXCEPTION 'Unexpected function privilege change';
 END IF;
END
$repair$;
