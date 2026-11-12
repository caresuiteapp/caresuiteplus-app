-- A confirmed BMP row can be the source of one explicitly saved order. This
-- migration does not create or change orders, confirmations, or administrations.
alter table public.medications
  add column bmp_import_id uuid,
  add column bmp_row_index integer,
  add constraint medications_bmp_confirmation_fk
    foreign key (bmp_import_id, bmp_row_index)
    references medication_plan_import_private.medication_plan_import_confirmations(import_id, row_index) match full;

create unique index medications_bmp_position_unique
  on public.medications (bmp_import_id, bmp_row_index) where bmp_import_id is not null;

comment on column public.medications.bmp_import_id is
  'Unveränderlicher Herkunftsbezug auf die einzeln geprüfte Originalposition. Kein Nachweis unveränderter Verordnungsinhalte.';

create function medication_plan_import_private.require_confirmed_medication_position(
  p_tenant uuid, p_actor uuid, p_client uuid, p_import uuid, p_row_index integer, p_write boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  position jsonb;
  slot_key text;
  slot_value text;
  slots text[] := '{}';
  positive_amount text;
  dose_unit text;
  -- JavaScript trim whitespace, matching the parsed position eligibility.
  whitespace constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if p_client is null or p_import is null or p_row_index is null or p_row_index not between 0 and 199 then
    raise exception 'Ein bestätigter Bezug zur Medikationsplan-Position ist erforderlich.' using errcode = '22023';
  end if;
  perform medication_plan_import_private.guard_medication_plan_import(p_tenant, p_actor, p_client, p_write);
  select i.plan->'rows'->p_row_index into position
    from medication_plan_import_private.medication_plan_imports i
    join medication_plan_import_private.medication_plan_import_confirmations r on r.import_id = i.id
    where i.tenant_id = p_tenant and i.client_id = p_client and i.id = p_import and r.row_index = p_row_index;
  if position->>'kind' is distinct from 'medication' then
    raise exception 'Bestätigte Medikationsplan-Position nicht verfügbar.' using errcode = '42501';
  end if;
  if jsonb_typeof(position->'section') is distinct from 'object'
    or position#>'{section,label}' is distinct from 'null'::jsonb
    or (position#>'{section,code}' is distinct from 'null'::jsonb and position#>'{section,code}' is distinct from '"412"'::jsonb)
    or position->'weekdayCode' is distinct from 'null'::jsonb
    or position->'doseText' is distinct from 'null'::jsonb
    or not (position ?& array['instructions','additionalText','unit','unitCode','morning','noon','evening','night'])
    or jsonb_typeof(position->'instructions') not in ('string','null')
    or jsonb_typeof(position->'additionalText') not in ('string','null')
    or btrim(coalesce(position->>'instructions',''), whitespace) <> ''
    or btrim(coalesce(position->>'additionalText',''), whitespace) <> '' then
    raise exception 'Diese Position muss anhand des Originals separat erfasst werden.' using errcode = '22023';
  end if;
  if jsonb_typeof(position->'unitCode') = 'string' and position->'unit' = 'null'::jsonb then
    dose_unit := case position->>'unitCode'
      when '1' then 'Stück' when '5' then 'Hub' when '6' then 'Tropfen' when 'p' then 'IE'
      when 's' then 'ml' when 't' then 'g' when 'v' then 'mg' end;
  elsif jsonb_typeof(position->'unit') = 'string' and position->'unitCode' = 'null'::jsonb
    and position->>'unit' in ('Stück','Hub','Tropfen','IE','ml','g','mg','µg','Tablette','Kapsel') then
    dose_unit := position->>'unit';
  end if;
  if dose_unit is null then
    raise exception 'Die Dosiseinheit ist nicht eindeutig übertragbar.' using errcode = '22023';
  end if;
  foreach slot_key in array array['morning','noon','evening','night'] loop
    if position->slot_key = 'null'::jsonb then
      slot_value := '0';
    elsif jsonb_typeof(position->slot_key) = 'string' and position->>slot_key ~ '^(0|[1-9][0-9]{0,3})$' then
      slot_value := position->>slot_key;
    else
      raise exception 'Die Tageszeit-Dosen sind nicht eindeutig übertragbar.' using errcode = '22023';
    end if;
    if slot_value <> '0' then
      if positive_amount is not null and slot_value <> positive_amount then
        raise exception 'Die Tageszeit-Dosen sind nicht eindeutig übertragbar.' using errcode = '22023';
      end if;
      positive_amount := slot_value;
    end if;
    slots := array_append(slots, slot_value);
  end loop;
  if positive_amount is null then
    raise exception 'Die Tageszeit-Dosen sind nicht eindeutig übertragbar.' using errcode = '22023';
  end if;
  return jsonb_build_object('schedule', array_to_string(slots, '-'), 'dosage', positive_amount || ' ' || dose_unit,
    'morning', nullif(slots[1], '0'), 'noon', nullif(slots[2], '0'), 'evening', nullif(slots[3], '0'), 'night', nullif(slots[4], '0'));
end;
$$;

create function medication_plan_import_private.guard_medication_bmp_order_link()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare expected jsonb;
begin
  if tg_op = 'DELETE' then
    if old.bmp_import_id is not null then
      raise exception 'Die Verordnung mit Medikationsplan-Bezug muss in der Historie erhalten bleiben.' using errcode = '42501';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if (new.bmp_import_id, new.bmp_row_index) is distinct from (old.bmp_import_id, old.bmp_row_index)
      or (old.bmp_import_id is not null and (new.id, new.tenant_id, new.client_id) is distinct from (old.id, old.tenant_id, old.client_id)) then
      raise exception 'Der Medikationsplan-Bezug darf nicht nachträglich geändert werden.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.bmp_import_id is not null or new.bmp_row_index is not null then
    if new.created_by is null or new.updated_by is distinct from new.created_by then
      raise exception 'Das speichernde Benutzerprofil konnte nicht bestätigt werden.' using errcode = '42501';
    end if;
    expected := medication_plan_import_private.require_confirmed_medication_position(
      new.tenant_id, new.created_by, new.client_id, new.bmp_import_id, new.bmp_row_index, true
    );
    if coalesce(new.route, '') !~ '[^[:space:]]' or coalesce(new.prescribed_by, '') !~ '[^[:space:]]'
      or new.start_date is null or new.start_date not between date '0001-01-01' and date '9999-12-31' then
      raise exception 'Applikationsweg, verordnende Person und bestätigter Therapiebeginn sind erforderlich.' using errcode = '23514';
    end if;
    if (new.schedule, new.dosage, new.morning_dose, new.noon_dose, new.evening_dose, new.night_dose, new.is_prn)
      is distinct from (expected->>'schedule', expected->>'dosage', expected->>'morning', expected->>'noon', expected->>'evening', expected->>'night', false) then
      raise exception 'Dosierung und Gabezeiten müssen der geprüften Medikationsplan-Position entsprechen.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger medication_bmp_order_link_guard before insert or delete or update of id, tenant_id, client_id, bmp_import_id, bmp_row_index
  on public.medications for each row execute function medication_plan_import_private.guard_medication_bmp_order_link();

-- The private helper authorizes access to the immutable source. Read the order
-- as the caller so any additional order policy remains effective.
create function public.get_medication_plan_order_link(
  p_tenant uuid, p_actor uuid, p_client uuid, p_import uuid, p_row_index integer
)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  perform medication_plan_import_private.require_confirmed_medication_position(
    p_tenant, p_actor, p_client, p_import, p_row_index, false
  );
  return (select m.id from public.medications m
    where m.bmp_import_id = p_import and m.bmp_row_index = p_row_index
      and m.tenant_id = p_tenant and m.client_id = p_client);
end;
$$;

revoke all on function medication_plan_import_private.require_confirmed_medication_position(uuid,uuid,uuid,uuid,integer,boolean),
  medication_plan_import_private.guard_medication_bmp_order_link(), public.get_medication_plan_order_link(uuid,uuid,uuid,uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function medication_plan_import_private.require_confirmed_medication_position(uuid,uuid,uuid,uuid,integer,boolean),
  public.get_medication_plan_order_link(uuid,uuid,uuid,uuid,integer) to authenticated;

notify pgrst, 'reload schema';
