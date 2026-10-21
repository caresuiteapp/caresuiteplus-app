import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { setupAmbulatoryDatabase } from './ambulatoryDatabaseFixture';
const tenant='11111111-1111-4111-8111-111111111111', client='55555555-5555-4555-8555-555555555555', employee='44444444-4444-4444-8444-444444444444';
const own='77777777-7777-4777-8777-777777777777', draft='88888888-8888-4888-8888-888888888888', other='99999999-9999-4999-8999-999999999999';
const day = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const png='data:image/png;base64,iVBORw0KGgo'+'A'.repeat(120);
let db:PGlite;
async function setting(key:string,value:string) { await db.query('SELECT set_config($1,$2,false)',[key,value]); }
async function proofs(){ return (await db.query<{p:{id:string;status:string;signature:string|null}[]}>('SELECT public.get_my_ambulatory_care_proofs() p')).rows[0].p; }
describe('Authenticated own care portal scope',()=>{
 beforeAll(async()=>{
  db=await setupAmbulatoryDatabase();await db.exec(`RESET ROLE;
  CREATE FUNCTION public.current_portal_type() RETURNS text LANGUAGE sql AS $$SELECT current_setting('test.portal',true)$$;
  CREATE FUNCTION public.current_client_id() RETURNS uuid LANGUAGE sql AS $$SELECT NULLIF(current_setting('test.client',true),'')::uuid$$;
  CREATE FUNCTION public.resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$SELECT NULLIF(current_setting('test.employee',true),'')::uuid$$;
  GRANT SELECT ON public.pfleger_service_proofs TO authenticated;
  INSERT INTO public.pfleger_service_proofs(id,tenant_id,client_id,service_date,started_at,ended_at,duration_minutes,service_code,service_label,legal_basis,quantity,unit_price_cents,gross_amount_cents,performance_note,employee_name_snapshot,status)
  SELECT x.id::uuid,'${tenant}','${client}','2026-10-02','2026-10-02T07:00:00+02:00','2026-10-02T07:30:00+02:00',30,'P1','Grundpflege','private',1,3275,3275,'Durchgeführt','Pflegekraft',x.status FROM (VALUES('${own}','submitted'),('${draft}','draft')) x(id,status);
  INSERT INTO public.pfleger_service_proofs(id,tenant_id,client_id,service_date,started_at,ended_at,duration_minutes,service_code,service_label,legal_basis,quantity,unit_price_cents,gross_amount_cents,performance_note,employee_name_snapshot,status)
  VALUES('${other}','22222222-2222-4222-8222-222222222222','66666666-6666-4666-8666-666666666666','2026-10-02','2026-10-02T07:00:00+02:00','2026-10-02T07:30:00+02:00',30,'P1','Fremd','private',1,1,1,'Fremd','Fremd','submitted');
  INSERT INTO public.care_tours(tenant_id,tour_date,name,employee_id,status) VALUES('${tenant}','${day}','Eigene Tour','${employee}','published'),('${tenant}','${day}','Entwurf','${employee}','draft'),('${tenant}','${day}','Andere Pflegekraft',NULL,'published');`);
  const sql=readFileSync('supabase/patches/ambulatory_care_portals.sql','utf8');await db.exec(sql);await db.exec(sql);await db.exec(`INSERT INTO public.care_tour_stops(tenant_id,tour_id,sequence_no,client_id,client_name_snapshot,planned_start,planned_end,service_summary) SELECT '${tenant}',id,1,'${client}','Test Klient','07:00','07:30','Grundpflege' FROM public.care_tours WHERE name='Eigene Tour';`);await db.exec('SET ROLE authenticated;');
  await setting('test.permissions','');await setting('test.portal','client');await setting('test.client',client);
 },30000);
 afterAll(async()=>{await db?.close();});
 it('lists only own provided proofs, without administration permission',async()=>{expect((await proofs()).map(p=>p.id)).toEqual([own]);});
 it('denies another tenant and another portal kind',async()=>{
  await setting('test.tenant','22222222-2222-4222-8222-222222222222');await expect(proofs()).rejects.toThrow(/Berechtigung/);await setting('test.tenant',tenant);
  await setting('test.portal','relative');await expect(proofs()).rejects.toThrow(/Berechtigung/);await setting('test.portal','client');
 });
 it('cannot sign foreign or draft proof and invalid PNG rolls back',async()=>{
  for(const id of [other,draft]) await expect(db.query('SELECT public.sign_my_ambulatory_care_proof($1,$2,$3)',[id,'Klient',png])).rejects.toThrow();
  await expect(db.query('SELECT public.sign_my_ambulatory_care_proof($1,$2,$3)',[own,'Klient','bad'])).rejects.toThrow(/PNG/);
  expect((await proofs())[0].status).toBe('submitted');
 });
 it('stores signature and audit atomically; identical retry returns same proof',async()=>{
  const first=await db.query('SELECT public.sign_my_ambulatory_care_proof($1,$2,$3)',[own,'Klient',png]);
  expect(await db.query('SELECT public.sign_my_ambulatory_care_proof($1,$2,$3)',[own,'Klient',png])).toEqual(first);
  const p=(await proofs())[0];expect(p.status).toBe('signed');expect(p.signature).toBeNull();expect((await db.query<{s:{pngDataUrl:string}}>('SELECT public.get_my_ambulatory_care_signature($1) s',[own])).rows[0].s.pngDataUrl).toBe(png);await expect(db.query('SELECT public.get_my_ambulatory_care_signature($1)',[other])).rejects.toThrow(/eigene/);
  await expect(db.query('SELECT public.sign_my_ambulatory_care_proof($1,$2,$3)',[own,'Andere Person',png])).rejects.toThrow(/nicht zur Unterschrift/);
  await db.exec('RESET ROLE;');expect((await db.query("SELECT id FROM public.care_audit_events WHERE action='portal_signed'")).rows).toHaveLength(1);await db.exec('SET ROLE authenticated;');
 });
 it('exports only own provided proof with captured signature and no internal evidence payload',async()=>{
  const exportRow=(await db.query<{r:{proof:{clientId:string;performanceNote:string;evidence_snapshot?:unknown};signature:{dataUrl:string}}}>('SELECT public.get_my_ambulatory_care_proof_export($1) r',[own])).rows[0].r;
  expect(exportRow.proof.clientId).toBe(client);expect(exportRow.signature.dataUrl).toBe(png);expect(exportRow.proof.evidence_snapshot).toBeUndefined();
  for(const id of [other,draft]) await expect(db.query('SELECT public.get_my_ambulatory_care_proof_export($1)',[id])).rejects.toThrow(/nicht verfügbar/);
 });
 it('employee reads only own released tours, never drafts or unassigned tours',async()=>{
  await setting('test.portal','employee');await setting('test.employee',employee);
  const rows=(await db.query<{r:{name:string}[]}>('SELECT public.get_my_ambulatory_care_tours($1) r',[day])).rows[0].r;expect(rows.map(r=>r.name)).toEqual(['Eigene Tour']);
  await expect(proofs()).rejects.toThrow(/Berechtigung/);
  await setting('test.employee','');await expect(db.query('SELECT public.get_my_ambulatory_care_tours($1)',[day])).rejects.toThrow(/Pflegekraft/);
 });
 it('allows own execution without office permissions and requires documentation',async()=>{
  await setting('test.portal','employee');await setting('test.employee',employee);
  const tours=(await db.query<{r:{id:string;stops:{id:string}[]}[]}>('SELECT public.get_my_ambulatory_care_tours($1) r',[day])).rows[0].r;
  const tour=tours[0].id, stop=tours[0].stops[0].id;
  await expect(db.query('SELECT public.advance_my_ambulatory_care_tour($1,$2,$3)',[tour,'cancelled','published'])).rejects.toThrow(/Nur eigene/);
  await db.query('SELECT public.advance_my_ambulatory_care_tour($1,$2,$3)',[tour,'in_progress','published']);
  await expect(db.query('SELECT public.advance_my_ambulatory_care_tour($1,$2,$3)',[tour,'completed','in_progress'])).rejects.toThrow(/Alle Einsätze/);
  await db.query('SELECT public.advance_my_ambulatory_care_stop($1,$2,$3,$4)',[stop,'arrived','planned','']);
  await db.query('SELECT public.advance_my_ambulatory_care_stop($1,$2,$3,$4)',[stop,'in_progress','arrived','']);
  await expect(db.query('SELECT public.advance_my_ambulatory_care_stop($1,$2,$3,$4)',[stop,'completed','in_progress',''])).rejects.toThrow(/Durchführungsnachweis/);
  await db.query('SELECT public.advance_my_ambulatory_care_stop($1,$2,$3,$4)',[stop,'completed','in_progress','Grundpflege durchgeführt, keine Abweichung.']);
  await db.query('SELECT public.advance_my_ambulatory_care_tour($1,$2,$3)',[tour,'completed','in_progress']);
  await db.exec('RESET ROLE;'); const docs=(await db.query<{content:string}>('SELECT content FROM public.clinical_documentation_entries')).rows;expect(docs[0].content).toContain('Grundpflege durchgeführt');await db.exec('SET ROLE authenticated;');
 });
 it('rejects stale status and foreign tour/stop mutations',async()=>{
  const tours=(await db.query<{r:{id:string;stops:{id:string}[]}[]}>('SELECT public.get_my_ambulatory_care_tours($1) r',[day])).rows[0].r;
  await expect(db.query('SELECT public.advance_my_ambulatory_care_tour($1,$2,$3)',[tours[0].id,'completed','in_progress'])).rejects.toThrow(/zwischenzeitlich/);
  await setting('test.employee','');
  await expect(db.query('SELECT public.advance_my_ambulatory_care_stop($1,$2,$3,$4)',[tours[0].stops[0].id,'cancelled','completed','Ausfall'])).rejects.toThrow(/Berechtigung/);
 });

 it('portal execution still obeys operations admission and shift guards',async()=>{
  const guarded=await setupAmbulatoryDatabase(true);
  try {
   await guarded.exec(`RESET ROLE;
    CREATE FUNCTION public.current_portal_type() RETURNS text LANGUAGE sql AS $$SELECT 'employee'::text$$;
    CREATE FUNCTION public.current_client_id() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;
    CREATE FUNCTION public.resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$SELECT '${employee}'::uuid$$;
    INSERT INTO public.care_tours(id,tenant_id,tour_date,name,employee_id,status) VALUES('${own}','${tenant}','${day}','Bereitgestellte Tour','${employee}','published');
    INSERT INTO public.care_tour_stops(tenant_id,tour_id,sequence_no,client_id,client_name_snapshot,planned_start,planned_end,service_summary) VALUES('${tenant}','${own}',1,'${client}','Klient','07:00','07:30','Grundpflege');`);
   await guarded.exec(readFileSync('supabase/patches/ambulatory_care_portals.sql','utf8'));await guarded.exec('SET ROLE authenticated;');
   await expect(guarded.query('SELECT public.advance_my_ambulatory_care_tour($1,$2,$3)',[own,'in_progress','published'])).rejects.toThrow(/Aufnahme|Dienst/);
   await guarded.exec('RESET ROLE;');expect((await guarded.query<{status:string}>('SELECT status FROM public.care_tours WHERE id=$1',[own])).rows[0].status).toBe('published');
  } finally { await guarded.close(); }
 },30000);

});
