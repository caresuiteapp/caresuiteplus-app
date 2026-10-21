-- PREPARED ONLY: U-01..U-12 connected private Web/Desktop billing workspace.
-- Not applied. No legacy writer, native/Android surface, service proof, invoice or payment original is changed.
-- Required runtime gates: PostgreSQL/PostgREST/RLS/grants, two-session CAS/deadlock/rollback,
-- SDK argument names, native writer compatibility, browser/layout and qualified care/privacy/legal acceptance.
begin;
create schema if not exists client_billing_private;
revoke all on schema client_billing_private from public,anon,authenticated;

create table if not exists client_billing_private.roots(
 tenant_id uuid not null,client_id uuid not null,head_id uuid,updated_at timestamptz not null default clock_timestamp(),
 primary key(tenant_id,client_id));
create table if not exists client_billing_private.events(
 id uuid primary key,tenant_id uuid not null,client_id uuid not null,sequence bigint not null,previous_id uuid,request_id uuid not null,
 actor_id uuid not null,actor_name text not null,occurred_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),
 kind text not null,command jsonb not null,unique(tenant_id,client_id,sequence),unique(tenant_id,request_id));
alter table client_billing_private.roots enable row level security;
alter table client_billing_private.events enable row level security;
revoke all on all tables in schema client_billing_private from public,anon,authenticated;

create or replace function client_billing_private.immutable()returns trigger language plpgsql security definer set search_path='' as $$begin raise exception using errcode='P0P01',message='Abrechnungsereignisse bleiben unveränderlich.';end$$;
drop trigger if exists client_billing_roots_delete on client_billing_private.roots;
create trigger client_billing_roots_delete before delete on client_billing_private.roots for each row execute function client_billing_private.immutable();
drop trigger if exists client_billing_events_immutable on client_billing_private.events;
create trigger client_billing_events_immutable before update or delete on client_billing_private.events for each row execute function client_billing_private.immutable();

create or replace function client_billing_private.profile_has(t uuid,a uuid,keys text[])returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'
 and not exists(select 1 from unnest(keys)k where not case when exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key)
 then exists(select 1 from public.role_permission_sets z where z.tenant_id=t and z.role_key=r.key and z.permission_key=k)
 else exists(select 1 from public.role_permissions z where z.role_id=r.id and z.permission_key=k)end))$$;
create or replace function client_billing_private.actor(t uuid,a uuid,writing boolean)returns text language plpgsql security definer set search_path='' as $$
declare sid uuid;n text;k text;keys text[]:=array['office.clients.view','office.clients.view_sensitive','office.documents.view','office.invoices.view']||case when writing then array['office.clients.edit','office.invoices.create','office.invoices.status_change']else array[]::text[]end;begin
 if auth.uid()is null or auth.uid()is distinct from a or public.resolve_current_profile_id()is distinct from a or public.current_tenant_id()is distinct from t
 or coalesce((auth.jwt()->>'exp')::bigint,0)<=extract(epoch from clock_timestamp())then raise exception using errcode='42501',message='Aktuelles eigenes Konto fehlt.';end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;perform 1 from auth.sessions s where s.id=sid and s.user_id=auth.uid()and(s.not_after is null or s.not_after>clock_timestamp())for share;
 if not found then raise exception using errcode='42501',message='Aktuelle native Sitzung fehlt.';end if;
 if writing then lock table public.roles,public.role_permissions,public.role_permission_sets in share mode;end if;
 select coalesce(nullif(btrim(p.display_name),''),'Name nicht bestätigt')into n from public.profiles p join public.roles r on r.id=p.role_id where p.id=a and p.tenant_id=t and p.is_active and p.status='active'and(p.auth_user_id is null or p.auth_user_id=auth.uid())for share of p,r;
 if n is null or not client_billing_private.profile_has(t,a,keys)then raise exception using errcode='42501',message='Aktuelle Akten-, Dokument- oder Schreibrechte fehlen.';end if;
 foreach k in array keys loop if public.has_permission(k)is not true then raise exception using errcode='42501',message='Nativer Rechtezugang fehlt.';end if;end loop;return n;
end$$;

create or replace function client_billing_private.event_json(e client_billing_private.events)returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',e.id,'sequence',e.sequence,'previousId',e.previous_id,'tenantId',e.tenant_id,'clientId',e.client_id,'actorId',e.actor_id,'actorName',e.actor_name,'recordedAt',to_char(e.recorded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'command',e.command)$$;
create or replace function client_billing_private.history(t uuid,c uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare e client_billing_private.events%rowtype;head uuid;prev uuid;n bigint:=0;rows jsonb:='[]';begin
 select r.head_id into head from client_billing_private.roots r where r.tenant_id=t and r.client_id=c;
 for e in select*from client_billing_private.events z where z.tenant_id=t and z.client_id=c order by z.sequence loop
  if e.sequence<>n+1 or e.previous_id is distinct from prev or e.command->>'eventId'is distinct from e.id::text or e.command->>'tenantId'is distinct from t::text or e.command->>'clientId'is distinct from c::text or e.command->>'actorId'is distinct from e.actor_id::text or(e.command->>'expectedHeadId')is distinct from prev::text then raise exception using errcode='23514',message='Abrechnungsverlauf ist widersprüchlich.';end if;
  rows:=rows||jsonb_build_array(client_billing_private.event_json(e));prev:=e.id;n:=n+1;
 end loop;
 if head is distinct from prev then raise exception using errcode='23514',message='Abrechnungsverlaufskopf ist unvollständig.';end if;
 return jsonb_build_object('version','2026-10-16.1','tenantId',t,'clientId',c,'count',n,'headId',head,'events',rows);
end$$;

create or replace function client_billing_private.sources(t uuid,c uuid)returns jsonb language sql security definer set search_path='' as $$
 with s as(
  select 'contract'::text kind,x.id,to_jsonb(x)snapshot from public.client_contracts x where x.tenant_id=t and x.client_id=c
  union all select 'financing',x.id,to_jsonb(x)from public.client_financing_paths x where x.tenant_id=t and x.client_id=c
  union all select 'document',x.id,to_jsonb(x)from public.client_documents x where x.tenant_id=t and x.client_id=c
  union all select 'proof',x.id,to_jsonb(x)from public.pfleger_service_proofs x where x.tenant_id=t and x.client_id=c
  union all select 'billing_case',x.id,to_jsonb(x)from public.pfleger_billing_cases x where x.tenant_id=t and x.client_id=c
  union all select 'foundation',x.id,to_jsonb(x)from public.pfleger_invoice_foundations x where x.tenant_id=t and x.client_id=c
  union all select 'draft',x.id,to_jsonb(x)from public.pfleger_invoice_drafts x where x.tenant_id=t and x.client_id=c
  union all select 'approval',x.id,to_jsonb(x)from public.pfleger_invoice_approvals x where x.tenant_id=t and x.client_id=c
  union all select 'export',x.id,to_jsonb(x)from public.pfleger_cost_carrier_exports x where x.tenant_id=t and x.client_id=c
  union all select 'carrier_return',x.id,to_jsonb(x)from public.pfleger_cost_carrier_returns x where x.tenant_id=t and x.client_id=c
  union all select 'adjustment',x.id,to_jsonb(x)from public.pfleger_invoice_adjustments x where x.tenant_id=t and x.client_id=c
  union all select 'open_item',x.id,to_jsonb(x)from public.pfleger_receivable_open_items x where x.tenant_id=t and x.client_id=c
  union all select 'payment',x.id,to_jsonb(x)from public.pfleger_receivable_payment_events x where x.tenant_id=t and x.client_id=c
  union all select 'accounting_source',x.id,to_jsonb(x)from public.pfleger_accounting_source_documents x where x.tenant_id=t and x.client_id=c
  union all select 'accounting_posting',x.id,to_jsonb(x)from public.pfleger_accounting_postings x where x.tenant_id=t and x.client_id=c
  union all select 'dunning',x.id,to_jsonb(x)from public.pfleger_dunning_notices x where x.tenant_id=t and x.client_id=c
  union all select 'dunning_dispatch',x.id,to_jsonb(x)from public.pfleger_dunning_dispatches x where x.tenant_id=t and x.client_id=c
  union all select 'mandate',x.id,to_jsonb(x)from public.pfleger_sepa_mandate_versions x where x.tenant_id=t and x.client_id=c
  union all select 'direct_debit',x.id,to_jsonb(x)from public.pfleger_direct_debit_orders x where x.tenant_id=t and x.client_id=c
  union all select 'direct_debit',x.id,to_jsonb(x)from public.pfleger_direct_debit_returns x where x.tenant_id=t and x.client_id=c
  union all select 'cost_share',x.id,to_jsonb(x)from public.pfleger_invoice_cost_share_assessments x where x.tenant_id=t and x.client_id=c
  union all select 'period_closure',x.id,to_jsonb(x)from public.pfleger_invoice_period_closures x where x.tenant_id=t and exists(select 1 from public.pfleger_invoice_period_closure_invoices ci where ci.period_closure_id=x.id and ci.tenant_id=t and ci.client_id=c)
  union all select 'workspace_event',e.id,client_billing_private.event_json(e)from client_billing_private.events e where e.tenant_id=t and e.client_id=c
 )select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'snapshot',snapshot)order by kind,id),'[]'::jsonb)from s$$;
create or replace function client_billing_private.walk_sources(v jsonb,src jsonb)returns void language plpgsql set search_path='' as $$declare x jsonb;begin
 if jsonb_typeof(v)='array'then for x in select value from jsonb_array_elements(v)loop perform client_billing_private.walk_sources(x,src);end loop;
 elsif jsonb_typeof(v)='object'then if v?'snapshot'and v?'kind'and v?'id'then if not exists(select 1 from jsonb_array_elements(src)x where x=v)then raise exception using errcode='40001',message='Ausgewählte Originalgrundlage wurde geändert oder ist nicht mehr zugänglich.';end if;else for x in select value from jsonb_each(v)loop perform client_billing_private.walk_sources(x,src);end loop;end if;end if;
end$$;
create or replace function client_billing_private.require_source(p jsonb,k text,kinds text[],src jsonb)returns void language plpgsql set search_path='' as $$declare v jsonb:=p->k;actual text[];begin
 if jsonb_typeof(v)is distinct from'object'then raise exception using errcode='22023',message='Originalquelle fehlt.';end if;
 select array_agg(x order by x)into actual from jsonb_object_keys(v)x;
 if actual is distinct from array['id','kind','snapshot']::text[]or not(v->>'kind'=any(kinds))or(v->>'id')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or jsonb_typeof(v->'snapshot')is distinct from'object'or v#>>'{snapshot,id}'is distinct from v->>'id'or not exists(select 1 from jsonb_array_elements(src)x where x=v)then raise exception using errcode='40001',message='Originalquelle ist falsch, geändert oder nicht mehr zugänglich.';end if;
end$$;
create or replace function client_billing_private.require_date(p jsonb,k text)returns void language plpgsql set search_path='' as $$declare v text:=p->>k;begin
 if v!~'^\d{4}-\d{2}-\d{2}$'or to_char(to_date(v,'YYYY-MM-DD'),'YYYY-MM-DD')<>v then raise exception using errcode='22007',message='Datum ist ungültig.';end if;
end$$;
create or replace function client_billing_private.require_amount(p jsonb,k text)returns void language plpgsql set search_path='' as $$begin
 if(p->>k)!~'^(0|[1-9][0-9]*)$'then raise exception using errcode='22023',message='Geldbetrag muss als nichtnegativer Centbetrag vorliegen.';end if;
end$$;
create or replace function client_billing_private.require_uuid(p jsonb,k text)returns void language plpgsql set search_path='' as $$begin
 if(p->>k)!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'then raise exception using errcode='22P02',message='Belegkennung ist ungültig.';end if;
end$$;
create or replace function client_billing_private.payload_keys(k text)returns text[] language sql immutable set search_path='' as $$select case k
 when'foundation_review'then array['foundation','billingCase','proof','contract','periodFrom','periodTo','recipientKey','selectionFingerprint']
 when'invoice_draft'then array['foundation','draft','invoiceNumber','totalCents','dueDate','positionFingerprint']
 when'invoice_approval'then array['draft','approval','document','approvalVersion','totalCents','documentFingerprint','taxTreatment']
 when'carrier_export'then array['approval','export','recipientIk','specificationVersion','payloadFingerprint','validationResult']
 when'carrier_return'then array['export','carrierReturn','returnCode','returnState','fileFingerprint','nextAction']
 when'invoice_adjustment'then array['approval','adjustment','adjustmentKind','adjustmentCents','reason','approvalEvidence']
 when'payment_entry'then array['openItem','payment','paymentCents','valueDate','bookingReference','allocationFingerprint']
 when'payment_reversal'then array['openItem','payment','reversal','reversalCents','valueDate','reason']
 when'accounting_posting'then array['sourceDocument','posting','postingDate','period','debitAccount','creditAccount','amountCents']
 when'accounting_reconciliation'then array['posting','externalJournalReference','reconciliationState','evidenceFingerprint']
 when'dunning_notice'then array['openItem','notice','stage','remainingCents','paymentRevision','nextReviewOn']
 when'dunning_dispatch'then array['notice','dispatch','recipient','channel','authorizationEvidence','deliveryEvidence']
 when'direct_debit_mandate'then array['mandate','mandateReference','signedOn','creditorId','mandateFingerprint']
 when'direct_debit_collection'then array['openItem','mandate','directDebit','collectionCents','dueDate','collectionState','bankReference']
 when'cost_share_assessment'then array['approval','costShare','payerCents','personalCents','basis','assessmentFingerprint']
 when'period_closure'then array['closure','periodFrom','periodTo','invoiceCount','invoiceTotalCents','approvalEvidence']
 when'correction'then array['targetId','reason','correctionEvidence']else null end$$;
create or replace function client_billing_private.validate_command(cmd jsonb,src jsonb)returns void language plpgsql set search_path='' as $$
declare keys text[];actual text[];command_keys text[];kind text:=cmd->>'kind';v text;p jsonb:=cmd->'payload';begin
 select array_agg(x order by x)into command_keys from jsonb_object_keys(cmd)x;
 if jsonb_typeof(cmd)is distinct from'object'or command_keys is distinct from array['actorId','clientId','eventId','expectedHeadId','kind','note','occurredAt','payload','requestId','tenantId','version']::text[]or cmd->>'version'<>'2026-10-16.1'or cmd->>'requestId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'eventId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'tenantId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'clientId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or cmd->>'actorId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'or(cmd->'expectedHeadId'<>'null'::jsonb and cmd->>'expectedHeadId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')or cmd->>'occurredAt'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'or nullif(btrim(cmd->>'note'),'')is null or length(cmd->>'note')>4000 or jsonb_typeof(p)is distinct from'object'then raise exception using errcode='22023',message='Abrechnungsanfrage ist unvollständig.';end if;
 keys:=client_billing_private.payload_keys(kind);if keys is null then raise exception using errcode='22023',message='Vorgangsart ist unbekannt.';end if;
 select array_agg(x order by x)into actual from jsonb_object_keys(cmd->'payload')x;if actual is distinct from(select array_agg(x order by x)from unnest(keys)x)then raise exception using errcode='22023',message='Vorgangsfelder sind nicht vollständig oder enthalten Fremdfelder.';end if;
 for v in select value#>>'{}'from jsonb_each(cmd->'payload')where jsonb_typeof(value)='string'loop if nullif(btrim(v),'')is null then raise exception using errcode='22023',message='Leeres Vorgangsfeld.';end if;end loop;
 perform client_billing_private.walk_sources(p,src);
 case kind
  when'foundation_review'then perform client_billing_private.require_source(p,'foundation',array['foundation'],src);perform client_billing_private.require_source(p,'billingCase',array['billing_case'],src);perform client_billing_private.require_source(p,'proof',array['proof'],src);perform client_billing_private.require_source(p,'contract',array['contract','financing'],src);perform client_billing_private.require_date(p,'periodFrom');perform client_billing_private.require_date(p,'periodTo');
  when'invoice_draft'then perform client_billing_private.require_source(p,'foundation',array['foundation'],src);perform client_billing_private.require_source(p,'draft',array['draft'],src);perform client_billing_private.require_amount(p,'totalCents');perform client_billing_private.require_date(p,'dueDate');
  when'invoice_approval'then perform client_billing_private.require_source(p,'draft',array['draft'],src);perform client_billing_private.require_source(p,'approval',array['approval'],src);perform client_billing_private.require_source(p,'document',array['document'],src);perform client_billing_private.require_amount(p,'totalCents');
  when'carrier_export'then perform client_billing_private.require_source(p,'approval',array['approval'],src);perform client_billing_private.require_source(p,'export',array['export'],src);
  when'carrier_return'then perform client_billing_private.require_source(p,'export',array['export'],src);perform client_billing_private.require_source(p,'carrierReturn',array['carrier_return'],src);
  when'invoice_adjustment'then perform client_billing_private.require_source(p,'approval',array['approval'],src);perform client_billing_private.require_source(p,'adjustment',array['adjustment'],src);perform client_billing_private.require_amount(p,'adjustmentCents');
  when'payment_entry'then perform client_billing_private.require_source(p,'openItem',array['open_item'],src);perform client_billing_private.require_source(p,'payment',array['payment'],src);perform client_billing_private.require_amount(p,'paymentCents');perform client_billing_private.require_date(p,'valueDate');
  when'payment_reversal'then perform client_billing_private.require_source(p,'openItem',array['open_item'],src);perform client_billing_private.require_source(p,'payment',array['payment'],src);perform client_billing_private.require_source(p,'reversal',array['payment'],src);perform client_billing_private.require_amount(p,'reversalCents');perform client_billing_private.require_date(p,'valueDate');
  when'accounting_posting'then perform client_billing_private.require_source(p,'sourceDocument',array['accounting_source','approval','adjustment','payment'],src);perform client_billing_private.require_source(p,'posting',array['accounting_posting'],src);perform client_billing_private.require_date(p,'postingDate');perform client_billing_private.require_amount(p,'amountCents');
  when'accounting_reconciliation'then perform client_billing_private.require_source(p,'posting',array['accounting_posting'],src);
  when'dunning_notice'then perform client_billing_private.require_source(p,'openItem',array['open_item'],src);perform client_billing_private.require_source(p,'notice',array['dunning'],src);perform client_billing_private.require_amount(p,'remainingCents');perform client_billing_private.require_date(p,'nextReviewOn');
  when'dunning_dispatch'then perform client_billing_private.require_source(p,'notice',array['dunning'],src);perform client_billing_private.require_source(p,'dispatch',array['dunning_dispatch'],src);
  when'direct_debit_mandate'then perform client_billing_private.require_source(p,'mandate',array['mandate'],src);perform client_billing_private.require_date(p,'signedOn');
  when'direct_debit_collection'then perform client_billing_private.require_source(p,'openItem',array['open_item'],src);perform client_billing_private.require_source(p,'mandate',array['mandate'],src);perform client_billing_private.require_source(p,'directDebit',array['direct_debit'],src);perform client_billing_private.require_amount(p,'collectionCents');perform client_billing_private.require_date(p,'dueDate');
  when'cost_share_assessment'then perform client_billing_private.require_source(p,'approval',array['approval'],src);perform client_billing_private.require_source(p,'costShare',array['cost_share'],src);perform client_billing_private.require_amount(p,'payerCents');perform client_billing_private.require_amount(p,'personalCents');
  when'period_closure'then perform client_billing_private.require_source(p,'closure',array['period_closure'],src);perform client_billing_private.require_date(p,'periodFrom');perform client_billing_private.require_date(p,'periodTo');perform client_billing_private.require_amount(p,'invoiceTotalCents');if(p->>'invoiceCount')!~'^(0|[1-9][0-9]*)$'then raise exception using errcode='22023',message='Rechnungsanzahl ist ungültig.';end if;
  when'correction'then perform client_billing_private.require_uuid(p,'targetId');
 end case;
end$$;

create or replace function client_billing_private.read_context(t uuid,a uuid,c uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare n text;client jsonb;src jsonb;begin
 n:=client_billing_private.actor(t,a,false);select to_jsonb(x)into client from public.clients x where x.tenant_id=t and x.id=c for share;
 if client is null then raise exception using errcode='42501',message='Pflegefall fehlt oder ist nicht zugänglich.';end if;src:=client_billing_private.sources(t,c);
 return jsonb_build_object('version','2026-10-16.1','tenantId',t,'clientId',c,'actorId',a,'loadedAt',to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'client',client,'sources',jsonb_build_object('count',jsonb_array_length(src),'rows',src),'history',client_billing_private.history(t,c));
end$$;
create or replace function client_billing_private.commit_event(cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid:=(cmd->>'tenantId')::uuid;c uuid:=(cmd->>'clientId')::uuid;a uuid:=(cmd->>'actorId')::uuid;rid uuid:=(cmd->>'requestId')::uuid;eid uuid:=(cmd->>'eventId')::uuid;n text;root client_billing_private.roots%rowtype;e client_billing_private.events%rowtype;src jsonb;begin
 n:=client_billing_private.actor(t,a,true);perform 1 from public.clients x where x.tenant_id=t and x.id=c for share;if not found then raise exception using errcode='42501',message='Pflegefall fehlt.';end if;
 lock table public.client_contracts,public.client_financing_paths,public.client_documents,public.pfleger_service_proofs,public.pfleger_billing_cases,public.pfleger_invoice_foundations,public.pfleger_invoice_drafts,public.pfleger_invoice_approvals,public.pfleger_cost_carrier_exports,public.pfleger_cost_carrier_returns,public.pfleger_invoice_adjustments,public.pfleger_receivable_open_items,public.pfleger_receivable_payment_events,public.pfleger_accounting_source_documents,public.pfleger_accounting_postings,public.pfleger_dunning_notices,public.pfleger_dunning_dispatches,public.pfleger_sepa_mandate_versions,public.pfleger_direct_debit_orders,public.pfleger_direct_debit_returns,public.pfleger_invoice_cost_share_assessments,public.pfleger_invoice_period_closures,public.pfleger_invoice_period_closure_invoices in share mode;
 insert into client_billing_private.roots(tenant_id,client_id)values(t,c)on conflict do nothing;select*into root from client_billing_private.roots r where r.tenant_id=t and r.client_id=c for update;
 select*into e from client_billing_private.events z where z.tenant_id=t and z.request_id=rid;if e.id is not null then if e.command is distinct from cmd then raise exception using errcode='23505',message='Anfragekennung gehört zu anderem Inhalt.';end if;return jsonb_build_object('version','2026-10-16.1','requestId',rid,'command',e.command,'event',client_billing_private.event_json(e));end if;
 src:=client_billing_private.sources(t,c);perform client_billing_private.validate_command(cmd,src);
 if(cmd->>'expectedHeadId')is distinct from root.head_id::text then raise exception using errcode='40001',message='Abrechnungsverlauf wurde geändert.';end if;
 if cmd->>'kind'='correction'and not exists(select 1 from client_billing_private.events x where x.tenant_id=t and x.client_id=c and x.id=(cmd#>>'{payload,targetId}')::uuid and x.kind<>'correction'and not exists(select 1 from client_billing_private.events z where z.tenant_id=t and z.client_id=c and z.kind='correction'and z.command#>>'{payload,targetId}'=x.id::text))then raise exception using errcode='23514',message='Nur ein vorhandenes unberichtigtes Original kann berichtigt werden.';end if;
 insert into client_billing_private.events(id,tenant_id,client_id,sequence,previous_id,request_id,actor_id,actor_name,occurred_at,kind,command)values(eid,t,c,coalesce((select max(sequence)+1 from client_billing_private.events where tenant_id=t and client_id=c),1),root.head_id,rid,a,n,(cmd->>'occurredAt')::timestamptz,cmd->>'kind',cmd)returning*into e;
 update client_billing_private.roots set head_id=eid,updated_at=clock_timestamp()where tenant_id=t and client_id=c;
 return jsonb_build_object('version','2026-10-16.1','requestId',rid,'command',cmd,'event',client_billing_private.event_json(e));
end$$;
create or replace function client_billing_private.confirm_event(t uuid,a uuid,c uuid,rid uuid,cmd jsonb)returns jsonb language plpgsql security definer set search_path='' as $$declare e client_billing_private.events%rowtype;begin
 perform client_billing_private.actor(t,a,false);select*into e from client_billing_private.events z where z.tenant_id=t and z.client_id=c and z.request_id=rid;
 if e.id is null or e.command is distinct from cmd or e.actor_id<>a then raise exception using errcode='P0P01',message='Passende native Quittung fehlt.';end if;
 return jsonb_build_object('version','2026-10-16.1','requestId',rid,'command',e.command,'event',client_billing_private.event_json(e));
end$$;

create or replace function public.web_client_billing_context(p_tenant_id uuid,p_client_id uuid,p_actor_id uuid)returns jsonb language sql security invoker set search_path='' as $$select client_billing_private.read_context(p_tenant_id,p_actor_id,p_client_id)$$;
create or replace function public.web_commit_client_billing_event(p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select client_billing_private.commit_event(p_command)$$;
create or replace function public.web_confirm_client_billing_event(p_tenant_id uuid,p_client_id uuid,p_actor_id uuid,p_request_id uuid,p_command jsonb)returns jsonb language sql security invoker set search_path='' as $$select client_billing_private.confirm_event(p_tenant_id,p_actor_id,p_client_id,p_request_id,p_command)$$;
revoke all on function public.web_client_billing_context(uuid,uuid,uuid),public.web_commit_client_billing_event(jsonb),public.web_confirm_client_billing_event(uuid,uuid,uuid,uuid,jsonb)from public,anon;
grant usage on schema client_billing_private to authenticated;
grant execute on function client_billing_private.read_context(uuid,uuid,uuid),client_billing_private.commit_event(jsonb),client_billing_private.confirm_event(uuid,uuid,uuid,uuid,jsonb)to authenticated;
grant execute on function public.web_client_billing_context(uuid,uuid,uuid),public.web_commit_client_billing_event(jsonb),public.web_confirm_client_billing_event(uuid,uuid,uuid,uuid,jsonb)to authenticated;
commit;
