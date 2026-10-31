/** Synthetic source bindings and the unsigned XML layer; no TI or approval evidence. */
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {monthlyHostFixture,signingPng} from './monthly-host-fixture.mjs';
import {MonthlyOriginalVerifier} from '../../services/gkv/monthly-original-verifier.mjs';
import {MonthlyOriginalStore} from '../../services/gkv/monthly-original-store.mjs';
import {monthlyRestDatabase} from '../../services/gkv/monthly-rest-database.mjs';

export const lines=[{code:'0101101',description:'Unterstützung bei der Körperpflege',quantity:'1.00'},
 {code:'0102102',description:'Zeitabhängige Unterstützung',minutes:15}];
export async function monthlyFactsFixture(){
 const f=await monthlyHostFixture(),dir=await mkdtemp(join(tmpdir(),'monthly-facts-'));
 const storeOptions={path:join(dir,'originals.sqlite'),key:randomBytes(32)};
 const store=new MonthlyOriginalStore(storeOptions);
 const database=monthlyRestDatabase({config:f.config,tenantId:f.tenant,principal:{actorId:f.actorId,sessionId:f.sessionId},authorization:'Bearer '+f.token(),workerKeyId:f.workerKeyId,workerKey:f.workerKey,http:f.http});
 // Explicitly exercise the unsigned XML layer. The actual host never disables its CMS gate.
 let worker=new MonthlyOriginalVerifier({database,store,requireComponents:false}),ink=0;
 await f.db.exec('ALTER TABLE clients ADD COLUMN insurance_number text');
 await f.db.exec(await readFile(new URL('../../docs/gkv/sql/monthly-facts-draft.sql',import.meta.url),'utf8'));
 await f.db.query("INSERT INTO care_security.gkv_monthly_fact_profiles VALUES($1,$2,'123456789','999888777','SYNTHETISCHE IK-Zuordnung','SYNTHETISCHE Verantwortlichenprüfung',now()+interval '1 day',NULL)",[f.tenant,f.actorId]);
 const refresh=async v=>{v.p=await f.command('replace_sources',{id:v.p.id,revision:v.p.revision,source_ids:v.p.payload.records.map(r=>r.recordId),reason:'Originalquelle erneut abgleichen'});v.input.revision=v.p.revision;};
 const freeze=async(v,id=randomUUID())=>{v.p=await f.command('freeze_facts',{id:v.p.id,revision:v.p.revision},id);v.input.revision=v.p.revision;return v.p;};
 const setup=async({mapped=true,serviceDate='2026-10-03',serviceStartedAt=serviceDate+'T08:00:00Z',serviceEndedAt=serviceDate+'T08:45:00Z'}={})=>{
  const v=await f.proof({serviceDate}),r=v.p.payload.records[0];
  await f.db.query("UPDATE clients SET insurance_number='A123456789' WHERE id=$1",[v.p.payload.clientId]);
  await f.db.query("UPDATE service_records SET source_receipt=source_receipt||$2::jsonb WHERE id=$1",[r.recordId,JSON.stringify({service_started_at:serviceStartedAt,service_ended_at:serviceEndedAt})]);
  await refresh(v);
  if(mapped)await f.db.query("INSERT INTO care_security.gkv_monthly_fact_sources SELECT tenant_id,id,updated_at,encode(sha256(convert_to(source_receipt::text,'UTF8')),'hex'),'123123123',$2::jsonb,'SYNTHETISCHE Leistungszuordnung' FROM service_records WHERE id=$1",[r.recordId,JSON.stringify(lines)]);
  return v;
 };
 const prepare=async v=>{v.original=await worker.prepare(v.input);await worker.acknowledge(v.input,v.original.originalSha256);};
 const confirm=async v=>{v.png=Buffer.from(signingPng(++ink),'base64');v.receipt=await worker.verify(v.input,v.png);v.p=await f.command('confirm',{id:v.p.id,revision:v.p.revision,content_sha256:v.p.content_sha256,receipt_id:v.receipt.receiptId});return v.p;};
 return {f,store,storeOptions,database,setup,refresh,freeze,prepare,confirm,get worker(){return worker;},
  setComponentSigner(componentSigner){worker=new MonthlyOriginalVerifier({database,store,componentSigner,requireComponents:true});return worker;},
  async close(){database.close();store.close();await f.close();await rm(dir,{recursive:true,force:true});}};
}
