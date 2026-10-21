import { getSupabaseClient } from '@/lib/supabase/client';
import { getServiceMode } from '@/lib/services/mode';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal, captureClientNativePage, type ClientNativeRow } from './clientRecordNativeOriginal.web';
import type { ClientEditAttempt } from './clientRecordEditController.web';
import type { ClientEditCoreOutcome } from './clientRecordEditCoreWrite.web';
import { claimClientCareDocumentAppendWeb, assertClientCareDocumentAppendWeb, clientCareDocumentAppendPrivateBindingWeb,
  type ClientCareDocumentAppendPlan, type ClientCareDocumentAppendCapability, type ClientCareDocumentAppendPrivateBinding } from './clientRecordEditCareDocumentPlan.web';
import { validEventInstant } from '../pflege/medicationAdministrationDomain';
import { woundUuid } from '../pflege/woundCareDomain';

export type ClientCareDocumentAppendEvidence = Readonly<{table:string;payload:ClientNativeRow;nativeResult:unknown;acknowledged:boolean}>;
export type ClientCareDocumentAppendOutcome = Readonly<{
  phase:'care_document_append';status:'blocked'|'uncertain'|'acknowledged';nativeWriteEntered:boolean;
  /** Snapshot only; never a whole-save completion, clinical approval or continuation grant. */
  currentAtReturn:boolean;evidence:readonly ClientCareDocumentAppendEvidence[];error?:string;
}>;
type Completed={cap:ClientCareDocumentAppendCapability;attempt:ClientEditAttempt;plan:ClientCareDocumentAppendPlan};
const completed=new WeakMap<ClientCareDocumentAppendOutcome,Completed>();
const denied=()=>Error('Der private Dokumentnachfolger oder seine vollständige native Teilbestätigung ist ungeklärt.');
const object=(v:unknown):v is ClientNativeRow=>!!v&&typeof v==='object'&&!Array.isArray(v);
const own=(r:ClientNativeRow,k:string)=>{if(!Object.hasOwn(r,k))throw denied();return r[k];};
const tables={documents:'client_intake_documents',canonicals:'client_documents',signatures:'client_document_signatures',events:'client_document_events',systems:'intake_document_system_templates',tenants:'tenant_document_templates'}as const;
function response(raw:unknown):ClientNativeRow {
  const r=freezeClientNativeOriginal(cloneClientNativeOriginal(raw));
  if(!object(r)||own(r,'error')!==null||!Object.hasOwn(r,'data')||typeof own(r,'status')!=='number'
    ||!Number.isInteger(r.status)||Number(r.status)<200||Number(r.status)>299)throw denied();return r;
}
function metadata(v:unknown):void{if(typeof v!=='string'||!validEventInstant(v.replace(' ','T')))throw denied();}
function page(raw:unknown,b:ClientCareDocumentAppendPrivateBinding,key:keyof typeof tables,cursor:string|null):ClientNativeRow[] {
  if(key!=='systems'&&key!=='tenants')return captureClientNativePage(raw,b.lease.original.scope,cursor);
  const rows=cloneClientNativeOriginal(raw);if(!Array.isArray(rows))throw denied();let previous=cursor?.toLowerCase()??null;
  for(const row of rows){if(!object(row)||!woundUuid(own(row,'id'))||key==='tenants'&&own(row,'tenant_id')!==b.lease.original.scope.tenantId
      ||key==='systems'&&Object.hasOwn(row,'tenant_id'))throw denied();
    const id=String(row.id).toLowerCase();if(previous!==null&&id<=previous)throw denied();previous=id;}
  return freezeClientNativeOriginal(rows);
}
function ack(raw:unknown,b:ClientCareDocumentAppendPrivateBinding,table:string,payload:ClientNativeRow,known:Set<string>):ClientNativeRow {
  const r=response(raw),row=own(r,'data'),scope=b.lease.original.scope;
  if(!object(row)||!woundUuid(own(row,'id'))||known.has(String(row.id).toLowerCase())||own(row,'tenant_id')!==scope.tenantId||own(row,'client_id')!==scope.clientId)throw denied();
  for(const [k,v]of Object.entries(payload))if(!sameClientNativeOriginal(own(row,k),v))throw denied();
  metadata(own(row,'created_at'));
  if(table!=='client_document_events')metadata(own(row,'updated_at'));
  if(table==='client_intake_documents'){
    for(const k of ['finalized_html','rendered_pdf_path','finalized_at','generated_document_id'])if(own(row,k)!==null)throw denied();
  }else if(table==='client_documents'){
    for(const k of ['storage_path','valid_until','size_bytes','signed_at','service_record_id','service_month'])if(own(row,k)!==null)throw denied();
    if(own(row,'signature_required')!==false||!sameClientNativeOriginal(own(row,'module_visibility'),[]))throw denied();
  }
  known.add(String(row.id).toLowerCase());return row;
}

/** Append-only three independent native rows per successor. Existing documents,
 * signatures and history are never mutated. No transaction/CAS/version-head,
 * replay, activation, portal publication, finish or whole-save ACK is invented. */
export async function executeClientCareDocumentAppendWeb(plan:ClientCareDocumentAppendPlan,attempt:ClientEditAttempt,coreOutcome:ClientEditCoreOutcome):Promise<ClientCareDocumentAppendOutcome> {
  const cap=claimClientCareDocumentAppendWeb(plan,attempt,coreOutcome),evidence:ClientCareDocumentAppendEvidence[]=[];
  let nativeWriteEntered=false;
  const current=()=>{try{if(!cap)return false;assertClientCareDocumentAppendWeb(cap);return true;}catch{return false;}};
  const finish=(status:ClientCareDocumentAppendOutcome['status'],error?:string)=>{
    const outcome=freezeClientNativeOriginal({phase:'care_document_append' as const,status,nativeWriteEntered,currentAtReturn:current(),evidence:[...evidence],...(error?{error}:{})});
    if(cap)completed.set(outcome,{cap,attempt,plan});return outcome;
  };
  if(!cap)return finish('blocked');
  try{
    const b=clientCareDocumentAppendPrivateBindingWeb(cap),db=b.sdk,scope=b.lease.original.scope;
    const expected=cloneClientNativeOriginal(b.originals.pools);
    const ids=Object.fromEntries(Object.entries(expected).map(([key,rows])=>[key,new Set(rows.map(r=>String(r.id).toLowerCase()))]))as Record<keyof typeof tables,Set<string>>;
    const gate=()=>{
      assertClientCareDocumentAppendWeb(cap);
      if(getServiceMode()!=='supabase'||getSupabaseClient()!==db||getServiceMode()!=='supabase')throw denied();
    };
    const dispatch=async(build:()=>PromiseLike<unknown>,mutation:boolean):Promise<unknown>=>{
      gate();
      const invoke=()=>{
        gate();const query=build();
        return {then<TResult1=unknown,TResult2=never>(onfulfilled?:((v:unknown)=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((e:unknown)=>TResult2|PromiseLike<TResult2>)|null):Promise<TResult1|TResult2>{
          return new Promise<unknown>((resolve,reject)=>{
            try{const then=query?.then,same=query?.then;if(typeof then!=='function'||same!==then)throw denied();
              gate();if(mutation)nativeWriteEntered=true;Reflect.apply(then,query,[resolve,reject]);}catch(error){reject(error);}
          }).then(onfulfilled,onrejected);
        }};
      };
      // Native SELECTs remain source-owned reads. Mutations enter the already
      // active controller journal; a denied builder is never a whole no-write proof.
      return withServiceQueryTimeout(mutation?b.controller.dispatchNativeWrite(attempt,invoke):new Promise<unknown>((resolve,reject)=>{
        try{invoke().then(resolve,reject);}catch(error){reject(error);}
      }));
    };
    const revalidate=async()=>{
      for(const[key,table]of Object.entries(tables)as[keyof typeof tables,string][]){
        const rows:ClientNativeRow[]=[];let cursor:string|null=null;
        for(;;){const raw=await dispatch(()=>{
          let q=fromUnknownTable(db,table).select('*');if(key!=='systems')q=q.eq('tenant_id',scope.tenantId);
          if(key!=='systems'&&key!=='tenants')q=q.eq('client_id',scope.clientId);
          q=q.order('id',{ascending:true}).limit(200);if(cursor!==null)q=q.gt('id',cursor);return q;
        },false);
          gate();const r=response(raw),rowsPage=page(r.data,b,key,cursor);gate();
          if(!rowsPage.length)break;rows.push(...rowsPage);cursor=String(rowsPage[rowsPage.length-1].id).toLowerCase();
        }
        gate();const want=[...expected[key]].sort((a,c)=>String(a.id).toLowerCase().localeCompare(String(c.id).toLowerCase()));
        if(!sameClientNativeOriginal(rows,want))throw denied();
      }
      gate();
    };
    const insert=async(key:'documents'|'canonicals'|'events',payload:ClientNativeRow)=>{
      await revalidate();gate();
      let raw:unknown=null;
      try{
        raw=await dispatch(()=>fromUnknownTable(db,tables[key]).insert(payload).select('*').single(),true);
        // Clone and retain SDK facts BEFORE current authority checks. Known ACKs
        // survive owner/rights loss; that never authorizes another request.
        const captured=freezeClientNativeOriginal(cloneClientNativeOriginal(raw));
        const row=ack(captured,b,tables[key],payload,ids[key]);
        evidence.push(freezeClientNativeOriginal({table:tables[key],payload,nativeResult:captured,acknowledged:true}));expected[key].push(row);
        return row;
      }catch(error){
        let captured:unknown=null;try{captured=freezeClientNativeOriginal(cloneClientNativeOriginal(raw));}catch{}
        evidence.push(freezeClientNativeOriginal({table:tables[key],payload,nativeResult:captured,acknowledged:false}));throw error;
      }
    };
    for(const row of b.rows){
      const intake=await insert('documents',row.intake);gate();
      const canonical=freezeClientNativeOriginal({...row.canonical,intake_document_id:intake.id});
      await insert('canonicals',canonical);gate();
      const event=freezeClientNativeOriginal({...row.event,document_id:intake.id});
      await insert('events',event);
      // Last accepted row remains fact even when a final follow-up gate denies.
      if(row!==b.rows[b.rows.length-1])gate();
    }
    return finish('acknowledged');
  }catch(error){return finish('uncertain',error instanceof Error?error.message:'Die Dokumentteilfolge ist ungeklärt.');}
}
/** Fresh own phase continuation only. Copied outcomes/snapshot positives cannot grant UI or close a journal. */
export function mayContinueClientCareDocumentAppendWeb(plan:ClientCareDocumentAppendPlan,attempt:ClientEditAttempt,outcome:ClientCareDocumentAppendOutcome):boolean {
  const own=completed.get(outcome);if(!own||own.plan!==plan||own.attempt!==attempt||outcome.status!=='acknowledged')return false;
  try{assertClientCareDocumentAppendWeb(own.cap);return true;}catch{return false;}
}
