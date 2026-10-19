import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import type { RoleKey } from '@/types';
import { hasDraftShape, hasProfileShape, STATUS_LABELS, type BatchStatus, type ExchangeDraft, type ExchangeProfile } from './model';
import { importInvoiceCase, readSourceSnapshot, UUID } from './sources';
import type { RevisionSummary, SavedRevision } from './history';
export type { RevisionSummary, SavedRevision } from './history';

export type Batch = {id:string;tenant_id:string;revision:number;draft:ExchangeDraft;status:BatchStatus;updated_at:string;origin_batch_id?:string|null;origin_revision?:number|null};
export type Event = {id:string;event_type:string;created_at:string;details:Record<string,unknown>};
export type DirectoryRow = {id:string;filename:string;source_text:string;imported_at:string};
type Row=Record<string,unknown>;
export type SourceInvoice={id:string;invoice_number:string;status:string;total_amount:number;updated_at:string;client_id:string|null};
function connection(tenantId:string,role:RoleKey,write=false) {
  if(getServiceMode()!=='supabase')throw new Error('Der GKV-Datenaustausch steht nur mit einer verbundenen Live-Datenbank zur Verfügung.');
  const denied=enforcePermission(role,write?'office.invoices.create':'office.invoices.view');
  const guard=guardServiceTenant(tenantId);if(denied||guard)throw new Error('Zugriff auf diese Abrechnung ist nicht freigegeben.');
  const client=getSupabaseClient();if(!client)throw new Error('Die Abrechnung benötigt eine verbundene Datenbank.');return client;
}
function failure(error:unknown):never {
  const value=error as {code?:string;message?:string};
  if(['42P01','42883','PGRST202','PGRST205'].includes(value?.code||''))throw new Error('Die Datenbank-Erweiterung für den GKV-Datenaustausch ist noch nicht eingespielt.');
  if(value?.code==='40001')throw new Error('Der Datensatz wurde zwischenzeitlich geändert. Bitte neu laden.');
  if(value?.code==='42501')throw new Error('Für diese Aktion fehlen die Abrechnungsrechte.');
  throw new Error('Die Daten konnten nicht vollständig verarbeitet werden. Bitte erneut versuchen.');
}
export async function readWorkspace(tenantId:string,role:RoleKey) {
  const client=connection(tenantId,role);
  const results=await Promise.all([
    fromUnknownTable(client,'gkv_exchange_batches').select('id,tenant_id,revision,draft,status,updated_at,origin_batch_id,origin_revision').eq('tenant_id',tenantId).order('updated_at',{ascending:false}).order('id').limit(100),
    fromUnknownTable(client,'gkv_exchange_settings').select('tenant_id,profile,revision').eq('tenant_id',tenantId).maybeSingle(),
    fromUnknownTable(client,'gkv_exchange_directories').select('id,filename,imported_at').eq('tenant_id',tenantId).order('imported_at',{ascending:false}).limit(30),
  ]);
  for(const r of results)if(r.error)failure(r.error);
  const batches=(results[0].data||[]) as unknown as Batch[];
  const settings=results[1].data as unknown as {profile:ExchangeProfile;revision:number}|null;
  if(batches.some(batch=>batch.tenant_id!==tenantId || !hasDraftShape(batch.draft)) || (settings && !hasProfileShape(settings.profile)))throw new Error('Ein gespeicherter GKV-Datensatz hat ein unlesbares Format. Bitte die Administration informieren.');
  return {batches,settings,
    directories:(results[2].data||[]) as unknown as Omit<DirectoryRow,'source_text'>[]};
}
export async function command<T>(tenantId:string,role:RoleKey,action:string,input:Row,requestId:string=crypto.randomUUID()):Promise<T> {
  const client=connection(tenantId,role,true);
  const rpc=client.rpc.bind(client) as unknown as (name:string,args:Row)=>Promise<{data:unknown;error:unknown}>;
  const {data,error}=await rpc(action==='copy_revision'?'gkv_exchange_copy_revision':'gkv_exchange_command',
    {p_tenant_id:tenantId,p_request_id:requestId,...(action==='copy_revision'?{}:{p_action:action}),p_input:input});
  if(error)failure(error);return data as T;
}
export async function readBatch(tenantId:string,role:RoleKey,id:string):Promise<Batch> {
  if(!UUID.test(id))throw new Error('Ungültige Paketkennung.');
  const client=connection(tenantId,role);const {data,error}=await fromUnknownTable(client,'gkv_exchange_batches')
    .select('id,tenant_id,revision,draft,status,updated_at,origin_batch_id,origin_revision').eq('tenant_id',tenantId).eq('id',id).single();
  if(error)failure(error);const batch=data as unknown as Batch;
  if(!batch||batch.id!==id||batch.tenant_id!==tenantId||!hasDraftShape(batch.draft))throw new Error('Der gespeicherte Paketstand ist unlesbar.');
  return batch;
}
const revisionColumns='tenant_id,batch_id,revision,status,draft_sha256,recorded_at,capture_kind';
function validRevision(row:RevisionSummary,tenantId:string,batchId:string):boolean {
  return Boolean(row&&row.tenant_id===tenantId&&row.batch_id===batchId&&Number.isSafeInteger(row.revision)&&row.revision>0
    &&Object.hasOwn(STATUS_LABELS,row.status)&&/^[a-f0-9]{64}$/.test(row.draft_sha256)
    &&typeof row.recorded_at==='string'&&Number.isFinite(Date.parse(row.recorded_at))&&['change','backfill'].includes(row.capture_kind));
}
export async function readRevisions(tenantId:string,role:RoleKey,batchId:string,before?:number) {
  if(!UUID.test(batchId)||(before!==undefined&&(!Number.isSafeInteger(before)||before<1)))throw new Error('Ungültige Revisionsabfrage.');
  const client=connection(tenantId,role);let query=fromUnknownTable(client,'gkv_exchange_revisions').select(revisionColumns)
    .eq('tenant_id',tenantId).eq('batch_id',batchId).order('revision',{ascending:false}).limit(21);
  if(before!==undefined)query=query.lt('revision',before);
  const {data,error}=await query;if(error)failure(error);const rows=(data||[]) as unknown as RevisionSummary[];
  if(rows.some(row=>!validRevision(row,tenantId,batchId)))throw new Error('Die gespeicherten Stände sind unlesbar.');
  return {rows:rows.slice(0,20),hasMore:rows.length>20};
}
export async function readRevision(tenantId:string,role:RoleKey,batchId:string,revision:number):Promise<SavedRevision> {
  if(!UUID.test(batchId)||!Number.isSafeInteger(revision)||revision<1)throw new Error('Ungültige Revisionsabfrage.');
  const client=connection(tenantId,role);const {data,error}=await fromUnknownTable(client,'gkv_exchange_revisions').select(`${revisionColumns},draft`)
    .eq('tenant_id',tenantId).eq('batch_id',batchId).eq('revision',revision).single();
  if(error)failure(error);const saved=data as unknown as SavedRevision;
  if(!validRevision(saved,tenantId,batchId)||saved.revision!==revision||!hasDraftShape(saved.draft))throw new Error('Der gespeicherte Stand ist unlesbar.');
  return saved;
}
export async function readEvents(tenantId:string,role:RoleKey,batchId:string):Promise<Event[]> {
  const client=connection(tenantId,role);const {data,error}=await fromUnknownTable(client,'gkv_exchange_events').select('id,event_type,created_at,details').eq('tenant_id',tenantId).eq('batch_id',batchId).order('created_at',{ascending:false}).order('id').limit(100);
  if(error)failure(error);return (data||[]) as unknown as Event[];
}
export async function readDirectory(tenantId:string,role:RoleKey,id:string):Promise<DirectoryRow> {
  const client=connection(tenantId,role);const {data,error}=await fromUnknownTable(client,'gkv_exchange_directories').select('id,filename,source_text,imported_at').eq('tenant_id',tenantId).eq('id',id).single();if(error)failure(error);return data as unknown as DirectoryRow;
}
export async function readInvoiceSources(tenantId:string,role:RoleKey,month:string):Promise<SourceInvoice[]> {
  const client=connection(tenantId,role);const end=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
  const {data,error}=await fromUnknownTable(client,'invoices').select('id,invoice_number,status,total_amount,updated_at,client_id').eq('tenant_id',tenantId)
    .gte('service_period_from',`${month}-01`).lte('service_period_to',`${month}-${end}`).neq('status','cancelled').neq('status','draft').order('invoice_date',{ascending:false}).limit(100);
  if(error)failure(error);return (data||[]) as unknown as SourceInvoice[];
}
export async function readInvoiceCase(tenantId:string,role:RoleKey,id:string,month:string) {
  if(!UUID.test(id))throw new Error('Ungültige Rechnungsreferenz.');
  const client=connection(tenantId,role,true);
  const rpc=client.rpc.bind(client) as unknown as (name:string,args:Row)=>Promise<{data:unknown;error:unknown}>;
  const {data,error}=await rpc('gkv_invoice_source_snapshot',{p_tenant_id:tenantId,p_invoice_ids:[id]});
  if(error)failure(error);
  return importInvoiceCase(readSourceSnapshot(data,tenantId,[id])[0],month);
}
export async function requestTestExport(tenantId:string,role:RoleKey,batch:Batch) {
  const client=connection(tenantId,role,true);const {data,error}=await client.auth.getSession();if(error||!data.session)throw new Error('Bitte erneut anmelden.');
  const response=await fetch('/api/gkv/test-export',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},
    body:JSON.stringify({tenantId,batchId:batch.id,revision:batch.revision}),signal:AbortSignal.timeout(45000)});
  const result=await response.json();if(!response.ok||!result.ok)throw new Error(typeof result.error==='string'?result.error:'Die Prüfdatei konnte nicht erstellt werden.');
  if(result.kind!=='unencrypted_test'||result.revision!==batch.revision||!/^TPFL0\d{3}$/.test(result.name)||! /^[a-f0-9]{64}$/.test(result.sha256)
    ||typeof result.dataBase64!=='string'||result.dataBase64.length>2_700_000||typeof result.orderBase64!=='string'||atob(result.orderBase64).length!==348)throw new Error('Die Antwort des Exportdienstes ist unvollständig.');
  if(result.sourceReport && (!['checkedInvoices','checkedItems','checkedServiceRecords','checkedPdfFiles','manualCases'].every(key=>Number.isSafeInteger(result.sourceReport[key])&&result.sourceReport[key]>=0)||! /^[a-f0-9]{64}$/.test(result.sourceReport.sourceSha256)))throw new Error('Der Quellprüfbericht ist unvollständig.');
  return result as {name:string;sha256:string;dataBase64:string;orderBase64:string;note:string;sourceReport?:{checkedInvoices:number;checkedItems:number;checkedServiceRecords:number;checkedPdfFiles:number;manualCases:number;sourceSha256:string}};
}
export function downloadBytes(name:string,bytes:Uint8Array) {
  const blob=new Blob([new Uint8Array(bytes).buffer],{type:'application/octet-stream'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
