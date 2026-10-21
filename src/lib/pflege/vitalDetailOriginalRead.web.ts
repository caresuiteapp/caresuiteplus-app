import {fromUnknownTable} from '../supabase/untypedTable';
import {withServiceQueryTimeout} from '../services/queryTimeout';
import {assertVitalDetailReadWeb,assertVitalDetailSessionWeb,vitalDetailReadContextWeb,type VitalDetailReadLeaseWeb} from './vitalDetailRuntime.web.ts';

type Row=Readonly<Record<string,unknown>>;
export type VitalDetailOriginalReadWeb=Readonly<Record<never,never>>;
export type VitalDetailOriginalsWeb=Readonly<{measurement:Row;client:Row;followUps:readonly Row[];invalidations:readonly Row[]}>;
type Receipt={lease:VitalDetailReadLeaseWeb;originals:VitalDetailOriginalsWeb;closed:boolean};
const receipts=new WeakMap<object,Receipt>();
const failure=()=>new Error('Die Originalmessung und ihre vollständigen nativen Belege sind nicht bestätigt.');
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const equalUuid=(a:unknown,b:unknown)=>uuid(a)&&uuid(b)&&a.toLowerCase()===b.toLowerCase();
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw failure();return value as Record<string,unknown>;}
function field(value:unknown,key:string):unknown{const descriptor=Object.getOwnPropertyDescriptor(object(value),key);if(!descriptor)return undefined;if(!('value'in descriptor)||!descriptor.enumerable)throw failure();return descriptor.value;}
/** All supplied own data, including unknown fields and undefined, survives; no getter/JSON roundtrip. */
function clone(value:unknown,ancestors=new Set<object>()):unknown{
  if(value===null||value===undefined||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'){if(!Number.isFinite(value))throw failure();return value;}
  if(!value||typeof value!=='object'||ancestors.has(value))throw failure();
  ancestors.add(value);
  try{
    if(Array.isArray(value)){
      if(Object.getPrototypeOf(value)!==Array.prototype||Reflect.ownKeys(value).length!==value.length+1)throw failure();
      const out:unknown[]=[];for(let i=0;i<value.length;i++){const descriptor=Object.getOwnPropertyDescriptor(value,String(i));if(!descriptor||!('value'in descriptor)||!descriptor.enumerable)throw failure();out.push(clone(descriptor.value,ancestors));}return Object.freeze(out);
    }
    object(value);const out:Record<string,unknown>=Object.create(Object.getPrototypeOf(value));
    for(const key of Reflect.ownKeys(value)){if(typeof key!=='string')throw failure();Object.defineProperty(out,key,{value:clone(field(value,key),ancestors),enumerable:true});}return Object.freeze(out);
  }finally{ancestors.delete(value);}
}
function same(a:unknown,b:unknown):boolean{
  if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keysA=Reflect.ownKeys(a),keysB=Reflect.ownKeys(b);return keysA.length===keysB.length&&keysA.every(key=>keysB.includes(key)&&same(Object.getOwnPropertyDescriptor(a,key)?.value,Object.getOwnPropertyDescriptor(b,key)?.value));
}
function root(value:unknown,tenantId:string,measurementId:string,expectedClientId:string|undefined):Row{
  const row=object(value),clientId=field(row,'client_id');
  if(!equalUuid(field(row,'id'),measurementId)||!equalUuid(field(row,'tenant_id'),tenantId)||!uuid(clientId)||(expectedClientId!==undefined&&!equalUuid(clientId,expectedClientId)))throw failure();return row;
}
function client(value:unknown,tenantId:string,clientId:string):Row{const row=object(value);if(Reflect.ownKeys(row).length!==2||!equalUuid(field(row,'id'),clientId)||!equalUuid(field(row,'tenant_id'),tenantId))throw failure();return row;}
function payloadBinding(row:Row):'known'|'unknown_legacy'{
  const payload=field(row,'creation_payload');
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return 'unknown_legacy';
  const reference=field(payload,'measurementId');if(!uuid(reference))return 'unknown_legacy';
  if(!equalUuid(reference,field(row,'measurement_id')))throw failure();return 'known';
}
function page(value:unknown,table:string,tenantId:string,clientId:string,measurementId:string,cursor:string|null):readonly Row[]{
  if(!Array.isArray(value)||value.length>200)throw failure();let previous=cursor;const rows:Row[]=[];
  for(const valueRow of value){const row=object(valueRow),nativeId=field(row,'id');
    if(!uuid(nativeId)||!equalUuid(field(row,'tenant_id'),tenantId)||!equalUuid(field(row,'client_id'),clientId)||!equalUuid(field(row,'measurement_id'),measurementId)||(previous!==null&&nativeId.toLowerCase()<=previous))throw failure();
    // Every row belongs to the original pool; no selection/filtering can hide a foreign or incomplete row.
    if(!uuid(field(row,'request_id'))||!uuid(field(row,'recorded_by')))throw failure();
    payloadBinding(row);
    if(table==='vital_measurement_invalidations'&&rows.length&&rows.some(old=>equalUuid(field(old,'measurement_id'),measurementId)))throw failure();
    rows.push(row);previous=nativeId.toLowerCase();
  }return rows;
}
/** SELECT-only: no Shared mapper/service/write/RPC call and no fabricated active care-case claim. */
export async function fetchVitalDetailOriginalReadWeb(lease:VitalDetailReadLeaseWeb):Promise<VitalDetailOriginalReadWeb>{
  let closed=false;
  const current=()=>{if(closed)throw failure();assertVitalDetailReadWeb(lease);};
  const session=async()=>{current();await assertVitalDetailSessionWeb(lease);current();};
  const select=async(query:PromiseLike<unknown>)=>{
    current();const then=query.then;current();const sameThen=query.then;current();if(typeof then!=='function'||sameThen!==then)throw failure();
    const response=await withServiceQueryTimeout(new Promise<unknown>((resolve,reject)=>{current();Reflect.apply(then,query,[resolve,reject]);}), 'Originale Vitaldokumentation',20_000);
    current();const captured=object(clone(response));current();
    const status=field(captured,'status');if(field(captured,'error')!==null||typeof status!=='number'||!Number.isInteger(status)||status<200||status>=300)throw failure();
    await session();return field(captured,'data');
  };
  try{
    await session();const context=vitalDetailReadContextWeb(lease),{tenantId,measurementId,expectedClientId}=context;
    const fetchRoot=async()=>{await session();const query=fromUnknownTable(context.client,'vital_sign_measurements').select('*').eq('tenant_id',tenantId).eq('id',measurementId).maybeSingle();current();return root(await select(query),tenantId,measurementId,expectedClientId);};
    const before=await fetchRoot(),clientId=field(before,'client_id') as string;
    await session();const clientQuery=fromUnknownTable(context.client,'clients').select('id,tenant_id').eq('tenant_id',tenantId).eq('id',clientId).maybeSingle();current();const nativeClient=client(await select(clientQuery),tenantId,clientId);
    const history=async(table:'vital_measurement_follow_ups'|'vital_measurement_invalidations')=>{
      const result:Row[]=[];let cursor:string|null=null;
      try{for(;;){await session();let query=fromUnknownTable(context.client,table).select('*').eq('tenant_id',tenantId).eq('client_id',clientId).eq('measurement_id',measurementId).order('id',{ascending:true}).limit(200);if(cursor)query=query.gt('id',cursor);current();
        const rows=page(await select(query),table,tenantId,clientId,measurementId,cursor);current();if(!rows.length)return Object.freeze(result);
        if(table==='vital_measurement_invalidations'&&result.length+rows.length>1)throw failure();result.push(...rows);cursor=field(rows[rows.length-1],'id') as string;cursor=cursor.toLowerCase();
      }}catch(error){closed=true;throw error;}
    };
    const [followUps,invalidations]=await Promise.all([history('vital_measurement_follow_ups'),history('vital_measurement_invalidations')]);current();
    const after=await fetchRoot();if(!same(before,after))throw failure();
    await session();current();
    const originals=Object.freeze({measurement:before,client:nativeClient,followUps,invalidations}),token=Object.freeze({});receipts.set(token,{lease,originals,closed:false});return token;
  }finally{closed=true;}
}
export function vitalDetailOriginalsWeb(token:VitalDetailOriginalReadWeb,lease:VitalDetailReadLeaseWeb):VitalDetailOriginalsWeb|null{
  const receipt=receipts.get(token);if(!receipt||receipt.lease!==lease||receipt.closed)return null;
  try{assertVitalDetailReadWeb(lease);return receipt.originals;}catch{receipt.closed=true;return null;}
}
/** Minimal legacy UI projection is separate from all whole native originals and evidence metadata. */
export function vitalDetailProjectionWeb(token:VitalDetailOriginalReadWeb,lease:VitalDetailReadLeaseWeb):Readonly<Record<string,unknown>>|null{
  const originals=vitalDetailOriginalsWeb(token,lease);if(!originals)return null;
  if([...originals.followUps,...originals.invalidations].some(row=>payloadBinding(row)!=='known'))return null;
  const row=originals.measurement,values=field(row,'values'),context=field(row,'context');
  if(typeof field(row,'vital_key')!=='string'||typeof field(row,'display_value')!=='string'||!values||typeof values!=='object'||Array.isArray(values)||!context||typeof context!=='object'||Array.isArray(context))return null;
  const fields=(original:Row,mapping:Record<string,string>)=>{const output:Record<string,unknown>={};for(const [native,projected] of Object.entries(mapping)){if(Object.hasOwn(original,native))Object.defineProperty(output,projected,{value:field(original,native),enumerable:true});}return output;};
  const mapped=Object.freeze({...fields(row,{id:'id',tenant_id:'tenantId',client_id:'clientId',vital_key:'type',display_value:'value',unit:'unit',values:'values',context:'context',note:'note',flag_status:'flagStatus',occurred_at:'occurredAt',created_at:'recordedAt',recorded_by_name:'recordedByName',catalog_snapshot:'catalogSnapshot',configuration_snapshot:'configurationSnapshot'}),clientName:'Name nicht geladen',
    followUps:Object.freeze(originals.followUps.map(f=>Object.freeze(fields(f,{id:'id',observed_at:'observedAt',observation:'observation',action:'action',responsible_person:'responsiblePerson',outcome:'outcome',next_review_at:'nextReviewAt',created_at:'recordedAt',recorded_by_name:'recordedByName'})))),
    invalidation:originals.invalidations.length?Object.freeze(fields(originals.invalidations[0],{id:'id',measurement_id:'measurementId',reason:'reason',created_at:'recordedAt',recorded_by_name:'recordedByName'})):null});
  return vitalDetailOriginalsWeb(token,lease)?mapped:null;
}
