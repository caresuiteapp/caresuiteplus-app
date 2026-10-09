import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { setupAmbulatoryDatabase } from './ambulatoryDatabaseFixture';
const tenant='11111111-1111-4111-8111-111111111111',client='55555555-5555-4555-8555-555555555555',employee='44444444-4444-4444-8444-444444444444',actor='33333333-3333-4333-8333-333333333333',source='77777777-7777-4777-8777-777777777777';
let db:PGlite;
describe('Care notifications use existing notice outbox',()=>{
 beforeAll(async()=>{db=await setupAmbulatoryDatabase();await db.exec(`RESET ROLE;
 CREATE ROLE service_role;
 CREATE TABLE public.portal_push_devices(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,auth_user_id uuid,employee_id uuid,client_id uuid,portal_account_id uuid,portal_type text,platform text,app_build_version bigint);
 CREATE FUNCTION public.portal_push_account_active(d public.portal_push_devices) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
 CREATE TABLE public.office_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,recipient_user_id uuid,recipient_employee_id uuid,notification_type text,title text,body_preview text,action_url text,metadata jsonb,is_read boolean DEFAULT false,read_at timestamptz);
 CREATE TABLE public.portal_push_outbox(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,source_id uuid,event_kind text,route text);
 CREATE TABLE public.client_portal_access(tenant_id uuid,client_id uuid,auth_user_id uuid,portal_enabled boolean,status text);
 CREATE TABLE public.client_portal_codes(tenant_id uuid,client_id uuid,auth_user_id uuid,status text,expires_at timestamptz);
 INSERT INTO public.client_portal_access VALUES('${tenant}','${client}','${actor}',true,'aktiv'),('22222222-2222-4222-8222-222222222222','${client}','99999999-9999-4999-8999-999999999999',true,'aktiv');
 INSERT INTO public.client_portal_codes VALUES('${tenant}','${client}','${actor}','active',NULL),('${tenant}','${client}','99999999-9999-4999-8999-999999999999','active',clock_timestamp()-interval '1 hour');
 CREATE FUNCTION public.test_notice_queue() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN INSERT INTO public.portal_push_outbox(tenant_id,source_id,event_kind,route) VALUES(NEW.tenant_id,NEW.id,'notice','/portal/client/announcements');RETURN NEW;END$$;
 CREATE TRIGGER test_notice_queue AFTER INSERT ON public.office_notifications FOR EACH ROW EXECUTE FUNCTION public.test_notice_queue();
 INSERT INTO public.care_tours(id,tenant_id,tour_date,name,employee_id,status) VALUES('${source}','${tenant}','2026-10-02','Tour','${employee}','draft');
 INSERT INTO public.pfleger_service_proofs(id,tenant_id,client_id,service_date,started_at,ended_at,duration_minutes,service_code,service_label,legal_basis,quantity,unit_price_cents,gross_amount_cents,performance_note,employee_name_snapshot,status)
 VALUES('${source}','${tenant}','${client}','2026-10-02','2026-10-02T07:00:00+02:00','2026-10-02T07:30:00+02:00',30,'P1','Grundpflege','private',1,1,1,'Vertrauliche Pflegedokumentation','Pflegekraft','draft');`);
 const sql=readFileSync('supabase/patches/ambulatory_care_notifications.sql','utf8');await db.exec(sql);await db.exec(sql);},30000);
 afterAll(async()=>{await db?.close();});
 it('draft creates no notice; release creates own employee notice and portal destination',async()=>{
  expect((await db.query('SELECT id FROM public.office_notifications')).rows).toHaveLength(0);
  await db.query("UPDATE public.care_tours SET status='published' WHERE id=$1",[source]);
  const notice=(await db.query<{recipient_employee_id:string;body_preview:string}>('SELECT recipient_employee_id,body_preview FROM public.office_notifications')).rows[0];expect(notice.recipient_employee_id).toBe(employee);expect(notice.body_preview).not.toContain('Klient');
  expect((await db.query<{route:string}>('SELECT route FROM public.portal_push_outbox')).rows[0].route).toBe('/portal/employee');
 });
 it('submission deduplicates overlapping active client accounts and excludes wrong tenant/expired accounts',async()=>{
  await db.query("UPDATE public.pfleger_service_proofs SET status='submitted' WHERE id=$1",[source]);
  const rows=(await db.query<{recipient_user_id:string;body_preview:string}>("SELECT recipient_user_id,body_preview FROM public.office_notifications WHERE metadata->>'careSourceKind'='proof'")).rows;
  expect(rows).toHaveLength(1);expect(rows[0].recipient_user_id).toBe(actor);expect(rows[0].body_preview).not.toContain('Vertrauliche');
  expect((await db.query<{route:string}>("SELECT route FROM public.portal_push_outbox WHERE route='/portal/client/proofs'")).rows).toHaveLength(1);
 });
 it('repeated unchanged update produces no additional push event',async()=>{
  await db.query("UPDATE public.pfleger_service_proofs SET status='submitted' WHERE id=$1",[source]);expect((await db.query('SELECT id FROM public.office_notifications')).rows).toHaveLength(2);expect((await db.query('SELECT id FROM public.portal_push_outbox')).rows).toHaveLength(2);
 });
 it('actual notice visibility confines shared auth users to the correct client account and portal kind',async()=>{
  await db.exec(`INSERT INTO public.portal_push_devices(tenant_id,auth_user_id,client_id,employee_id,portal_type) VALUES('${tenant}','${actor}','${client}',NULL,'client'),('${tenant}','${actor}','99999999-9999-4999-8999-999999999999',NULL,'client'),('${tenant}','${actor}',NULL,'${employee}','employee');`);
  const rows=(await db.query<{client_id:string|null;portal_type:string;visible:boolean}>("SELECT d.client_id,d.portal_type,public.portal_push_event_visible(d,'notice',n.id) visible FROM public.portal_push_devices d CROSS JOIN public.office_notifications n WHERE n.metadata->>'careSourceKind'='proof'")).rows;
  expect(rows.filter(r=>r.visible)).toHaveLength(1);expect(rows.find(r=>r.visible)?.client_id).toBe(client);
 });
 it('cancellation retires pending notices so existing dispatcher visibility check blocks stale delivery',async()=>{
  await db.query("UPDATE public.care_tours SET status='cancelled' WHERE id=$1",[source]);
  await db.query("UPDATE public.pfleger_service_proofs SET status='cancelled' WHERE id=$1",[source]);
  expect((await db.query('SELECT id FROM public.office_notifications WHERE NOT is_read')).rows).toHaveLength(0);
 });
});
