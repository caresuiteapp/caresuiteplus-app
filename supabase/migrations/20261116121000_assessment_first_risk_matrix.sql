-- The optional matrix belongs to the same assessment draft and version snapshot.
-- The guarded assessment draft writer persists it with the other clinical fields.
begin;

create schema if not exists care_private;

create or replace function care_private.valid_first_risk_matrix(matrix jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  topic_keys constant text[] := array[
    'cognition_communication', 'mobility', 'disease_demands', 'self_care', 'social_relationships'
  ];
  risk_keys constant text[] := array['pressure_injury', 'fall', 'continence', 'pain', 'nutrition', 'other'];
  cell_key text;
  cell jsonb;
  topic text;
  counseling jsonb;
begin
  if jsonb_typeof(matrix) is distinct from 'object'
    or matrix - array['otherLabel', 'cells', 'counseling'] <> '{}'::jsonb
    or jsonb_typeof(matrix->'otherLabel') is distinct from 'string'
    or length(matrix->>'otherLabel') > 160
    or jsonb_typeof(matrix->'cells') is distinct from 'object'
    or jsonb_typeof(matrix->'counseling') is distinct from 'object'
  then return false;
  end if;

  for cell_key, cell in select key, value from jsonb_each(matrix->'cells') loop
    if array_length(string_to_array(cell_key, ':'), 1) is distinct from 2
      or not (split_part(cell_key, ':', 1) = any(topic_keys))
      or not (split_part(cell_key, ':', 2) = any(risk_keys))
      or jsonb_typeof(cell) is distinct from 'object'
      or cell - array['present', 'furtherAssessment'] <> '{}'::jsonb
      or jsonb_typeof(cell->'present') is distinct from 'boolean'
      or coalesce(jsonb_typeof(cell->'furtherAssessment'), '') not in ('null', 'boolean')
      or (cell->'present' = 'false'::jsonb and cell->'furtherAssessment' <> 'null'::jsonb)
    then return false;
    end if;
  end loop;

  for topic, counseling in select key, value from jsonb_each(matrix->'counseling') loop
    if not (topic = any(topic_keys)) or jsonb_typeof(counseling) is distinct from 'boolean'
    then return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke execute on function care_private.valid_first_risk_matrix(jsonb) from public, anon;
grant execute on function care_private.valid_first_risk_matrix(jsonb) to authenticated;

alter table public.care_assessments
  add column if not exists first_risk_matrix jsonb;

alter table public.care_assessments
  add constraint care_assessments_first_risk_matrix_shape
    check (first_risk_matrix is null or care_private.valid_first_risk_matrix(first_risk_matrix)) not valid;

alter table public.care_assessments validate constraint care_assessments_first_risk_matrix_shape;

commit;
