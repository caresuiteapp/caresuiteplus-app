-- Apply after the wound workspace and record patches. The two writes share
-- the case request's transaction and receipt so a retry cannot add a second point.
create or replace function care_private.create_wound_with_location(r uuid, request_payload jsonb, mark jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  tenant uuid := public.current_tenant_id();
  actor uuid := public.resolve_current_profile_id();
  subject uuid;
  wound uuid;
  confirmed_at timestamptz;
  already_received boolean;
  coordinates jsonb;
begin
  perform care_private.assert_wound_record_scope(tenant, actor, null, null, true);
  if r is null or request_payload->>'action' is distinct from 'create'
    or jsonb_typeof(mark) is distinct from 'object' or pg_column_size(mark) > 3200
    or mark->>'kind' is distinct from 'Wunde' or mark->>'text' is distinct from ''
    or char_length(mark->>'name') not between 1 and 120
    or not (mark ?& array['name','kind','text','figure','focusRegion','side','target','yaw','pitch','height','detailAngle','anatomyIndex','clinical'])
    or (mark-array['name','kind','text','figure','focusRegion','side','target','yaw','pitch','height','detailAngle','anatomyIndex','clinical','point','diagram'])<>'{}'::jsonb
    or (mark ? 'point') = (mark ? 'diagram')
    or coalesce(mark->>'side','') not in ('left','right')
    or (mark->>'focusRegion' is not null and mark->>'focusRegion' not in
      ('torso','hand','foot','eye','ear','head','back','arm','knee','pelvis'))
    or jsonb_typeof(mark->'clinical') is distinct from 'boolean'
    or (mark->>'figure' in ('boy','girl') and mark->'clinical' = 'true'::jsonb) then
    raise exception '3D-Lokalisation prüfen.' using errcode = '22023';
  end if;
  for coordinates in select mark->'target' union all select mark->'point' where mark ? 'point' loop
    if jsonb_typeof(coordinates) is distinct from 'array' then
      raise exception '3D-Koordinaten prüfen.' using errcode = '22023';
    end if;
    if jsonb_array_length(coordinates) <> 3 or exists (
      select from jsonb_array_elements(coordinates) x(value)
      where case when jsonb_typeof(x.value) = 'number' then (x.value::text)::numeric not between -5 and 5 else true end
    ) then
      raise exception '3D-Koordinaten prüfen.' using errcode = '22023';
    end if;
  end loop;
  if mark ? 'diagram' and (jsonb_typeof(mark->'diagram') is distinct from 'object'
    or not ((mark->'diagram') ?& array['view','x','y'])
    or ((mark->'diagram')-array['view','x','y'])<>'{}'::jsonb
    or not jsonb_path_exists(mark->'diagram', 'strict $ ? (@.view == 0 || @.view == 1 || @.view == 2)')
    or not jsonb_path_exists(mark->'diagram', 'strict $ ? (@.x >= 0 && @.x <= 100 && @.y >= 0 && @.y <= 100)')) then
    raise exception 'Position im Körperschema prüfen.' using errcode = '22023';
  end if;
  if not jsonb_path_exists(mark, 'strict $ ? (@.yaw >= -10000 && @.yaw <= 10000 && @.pitch >= -2 && @.pitch <= 2 && @.height >= 0.01 && @.height <= 5)') then
    raise exception '3D-Ansicht der Lokalisation prüfen.' using errcode = '22023';
  end if;
  perform care_private.validate_wound_record_entry('body_mark', mark);

  perform pg_advisory_xact_lock(hashtextextended(tenant||':wound-documentation-request:'||r,0));
  select exists(select 1 from care_private.wound_requests x where x.tenant_id=tenant and x.request_id=r)
    into already_received;
  wound := care_private.write_wound_documentation(r, request_payload);
  subject := (request_payload->>'subjectId')::uuid;
  if mark->>'name' is distinct from btrim((request_payload->>'dataJson')::jsonb->>'bodyLocation') then
    raise exception '3D-Markierung und Wundlokalisation müssen übereinstimmen.' using errcode = '22023';
  end if;
  if already_received and not exists (
    select 1 from public.ambulatory_wound_clinical_entries x
      where x.tenant_id=tenant and x.id=r and x.wound_case_id=wound and x.kind='body_mark'
  ) then
    raise exception 'Anfrage mit anderen Daten verwendet.' using errcode = '23514';
  end if;
  select x.created_at into strict confirmed_at from care_private.wound_requests x
    where x.tenant_id=tenant and x.request_id=r;
  perform care_private.write_wound_record_entry(tenant, actor, subject, wound, r, 'body_mark', confirmed_at, mark);
  return wound;
end $$;

create or replace function public.create_ambulatory_wound_with_location(request_id uuid, payload jsonb, body_mark jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select care_private.create_wound_with_location(request_id, payload, body_mark)
$$;

revoke all on function care_private.create_wound_with_location(uuid,jsonb,jsonb),
  public.create_ambulatory_wound_with_location(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function care_private.create_wound_with_location(uuid,jsonb,jsonb),
  public.create_ambulatory_wound_with_location(uuid,jsonb,jsonb) to authenticated;
