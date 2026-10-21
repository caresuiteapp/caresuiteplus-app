import {cloneClientNativeOriginal as clone,freezeClientNativeOriginal as freeze,sameClientNativeOriginal as same} from '../clients/clientRecordNativeOriginal.web.ts';
import {fromUnknownTable} from '../supabase/untypedTable';
import {withServiceQueryTimeout} from '../services/queryTimeout';
import {beginVitalHistoryFetchWeb,assertVitalHistoryFetchWeb,assertVitalHistorySessionWeb,vitalHistoryReadContextWeb,closeVitalHistoryFetchWeb,type VitalHistoryFetchWeb,type VitalHistoryReadLeaseWeb} from './vitalHistoryRuntime.web.ts';

type Row=Readonly<Record<string,unknown>>;
export type VitalHistoryOriginalReadWeb=Readonly<Record<never,never>>;
export type VitalHistoryReadOriginalsWeb=Readonly<{scope:Readonly<{tenantId:string;clientId:string}>;client:Row;measurements:readonly Row[];followUps:readonly Row[];invalidations:readonly Row[];responses:readonly Row[]}>;
type Receipt={lease:VitalHistoryReadLeaseWeb;frame:VitalHistoryFetchWeb;originals:VitalHistoryReadOriginalsWeb;closed:boolean};
const receipts=new WeakMap<object,Receipt>();
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const equal=(a:unknown,b:unknown)=>uuid(a)&&uuid(b)&&a.toLowerCase()===b.toLowerCase();
const failure=()=>Error('Der aktuelle ganze native Verlauf mit allen Originalbelegen ist nicht bestätigt.');
function object(value:unknown):Row{if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw failure();return value as Row;}
const own=(row:Row,key:string):unknown=>Object.getOwnPropertyDescriptor(row,key)?.value;
function validatePage(value:unknown,tenantId:string,clientId:string,cursor:string|null):readonly Row[]{if(!Array.isArray(value)||value.length>200)throw failure();let previous=cursor;for(const native of value){const row=object(native);if(!Object.hasOwn(row,'id')||!Object.hasOwn(row,'tenant_id')||!Object.hasOwn(row,'client_id')||!uuid(row.id)||!equal(row.tenant_id,tenantId)||!equal(row.client_id,clientId)||previous!==null&&row.id.toLowerCase()<=previous)throw failure();previous=row.id.toLowerCase();}return value;}
/** SELECT-only scoped collection, not an atomic history snapshot or active-care-case authorization. */
export async function fetchVitalHistoryOriginalReadWeb(lease:VitalHistoryReadLeaseWeb):Promise<VitalHistoryOriginalReadWeb>{
 const frame=beginVitalHistoryFetchWeb(lease);let failed=false;const responses:Row[]=[];
 const current=()=>{if(failed)throw failure();assertVitalHistoryFetchWeb(frame,lease);};
 const session=async()=>{current();await assertVitalHistorySessionWeb(frame,lease);current();};
 const select=async(query:PromiseLike<unknown>)=>{current();const then=query.then;current();const second=query.then;current();if(typeof then!=='function'||then!==second)throw failure();const raw=await withServiceQueryTimeout(new Promise<unknown>((resolve,reject)=>{current();Reflect.apply(then,query,[resolve,reject]);}),'Ganze originale Vitalwertverläufe',20_000);current();const response=object(freeze(clone(raw)));current();if(!Object.hasOwn(response,'data')||!Object.hasOwn(response,'error')||!Object.hasOwn(response,'status')||response.error!==null||typeof response.status!=='number'||!Number.isInteger(response.status)||response.status<200||response.status>=300)throw failure();responses.push(response);await session();return response.data;};
 try{
  await session();const context=vitalHistoryReadContextWeb(frame,lease),{tenantId,clientId}=context;
  const clientRead=async()=>{await session();const query=fromUnknownTable(context.client,'clients').select('id,tenant_id').eq('tenant_id',tenantId).eq('id',clientId).maybeSingle();current();const native=object(await select(query));if(Object.keys(native).length!==2||!Object.hasOwn(native,'id')||!Object.hasOwn(native,'tenant_id')||!equal(native.id,clientId)||!equal(native.tenant_id,tenantId))throw failure();return native;};
  const beforeClient=await clientRead();
  const pool=async(table:'vital_sign_measurements'|'vital_measurement_follow_ups'|'vital_measurement_invalidations')=>{const rows:Row[]=[];let cursor:string|null=null;try{for(;;){await session();let query=fromUnknownTable(context.client,table).select('*').eq('tenant_id',tenantId).eq('client_id',clientId).order('id',{ascending:true}).limit(200);if(cursor)query=query.gt('id',cursor);current();const page=validatePage(await select(query),tenantId,clientId,cursor);current();if(!page.length)return Object.freeze(rows);rows.push(...page);cursor=(page[page.length-1].id as string).toLowerCase();}}catch(error){failed=true;throw error;}};
  const measurements=await pool('vital_sign_measurements');
  const [followUps,invalidations]=await Promise.all([pool('vital_measurement_follow_ups'),pool('vital_measurement_invalidations')]);current();
  const parents=new Map(measurements.map(row=>[(row.id as string).toLowerCase(),row])),corrected=new Set<string>();
  const requests=new Set<string>();for(const row of measurements){const request=own(row,'creation_request_id');if(request!=null){if(!uuid(request)||requests.has(request.toLowerCase()))throw failure();requests.add(request.toLowerCase());}const payload=own(row,'creation_payload');if(payload&&typeof payload==='object'&&!Array.isArray(payload)&&Object.hasOwn(payload,'clientId')&&uuid((payload as Row).clientId)&&!equal((payload as Row).clientId,clientId))throw failure();}
  for(const [table,rows] of [['followUps',followUps],['invalidations',invalidations]] as const){const requests=new Set<string>();for(const row of rows){if(!Object.hasOwn(row,'measurement_id')||!Object.hasOwn(row,'request_id')||!Object.hasOwn(row,'recorded_by')||!uuid(row.measurement_id)||!parents.has(row.measurement_id.toLowerCase())||!uuid(row.request_id)||requests.has(row.request_id.toLowerCase())||!uuid(row.recorded_by))throw failure();requests.add(row.request_id.toLowerCase());const payload=own(row,'creation_payload');if(payload&&typeof payload==='object'&&!Array.isArray(payload)&&Object.hasOwn(payload,'measurementId')&&uuid((payload as Row).measurementId)&&!equal((payload as Row).measurementId,row.measurement_id))throw failure();if(table==='invalidations'){if(corrected.has(row.measurement_id.toLowerCase()))throw failure();corrected.add(row.measurement_id.toLowerCase());}}}
  current();const after=await pool('vital_sign_measurements');if(!same(measurements,after))throw failure();const afterClient=await clientRead();if(!same(beforeClient,afterClient))throw failure();await session();current();
  const originals=freeze({scope:{tenantId,clientId},client:beforeClient,measurements,followUps,invalidations,responses}),token=Object.freeze({});current();receipts.set(token,{lease,frame,originals,closed:false});return token;
 }catch(error){failed=true;closeVitalHistoryFetchWeb(frame);throw error;}
}
/** Only this own completed delivery/frame is readable; arbitrary cache data cannot recreate it. */
export function vitalHistoryReadOriginalsWeb(token:VitalHistoryOriginalReadWeb,lease:VitalHistoryReadLeaseWeb):VitalHistoryReadOriginalsWeb|null{const receipt=receipts.get(token);if(!receipt||receipt.closed||receipt.lease!==lease)return null;try{assertVitalHistoryFetchWeb(receipt.frame,lease);return receipt.originals;}catch{receipt.closed=true;return null;}}
