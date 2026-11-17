// Isolated PostgreSQL with the production plan shape and synthetic account scopes.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const schemas = `
create role authenticated;
create role anon;
create schema auth;
create schema care_private;
create schema test_context;
grant usage on schema auth,care_private,test_context to authenticated;
create table public.tenants(id uuid primary key,name text);
create table public.roles(id uuid primary key,key text,name text);
create table public.role_permissions(role_id uuid,permission_key text);
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb);
create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
create table public.profiles(id uuid primary key,tenant_id uuid,role_id uuid,role_key text,is_active boolean,status text,display_name text);
create function test_context.profile_from_auth() returns trigger language plpgsql as $$
begin insert into public.profiles(id) values(new.id); return new; end; $$;
create trigger user_profile after insert on auth.users for each row execute function test_context.profile_from_auth();
create function auth.uid() returns uuid language sql stable as $$
 select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
create function public.resolve_current_profile_id() returns uuid language sql stable security definer set search_path='' as $$
  select p.id from public.profiles p where p.id=auth.uid() and p.is_active and p.status='active'
    and exists (select 1 from auth.sessions s where s.user_id=p.id and s.not_after>now() and s.id=
      (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid)
$$;
create function public.current_tenant_id() returns uuid language sql stable security definer set search_path='' as $$
 select p.tenant_id from public.profiles p where p.id=public.resolve_current_profile_id()
$$;
create function public.current_portal_type() returns text language sql stable as $$ select 'business'::text $$;
create function public.has_permission(permission text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.role_permissions r on r.role_id=p.role_id
   where p.id=public.resolve_current_profile_id() and r.permission_key=permission)
$$;
create table public.clients(id uuid primary key,tenant_id uuid,first_name text,last_name text,status text,lifecycle_status text,deleted_at timestamptz);
create table public.client_module_assignments(tenant_id uuid,client_id uuid,module_key text,status text,is_active boolean);
create function public.is_active_pfleger_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.clients c join public.client_module_assignments a on a.tenant_id=c.tenant_id and a.client_id=c.id
   where c.id=p_client_id and c.tenant_id=public.current_tenant_id() and c.status='active'
    and a.module_key='pflege' and a.is_active and a.status not in ('inactive','deactivated','archiviert'))
$$;
create table public.employees(id uuid primary key,tenant_id uuid);
create table public.care_assessments(id uuid primary key,tenant_id uuid,subject_id uuid,subject_type text,variant text,status text,version int,approved_at timestamptz);
create type public.care_plan_status as enum ('draft','active','paused','completed','archived');
create type public.care_plan_item_status as enum ('active','paused','completed','cancelled');
create table public.care_plans(id uuid primary key,tenant_id uuid not null references public.tenants(id),client_id uuid not null references public.clients(id),
 title text not null,description text,goals text,resources text,risks text,valid_from date,valid_until date,
 source_assessment_id uuid references public.care_assessments(id),primary_nurse_id uuid references public.employees(id),
 status public.care_plan_status,version int,created_by uuid references public.profiles(id),updated_by uuid,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.care_plan_items(id uuid primary key,tenant_id uuid not null references public.tenants(id),
 care_plan_id uuid not null references public.care_plans(id),title text,category text,description text,goal text,intervention text,frequency text,
 timing text,responsible_role text,person_contribution text,relatives_contribution text,warning_signs text,escalation_path text,
 evaluation_criteria text,evaluation_interval_days int,next_evaluation_date date,status public.care_plan_item_status,sort_order int,notes text,
 created_by uuid,updated_by uuid,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.care_plan_versions(id uuid primary key default gen_random_uuid(),tenant_id uuid,care_plan_id uuid,version int,snapshot jsonb,
 reason text,actor_id uuid,actor_name text,created_at timestamptz default now(),unique(care_plan_id,version));
create table public.care_audit_events(id uuid primary key default gen_random_uuid(),tenant_id uuid,client_id uuid,care_plan_id uuid,entity_type text,
 entity_id uuid,action text,summary text,before_data jsonb,after_data jsonb,actor_id uuid,actor_name text);
alter table public.care_plans enable row level security;
grant select on public.care_plans to authenticated;
create policy plan_read on public.care_plans for select to authenticated using (
 tenant_id=public.current_tenant_id() and public.has_permission('pflege.plans.view')
);
`;

const migrations = readdirSync(new URL('../migrations/', import.meta.url));
async function apply(db, name) {
  const files = migrations.filter(file => file.endsWith('_' + name + '.sql'));
  assert.equal(files.length, 1, name);
  await db.exec(read('../migrations/' + files[0]));
}

test('existing plan versions, item identity, idempotent saves and respiratory record access', async () => {
  const db = new PGlite();
  try {
    await db.exec(schemas);
    for (const name of ['ambulatory_plan_editor', 'care_plan_respiratory_assessment']) {
      await apply(db, name);
    }
    const proof = await db.exec(read('./ambulatory_plan_editor_staging.sql'));
    assert.match(proof.find(part => part.rows[0]?.result)?.rows[0]?.result ?? '', /Revisionen gesichert/);
    const count = await db.query('select count(*)::int as count from public.care_plans');
    assert.equal(count.rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test('records, rereads and revises a drinking entry while keeping direct tables closed', async () => {
  const db = new PGlite();
  try {
    await db.exec(schemas);
    const original = read('../patches/daily_care_protocols.sql');
    await db.exec(original.slice(original.indexOf('create table'), original.indexOf('grant select on public.care_protocol_roots')));
    await db.exec(read('../patches/ambulatory_daily_protocols_review.sql'));
    const proof = await db.exec(read('./ambulatory_daily_protocols_staging.sql'));
    assert.equal(proof.find(part => part.rows[0]?.result)?.rows[0]?.result, 'Protokollrecht, Aufnahme und Berichtigung bestätigt');
    const count = await db.query('select count(*)::int as count from public.care_protocol_events');
    assert.equal(count.rows[0].count, 0);
  } finally {
    await db.close();
  }
});
