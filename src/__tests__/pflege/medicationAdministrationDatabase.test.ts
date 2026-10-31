import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
let db: PGlite;
const tenant='11111111-1111-4111-8111-111111111111', actor='22222222-2222-4222-8222-222222222222', witness='33333333-3333-4333-8333-333333333333', client='44444444-4444-4444-8444-444444444444', med='55555555-5555-4555-8555-555555555555';
let time: string, version: string;
const read=(p:string)=>readFileSync(p,'utf8');
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table public.tenants(id uuid primary key); create table public.clients(id uuid primary key,tenant_id uuid,active boolean default true);
 create table public.profiles(id uuid primary key,tenant_id uuid,is_active boolean,display_name text,email text);
 create table public.medications(id uuid primary key,tenant_id uuid references tenants(id),client_id uuid references clients(id),name text,dosage text,updated_at timestamptz default now());
 create table public.client_documents(id uuid primary key,tenant_id uuid,client_id uuid,title text,file_name text,mime_type text,storage_path text,status text,updated_at timestamptz default now());
 grant select on public.client_documents to authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 create function public.resolve_current_profile_id() returns uuid language sql as $$select auth.uid()$$;
 create function public.current_tenant_id() returns uuid language sql as $$select nullif(current_setting('test.tenant',true),'')::uuid$$;
 create function public.has_permission(p text) returns boolean language sql as $$select p=any(string_to_array(current_setting('test.permissions',true),','))$$;
 create function public.is_active_pfleger_client(p uuid) returns boolean language sql security definer as $$select exists(select 1 from public.clients where id=p and tenant_id=public.current_tenant_id() and active)$$;
 -- Local fixture prerequisite for the source ledger's invoker-side own-profile predicate.
 -- The application profile directory is not part of these medication patches.
 alter table public.profiles enable row level security;
 create policy fixture_own_profile_read on public.profiles for select to authenticated
 using(id=auth.uid() and tenant_id=public.current_tenant_id());
 grant select on public.profiles to authenticated;
 insert into tenants values('${tenant}'); insert into clients values('${client}','${tenant}',true);
 insert into profiles values('${actor}','${tenant}',true,'Test Pflegekraft','test@example.invalid'),('${witness}','${tenant}',true,'Test Kontrolle','witness@example.invalid');
 insert into medications values('${med}','${tenant}','${client}','Testpräparat','1 Tablette',now());
 select set_config('test.actor','${actor}',false),set_config('test.tenant','${tenant}',false),set_config('test.permissions','pflege.medications.view,pflege.medications.administer',false);`);
 await db.exec(read('supabase/migrations/20260812153000_live_medication_ambulatory_intensive.sql'));
 await db.exec(`insert into medication_administrations(tenant_id,medication_id,client_id,status,administered_by,deviation_reason) values('${tenant}','${med}','${client}','refused','${actor}','Historische Ablehnung');`);
 await db.exec(read('supabase/patches/ambulatory_medication_documentation.sql'));
 await db.exec(read('supabase/patches/ambulatory_medication_documentation.sql'));
 await db.exec(read('supabase/patches/ambulatory_medication_sources.sql'));
 await db.exec(read('supabase/patches/ambulatory_medication_sources.sql'));
 const row=(await db.query<{time:string;version:string}>(`select (clock_timestamp()-interval '1 hour')::text as time,updated_at::text as version from medications limit 1`)).rows[0];
 time=new Date(row.time).toISOString();version=new Date(row.version).toISOString();
 await db.exec('grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; set role authenticated;');
},20000);
afterAll(async()=>{await db?.close();});
const payload=(extra={})=>({status:'administered',occurredAt:time,expectedUpdatedAt:version,dose:'1 Tablette',route:'oral',...extra});
const event=async(request:string,extra={})=>(await db.query<{id:string}>('select public.record_ambulatory_medication_event($1,$2,$3::jsonb) as id',[med,request,JSON.stringify(payload(extra))])).rows[0].id;
it('belässt historische Daten ohne erfundenen Ereigniszeitpunkt',async()=>{
 const row=(await db.query<{occurred_at:unknown;order_snapshot:unknown;administered_at:unknown}>('select occurred_at,order_snapshot,administered_at from medication_administrations limit 1')).rows[0];
 expect(row.occurred_at).toBeNull();expect(row.order_snapshot).toBeNull();expect(row.administered_at).not.toBeNull();
});
it('begrenzt den lokalen Profil-Lesebestand auf das eigene Konto im eigenen Mandanten',async()=>{
 expect((await db.query<{id:string}>('select id from public.profiles')).rows).toEqual([{id:actor}]);
 expect((await db.query('select id from public.profiles where id=$1',[witness])).rows).toEqual([]);
});
it('speichert tatsächliche Gaben atomar, mit eingefrorener Verordnung und idempotent',async()=>{
 const key=crypto.randomUUID(),id=await event(key,{painScoreBefore:0});expect(await event(key,{painScoreBefore:0})).toBe(id);
 const row=(await db.query<{order_snapshot:Record<string,unknown>;pain_score_before:number;occurred_at:Date;administered_at:Date;created_at:Date}>('select * from medication_administrations where id=$1',[id])).rows[0];
 expect(row.order_snapshot.name).toBe('Testpräparat');expect(row.pain_score_before).toBe(0);expect(row.occurred_at).toEqual(row.administered_at);
 expect(new Date(row.created_at).getTime()).toBeGreaterThan(new Date(row.occurred_at).getTime());
 await expect(event(key,{dose:'2 Tabletten',painScoreBefore:0})).rejects.toThrow(/anderen Daten/);
});
it('erfasst Nichtgaben ohne tatsächliche Dosis oder Gabezeit',async()=>{
 const id=await event(crypto.randomUUID(),{status:'refused',dose:null,route:null,deviationReason:'Ablehnung'});
 const row=(await db.query<{administered_at:unknown;administered_dose:unknown}>('select * from medication_administrations where id=$1',[id])).rows[0];expect(row.administered_at).toBeNull();expect(row.administered_dose).toBeNull();
 await expect(event(crypto.randomUUID(),{status:'refused',deviationReason:'Ablehnung'})).rejects.toThrow(/Nichtgabe/);
});
it('prüft verspätete Bedarfsgaben und BtM genauso wie reguläre Gaben',async()=>{
 await db.exec(`reset role; update medications set is_prn=true,is_controlled_substance=true; set role authenticated;`);
 await expect(event(crypto.randomUUID(),{status:'late',deviationReason:'Verspätet'})).rejects.toThrow(/Bedarfsindikation/);
 await expect(event(crypto.randomUUID(),{status:'late',deviationReason:'Verspätet',prnReason:'Bedarf'})).rejects.toThrow(/Gegenkontrolle/);
 await expect(event(crypto.randomUUID(),{status:'late',deviationReason:'Verspätet',prnReason:'Bedarf',witnessProfileId:actor})).rejects.toThrow(/andere aktive/);
 expect(await event(crypto.randomUUID(),{status:'late',deviationReason:'Verspätet',prnReason:'Bedarf',witnessProfileId:witness})).toBeTruthy();
 await db.exec('reset role; update medications set is_prn=false,is_controlled_substance=false; set role authenticated;');
});
it('sperrt Rechteumgehung und direkte Schreibzugriffe',async()=>{
 await expect(db.exec(`insert into medication_administrations(tenant_id,medication_id,client_id,status) values('${tenant}','${med}','${client}','scheduled')`)).rejects.toThrow(/permission denied/);
 await db.exec("select set_config('test.permissions','pflege.medications.view',false)");await expect(event(crypto.randomUUID())).rejects.toThrow(/Berechtigung/);
 await db.exec("select set_config('test.permissions','pflege.medications.view,pflege.medications.administer',false)");
 await db.exec("select set_config('test.tenant','66666666-6666-4666-8666-666666666666',false)");await expect(event(crypto.randomUUID())).rejects.toThrow();
 await db.exec(`select set_config('test.tenant','${tenant}',false)`);
});
it('verweigert Zukunft, Bruchteil-Schmerz und veraltete Verordnung',async()=>{
 await expect(event(crypto.randomUUID(),{occurredAt:'2099-01-01T00:00:00Z'})).rejects.toThrow(/zukünftig/);
 await expect(event(crypto.randomUUID(),{painScoreBefore:0.5})).rejects.toThrow(/Schmerzskala/);
 await expect(event(crypto.randomUUID(),{expectedUpdatedAt:'2000-01-01T00:00:00Z'})).rejects.toThrow(/geändert/);
});
it('ergänzt Wirkungskontrollen unveränderbar und ohne Duplikat',async()=>{
 const id=await event(crypto.randomUUID()),request=crypto.randomUUID();
 const p={observedAt:new Date(Date.parse(time)+30*60000).toISOString(),observation:'Wirkung beobachtet',action:'Weitere Kontrolle vereinbart',painScore:0};
 const follow=async(data=p)=>(await db.query<{id:string}>('select public.record_ambulatory_medication_followup($1,$2,$3::jsonb) as id',[id,request,JSON.stringify(data)])).rows[0].id;
 const first=await follow();expect(await follow()).toBe(first);await expect(follow({...p,action:'Anders'})).rejects.toThrow(/anderen Daten/);
 await expect(db.exec(`delete from medication_administration_followups where id='${first}'`)).rejects.toThrow(/permission denied/);
 await expect(db.query('select public.record_ambulatory_medication_followup($1,$2,$3::jsonb)',[id,crypto.randomUUID(),JSON.stringify({...p,observedAt:new Date(Date.parse(time)-1000).toISOString()})])).rejects.toThrow(/Kontrollzeitpunkt/);
});

const orderVersion = async () => (await db.query<{version:string}>('select updated_at::text as version from medications where id=$1',[med])).rows[0].version;
const changeStatus = async (request:string,p:{status:string;reason:string;expectedUpdatedAt:string}) => (await db.query<{id:string}>('select public.change_ambulatory_medication_status($1,$2,$3::jsonb) as id',[med,request,JSON.stringify(p)])).rows[0].id;
it('verlangt Verwaltungsrecht, Begründung und den aktuellen Stand für Statusänderungen',async()=>{
 const current=await orderVersion();
 await expect(changeStatus(crypto.randomUUID(),{status:'paused',reason:'Grund',expectedUpdatedAt:current})).rejects.toThrow(/Berechtigung/);
 await db.exec("select set_config('test.permissions','pflege.medications.view,pflege.medications.administer,pflege.medications.manage',false)");
 await expect(changeStatus(crypto.randomUUID(),{status:'paused',reason:' ',expectedUpdatedAt:current})).rejects.toThrow(/Begründung/);
 await expect(changeStatus(crypto.randomUUID(),{status:'paused',reason:'Grund',expectedUpdatedAt:'2000-01-01T00:00:00Z'})).rejects.toThrow(/geändert/);
 await expect(changeStatus(crypto.randomUUID(),{status:'active',reason:'Grund',expectedUpdatedAt:current})).rejects.toThrow(/Statusübergang/);
});
it('protokolliert Pausierung und erlaubt exakt gleiche Wiederholungen trotz verändertem Status',async()=>{
 const eventRequest=crypto.randomUUID(); const given=await event(eventRequest);
 const request=crypto.randomUUID(), p={status:'paused',reason:'Ärztliche Rücksprache dokumentiert',expectedUpdatedAt:await orderVersion()};
 const id=await changeStatus(request,p);expect(await changeStatus(request,p)).toBe(id);
 expect(await event(eventRequest)).toBe(given);
 const countBefore=(await db.query<{count:number}>('select count(*)::int as count from medication_administrations')).rows[0].count;
 await expect(event(crypto.randomUUID(),{expectedUpdatedAt:await orderVersion()})).rejects.toThrow(/aktive/);
 expect((await db.query<{count:number}>('select count(*)::int as count from medication_administrations')).rows[0].count).toBe(countBefore);
 const row=(await db.query<{previous_status:string;next_status:string;before_data:{status:string};after_data:{status:string};recorded_by_name:string}>('select * from medication_order_status_events where id=$1',[id])).rows[0];
 expect(row.previous_status).toBe('active');expect(row.next_status).toBe('paused');expect(row.before_data.status).toBe('active');expect(row.after_data.status).toBe('paused');expect(row.recorded_by_name).toBe('Test Pflegekraft');
 await expect(changeStatus(request,{...p,reason:'Andere Begründung'})).rejects.toThrow(/anderen Daten/);
 await expect(db.exec(`update medications set status='active' where id='${med}'`)).rejects.toThrow(/permission denied/);
 await expect(db.exec(`delete from medication_order_status_events where id='${id}'`)).rejects.toThrow(/permission denied/);
});
it('reaktiviert eine gültige Verordnung und beendet sie ohne erneute Aktivierung',async()=>{
 await changeStatus(crypto.randomUUID(),{status:'active',reason:'Rücksprache: Fortsetzen',expectedUpdatedAt:await orderVersion()});
 const request=crypto.randomUUID(),p={status:'stopped',reason:'Ärztlich beendet',expectedUpdatedAt:await orderVersion()};
 const id=await changeStatus(request,p);expect(await changeStatus(request,p)).toBe(id);
 await expect(changeStatus(crypto.randomUUID(),{status:'active',reason:'Versuch',expectedUpdatedAt:await orderVersion()})).rejects.toThrow(/Statusübergang/);
 expect((await db.query<{status:string}>('select status from medications where id=$1',[med])).rows[0].status).toBe('stopped');
});

const sourceDocument='77777777-7777-4777-8777-777777777777';
const sourcePayload=async()=>({documentId:sourceDocument,documentUpdatedAt:(await db.query<{version:string}>('select updated_at::text as version from client_documents where id=$1',[sourceDocument])).rows[0].version,expectedUpdatedAt:await orderVersion(),reason:'Originalquelle zugeordnet, Fachprüfung offen',contentSha256:'a'.repeat(64),contentSize:123});
const sourceLink=async(request:string,p:Record<string,unknown>)=>(await db.query<{id:string}>('select public.link_ambulatory_medication_source($1,$2,$3::jsonb) as id',[med,request,JSON.stringify(p)])).rows[0].id;
it('verlangt Quellenrechte und dokumentiert Zuordnung ohne Fachfreigabe',async()=>{
 await db.exec(`reset role;insert into client_documents(id,tenant_id,client_id,title,file_name,mime_type,storage_path,status) values('${sourceDocument}','${tenant}','${client}','Originalunterlage','Original.pdf','application/pdf','tenant/${tenant}/clients/${client}/documents/${sourceDocument}/Original.pdf','aktiv');set role authenticated;`);
 const p=await sourcePayload();await expect(sourceLink(crypto.randomUUID(),p)).rejects.toThrow(/Berechtigung/);
 await db.exec("select set_config('test.permissions','pflege.medications.view,pflege.medications.administer,pflege.medications.manage,office.documents.view,office.clients.view_sensitive',false)");
 const id=await sourceLink(crypto.randomUUID(),p);
 const row=(await db.query<{document_snapshot:{title:string;content_sha256:string;content_size:number;content_fingerprint_origin:string};order_snapshot:{id:string};recorded_by:string}>('select * from medication_order_sources where id=$1',[id])).rows[0];
 expect(row.document_snapshot.title).toBe('Originalunterlage');expect(row.document_snapshot.content_sha256).toBe(p.contentSha256);expect(row.document_snapshot.content_size).toBe(p.contentSize);expect(row.document_snapshot.content_fingerprint_origin).toBe('client_observed');expect(row.order_snapshot.id).toBe(med);expect(row.recorded_by).toBe(actor);expect('verified' in row).toBe(false);
 await expect(db.exec(`delete from medication_order_sources where id='${id}'`)).rejects.toThrow(/permission denied/);
});
it('sperrt veraltete Quellenstände, fremde Dokumente und leere Begründung',async()=>{
 const p=await sourcePayload();
 await expect(sourceLink(crypto.randomUUID(),{...p,contentSha256:'invalid'})).rejects.toThrow(/Inhaltsfingerabdruck/);
 await expect(sourceLink(crypto.randomUUID(),{...p,contentSize:1.5})).rejects.toThrow(/Dateigröße/);
 await expect(sourceLink(crypto.randomUUID(),{...p,contentSize:52_428_801})).rejects.toThrow(/Dateigröße/);
 await expect(sourceLink(crypto.randomUUID(),{...p,documentUpdatedAt:'2000-01-01T00:00:00Z'})).rejects.toThrow(/Dokument wurde geändert/);
 await expect(sourceLink(crypto.randomUUID(),{...p,expectedUpdatedAt:'2000-01-01T00:00:00Z'})).rejects.toThrow(/Verordnung wurde geändert/);
 await expect(sourceLink(crypto.randomUUID(),{...p,documentId:'88888888-8888-4888-8888-888888888888'})).rejects.toThrow(/Dokument dieser/);
 await expect(sourceLink(crypto.randomUUID(),{...p,reason:' '})).rejects.toThrow(/Begründung/);
});
it('wiederholt Quellenzuordnung identisch auch nach Dokumentarchivierung',async()=>{
 const p=await sourcePayload(),request=crypto.randomUUID(),id=await sourceLink(request,p);
 await db.exec(`reset role;update client_documents set status='archiviert',updated_at=clock_timestamp() where id='${sourceDocument}';set role authenticated;`);
 expect(await sourceLink(request,p)).toBe(id);
 await expect(sourceLink(request,{...p,reason:'Anderer Bezug'})).rejects.toThrow(/anderen Daten/);
 await expect(sourceLink(crypto.randomUUID(),p)).rejects.toThrow(/Aktives Dokument/);
});
