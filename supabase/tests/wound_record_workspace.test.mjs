import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const fixtures = {
  tenant: '00000000-0000-4000-8000-000000000001',
  otherTenant: '00000000-0000-4000-8000-000000000002',
  actor: '00000000-0000-4000-8000-000000000003',
  patient: '00000000-0000-4000-8000-000000000004',
  child: '00000000-0000-4000-8000-000000000005',
  wound: '00000000-0000-4000-8000-000000000006',
  otherWound: '00000000-0000-4000-8000-000000000007',
  assessment: '00000000-0000-4000-8000-000000000008',
  consent: '00000000-0000-4000-8000-000000000009',
  photo: '00000000-0000-4000-8000-000000000010',
  entry: '00000000-0000-4000-8000-000000000011',
  article: '00000000-0000-4000-8000-000000000012',
};
const { tenant, otherTenant, actor, patient, child, wound, otherWound, assessment, consent, photo, entry, article } = fixtures;
const patch = readFileSync(new URL('../patches/ambulatory_wound_record.sql', import.meta.url), 'utf8');
const now = '2026-08-01T08:00:00.000Z';

test('wound client lookup reads both client schemas and respects the current status and assignment', async () => {
  const release = readFileSync(new URL('../patches/ambulatory_wound_release_access.sql', import.meta.url), 'utf8');
  const lookup = release.match(/^create or replace function care_private\.wound_active_client\(subject uuid\)[\s\S]*?^\$\$;/m);
  assert.ok(lookup);

  const db = await PGlite.create();
  try {
    await db.exec(`
      create schema care_private;
      create type public.client_status as enum ('active', 'aktiv', 'archived');
      create table public.clients (
        id uuid primary key, tenant_id uuid, status public.client_status, deleted_at timestamptz
      );
      create table public.client_module_assignments (
        tenant_id uuid, client_id uuid, module_key text, is_active boolean, status text
      );
      create function public.current_tenant_id() returns uuid language sql as $$select '${tenant}'::uuid$$;
      create function public.resolve_current_profile_id() returns uuid language sql as $$select '${actor}'::uuid$$;
      create function care_private.require_wound_workspace_session(t uuid, a uuid)
      returns void language plpgsql as $$
      begin
        if t is distinct from public.current_tenant_id() or a is distinct from public.resolve_current_profile_id() then
          raise exception 'Invalid fixture scope';
        end if;
      end
      $$;
      insert into public.clients values ('${patient}', '${tenant}', 'active', null),
        ('${child}', '${otherTenant}', 'active', null);
      insert into public.client_module_assignments values ('${tenant}', '${patient}', 'pflege', true, 'aktiv'),
        ('${otherTenant}', '${child}', 'pflege', true, 'active');
    `);
    await db.exec(lookup[0]);
    const isActive = async (id) =>
      (await db.query('select care_private.wound_active_client($1) as active', [id])).rows[0].active;

    assert.equal(await isActive(patient), true);
    assert.equal(await isActive(child), false);
    await db.exec('begin read only');
    assert.equal(await isActive(patient), true);
    await db.exec('commit');
    await db.exec("update public.client_module_assignments set is_active=false where status='aktiv'");
    assert.equal(await isActive(patient), false);
    await db.exec("update public.client_module_assignments set is_active=true where status='aktiv'");
    await db.exec("update public.clients set status='archived' where tenant_id=current_tenant_id()");
    assert.equal(await isActive(patient), false);
    await db.exec("update public.clients set status='aktiv' where tenant_id=current_tenant_id()");

    await db.exec('alter table public.clients add column lifecycle_status text');
    assert.equal(await isActive(patient), false);
    await db.exec("update public.clients set lifecycle_status='archived' where tenant_id=current_tenant_id()");
    assert.equal(await isActive(patient), false);
    await db.exec("update public.clients set lifecycle_status='active' where tenant_id=current_tenant_id()");
    assert.equal(await isActive(patient), true);
    await db.exec('update public.clients set deleted_at=clock_timestamp() where tenant_id=current_tenant_id()');
    assert.equal(await isActive(patient), false);
  } finally {
    await db.close();
  }
});

test('Wundakte bindings, immutable entries, media promotion, catalog and statistics', async () => {
  const db = await PGlite.create();
  try {
    // The existing workspace authorities are represented by scoped, explicit synthetic data.
    // The patch and every new policy, edge of the role grant and RPC execute unchanged.
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema care_private; create schema storage;
      grant usage on schema care_private,storage,auth to authenticated;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('wound_test.actor',true),'')::uuid$$;
      create function public.current_tenant_id() returns uuid language sql as $$select nullif(current_setting('wound_test.tenant',true),'')::uuid$$;
      create function public.resolve_current_profile_id() returns uuid language sql as $$select auth.uid()$$;

      create table public.tenants(id uuid primary key);
      create table public.profiles(id uuid primary key,tenant_id uuid,display_name text,can_write boolean default false);
      create table public.clients(id uuid primary key,tenant_id uuid,date_of_birth date,gender text,is_active boolean default true);
      create table public.clinical_wound_cases(id uuid primary key,tenant_id uuid,client_id uuid,wound_type text,created_at timestamptz);
      create table public.clinical_wound_assessments(id uuid primary key,tenant_id uuid,client_id uuid,wound_case_id uuid,observed_at timestamptz);
      create table public.ambulatory_wound_lifecycle_events(id uuid primary key,tenant_id uuid,client_id uuid,wound_case_id uuid,occurred_at timestamptz,created_at timestamptz,action text);
      create table public.client_consents(id uuid primary key,tenant_id uuid,client_id uuid,consent_type text,granted boolean,granted_at timestamptz,expires_at timestamptz);
      create table public.ambulatory_wound_photo_links(id uuid primary key,tenant_id uuid,client_id uuid,wound_case_id uuid,assessment_id uuid,
        consent_id uuid,storage_path text,file_name text,content_sha256 text,captured_at timestamptz,recorded_by uuid,recorded_by_name text);
      create table public.care_audit_events(tenant_id uuid,client_id uuid,entity_type text,entity_id uuid,action text,summary text,after_data jsonb,actor_id uuid,actor_name text);
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text,owner_id text,owner uuid,metadata jsonb);
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to authenticated;
      create policy broad_fixture_policy on storage.objects using(true) with check(true);
      create function care_private.wound_has_permission(key text) returns boolean language sql as $$
        select exists(select 1 from public.profiles where id=auth.uid() and tenant_id=public.current_tenant_id()
          and (key='pflege.wounds.view' or (key='pflege.wounds.manage' and can_write)))
      $$;
      create function care_private.wound_active_client(subject uuid) returns boolean language sql as $$
        select exists(select 1 from public.clients where id=subject and tenant_id=public.current_tenant_id() and is_active)
      $$;
      insert into public.tenants values ('${tenant}'),('${otherTenant}');
      insert into public.profiles values ('${actor}','${tenant}','Synthetische Pflegekraft',true);
      insert into public.clients values ('${patient}','${tenant}','1960-04-04','weiblich',true),
        ('${child}','${tenant}','2020-07-19','männlich',true);
      insert into public.clinical_wound_cases values ('${wound}','${tenant}','${patient}','Synthetische Testwunde','2026-08-01'),
        ('${otherWound}','${tenant}','${child}','Synthetische Testwunde','2026-08-02');
      insert into public.clinical_wound_assessments values ('${assessment}','${tenant}','${patient}','${wound}','2026-08-01');
      insert into public.ambulatory_wound_lifecycle_events values (gen_random_uuid(),'${tenant}','${patient}','${wound}','2026-08-11','2026-08-11','close');
      insert into public.client_consents values ('${consent}','${tenant}','${patient}','foto_video',true,'2026-07-01',null);
    `);
    await db.exec(patch);
    await db.query("select set_config('wound_test.actor',$1,false),set_config('wound_test.tenant',$2,false)", [actor, tenant]);
    await db.exec('set role authenticated');
    const scope = [tenant, actor, patient, wound];
    const risk = { scale: 'braden', scores: [4,4,4,4,4,3], assessment: 'Synthetische Beurteilung', plan: 'Synthetischer Plan' };
    const write = (id, kind, p, change = scope, at = now) => db.query(
      'select public.write_wound_record_entry($1,$2,$3,$4,$5,$6,$7,$8) as id', [...change,id,kind,at,JSON.stringify(p)]);
    assert.equal((await write(entry,'risk',risk)).rows[0].id, entry);
    assert.equal((await write(entry,'risk',risk)).rows[0].id, entry);
    await assert.rejects(write(entry,'risk',{...risk,plan:'Andere Anfrage'}), /anderen Erfassung/);
    await assert.rejects(write(crypto.randomUUID(),'risk',{...risk,scores:[4,4,4,4,4,4]}), /Punktwert/);
    await assert.rejects(write(crypto.randomUUID(),'risk',risk,[tenant,actor,child,otherWound]), /Erwachsene/);
    await assert.rejects(write(crypto.randomUUID(),'note',{description:'Synthetisch'},[tenant,actor,child,wound]), /Keine Berechtigung/);
    await assert.rejects(write(crypto.randomUUID(),'note',{description:'Synthetisch'},[otherTenant,actor,patient,wound]), /Keine Berechtigung/);
    await assert.rejects(db.exec('update public.ambulatory_wound_clinical_entries set payload=payload'), /permission denied/);
    const context = (await db.query('select public.read_wound_record_context($1,$2,$3,$4) as result',scope)).rows[0].result;
    assert.equal(context.consents[0].id, consent);
    assert.equal(context.person.date_of_birth, '1960-04-04');

    const catalog = { id:article, kind:'article', name:'Synthetisches Material', text:'', supplier:'Testlieferant',code:'',unit:'Stück',unit_cents:200,updated_at:'' };
    const store = p => db.query('select public.save_wound_catalog_item($1,$2,$3) as id',[tenant,actor,JSON.stringify(p)]);
    assert.equal((await store(catalog)).rows[0].id, article);
    assert.equal((await store(catalog)).rows[0].id, article);
    const catalogRow = (await db.query('select updated_at::text as updated_at from public.ambulatory_wound_catalog')).rows[0];
    assert.equal((await store({...catalog,updated_at:catalogRow.updated_at,unit_cents:300})).rows[0].id, article);
    await assert.rejects(store({...catalog,updated_at:catalogRow.updated_at,unit_cents:500}), /geändert/);

    const file = { id:photo, kind:'wound_photo', name:'synthetisch.png', mime:'image/png', size:1024, digest:'a'.repeat(64),
      observedAt:now, assessmentId:assessment,consentId:consent };
    const prepare = p => db.query('select public.prepare_wound_media($1,$2,$3,$4,$5) as result',[...scope,JSON.stringify(p)]);
    await assert.rejects(prepare({...file,observedAt:'2026-06-01T00:00:00Z'}), /Fotoeinwilligung/);
    const receipt = (await prepare(file)).rows[0].result;
    const complete = () => db.query('select public.complete_wound_media($1,$2,$3,$4,$5) as id',[...scope,photo]);
    assert.equal(receipt.state,'pending');
    assert.equal((await prepare({...file,id:crypto.randomUUID()})).rows[0].result.id,photo);
    await assert.rejects(prepare({...file,id:crypto.randomUUID(),name:'abweichend.png'}), /offenen Uploadauftrag/);
    await assert.rejects(complete(), /gespeicherte Original/);
    await assert.rejects(db.query("insert into storage.objects values ('pflege-wound-media',$1,$2,null,$3)",
      [receipt.path + '-fremd',actor, JSON.stringify({size:1024,mimetype:'image/png'})]), /row-level security/);
    await db.query("insert into storage.objects values ('pflege-wound-media',$1,$2,null,$3)",
      [receipt.path,actor, JSON.stringify({size:1024,mimetype:'image/png'})]);
    assert.equal((await db.query('select count(*)::int as n from storage.objects')).rows[0].n,0);
    assert.equal((await complete()).rows[0].id,photo);
    assert.equal((await complete()).rows[0].id,photo);
    assert.equal((await db.query('select count(*)::int as n from storage.objects')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int as n from public.ambulatory_wound_media')).rows[0].n,1);
    await assert.rejects(db.query('select storage_path from public.ambulatory_wound_media'), /permission denied/);
    const trace = {
      width:500, height:500,
      outline:[{x:.1,y:.1},{x:.5,y:.1},{x:.5,y:.5},{x:.1,y:.5}],
      scale:{from:{x:.1,y:.1},to:{x:.2,y:.1},millimetres:10},
      sections:[], areaCm2:16, lengthCm:5.656854, widthCm:5.656854,
      shares:{necrosis:0,granulation:0,fibrin:0,epithelium:0,unassigned:100},
    };
    await assert.rejects(write(crypto.randomUUID(),'measurement',{photoId:photo,assessmentId:crypto.randomUUID(),trace}), /Originalfoto/);
    await write(crypto.randomUUID(),'measurement',{photoId:photo,assessmentId:assessment,trace});
    await write(crypto.randomUUID(),'anamnesis',{general:'Synthetischer Verlauf',heightCm:180,weightKg:75,vas:0,factors:['diabetes']});
    const stats = (await db.query('select public.read_wound_statistics($1,$2,$3,$4) as result',[tenant,actor,'2026-08-01','2026-08-20'])).rows[0].result;
    assert.deepEqual({total:stats.total, people:stats.people, median:stats.medianDays, factors:stats.factors},
      {total:2,people:2,median:10,factors:{diabetes:1}});
    await db.exec('reset role');
    await db.query('update public.client_consents set granted=false where id=$1',[consent]);
    await db.query('update public.profiles set can_write=false where id=$1',[actor]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select count(*)::int as n from storage.objects')).rows[0].n,0);
    await assert.rejects(write(crypto.randomUUID(),'note',{description:'Synthetisch'}), /Keine Berechtigung/);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select public.read_wound_statistics($1,$2,$3,$4)',[tenant,actor,'2026-08-01','2026-08-20']), /permission denied/);
  } finally { await db.close(); }
});
