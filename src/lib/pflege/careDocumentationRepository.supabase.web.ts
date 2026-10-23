import {cloneClientNativeOriginal} from '../clients/clientRecordNativeOriginal.web.ts';
import {requireCareWorkspaceAuthorityWeb,type CareWorkspaceAuthoritySdkWeb} from './careWorkspaceAuthority.web';
import {getSupabaseClient} from '@/lib/supabase/client';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {careDocumentationInstantMicros,careDocumentationOriginalIssue,careDocumentationPacketIssue,type CareDocumentationOriginal,type CareDocumentationPacket} from './careDocumentationPacket.web';

type Row=Record<string,unknown>;
type Context={tenantId:string;clientId:string|null;actorId:string;isCurrent():boolean};
type Result<T>={ok:true;data:T}|{ok:false;error:string;uncertain?:boolean;rejected?:boolean};
type Response={data:unknown;error:unknown;status?:number};
const unavailable='Die vollständige Pflegedokumentation konnte nicht bestätigt werden.';
const object=(value:unknown):value is Row=>!!value&&typeof value==='object'&&!Array.isArray(value);
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const rpcClient=()=>getSupabaseClient() as unknown as CareWorkspaceAuthoritySdkWeb|null;
const stable=(value:unknown):string=>JSON.stringify(value,(_key,entry:unknown)=>object(entry)?Object.fromEntries(Object.keys(entry).sort().map(key=>[key,entry[key]])):entry);

/** Pin the real account separately from the internal profile for the entire operation. */
async function operation(context:Context){
 const owner={tenantId:context.tenantId,clientId:context.clientId,actorId:context.actorId,callback:context.isCurrent},db=rpcClient();
 if(!db||!uuid(owner.tenantId)||!uuid(owner.clientId)||!uuid(owner.actorId)||typeof owner.callback!=='function')throw Error(unavailable);
 const auth=db.auth,getSession=auth.getSession,getUser=auth.getUser,rpc=db.rpc;let sessionOwner:string|null=null;
 const current=()=>{if(context.tenantId!==owner.tenantId||context.clientId!==owner.clientId||context.actorId!==owner.actorId||context.isCurrent!==owner.callback||owner.callback()!==true||rpcClient()!==db||db.auth!==auth||auth.getSession!==getSession||auth.getUser!==getUser||db.rpc!==rpc||owner.callback()!==true)throw Error(unavailable);};
 const invoke=async(method:Function,receiver:unknown,args:unknown[],label:string)=>{
  current();const request=Reflect.apply(method,receiver,args);current();const raw=await withServiceQueryTimeout(Promise.resolve(request),label,20_000);current();
  const response=cloneClientNativeOriginal(raw);current();if(!object(response)||!Object.hasOwn(response,'data')||!Object.hasOwn(response,'error'))throw Error(unavailable);return response as unknown as Response;
 };
 const scope={tenantId:owner.tenantId,clientId:owner.clientId as string,actorId:owner.actorId,isCurrent:()=>{try{current();return true;}catch{return false;}}};
 const facade:CareWorkspaceAuthoritySdkWeb={auth:{
  getSession:async()=>{
   const response=await invoke(getSession,auth,[],'Eigene Dokumentationssitzung bestätigen');
   if(response.error!==null||!object(response.data)||!object(response.data.session)||!object(response.data.session.user))throw Error(unavailable);
   const session=response.data.session,user=session.user as Row;
   if(!uuid(user.id)||typeof session.access_token!=='string'||!session.access_token||!Number.isSafeInteger(session.expires_at)||Number(session.expires_at)*1000<=Date.now())throw Error(unavailable);
   const fingerprint=stable([user.id,session.access_token,session.expires_at]);if(sessionOwner!==null&&fingerprint!==sessionOwner)throw Error(unavailable);sessionOwner=fingerprint;
   return response as unknown as Awaited<ReturnType<CareWorkspaceAuthoritySdkWeb['auth']['getSession']>>;
  },
  getUser:async(token)=>{const response=await invoke(getUser,auth,[token],'Eigenes Dokumentationskonto bestätigen');if(response.error!==null||!object(response.data)||!object(response.data.user)||response.data.user.is_anonymous===true)throw Error(unavailable);return response as unknown as Awaited<ReturnType<CareWorkspaceAuthoritySdkWeb['auth']['getUser']>>;},
 },rpc:async(name,args)=>{if(!['resolve_current_profile_id','current_tenant_id'].includes(name))throw Error(unavailable);return invoke(rpc,db,[name,args],'Eigenen Dokumentationskontext bestätigen');}};
 const check=async()=>{current();await requireCareWorkspaceAuthorityWeb(scope,()=>{current();return facade;},(request,label)=>withServiceQueryTimeout(Promise.resolve(request),label,20_000),unavailable);current();};
 await check();return{scope,current,check,read:async(name:string,args:Row,label:string)=>invoke(rpc,db,[name,args],label)};
}
function decodeOriginal(value:unknown,context:{tenantId:string;clientId:string}):CareDocumentationOriginal{const issue=careDocumentationOriginalIssue(value,context);if(issue)throw Error(issue);return cloneClientNativeOriginal(value as CareDocumentationOriginal);}
function pageEnvelope(value:unknown){if(!object(value)||Object.keys(value).sort().join(',')!=='nextCursorId,nextCursorOccurredAt,rows,stateFingerprint'||!Array.isArray(value.rows)||value.rows.length>100||typeof value.stateFingerprint!=='string'||!/^sha256:[0-9a-f]{64}$/.test(value.stateFingerprint))throw Error(unavailable);return value as Row&{rows:unknown[];stateFingerprint:string};}

export async function readCareDocumentation(context:Context):Promise<Result<CareDocumentationOriginal[]>>{
 if(!context.clientId)return{ok:false,error:'Aktiven Pflegefall wählen.'};
 try{
  const guard=await operation(context),all:CareDocumentationOriginal[]=[],roots=new Set<string>();let cursorOccurred:string|null=null,cursorId:string|null=null,stateFingerprint='',head:unknown=null;
  const read=async(at:string|null,id:string|null)=>{await guard.check();const response=await guard.read('web_read_care_documentation_page',{p_tenant_id:guard.scope.tenantId,p_client_id:guard.scope.clientId,p_actor_profile_id:guard.scope.actorId,p_cursor_occurred_at:at,p_cursor_id:id,p_page_size:100},'Pflegedokumentation vollständig laden');await guard.check();if(response.error!==null)throw Error(unavailable);return pageEnvelope(response.data);};
  for(let page=0;page<100;page++){
   const data=await read(cursorOccurred,cursorId);if(stateFingerprint&&data.stateFingerprint!==stateFingerprint)throw Error('Der Dokumentationsbestand wurde während des Ladens geändert. Neu laden.');stateFingerprint=data.stateFingerprint;if(head===null)head=cloneClientNativeOriginal(data);
   if(data.rows.length===0){if(data.nextCursorOccurredAt!==null||data.nextCursorId!==null)throw Error(unavailable);const latest=await read(null,null);if(stable(latest)!==stable(head))throw Error('Der vollständige Dokumentationsstand wurde während des Ladens geändert. Neu laden.');guard.current();return{ok:true,data:all};}
   let previous=cursorOccurred===null?null:{at:careDocumentationInstantMicros(cursorOccurred)!,id:cursorId!.toLowerCase()};
   for(const value of data.rows){const row=decodeOriginal(value,guard.scope),at=careDocumentationInstantMicros(row.occurredAt);if(at===null)throw Error(unavailable);const position={at,id:row.id.toLowerCase()};if(roots.has(row.rootId.toLowerCase())||previous&&(position.at>previous.at||position.at===previous.at&&position.id>=previous.id))throw Error(unavailable);roots.add(row.rootId.toLowerCase());all.push(row);previous=position;}
   if(!previous||!uuid(data.nextCursorId)||typeof data.nextCursorOccurredAt!=='string'||careDocumentationInstantMicros(data.nextCursorOccurredAt)!==previous.at||data.nextCursorId.toLowerCase()!==previous.id)throw Error(unavailable);cursorOccurred=data.nextCursorOccurredAt;cursorId=data.nextCursorId;
  }
  return{ok:false,error:'Der Dokumentationsbestand überschreitet die sicher vollständig lesbare Grenze.'};
 }catch(error){return{ok:false,error:error instanceof Error?error.message:unavailable};}
}
export async function readCareDocumentationRecord(context:Context,id:string):Promise<Result<CareDocumentationOriginal>>{
 if(!context.clientId)return{ok:false,error:'Aktiven Pflegefall wählen.'};
 try{if(!uuid(id))throw Error(unavailable);const guard=await operation(context);const response=await guard.read('web_read_care_documentation_record',{p_tenant_id:guard.scope.tenantId,p_client_id:guard.scope.clientId,p_actor_profile_id:guard.scope.actorId,p_entry_id:id},'Dokumentationsoriginal laden');await guard.check();if(response.error!==null)throw Error(unavailable);const original=decodeOriginal(response.data,guard.scope);if(!original.history.some(item=>item.id===id))throw Error(unavailable);guard.current();return{ok:true,data:original};}catch(error){return{ok:false,error:error instanceof Error?error.message:unavailable};}
}
function receipt(value:unknown,packet:CareDocumentationPacket):CareDocumentationOriginal|null{
 try{
  if(!object(value)||Object.keys(value).sort().join(',')!=='original,packet,requestId'||value.requestId!==packet.requestId||stable(value.packet)!==stable(packet))return null;
  const original=decodeOriginal(value.original,packet),last=original.history.at(-1)!;
  if(original.voided||packet.action==='confirm')return null; // The native qualification bridge is still unavailable.
  if(original.signature!==null||original.revision!==packet.expectedRevision+1||last.previousId!==packet.expectedHeadId||original.recordedBy!==packet.actorId||last.recordedBy!==packet.actorId||last.correctionReason!==packet.correctionReason||stable(original.payload)!==stable(packet.entry)||stable(last.payload)!==stable(packet.entry))return null;
  if(packet.original){if(original.rootId!==packet.original.rootId||stable(original.history.slice(0,-1))!==stable(packet.original.history))return null;}else if(original.rootId!==original.headId||original.history.length!==1)return null;
  return original;
 }catch{return null;}
}
function capturePacket(value:CareDocumentationPacket){const packet=cloneClientNativeOriginal(value),issue=careDocumentationPacketIssue(packet);if(issue)throw Error(issue);return packet;}
export async function commitCareDocumentationPacket(input:CareDocumentationPacket,isCurrent:()=>boolean,replay=false):Promise<Result<CareDocumentationOriginal>>{
 let packet:CareDocumentationPacket;try{packet=capturePacket(input);}catch(error){return{ok:false,error:error instanceof Error?error.message:unavailable,rejected:true};}let dispatched=false;
 try{const guard=await operation({tenantId:packet.tenantId,clientId:packet.clientId,actorId:packet.actorId,isCurrent});guard.current();dispatched=true;const response=await guard.read('web_commit_care_documentation_packet',{p_packet:packet},'Pflegedokumentation transaktional speichern');await guard.check();if(response.error!==null){const code=object(response.error)?String(response.error.code??''):'';return{ok:false,error:toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]),...(response.data===null&&['22007','22008','22023','22P02','23514','40001','42501','P0E01','P0E02'].includes(code)?{rejected:true}:{uncertain:true})};}const saved=receipt(response.data,packet);guard.current();return saved?{ok:true,data:saved}:{ok:false,error:unavailable,uncertain:true};}catch(error){return{ok:false,error:error instanceof Error?error.message:unavailable,uncertain:dispatched||replay};}
}
export async function confirmCareDocumentationPacket(input:CareDocumentationPacket,isCurrent:()=>boolean):Promise<Result<CareDocumentationOriginal>>{
 let packet:CareDocumentationPacket;try{packet=capturePacket(input);}catch(error){return{ok:false,error:error instanceof Error?error.message:unavailable,rejected:true};}
 try{const guard=await operation({tenantId:packet.tenantId,clientId:packet.clientId,actorId:packet.actorId,isCurrent});const response=await guard.read('web_confirm_care_documentation_packet',{p_tenant_id:packet.tenantId,p_client_id:packet.clientId,p_actor_profile_id:packet.actorId,p_request_id:packet.requestId,p_packet:packet},'Unklare Dokumentation anhand nativer Quittung prüfen');await guard.check();if(response.error!==null)return{ok:false,error:unavailable};const saved=receipt(response.data,packet);guard.current();return saved?{ok:true,data:saved}:{ok:false,error:unavailable};}catch(error){return{ok:false,error:error instanceof Error?error.message:unavailable};}
}
