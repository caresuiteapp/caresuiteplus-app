-- CareSuite · Christian Reinhardt · Arbeitszeiterfassung R4
-- Erweiterung um Abschlussbemerkung und getrennte GPS-Nachweise für Beginn/Ende.
-- Bestehende Zeiterfassungen und Tätigkeiten bleiben unverändert erhalten.

begin;

alter table public.christian_worktime
  add column if not exists remark text,
  add column if not exists started_lat double precision,
  add column if not exists started_lng double precision,
  add column if not exists started_accuracy_m double precision,
  add column if not exists started_location_at timestamptz,
  add column if not exists ended_lat double precision,
  add column if not exists ended_lng double precision,
  add column if not exists ended_accuracy_m double precision,
  add column if not exists ended_location_at timestamptz;

alter table public.christian_worktime
  drop constraint if exists christian_worktime_remark_length,
  add constraint christian_worktime_remark_length
    check (remark is null or char_length(remark) <= 2000),
  drop constraint if exists christian_worktime_started_lat_range,
  add constraint christian_worktime_started_lat_range
    check (started_lat is null or started_lat between -90 and 90),
  drop constraint if exists christian_worktime_started_lng_range,
  add constraint christian_worktime_started_lng_range
    check (started_lng is null or started_lng between -180 and 180),
  drop constraint if exists christian_worktime_ended_lat_range,
  add constraint christian_worktime_ended_lat_range
    check (ended_lat is null or ended_lat between -90 and 90),
  drop constraint if exists christian_worktime_ended_lng_range,
  add constraint christian_worktime_ended_lng_range
    check (ended_lng is null or ended_lng between -180 and 180),
  drop constraint if exists christian_worktime_started_accuracy_range,
  add constraint christian_worktime_started_accuracy_range
    check (started_accuracy_m is null or started_accuracy_m between 0 and 100000),
  drop constraint if exists christian_worktime_ended_accuracy_range,
  add constraint christian_worktime_ended_accuracy_range
    check (ended_accuracy_m is null or ended_accuracy_m between 0 and 100000);

comment on column public.christian_worktime.remark is
  'Optionale Abschlussbemerkung zur erfassten Arbeitszeit; max. 2.000 Zeichen.';
comment on column public.christian_worktime.started_lat is
  'GPS-Breitengrad beim Beginn der Zeiterfassung.';
comment on column public.christian_worktime.started_lng is
  'GPS-Längengrad beim Beginn der Zeiterfassung.';
comment on column public.christian_worktime.started_accuracy_m is
  'Vom Endgerät gemeldete GPS-Genauigkeit beim Beginn in Metern.';
comment on column public.christian_worktime.started_location_at is
  'Zeitstempel der GPS-Messung beim Beginn.';
comment on column public.christian_worktime.ended_lat is
  'GPS-Breitengrad beim Ende der Zeiterfassung.';
comment on column public.christian_worktime.ended_lng is
  'GPS-Längengrad beim Ende der Zeiterfassung.';
comment on column public.christian_worktime.ended_accuracy_m is
  'Vom Endgerät gemeldete GPS-Genauigkeit beim Ende in Metern.';
comment on column public.christian_worktime.ended_location_at is
  'Zeitstempel der GPS-Messung beim Ende.';

grant usage on schema public to service_role;
grant select, insert, update on table public.christian_worktime to service_role;
grant select, insert on table public.christian_worktime_audit to service_role;

notify pgrst, 'reload schema';

commit;

select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'christian_worktime'
      and column_name = 'remark'
  ) as bemerkung_aktiv,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'christian_worktime'
      and column_name = 'started_lat'
  ) as startstandort_aktiv,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'christian_worktime'
      and column_name = 'ended_lat'
  ) as endstandort_aktiv;
