-- Quarantined follow-up: bind full current order application and archive evidence in every ledger token.
create or replace function care_private.medication_daily_plan_ledger_fingerprint(p_tenant uuid,p_medication uuid)
returns text language plpgsql security definer set search_path='' as $$
declare m public.medications%rowtype;plans jsonb;reviews jsonb;app jsonb;originals jsonb;actor uuid:=public.resolve_current_profile_id();
begin
 perform care_private.require_workspace_session(p_tenant,actor);
 select * into m from public.medications where id=p_medication and tenant_id=p_tenant for share;
 if m.id is null then raise exception 'Tagesplanledger nicht zugänglich.' using errcode='42501';end if;
 perform care_private.lock_medication_source_scope(p_tenant,m.client_id,m.id,actor);
 select coalesce(jsonb_agg(care_private.medication_daily_plan_json(p.id) order by p.recorded_at,p.id),'[]'::jsonb) into plans from care_private.medication_daily_plans p where p.tenant_id=p_tenant and p.medication_id=p_medication and p.client_id=m.client_id;
 select coalesce(jsonb_agg(care_private.medication_daily_plan_review_json(q.id) order by q.recorded_at,q.id),'[]'::jsonb) into reviews from care_private.medication_daily_plan_review_requests q join care_private.medication_daily_plans p on p.id=q.plan_id where q.tenant_id=p_tenant and p.tenant_id=p_tenant and p.medication_id=p_medication and p.client_id=m.client_id;
 app:=care_private.current_medication_order_application(p_tenant,m.client_id,m.id);
 if app is not null then originals:=care_private.medication_order_archived_source(p_tenant,m.client_id,m.id,(app->>'source_id')::uuid);end if;
 return care_private.medication_json_fingerprint(jsonb_build_object('order',to_jsonb(m),'orderApplication',app,'source',originals,'plans',plans,'reviews',reviews));
end$$;
revoke all on function care_private.medication_daily_plan_ledger_fingerprint(uuid,uuid) from public,anon,authenticated,service_role;

