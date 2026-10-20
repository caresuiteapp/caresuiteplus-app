-- Web budget workspace: atomic writes with authenticated tenant scope, audit and replayable receipts.
-- Existing native mutation functions and their behavior are unchanged.
BEGIN;
CREATE SCHEMA IF NOT EXISTS budget_workspace_private;
REVOKE ALL ON SCHEMA budget_workspace_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS budget_workspace_private.receipts (
 request_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 auth_user_id uuid NOT NULL,
 action text NOT NULL,
 input jsonb NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS budget_workspace_receipts_client ON budget_workspace_private.receipts(tenant_id,client_id,created_at);
ALTER TABLE budget_workspace_private.receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON budget_workspace_private.receipts FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION budget_workspace_private.actor(p_tenant uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; n integer;
BEGIN
 IF auth.uid() IS NULL OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_tenant_id()
  OR coalesce(public.current_role_key(),'') IN ('','employee_portal','client_portal','family_portal','relative_portal')
  OR NOT coalesce(public.has_permission('clients.budgets.edit') OR public.has_permission('clients.billing_profile.edit') OR public.has_permission('office.clients.edit'),false)
 THEN RAISE EXCEPTION 'Keine Berechtigung zum Ändern der Budgets.' USING ERRCODE='42501'; END IF;
 SELECT count(*),min(p.id::text)::uuid INTO n,actor FROM public.profiles p
 WHERE p.tenant_id=p_tenant AND (p.auth_user_id=auth.uid() OR (p.auth_user_id IS NULL AND p.id=auth.uid()))
  AND p.is_active AND p.status::text='active' AND p.locked_at IS NULL;
 IF n<>1 THEN RAISE EXCEPTION 'Kein eindeutiges aktives Verwaltungsprofil.' USING ERRCODE='42501'; END IF;
 RETURN actor;
END $$;
REVOKE ALL ON FUNCTION budget_workspace_private.actor(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION budget_workspace_private.valid_date(value text)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE parsed date;
BEGIN
 IF value IS NULL OR value !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Ungültiges Datum.' USING ERRCODE='22023'; END IF;
 parsed:=value::date;
 IF parsed<DATE '1995-01-01' OR parsed>DATE '2200-12-31' OR to_char(parsed,'YYYY-MM-DD')<>value THEN
  RAISE EXCEPTION 'Ungültiges Datum.' USING ERRCODE='22023'; END IF;
 RETURN parsed;
END $$;
REVOKE ALL ON FUNCTION budget_workspace_private.valid_date(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION budget_workspace_private.amount(value jsonb, allow_negative boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE amount numeric;
BEGIN
 IF value IS NULL OR jsonb_typeof(value)<>'number' OR value::text !~ '^-?[0-9]+$' THEN
  RAISE EXCEPTION 'Beträge müssen ganze Centwerte sein.' USING ERRCODE='22023'; END IF;
 amount:=value::text::numeric;
 IF abs(amount)>9007199254740991 OR (NOT allow_negative AND amount<0) THEN
  RAISE EXCEPTION 'Betrag außerhalb des zulässigen Bereichs.' USING ERRCODE='22023'; END IF;
 RETURN amount::bigint;
END $$;
REVOKE ALL ON FUNCTION budget_workspace_private.amount(jsonb,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION budget_workspace_private.applicable(grade text, t public.budget_template_catalog, sources text[], conversion boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(t.is_active AND
  CASE WHEN grade IN ('kein','hospiz') THEN t.catalog_key IN ('selbstzahler','kulanz','ungeklaert')
   WHEN grade IN ('pg1','pg2','pg3','pg4','pg5') THEN
    (t.care_grade_min='kein' OR t.care_grade_max='kein' OR grade BETWEEN coalesce(t.care_grade_min,'pg1') AND coalesce(t.care_grade_max,'pg5')) ELSE false END
  AND CASE WHEN t.catalog_key='paragraph_45b' THEN 'entlastungsleistung'=ANY(sources)
   WHEN t.catalog_key LIKE 'umwandlung_%' THEN 'umwandlung'=ANY(sources) AND conversion AND t.catalog_key='umwandlung_'||grade
   WHEN t.catalog_key IN ('verhinderungspflege','gemeinsames_jahresbudget') THEN 'verhinderungspflege'=ANY(sources) AND grade IN ('pg2','pg3','pg4','pg5')
   WHEN t.catalog_key='selbstzahler' THEN 'selbstzahler'=ANY(sources)
   ELSE false END,false)
$$;
REVOKE ALL ON FUNCTION budget_workspace_private.applicable(text,public.budget_template_catalog,text[],boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION budget_workspace_private.get_budget_workspace_receipt(p_tenant_id uuid,p_client_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 PERFORM budget_workspace_private.actor(p_tenant_id);
 SELECT r.result INTO result FROM budget_workspace_private.receipts r WHERE r.request_id=p_request_id
  AND r.tenant_id=p_tenant_id AND r.client_id=p_client_id AND r.auth_user_id=auth.uid();
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION budget_workspace_private.get_budget_workspace_receipt(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION budget_workspace_private.get_budget_workspace_receipt(uuid,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION budget_workspace_private.mutate_budget_workspace(p_tenant_id uuid,p_client_id uuid,p_request_id uuid,p_action text,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; saved budget_workspace_private.receipts%ROWTYPE; c public.clients%ROWTYPE;
 e public.client_care_entitlement%ROWTYPE; old_e public.client_care_entitlement%ROWTYPE;
 legacy_care public.client_care_levels%ROWTYPE; primary_insurance public.client_insurance_profiles%ROWTYPE;
 a public.client_budget_accounts%ROWTYPE; t public.budget_template_catalog%ROWTYPE;
 selection public.client_funding_selections%ROWTYPE; selection_new public.client_funding_selections%ROWTYPE;
 reason text; result jsonb; item jsonb; output jsonb; sources text[]; requested_sources text[];
 delta bigint; allocated bigint; external_amount bigint; account_id uuid; transaction_id uuid;
 effective date; as_of date; first_day date; last_day date; v_grade text; year_no integer;
 updated_count integer:=0; created_count integer:=0; n integer; changed boolean; conversion boolean;
 today date:=(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
 actor:=budget_workspace_private.actor(p_tenant_id);
 IF p_client_id IS NULL OR p_request_id IS NULL OR p_action IS NULL OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
  OR octet_length(p_input::text)>262144 THEN RAISE EXCEPTION 'Ungültiger Budgetauftrag.' USING ERRCODE='22023'; END IF;
 -- All workspace operations for one client serialize, including creation when no entitlement/account exists.
 SELECT * INTO c FROM public.clients WHERE tenant_id=p_tenant_id AND id=p_client_id FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Klient:in nicht gefunden.' USING ERRCODE='42501'; END IF;
 SELECT * INTO saved FROM budget_workspace_private.receipts WHERE request_id=p_request_id;
 IF saved.request_id IS NOT NULL THEN
  IF saved.tenant_id IS DISTINCT FROM p_tenant_id OR saved.client_id IS DISTINCT FROM p_client_id OR saved.auth_user_id IS DISTINCT FROM auth.uid()
   OR saved.action IS DISTINCT FROM p_action OR saved.input IS DISTINCT FROM p_input THEN
   RAISE EXCEPTION 'Dieser Budgetauftrag gehört zu einer anderen Änderung.' USING ERRCODE='40001'; END IF;
  RETURN saved.result;
 END IF;
 reason:=btrim(coalesce(p_input->>'reason',''));
 IF reason='' OR length(reason)>2000 THEN RAISE EXCEPTION 'Bitte eine Begründung mit höchstens 2000 Zeichen angeben.' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM public.client_care_entitlement WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND valid_until IS NULL;
 IF n>1 THEN RAISE EXCEPTION 'Mehrere offene Pflegegradansprüche. Bitte zuerst die Klientenakte klären.' USING ERRCODE='22023'; END IF;
 SELECT * INTO e FROM public.client_care_entitlement WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND valid_until IS NULL FOR UPDATE;
 old_e:=e;
 SELECT * INTO selection FROM public.client_funding_selections WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND replaced_at IS NULL FOR UPDATE;
 sources:=coalesce(selection.sources,ARRAY[]::text[]);

 IF p_action IN ('correction','update_account','deactivate') THEN
  account_id:=(p_input->>'accountId')::uuid;
  SELECT * INTO a FROM public.client_budget_accounts WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND id=account_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Budgetkonto nicht gefunden.' USING ERRCODE='42501'; END IF;
  IF a.allocated_cents<0 OR a.used_cents<0 OR a.reserved_cents<0 OR a.external_sachleistung_cents<0 THEN
   RAISE EXCEPTION 'Das Budgetkonto enthält ungültige Salden. Bitte fachlich klären.' USING ERRCODE='22023'; END IF;
  IF a.status='closed' THEN RAISE EXCEPTION 'Geschlossene Budgetkonten können nicht verändert werden.' USING ERRCODE='22023'; END IF;
  IF p_input->>'expectedUpdatedAt' IS NULL OR a.updated_at IS DISTINCT FROM (p_input->>'expectedUpdatedAt')::timestamptz THEN
   RAISE EXCEPTION 'Das Budgetkonto wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
  allocated:=a.allocated_cents; external_amount:=a.external_sachleistung_cents;
  IF p_action='deactivate' AND EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) key WHERE key NOT IN ('accountId','expectedUpdatedAt','reason')) THEN RAISE EXCEPTION 'Ungültige Sperrfelder.' USING ERRCODE='22023'; END IF;
  IF p_action='correction' THEN
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) key WHERE key NOT IN ('accountId','expectedUpdatedAt','reason','amountCents','effectiveDate')) THEN RAISE EXCEPTION 'Ungültige Korrekturfelder.' USING ERRCODE='22023'; END IF;
   delta:=budget_workspace_private.amount(p_input->'amountCents',true);
   IF delta=0 THEN RAISE EXCEPTION 'Der Korrekturbetrag darf nicht null sein.' USING ERRCODE='22023'; END IF;
   effective:=budget_workspace_private.valid_date(p_input->>'effectiveDate');
   IF effective<a.period_start OR effective>a.period_end OR effective>today THEN
    RAISE EXCEPTION 'Das Korrekturdatum muss im Kontenzeitraum liegen und darf nicht in der Zukunft liegen.' USING ERRCODE='22023'; END IF;
   allocated:=a.allocated_cents+delta;
  ELSIF p_action='update_account' THEN
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_input) key WHERE key NOT IN ('accountId','expectedUpdatedAt','reason','individualAmountCents','isIndividualOverride','allocatedCents','notes','locked','lockReason','isEnabled','status','externalSachleistungCents')) THEN
    RAISE EXCEPTION 'Unbekannte Änderung am Budgetkonto.' USING ERRCODE='22023'; END IF;
   IF p_input?'allocatedCents' THEN allocated:=budget_workspace_private.amount(p_input->'allocatedCents'); END IF;
   IF p_input?'individualAmountCents' AND p_input->'individualAmountCents'<>'null'::jsonb THEN
    PERFORM budget_workspace_private.amount(p_input->'individualAmountCents');
    IF coalesce((p_input->>'isIndividualOverride')::boolean,a.is_individual_override) THEN allocated:=budget_workspace_private.amount(p_input->'individualAmountCents'); END IF; END IF;
   IF p_input?'isIndividualOverride' THEN
    IF jsonb_typeof(p_input->'isIndividualOverride')<>'boolean' THEN RAISE EXCEPTION 'Ungültige individuelle Budgetauswahl.' USING ERRCODE='22023'; END IF;
    IF (p_input->>'isIndividualOverride')::boolean THEN
     allocated:=budget_workspace_private.amount(p_input->'individualAmountCents');
     SELECT * INTO t FROM public.budget_template_catalog WHERE catalog_key=a.catalog_key AND budget_year=a.catalog_year;
     IF t.id IS NOT NULL AND NOT t.allows_individual_override THEN RAISE EXCEPTION 'Für diese Vorlage ist kein individueller Betrag zulässig.' USING ERRCODE='22023'; END IF;
    END IF;
   END IF;
   IF p_input?'externalSachleistungCents' THEN
    IF a.catalog_key NOT LIKE 'umwandlung_%' OR a.period<>'monthly' THEN RAISE EXCEPTION 'Externe Sachleistungen gehören zu einem monatlichen Umwandlungskonto.' USING ERRCODE='22023'; END IF;
    external_amount:=budget_workspace_private.amount(p_input->'externalSachleistungCents');
   END IF;
   IF p_input?'status' AND p_input->>'status' NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Ungültiger Kontostatus.' USING ERRCODE='22023'; END IF;
   IF p_input?'locked' AND jsonb_typeof(p_input->'locked')<>'boolean' OR p_input?'isEnabled' AND jsonb_typeof(p_input->'isEnabled')<>'boolean' THEN
    RAISE EXCEPTION 'Ungültiger Kontoschalter.' USING ERRCODE='22023'; END IF;
   IF p_input?'locked' OR p_input?'isEnabled' OR p_input?'status' THEN
    IF (coalesce((p_input->>'isEnabled')::boolean,a.is_enabled) AND (coalesce(p_input->>'status',a.status)<>'active' OR coalesce((p_input->>'locked')::boolean,a.locked))) THEN
     RAISE EXCEPTION 'Kontostatus, Freigabe und Sperre müssen zusammenpassen.' USING ERRCODE='22023'; END IF;
   END IF;
   IF length(coalesce(p_input->>'notes',''))>5000 OR length(coalesce(p_input->>'lockReason',''))>2000 THEN RAISE EXCEPTION 'Kontonotiz ist zu lang.' USING ERRCODE='22023'; END IF;
  END IF;
  IF allocated>a.allocated_cents AND a.catalog_key IN ('verhinderungspflege','kurzzeitpflege','gemeinsames_jahresbudget')
   AND EXISTS(SELECT 1 FROM public.client_budget_accounts WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND catalog_year=a.catalog_year AND catalog_key='gemeinsames_jahresbudget')
   AND EXISTS(SELECT 1 FROM public.client_budget_accounts WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND catalog_year=a.catalog_year AND catalog_key IN ('verhinderungspflege','kurzzeitpflege')) THEN
   RAISE EXCEPTION 'Gemeinsame und getrennte Jahreskonten bestehen gleichzeitig. Erhöhungen sind bis zur Klärung gesperrt.' USING ERRCODE='22023'; END IF;
  IF allocated<0 OR allocated>9007199254740991 OR allocated<a.used_cents+a.reserved_cents THEN
   RAISE EXCEPTION 'Das Budget darf nicht unter den Verbrauch und die Reservierungen sinken.' USING ERRCODE='22023'; END IF;
  IF (p_action='deactivate' OR p_input->>'isEnabled'='false' OR p_input->>'status'='suspended' OR p_input->>'locked'='true') AND a.reserved_cents>0 THEN
   RAISE EXCEPTION 'Vor dem Sperren müssen offene Reservierungen geklärt werden.' USING ERRCODE='22023'; END IF;
  IF p_input->>'isEnabled'='true' OR p_input->>'status'='active' OR p_input->>'locked'='false' THEN
   SELECT * INTO t FROM public.budget_template_catalog WHERE catalog_key=a.catalog_key AND budget_year=a.catalog_year;
   IF t.id IS NULL OR NOT budget_workspace_private.applicable(e.care_grade,t,sources,e.conversion_enabled) THEN
    RAISE EXCEPTION 'Dieses Konto ist durch die Finanzierungsarten oder den Pflegegrad nicht freigegeben.' USING ERRCODE='22023'; END IF;
  END IF;
  IF allocated<>a.allocated_cents THEN
   INSERT INTO public.client_budget_transactions(tenant_id,client_id,budget_account_id,transaction_type,amount_cents,balance_after_cents,reference_type,reference_id,note,created_by)
   VALUES(p_tenant_id,p_client_id,a.id,'adjustment',allocated-a.allocated_cents,allocated-a.used_cents-a.reserved_cents,
    CASE WHEN p_action='correction' THEN 'manual_correction' ELSE 'budget_account_update' END,p_request_id,
    CASE WHEN effective IS NOT NULL THEN '['||effective::text||'] ' ELSE '' END||reason,actor) RETURNING id INTO transaction_id;
  END IF;
  UPDATE public.client_budget_accounts SET allocated_cents=allocated,external_sachleistung_cents=external_amount,
   is_individual_override=CASE WHEN p_input?'isIndividualOverride' THEN (p_input->>'isIndividualOverride')::boolean ELSE is_individual_override END,
   individual_amount_cents=CASE WHEN coalesce((p_input->>'isIndividualOverride')::boolean,a.is_individual_override) THEN allocated WHEN p_input->>'isIndividualOverride'='false' THEN NULL WHEN p_input?'individualAmountCents' THEN (p_input->>'individualAmountCents')::bigint ELSE individual_amount_cents END,
   notes=CASE WHEN p_input?'notes' THEN p_input->>'notes' ELSE notes END,
   locked=CASE WHEN p_action='deactivate' THEN true WHEN p_input?'locked' THEN (p_input->>'locked')::boolean ELSE locked END,
   lock_reason=CASE WHEN p_action='deactivate' THEN reason WHEN p_input?'lockReason' THEN p_input->>'lockReason' ELSE lock_reason END,
   is_enabled=CASE WHEN p_action='deactivate' THEN false WHEN p_input?'isEnabled' THEN (p_input->>'isEnabled')::boolean ELSE is_enabled END,
   status=CASE WHEN p_action='deactivate' THEN 'suspended' WHEN p_input?'status' THEN p_input->>'status' ELSE status END,
   updated_at=clock_timestamp() WHERE id=a.id AND tenant_id=p_tenant_id AND client_id=p_client_id RETURNING * INTO a;
  output:=CASE WHEN p_action='correction' THEN jsonb_build_object('transactionId',transaction_id) ELSE to_jsonb(a) END;

 ELSIF p_action='recalculate' THEN
  IF jsonb_typeof(p_input->'diffs') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'diffs') NOT BETWEEN 1 AND 100 THEN
   RAISE EXCEPTION 'Keine gültigen Budgetänderungen ausgewählt.' USING ERRCODE='22023'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_input->'diffs'))<>(SELECT count(DISTINCT entry->>'accountId') FROM jsonb_array_elements(p_input->'diffs') entry) THEN
   RAISE EXCEPTION 'Doppelte Budgetkonten im Auftrag.' USING ERRCODE='22023'; END IF;
  as_of:=budget_workspace_private.valid_date(p_input->>'asOfDate');
  IF as_of>today THEN RAISE EXCEPTION 'Budgetkonten können erst für erreichte Zeiträume angelegt werden.' USING ERRCODE='22023'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_input->'diffs') ORDER BY value->>'accountId' LOOP
   IF item->>'create'='true' THEN
    SELECT * INTO t FROM public.budget_template_catalog WHERE id=(item->>'catalogTemplateId')::uuid FOR SHARE;
    first_day:=budget_workspace_private.valid_date(item->>'periodStart'); last_day:=budget_workspace_private.valid_date(item->>'periodEnd');
    IF t.id IS NULL OR (NOT t.auto_generate AND NOT (t.catalog_key='gemeinsames_jahresbudget' AND t.budget_year=2026 AND t.default_amount_cents=353900)) OR t.default_amount_cents IS NULL OR t.budget_year<>extract(year FROM as_of)::integer
     OR first_day<>date_trunc(CASE WHEN t.period='monthly' THEN 'month' WHEN t.period='quarterly' THEN 'quarter' ELSE 'year' END,first_day)::date
     OR first_day>as_of OR extract(year FROM first_day)::integer<>t.budget_year
     OR last_day<>(CASE WHEN t.catalog_key='paragraph_45b' THEN make_date(t.budget_year+1,6,30)
       WHEN t.period='monthly' THEN (first_day+interval '1 month - 1 day')::date WHEN t.period='quarterly' THEN (first_day+interval '3 months - 1 day')::date ELSE make_date(t.budget_year,12,31) END)
     OR (t.catalog_key<>'paragraph_45b' AND first_day<>date_trunc(CASE WHEN t.period='monthly' THEN 'month' WHEN t.period='quarterly' THEN 'quarter' ELSE 'year' END,as_of)::date)
     THEN RAISE EXCEPTION 'Die Kontenvorschau ist nicht mehr gültig. Bitte neu laden.' USING ERRCODE='40001'; END IF;
    IF t.budget_year=2026 AND t.catalog_key IN ('verhinderungspflege','kurzzeitpflege') THEN
     RAISE EXCEPTION 'Für 2026 wird ausschließlich das gemeinsame Jahresbudget neu angelegt.' USING ERRCODE='22023'; END IF;
    IF t.catalog_key='gemeinsames_jahresbudget' AND EXISTS(SELECT 1 FROM public.client_budget_accounts WHERE tenant_id=p_tenant_id AND client_id=p_client_id
      AND catalog_year=t.budget_year AND catalog_key IN ('verhinderungspflege','kurzzeitpflege')) THEN
     RAISE EXCEPTION 'Es bestehen bereits getrennte Jahreskonten. Bitte zuerst ihren Bestand fachlich klären, damit kein Budget doppelt entsteht.' USING ERRCODE='22023'; END IF;
    SELECT * INTO old_e FROM public.client_care_entitlement WHERE tenant_id=p_tenant_id AND client_id=p_client_id
     AND valid_from<=CASE WHEN t.catalog_key='paragraph_45b' THEN least(as_of,(date_trunc('month',first_day)+interval '1 month - 1 day')::date) ELSE as_of END
     AND (valid_until IS NULL OR valid_until>=first_day) ORDER BY valid_from DESC LIMIT 1;
    IF old_e.id IS NULL OR NOT budget_workspace_private.applicable(old_e.care_grade,t,sources,old_e.conversion_enabled)
     OR (t.catalog_key='paragraph_45b' AND first_day<date_trunc('month',old_e.valid_from)::date)
     OR budget_workspace_private.amount(item->'catalogAmountCents')<>t.default_amount_cents
     THEN RAISE EXCEPTION 'Pflegegrad, Finanzierungsart oder Katalogbetrag hat sich geändert.' USING ERRCODE='40001'; END IF;
    IF t.catalog_key LIKE 'umwandlung_%' AND EXISTS(SELECT 1 FROM public.client_budget_accounts WHERE tenant_id=p_tenant_id AND client_id=p_client_id
     AND catalog_key LIKE 'umwandlung_%' AND catalog_key<>t.catalog_key AND period_start=first_day
     AND (used_cents>0 OR reserved_cents>0 OR external_sachleistung_cents>0)) THEN
     RAISE EXCEPTION 'Im selben Monat bestehen bereits Umwandlungsbuchungen für einen anderen Pflegegrad. Bitte zuerst fachlich klären.' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM public.client_budget_accounts WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND catalog_key=t.catalog_key
     AND period_start=first_day AND period_end=last_day) THEN RAISE EXCEPTION 'Dieses Budgetkonto wurde bereits angelegt. Bitte neu laden.' USING ERRCODE='40001'; END IF;
    INSERT INTO public.client_budget_accounts(tenant_id,client_id,catalog_template_id,catalog_key,catalog_year,period,period_start,period_end,allocated_cents,standard_amount_cents,billing_priority,catalog_snapshot)
    VALUES(p_tenant_id,p_client_id,t.id,t.catalog_key,t.budget_year,t.period,first_day,last_day,t.default_amount_cents,t.default_amount_cents,t.billing_priority,
     jsonb_build_object('catalogKey',t.catalog_key,'budgetYear',t.budget_year,'defaultAmountCents',t.default_amount_cents,'label',t.label,'frozenAt',clock_timestamp())) RETURNING * INTO a;
    IF t.catalog_key='gemeinsames_jahresbudget' THEN
     INSERT INTO public.client_budget_mode(tenant_id,client_id,budget_year,care_prevention_mode,mode_change_reason)
     VALUES(p_tenant_id,p_client_id,t.budget_year,'joint_annual_budget',reason)
     ON CONFLICT(tenant_id,client_id,budget_year) DO UPDATE SET care_prevention_mode='joint_annual_budget',mode_change_reason=excluded.mode_change_reason,updated_at=clock_timestamp();
    END IF;
    delta:=t.default_amount_cents; created_count:=created_count+1;
   ELSE
    SELECT * INTO a FROM public.client_budget_accounts WHERE id=(item->>'accountId')::uuid AND tenant_id=p_tenant_id AND client_id=p_client_id FOR UPDATE;
    IF a.id IS NULL THEN RAISE EXCEPTION 'Budgetkonto nicht gefunden.' USING ERRCODE='42501'; END IF;
    SELECT * INTO t FROM public.budget_template_catalog WHERE catalog_key=a.catalog_key AND budget_year=a.catalog_year FOR SHARE;
    SELECT * INTO old_e FROM public.client_care_entitlement WHERE tenant_id=p_tenant_id AND client_id=p_client_id
     AND valid_from<=least(as_of,a.period_end) AND (valid_until IS NULL OR valid_until>=a.period_start) ORDER BY valid_from DESC LIMIT 1;
    IF a.allocated_cents<0 OR a.used_cents<0 OR a.reserved_cents<0 OR a.external_sachleistung_cents<0 OR a.status<>'active' OR NOT a.is_enabled OR a.locked OR a.is_individual_override OR a.catalog_year<>extract(year FROM as_of)::integer
     OR t.id IS NULL OR t.default_amount_cents IS NULL OR NOT budget_workspace_private.applicable(old_e.care_grade,t,sources,old_e.conversion_enabled)
     OR a.allocated_cents<>budget_workspace_private.amount(item->'currentAllocatedCents')
     OR t.default_amount_cents<>budget_workspace_private.amount(item->'catalogAmountCents')
     OR t.default_amount_cents<a.used_cents+a.reserved_cents THEN
     RAISE EXCEPTION 'Die Budgetvorschau ist veraltet oder würde bestehende Buchungen unterschreiten. Bitte neu laden.' USING ERRCODE='40001'; END IF;
    IF a.catalog_year=2026 AND a.catalog_key IN ('verhinderungspflege','kurzzeitpflege') THEN
     RAISE EXCEPTION 'Getrennte Bestandskonten werden 2026 nicht automatisch neu berechnet. Bitte fachlich klären.' USING ERRCODE='22023'; END IF;
    IF a.catalog_key='gemeinsames_jahresbudget' AND t.default_amount_cents>a.allocated_cents AND EXISTS(SELECT 1 FROM public.client_budget_accounts
     WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND catalog_year=a.catalog_year AND catalog_key IN ('verhinderungspflege','kurzzeitpflege')) THEN
     RAISE EXCEPTION 'Gemeinsame und getrennte Jahreskonten bestehen gleichzeitig. Erhöhungen sind bis zur Klärung gesperrt.' USING ERRCODE='22023'; END IF;
    delta:=t.default_amount_cents-a.allocated_cents;
    IF delta=0 THEN RAISE EXCEPTION 'Dieses Konto wurde bereits angepasst. Bitte neu laden.' USING ERRCODE='40001'; END IF;
    UPDATE public.client_budget_accounts SET allocated_cents=t.default_amount_cents,standard_amount_cents=t.default_amount_cents,updated_at=clock_timestamp()
     WHERE id=a.id AND tenant_id=p_tenant_id AND client_id=p_client_id RETURNING * INTO a;
   END IF;
   INSERT INTO public.client_budget_transactions(tenant_id,client_id,budget_account_id,transaction_type,amount_cents,balance_after_cents,reference_type,reference_id,note,created_by)
   VALUES(p_tenant_id,p_client_id,a.id,CASE WHEN item->>'create'='true' THEN 'allocation' ELSE 'adjustment' END,delta,a.allocated_cents-a.used_cents-a.reserved_cents,
    'catalog_recalc',p_request_id,reason,actor);
   updated_count:=updated_count+1;
  END LOOP;
  output:=jsonb_build_object('updated',updated_count,'created',created_count);

 ELSIF p_action IN ('change_grade','update_fund','update_valid_from','set_conversion','set_funding') THEN
  IF (SELECT count(*) FROM public.client_insurance_profiles WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND is_primary)>1 THEN
   RAISE EXCEPTION 'Mehrere Hauptversicherungen sind hinterlegt. Bitte zuerst die Klientenakte klären.' USING ERRCODE='22023'; END IF;
  IF p_action<>'set_funding' AND (CASE WHEN e.id IS NULL THEN p_input->'expectedEntitlement' IS DISTINCT FROM 'null'::jsonb ELSE
   p_input->'expectedEntitlement'->>'id' IS DISTINCT FROM e.id::text OR p_input->'expectedEntitlement'->>'updatedAt' IS NULL OR
   (p_input->'expectedEntitlement'->>'updatedAt')::timestamptz IS DISTINCT FROM e.updated_at END) THEN
   RAISE EXCEPTION 'Der Pflegegradanspruch wurde inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
  IF p_action NOT IN ('change_grade','set_funding') AND e.id IS NULL THEN RAISE EXCEPTION 'Bitte zuerst einen Pflegegradanspruch anlegen.' USING ERRCODE='22023'; END IF;
  IF p_action='change_grade' THEN
   v_grade:=p_input->>'newCareGrade'; effective:=budget_workspace_private.valid_date(p_input->>'effectiveFrom');
   IF v_grade NOT IN ('kein','pg1','pg2','pg3','pg4','pg5','hospiz') OR v_grade IS NULL OR effective>today THEN
    RAISE EXCEPTION 'Pflegegrad oder Gültigkeitsdatum ist ungültig.' USING ERRCODE='22023'; END IF;
   IF e.id IS NOT NULL AND (effective<=e.valid_from OR v_grade=e.care_grade) THEN
    RAISE EXCEPTION 'Ein Pflegegradwechsel braucht einen späteren Beginn und einen anderen Pflegegrad.' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM public.client_budget_accounts WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND reserved_cents>0) THEN
    RAISE EXCEPTION 'Bitte zuerst offene Budgetreservierungen klären.' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM public.client_care_entitlement WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND id IS DISTINCT FROM e.id
    AND (valid_until IS NULL OR valid_until>=effective)) THEN RAISE EXCEPTION 'Der Beginn überschneidet sich mit einem bestehenden Pflegegrad.' USING ERRCODE='22023'; END IF;
   IF e.id IS NULL THEN
    SELECT * INTO legacy_care FROM public.client_care_levels legacy_row WHERE legacy_row.tenant_id=p_tenant_id AND legacy_row.client_id=p_client_id
     AND legacy_row.valid_until IS NULL AND legacy_row.grade=v_grade AND legacy_row.valid_from=effective ORDER BY created_at DESC LIMIT 1;
    SELECT * INTO primary_insurance FROM public.client_insurance_profiles WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND is_primary;
   END IF;
   IF e.id IS NOT NULL THEN UPDATE public.client_care_entitlement SET valid_until=effective-1,updated_at=clock_timestamp() WHERE id=e.id; END IF;
   UPDATE public.client_care_levels SET valid_until=effective-1,updated_at=clock_timestamp()
    WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND valid_until IS NULL AND valid_from<effective;
   IF EXISTS(SELECT 1 FROM public.client_care_levels legacy_row WHERE legacy_row.tenant_id=p_tenant_id AND legacy_row.client_id=p_client_id AND legacy_row.valid_until IS NULL AND legacy_row.valid_from>=effective AND NOT (e.id IS NULL AND legacy_row.valid_from=effective AND legacy_row.grade=v_grade)) THEN
    RAISE EXCEPTION 'Der Beginn überschneidet sich mit der Pflegegradhistorie der Klientenakte.' USING ERRCODE='22023'; END IF;
   INSERT INTO public.client_care_entitlement(tenant_id,client_id,care_grade,valid_from,conversion_enabled,care_fund_name,care_fund_member_id,md_assessment_date,notes,source,metadata)
   VALUES(p_tenant_id,p_client_id,v_grade,effective,v_grade IN ('pg2','pg3','pg4','pg5') AND 'umwandlung'=ANY(sources),
    coalesce(e.care_fund_name,legacy_care.care_fund_name,c.insurance_name,primary_insurance.care_fund_name),coalesce(e.care_fund_member_id,legacy_care.care_fund_member_id,c.insurance_number,primary_insurance.insurance_number),coalesce(e.md_assessment_date,legacy_care.md_assessment_date),reason,'budget_workspace',jsonb_build_object('previousGrade',e.care_grade)) RETURNING * INTO e;
   IF NOT EXISTS(SELECT 1 FROM public.client_care_levels legacy_row WHERE legacy_row.tenant_id=p_tenant_id AND legacy_row.client_id=p_client_id AND legacy_row.valid_until IS NULL AND legacy_row.grade=e.care_grade AND legacy_row.valid_from=e.valid_from) THEN
    INSERT INTO public.client_care_levels(tenant_id,client_id,grade,valid_from,care_fund_name,care_fund_member_id,notes)
    VALUES(p_tenant_id,p_client_id,e.care_grade,e.valid_from,coalesce(e.care_fund_name,'Unbekannt'),e.care_fund_member_id,reason);
   END IF;
   UPDATE public.client_care_levels legacy_row SET care_fund_name=coalesce(e.care_fund_name,'Unbekannt'),care_fund_member_id=e.care_fund_member_id
    WHERE legacy_row.tenant_id=p_tenant_id AND legacy_row.client_id=p_client_id AND legacy_row.valid_until IS NULL AND legacy_row.grade=e.care_grade AND legacy_row.valid_from=e.valid_from;
   UPDATE public.clients SET care_level=(CASE WHEN v_grade='kein' THEN 'none' WHEN v_grade='hospiz' THEN 'unknown' ELSE v_grade END)::public.care_level,
    insurance_name=e.care_fund_name,insurance_number=e.care_fund_member_id WHERE tenant_id=p_tenant_id AND id=p_client_id;
   UPDATE public.client_insurance_profiles SET care_level=e.care_grade,care_level_valid_from=e.valid_from,care_fund_name=e.care_fund_name,insurance_number=e.care_fund_member_id
    WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND is_primary;
   -- Newly ineligible statutory accounts remain in the ledger but cannot finance new services.
   UPDATE public.client_budget_accounts budget_row SET is_enabled=false,status='suspended',locked=true,
    lock_reason=CASE WHEN budget_row.locked THEN budget_row.lock_reason ELSE 'Pflegegrad geändert' END,updated_at=clock_timestamp()
    FROM public.budget_template_catalog template_row
    WHERE budget_row.tenant_id=p_tenant_id AND budget_row.client_id=p_client_id AND budget_row.catalog_key=template_row.catalog_key AND budget_row.catalog_year=template_row.budget_year
     AND template_row.is_statutory AND NOT budget_workspace_private.applicable(v_grade,template_row,sources,e.conversion_enabled)
     AND budget_row.period_end>=effective AND budget_row.status='active';
  ELSIF p_action='update_fund' THEN
   IF btrim(coalesce(p_input->>'careFundName',''))='' OR length(p_input->>'careFundName')>240 OR length(coalesce(p_input->>'careFundMemberId',''))>120 THEN
    RAISE EXCEPTION 'Bitte Pflegekasse und Versichertennummer prüfen.' USING ERRCODE='22023'; END IF;
   UPDATE public.client_care_entitlement SET care_fund_name=btrim(p_input->>'careFundName'),care_fund_member_id=nullif(btrim(p_input->>'careFundMemberId'),''),updated_at=clock_timestamp()
    WHERE id=e.id RETURNING * INTO e;
   UPDATE public.clients SET insurance_name=e.care_fund_name,insurance_number=e.care_fund_member_id WHERE tenant_id=p_tenant_id AND id=p_client_id;
   UPDATE public.client_insurance_profiles SET care_fund_name=e.care_fund_name,insurance_number=e.care_fund_member_id
    WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND is_primary;
   UPDATE public.client_care_levels level_entry SET care_fund_name=e.care_fund_name,care_fund_member_id=e.care_fund_member_id,updated_at=clock_timestamp()
    WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND valid_until IS NULL AND valid_from=e.valid_from AND level_entry.grade=e.care_grade;
  ELSIF p_action='update_valid_from' THEN
   effective:=budget_workspace_private.valid_date(p_input->>'validFrom');
   IF effective>today OR effective=e.valid_from THEN RAISE EXCEPTION 'Das Gültigkeitsdatum ist unverändert oder liegt in der Zukunft.' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM public.client_care_entitlement WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND id<>e.id AND (valid_until IS NULL OR valid_until>=effective)) THEN
    RAISE EXCEPTION 'Das Datum überschneidet sich mit einem früheren Pflegegrad.' USING ERRCODE='22023'; END IF;
   IF effective>e.valid_from THEN
    IF EXISTS(SELECT 1 FROM public.client_budget_accounts WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND period='monthly'
      AND period_start>=date_trunc('month',e.valid_from)::date AND period_start<date_trunc('month',effective)::date
      AND (used_cents>0 OR reserved_cents>0 OR external_sachleistung_cents>0)) THEN
     RAISE EXCEPTION 'Vor dem neuen Beginn bestehen bereits Verbrauch, Reservierungen oder externe Sachleistungen. Bitte diese Buchungen zuerst klären.' USING ERRCODE='22023'; END IF;
    UPDATE public.client_budget_accounts SET status='suspended',is_enabled=false,locked=true,lock_reason='Gültigkeitsbeginn geändert',updated_at=clock_timestamp()
     WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND period='monthly' AND status='active'
      AND period_start>=date_trunc('month',e.valid_from)::date AND period_start<date_trunc('month',effective)::date;
   END IF;
   UPDATE public.client_care_levels level_entry SET valid_from=effective,updated_at=clock_timestamp()
    WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND valid_until IS NULL AND valid_from=e.valid_from AND level_entry.grade=e.care_grade;
   UPDATE public.client_care_entitlement SET valid_from=effective,updated_at=clock_timestamp() WHERE id=e.id RETURNING * INTO e;
   UPDATE public.client_insurance_profiles SET care_level_valid_from=e.valid_from
    WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND is_primary;
  ELSE
   -- Conversion is a financing selection, so both views are changed together.
   IF p_action='set_conversion' THEN
    IF jsonb_typeof(p_input->'enabled') IS DISTINCT FROM 'boolean' OR e.care_grade NOT IN ('pg2','pg3','pg4','pg5') THEN RAISE EXCEPTION 'Dieser Pflegegrad erlaubt keine Umwandlung.' USING ERRCODE='22023'; END IF;
    requested_sources:=CASE WHEN (p_input->>'enabled')::boolean THEN array_append(array_remove(sources,'umwandlung'),'umwandlung') ELSE array_remove(sources,'umwandlung') END;
    effective:=today;
   ELSE
    IF jsonb_typeof(p_input->'sources') IS DISTINCT FROM 'array' OR jsonb_typeof(p_input->'expectedSources') IS DISTINCT FROM 'array'
     OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_input->'expectedSources') x WHERE jsonb_typeof(x)<>'string')
     OR (SELECT array_agg(x ORDER BY x) FROM jsonb_array_elements_text(p_input->'expectedSources') x) IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(sources) x) THEN RAISE EXCEPTION 'Die Finanzierungsarten wurden inzwischen geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
    SELECT coalesce(array_agg(value),'{}'::text[]) INTO requested_sources FROM jsonb_array_elements_text(p_input->'sources');
    effective:=budget_workspace_private.valid_date(p_input->>'effectiveFrom');
   END IF;
   IF effective>today OR cardinality(requested_sources)=0 OR NOT requested_sources<@ARRAY['entlastungsleistung','umwandlung','verhinderungspflege','selbstzahler']::text[]
    OR cardinality(requested_sources)<>(SELECT count(DISTINCT s) FROM unnest(requested_sources) s)
    OR ('umwandlung'=ANY(requested_sources) AND coalesce(e.care_grade,'') NOT IN ('pg2','pg3','pg4','pg5')) THEN
    RAISE EXCEPTION 'Bitte die Finanzierungsarten und ihr Gültigkeitsdatum prüfen.' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM public.client_budget_accounts budget_row WHERE budget_row.tenant_id=p_tenant_id AND budget_row.client_id=p_client_id AND budget_row.reserved_cents>0 AND
    ((budget_row.catalog_key='paragraph_45b' AND NOT 'entlastungsleistung'=ANY(requested_sources)) OR (budget_row.catalog_key LIKE 'umwandlung_%' AND NOT 'umwandlung'=ANY(requested_sources))
     OR (budget_row.catalog_key IN ('verhinderungspflege','gemeinsames_jahresbudget') AND NOT 'verhinderungspflege'=ANY(requested_sources)) OR (budget_row.catalog_key='selbstzahler' AND NOT 'selbstzahler'=ANY(requested_sources)))) THEN
    RAISE EXCEPTION 'Die abgewählte Finanzierungsart hat offene Reservierungen. Bitte zuerst klären.' USING ERRCODE='22023'; END IF;
   SELECT array_agg(s ORDER BY pos) INTO requested_sources FROM unnest(ARRAY['entlastungsleistung','umwandlung','verhinderungspflege','selbstzahler']) WITH ORDINALITY x(s,pos) WHERE s=ANY(requested_sources);
   IF selection.id IS NOT NULL AND selection.sources=requested_sources AND selection.effective_from=effective THEN selection_new:=selection;
   ELSE
    IF selection.id IS NOT NULL THEN UPDATE public.client_funding_selections SET replaced_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=selection.id; END IF;
    INSERT INTO public.client_funding_selections(tenant_id,client_id,sources,effective_from,created_by)
     VALUES(p_tenant_id,p_client_id,requested_sources,effective,actor) RETURNING * INTO selection_new;
   END IF;
   UPDATE public.client_insurance_profiles SET self_pay='selbstzahler'=ANY(requested_sources) WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND is_primary;
   UPDATE public.client_care_entitlement SET conversion_enabled='umwandlung'=ANY(requested_sources) AND care_grade IN ('pg2','pg3','pg4','pg5'),updated_at=clock_timestamp()
    WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND valid_until IS NULL RETURNING * INTO e;
   UPDATE public.client_budget_accounts SET is_enabled=false,status='suspended',locked=true,
    lock_reason=CASE WHEN locked AND lock_reason IS DISTINCT FROM 'Finanzierungsart nicht ausgewählt' THEN lock_reason ELSE 'Finanzierungsart nicht ausgewählt' END,updated_at=clock_timestamp()
    WHERE tenant_id=p_tenant_id AND client_id=p_client_id AND status<>'closed' AND
     ((catalog_key='paragraph_45b' AND NOT 'entlastungsleistung'=ANY(requested_sources)) OR (catalog_key LIKE 'umwandlung_%' AND NOT 'umwandlung'=ANY(requested_sources))
     OR (catalog_key IN ('verhinderungspflege','gemeinsames_jahresbudget') AND NOT 'verhinderungspflege'=ANY(requested_sources)) OR (catalog_key='selbstzahler' AND NOT 'selbstzahler'=ANY(requested_sources)));
   UPDATE public.client_budget_accounts budget_row SET is_enabled=true,status='active',locked=false,lock_reason=NULL,updated_at=clock_timestamp()
    FROM public.budget_template_catalog template_row WHERE budget_row.tenant_id=p_tenant_id AND budget_row.client_id=p_client_id AND budget_row.catalog_key=template_row.catalog_key AND budget_row.catalog_year=template_row.budget_year
     AND budget_row.status='suspended' AND budget_row.lock_reason='Finanzierungsart nicht ausgewählt'
     AND budget_workspace_private.applicable(e.care_grade,template_row,requested_sources,e.conversion_enabled);
  END IF;
  output:=CASE WHEN p_action='set_funding' THEN to_jsonb(selection_new) ELSE to_jsonb(e) END;
 ELSE RAISE EXCEPTION 'Unbekannte Budgetaktion.' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.client_billing_audit_log(tenant_id,client_id,action,entity_type,entity_id,payload,actor_id)
 VALUES(p_tenant_id,p_client_id,'budget_workspace_'||p_action,'client_budget_workspace',coalesce(a.id,e.id,selection_new.id),
  jsonb_build_object('requestId',p_request_id,'reason',reason,'input',p_input,'result',output),actor);
 result:=jsonb_build_object('requestId',p_request_id,'action',p_action,'tenantId',p_tenant_id,'clientId',p_client_id,'data',output);
 INSERT INTO budget_workspace_private.receipts(request_id,tenant_id,client_id,auth_user_id,action,input,result)
 VALUES(p_request_id,p_tenant_id,p_client_id,auth.uid(),p_action,p_input,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION budget_workspace_private.mutate_budget_workspace(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION budget_workspace_private.mutate_budget_workspace(uuid,uuid,uuid,text,jsonb) TO authenticated;
GRANT USAGE ON SCHEMA budget_workspace_private TO authenticated;
CREATE OR REPLACE FUNCTION public.get_budget_workspace_receipt(p_tenant_id uuid,p_client_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT budget_workspace_private.get_budget_workspace_receipt(p_tenant_id,p_client_id,p_request_id)
$$;
REVOKE ALL ON FUNCTION public.get_budget_workspace_receipt(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_budget_workspace_receipt(uuid,uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.mutate_budget_workspace(p_tenant_id uuid,p_client_id uuid,p_request_id uuid,p_action text,p_input jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT budget_workspace_private.mutate_budget_workspace(p_tenant_id,p_client_id,p_request_id,p_action,p_input)
$$;
REVOKE ALL ON FUNCTION public.mutate_budget_workspace(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mutate_budget_workspace(uuid,uuid,uuid,text,jsonb) TO authenticated;
COMMIT;
