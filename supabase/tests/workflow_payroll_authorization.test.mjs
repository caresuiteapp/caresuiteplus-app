// Isolated synthetic database, including the captured unsafe original function.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {test} from 'node:test';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const t=id(1),e=id(2),u=id(3),account=id(4),statement=id(5),pdfHash='ab'.repeat(32);
const metadata=JSON.parse(readFileSync(new URL('../../docs/workflow-server-payroll-metadata-20261011.json',import.meta.url),'utf8'));
const stmtCols=metadata.columns.filter(c=>c.table==='payroll_month_statements').map(c=>`"${c.name}" ${c.type}`).join(',');
await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role;CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid'),'')::uuid $$;
CREATE FUNCTION current_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.tenant'),'')::uuid $$;
CREATE FUNCTION current_portal_type() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('test.portal'),'') $$;
CREATE FUNCTION current_portal_account_id() RETURNS uuid LANGUAGE sql AS $$ SELECT '${account}'::uuid $$;
CREATE FUNCTION resolve_current_employee_id() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.employee'),'')::uuid $$;
CREATE TABLE employee_portal_accounts(id uuid,tenant_id uuid,employee_id uuid,auth_user_id uuid,status text,must_change_password boolean DEFAULT false,first_login_completed boolean DEFAULT true);
CREATE TABLE payroll_month_statements(${stmtCols});
CREATE TABLE payroll_month_audit_log(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,statement_id uuid,employee_id uuid,action text,actor_id uuid,
 summary text,metadata jsonb,created_at timestamptz DEFAULT now(),CHECK(action IS DISTINCT FROM 'fixture_failure'));
`);
const rpcMeta=JSON.parse(readFileSync(new URL('../../docs/workflow-server-write-rpc-metadata-20261011.json',import.meta.url),'utf8')).functions.find(f=>f.name==='employee_decide_payroll_statement');
await db.exec(rpcMeta.definition);await db.exec('REVOKE ALL ON FUNCTION employee_decide_payroll_statement(uuid,text,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION employee_decide_payroll_statement(uuid,text,text) TO authenticated');
async function config(changes={}){for(const[k,v]of Object.entries({uid:u,tenant:t,employee:e,portal:'employee',...changes}))await db.query('SELECT set_config($1,$2,false)',['test.'+k,v]);}
async function reset(){await db.exec('RESET ROLE;TRUNCATE payroll_month_statements,payroll_month_audit_log,employee_portal_accounts');
 await db.query('INSERT INTO employee_portal_accounts(id,tenant_id,employee_id,auth_user_id,status) VALUES($1,$2,$3,$4,$5)',[account,t,e,u,'active']);
 await db.query(`INSERT INTO payroll_month_statements(id,tenant_id,employee_id,period_year,period_month,version,status,snapshot_json,pdf_path,pdf_sha256,published_at,published_by)
 VALUES($1,$2,$3,2026,9,1,'published','{"actualWorkMinutes":60}','own/month-v1.pdf',$4,'2026-10-01T08:00Z',$5)`,[statement,t,e,pdfHash,u]);
 await config();await db.exec('SET ROLE authenticated');}
const decide=(decision='confirm',reason=null)=>db.query('SELECT * FROM employee_decide_payroll_statement($1,$2,$3)',[statement,decision,reason]);
async function rows(sql){await db.exec('RESET ROLE');const r=(await db.query(sql)).rows;await db.exec('SET ROLE authenticated');return r;}
await test('captured deployed <> NULL guards admit an ordinary unlinked auth user to a foreign published statement',async()=>{
 await reset();await config({uid:id(90),tenant:'',employee:'',portal:''});const r=await decide();assert.equal(r.rows[0].status,'confirmed');
 assert.equal((await rows('SELECT actor_id FROM payroll_month_audit_log'))[0].actor_id,id(90));
});
// Current Production function is SHA-bound to the captured unsafe original.
// Exercise the narrow reviewed guard before the broader historical draft.
await db.exec('RESET ROLE');
await db.exec(readFileSync(new URL('../../docs/store/android-employee-decide-payroll-statement-guard-review.sql',import.meta.url),'utf8'));
await test('current-body guard denies unlinked/NULL/cross-tenant/foreign/portal actors without writes',async()=>{
 for(const changes of [{uid:''},{uid:id(90),tenant:'',employee:'',portal:''},{tenant:''},{employee:''},{tenant:id(91)},{employee:id(92)},{portal:'client'},{portal:'relative'},{portal:'business'}]){
  await reset();await config(changes);await assert.rejects(decide);
  assert.equal((await rows('SELECT status FROM payroll_month_statements'))[0].status,'published');
  assert.equal((await rows('SELECT count(*)::int n FROM payroll_month_audit_log'))[0].n,0);
 }
 for(const change of ["status='disabled'","status='pending_first_login'","must_change_password=true","first_login_completed=false","auth_user_id='"+id(90)+"'"]){
  await reset();await db.exec('RESET ROLE;UPDATE employee_portal_accounts SET '+change+';SET ROLE authenticated');
  await assert.rejects(decide);assert.equal((await rows('SELECT status FROM payroll_month_statements'))[0].status,'published');
 }
});
await test('current-body guard retains own active confirm/reject and rejects NULL decision',async()=>{
 await reset();assert.equal((await decide()).rows[0].status,'confirmed');
 await reset();assert.equal((await decide('reject','Nicht korrekt berechnet')).rows[0].status,'rejected');
 await reset();await assert.rejects(()=>decide(null));
 assert.equal((await rows('SELECT status FROM payroll_month_statements'))[0].status,'published');
});
await test('current-body guard refuses source drift instead of overwriting a changed definition',async()=>{
 await reset();await db.exec('RESET ROLE');
 await assert.rejects(()=>db.exec(readFileSync(new URL('../../docs/store/android-employee-decide-payroll-statement-guard-review.sql',import.meta.url),'utf8')),/Reviewed function source changed/);
 await db.exec('ROLLBACK');
});
await db.exec('RESET ROLE');await db.exec(readFileSync(new URL('../../docs/workflow-server-payroll-authorization-draft.sql',import.meta.url),'utf8'));
await test('NULL/unlinked/cross tenant/foreign employee/client actor and disabled account deny without writes',async()=>{
 for(const changes of [{uid:''},{uid:id(90),tenant:'',employee:'',portal:''},{tenant:''},{employee:''},{tenant:id(91)},{employee:id(92)},{portal:'client'},{portal:'relative'}]){
  await reset();await config(changes);await assert.rejects(decide);assert.equal((await rows('SELECT status FROM payroll_month_statements'))[0].status,'published');assert.equal((await rows('SELECT count(*)::int n FROM payroll_month_audit_log'))[0].n,0);
 }
 for(const status of ['disabled','pending_first_login','password_reset_required']){await reset();await db.exec(`RESET ROLE;UPDATE employee_portal_accounts SET status='${status}';SET ROLE authenticated`);await assert.rejects(decide);}
});
await test('own published version is confirmed once and replay returns the same stored timestamp and audit receipt',async()=>{
 await reset();const a=(await decide()).rows[0],b=(await decide()).rows[0];assert.equal(a.status,'confirmed');assert.deepEqual(a.confirmed_at,b.confirmed_at);
 assert.equal((await rows('SELECT count(*)::int n FROM payroll_month_audit_log'))[0].n,1);
 assert.equal((await rows('SELECT metadata FROM payroll_month_audit_log'))[0].metadata.pdf_sha256,pdfHash);
 await assert.rejects(()=>decide('reject','Andere Entscheidung'),/nicht mehr/);
});
await test('reject reason is version-bound and a retry cannot replace the original reason',async()=>{
 await reset();await assert.rejects(()=>decide('reject','kurz'));const a=(await decide('reject','  Nicht korrekt berechnet  ')).rows[0];
 assert.equal(a.employee_decision_reason,'Nicht korrekt berechnet');assert.equal((await decide('reject','Nicht korrekt berechnet')).rows[0].status,'rejected');
 await assert.rejects(()=>decide('reject','Ein anderer neuer Grund'),/Fassung/);assert.equal((await rows('SELECT count(*)::int n FROM payroll_month_audit_log'))[0].n,1);
});
await test('no fake receipt for NULL decision, missing published PDF or invalid published/locked status',async()=>{
 await reset();await assert.rejects(()=>decide(null));
 for(const sql of ["UPDATE payroll_month_statements SET published_at=NULL","UPDATE payroll_month_statements SET pdf_sha256=NULL","UPDATE payroll_month_statements SET status='draft'","UPDATE payroll_month_statements SET locked_at=now()"]){
  await reset();await db.exec('RESET ROLE;ALTER TABLE payroll_month_statements DISABLE TRIGGER workflow_published_payroll_version_guard;'+sql+';ALTER TABLE payroll_month_statements ENABLE TRIGGER workflow_published_payroll_version_guard;SET ROLE authenticated');await assert.rejects(decide);
 }
});
await test('audit insertion error atomically rolls back a decision',async()=>{
 await reset();await db.exec("RESET ROLE;ALTER TABLE payroll_month_audit_log ADD CONSTRAINT force_audit_failure CHECK(action<>'employee_confirmed');SET ROLE authenticated");
 await assert.rejects(decide);assert.equal((await rows('SELECT status FROM payroll_month_statements'))[0].status,'published');
 await db.exec('RESET ROLE;ALTER TABLE payroll_month_audit_log DROP CONSTRAINT force_audit_failure;SET ROLE authenticated');assert.equal((await decide()).rows[0].status,'confirmed');
});
await test('published version scope, PDF, snapshot and totals cannot be silently replaced/deleted',async()=>{
 await reset();await db.exec('RESET ROLE');for(const sql of ["UPDATE payroll_month_statements SET pdf_sha256='fake'","UPDATE payroll_month_statements SET snapshot_json='{}'","UPDATE payroll_month_statements SET actual_work_minutes=100","UPDATE payroll_month_statements SET tenant_id=gen_random_uuid()",'DELETE FROM payroll_month_statements'])await assert.rejects(()=>db.exec(sql),/unveränderlich|gelöscht/);
});
await test('anonymous cannot execute the payroll decision writer',async()=>{await reset();await db.exec('SET ROLE anon');await assert.rejects(decide,/permission denied/);});
await db.close();
