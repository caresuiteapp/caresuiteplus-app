
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const migration = name => readFileSync(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8');
await db.exec(`
CREATE TYPE assignment_status AS ENUM ('planned','confirmed','on_the_way','arrived','started','paused','finished','documentation_open','signature_open','completed','cancelled','no_show');
CREATE TABLE assignments(id text primary key,tenant_id text,client_id text,employee_id text,status assignment_status,on_the_way_at timestamptz,arrived_at timestamptz,actual_start_at timestamptz,actual_end_at timestamptz,finished_at timestamptz,updated_at timestamptz);
CREATE TABLE assist_visits(id text primary key,tenant_id text,client_id text,employee_id text,legacy_assignment_id text,planning_status text,canonical_status text,execution_status text,on_the_way_at timestamptz,arrived_at timestamptz,actual_start_at timestamptz,actual_end_at timestamptz,finished_at timestamptz,updated_at timestamptz);
CREATE TABLE assist_visit_execution_state(tenant_id text,visit_id text,assignment_status text,current_step text,service_started_at timestamptz,service_ended_at timestamptz,finalized_at timestamptz,updated_at timestamptz);
CREATE TABLE assist_time_events(tenant_id text,visit_id text,event_type text);
INSERT INTO assist_visits(id,tenant_id,planning_status,canonical_status,execution_status,actual_start_at) VALUES
('repair','one','confirmed','arrived','arrived','2026-09-10 09:00Z'),
('wrong-tenant','one','confirmed','arrived','arrived','2026-09-10 09:00Z'),
('ended','one','confirmed','arrived','arrived','2026-09-10 09:00Z'),
('cancelled','one','cancelled','arrived','arrived','2026-09-10 09:00Z');
INSERT INTO assist_time_events VALUES('one','repair','service_start'),('two','wrong-tenant','service_start'),('one','ended','service_start'),('one','ended','service_end'),('one','cancelled','service_start');
`);
await db.exec(migration('20260908100000_preserve_active_visit_times'));
await db.exec(migration('20260910120000_guard_assist_execution_status_regression'));
await test('repair requires matching tenant evidence, no end event and an active plan',async()=>{
 const rows=(await db.query('SELECT id,canonical_status FROM assist_visits ORDER BY id')).rows;
 assert.deepEqual(rows,[{id:'cancelled',canonical_status:'arrived'},{id:'ended',canonical_status:'arrived'},{id:'repair',canonical_status:'started'},{id:'wrong-tenant',canonical_status:'arrived'}]);
});
for(const [status,execution,local,step,end,finalized] of [
 ['started','in_progress','gestartet','in_service',false,false],
 ['paused','paused','pausiert','paused',false,false],
 ['finished','completed','beendet','documentation',true,false],
 ['signature_open','completed','unterschrift_offen','signature',true,false],
 ['completed','completed','abgeschlossen','completed',true,true],
 ['cancelled','cancelled','storniert','locked',false,false],
]){
 await test('late arrival preserves '+status+' across all three records',async()=>{
  await db.exec("TRUNCATE assist_visits,assignments,assist_visit_execution_state");
  const endSql=end?"'2026-09-10 10:00Z'":'NULL';
  await db.exec(`
INSERT INTO assignments(id,tenant_id,status,actual_start_at,actual_end_at) VALUES('v','one','${status}','2026-09-10 09:00Z',${endSql});
INSERT INTO assist_visits(id,tenant_id,canonical_status,execution_status,actual_start_at,actual_end_at) VALUES('v','one','${status}','${execution}','2026-09-10 09:00Z',${endSql});
INSERT INTO assist_visit_execution_state(tenant_id,visit_id,assignment_status,current_step,service_started_at,service_ended_at,finalized_at) VALUES('one','v','${local}','${step}','2026-09-10 09:00Z',${endSql},${finalized?endSql:'NULL'});
UPDATE assist_visits SET canonical_status='arrived',execution_status='arrived';
UPDATE assignments SET status='arrived';
UPDATE assist_visit_execution_state SET assignment_status='angekommen',current_step='arrived';
`);
  assert.equal((await db.query('SELECT canonical_status FROM assist_visits')).rows[0].canonical_status,status);
  assert.equal((await db.query('SELECT status FROM assignments')).rows[0].status,status);
  assert.deepEqual((await db.query('SELECT assignment_status,current_step FROM assist_visit_execution_state')).rows[0],{assignment_status:local,current_step:step});
 });
}
await test('restored assignment timestamp is considered before status validation',async()=>{
 await db.exec(`TRUNCATE assist_visits,assignments; INSERT INTO assignments(id,tenant_id,client_id,employee_id,status,actual_start_at) VALUES('v','one','c','e','started','2026-09-10 09:00Z'); INSERT INTO assist_visits(id,tenant_id,client_id,employee_id,legacy_assignment_id,canonical_status,execution_status) VALUES('v','one','c','e','v','arrived','arrived'); UPDATE assist_visits SET canonical_status='arrived';`);
 assert.equal((await db.query('SELECT canonical_status FROM assist_visits')).rows[0].canonical_status,'started');
});
await test('normal arrival before service start remains valid',async()=>{
 await db.exec(`TRUNCATE assist_visits,assignments; INSERT INTO assist_visits(id,tenant_id,canonical_status) VALUES('v','one','on_the_way'); UPDATE assist_visits SET canonical_status='arrived';`);
 assert.equal((await db.query('SELECT canonical_status FROM assist_visits')).rows[0].canonical_status,'arrived');
});
await test('explicit time correction can clear an incorrect start',async()=>{
 await db.exec(`UPDATE assist_visits SET actual_start_at='2026-09-10 09:00Z',canonical_status='started'; UPDATE assist_visits SET actual_start_at=NULL,canonical_status='arrived';`);
 assert.equal((await db.query('SELECT canonical_status FROM assist_visits')).rows[0].canonical_status,'arrived');
});
await db.close();
