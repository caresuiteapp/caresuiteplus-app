-- Existing table-level UPDATE grants must not expose the new structured facts to direct clients.
create or replace function care_private.guard_medication_order_facts()
returns trigger language plpgsql security invoker set search_path='' as $$
declare next_facts jsonb;previous_facts jsonb:='[null,null,null,null,null,null]'::jsonb;
begin
 next_facts:=jsonb_build_array(new.prescribed_dose,new.dose_unit,new.minimum_interval_minutes,new.maximum_dose,new.maximum_dose_unit,new.maximum_period_hours);
 if tg_op='UPDATE' then previous_facts:=jsonb_build_array(old.prescribed_dose,old.dose_unit,old.minimum_interval_minutes,old.maximum_dose,old.maximum_dose_unit,old.maximum_period_hours);end if;
 if next_facts is distinct from previous_facts and current_user not in('postgres','service_role') then
  raise exception 'Strukturierte Verordnungsangaben benötigen einen freigegebenen serverseitigen Originalbeleg.' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function care_private.guard_medication_order_facts() from public,anon,authenticated;
create trigger medication_structured_order_guard before insert or update on public.medications for each row execute function care_private.guard_medication_order_facts();
