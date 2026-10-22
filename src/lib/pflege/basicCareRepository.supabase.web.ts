import {cloneClientNativeOriginal,sameClientNativeOriginal} from '../clients/clientRecordNativeOriginal.web.ts';
import {requireCareWorkspaceAuthorityWeb,type CareWorkspaceAuthoritySdkWeb} from './careWorkspaceAuthority.web';
import {getSupabaseClient} from '@/lib/supabase/client';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {basicCareInstantMicros,basicCareOriginalIssue,basicCarePacketIssue,basicCareReviewOriginalIssue,basicCareReviewPacketIssue,basicCareReceiptIssue,basicCareReviewReceiptIssue,type BasicCareOriginal,type BasicCarePacket,type BasicCareReviewOriginal,type BasicCareReviewPacket} from './basicCarePacket.web';
type Row=Record<string,unknown>;
type Context={tenantId:string;clientId:string;actorId:string;isCurrent():boolean};
type Result<T>={ok:true;data:T}|{ok:false;error:string;uncertain?:boolean;rejected?:boolean};
type Response={data:unknown;error:unknown;status?:number};
const unavailable='Der vollständige Grundpflegebestand konnte nicht bestätigt werden.';
const object=(v:unknown):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&v.length===36&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const sha=(v:unknown):v is string=>typeof v==='string'&&v.length===71&&/^sha256:[0-9a-f]{64}$/.test(v);
const rpcClient=()=>getSupabaseClient() as unknown as CareWorkspaceAuthoritySdkWeb|null;
const stable=(value:unknown):string=>JSON.stringify(value,(_key,entry:unknown)=>object(entry)?Object.fromEntries(Object.keys(entry).sort().map(key=>[key,entry[key]])):entry);
export type BasicCarePrerequisites=Readonly<{
 plans:readonly Readonly<{planVersionId:string;measureId:string;visitId:string;planSnapshotSha256:string;kind:BasicCarePacket['entry']['kind'];title:string;plannedAt:string;secondPersonRequired:boolean;pressureOriginals:BasicCarePacket['pressureOriginals'];fallOriginals:BasicCarePacket['fallOriginals']}>[];
 pressure:BasicCarePacket['pressureOriginals'];fall:BasicCarePacket['fallOriginals'];
}>;
/** Pin the real account separately from the internal profile for the entire operation. */
export async function createBasicCareTransportGuard(context:Context){
 const owner={tenantId:context.tenantId,clientId:context.clientId,actorId:context.actorId,callback:context.isCurrent},db=rpcClient();
 if(!db||!uuid(owner.tenantId)||!uuid(owner.clientId)||!uuid(owner.actorId)||typeof owner.callback!=='function')throw Error(unavailable);
 const auth=db.auth,getSession=auth.getSession,getUser=auth.getUser,rpc=db.rpc;let sessionOwner:string|null=null;
 const current=()=>{if(context.tenantId!==owner.tenantId||context.clientId!==owner.clientId||context.actorId!==owner.actorId||context.isCurrent!==owner.callback||owner.callback()!==true||rpcClient()!==db||db.auth!==auth||auth.getSession!==getSession||auth.getUser!==getUser||db.rpc!==rpc||owner.callback()!==true)throw Error(unavailable);};
 const invoke=async(method:Function,receiver:unknown,args:unknown[],label:string)=>{
  current();const request=Reflect.apply(method,receiver,args);current();const raw=await withServiceQueryTimeout(Promise.resolve(request),label,20_000);current();
  const response=cloneClientNativeOriginal(raw);const strict=(value:unknown):void=>{if(value===undefined)throw Error(unavailable);if(value&&typeof value==='object')for(const item of Object.values(value))strict(item);};strict(response);current();if(!object(response)||!Object.hasOwn(response,'data')||!Object.hasOwn(response,'error'))throw Error(unavailable);return response as unknown as Response;
 };
 const scope={tenantId:owner.tenantId,clientId:owner.clientId as string,actorId:owner.actorId,isCurrent:()=>{try{current();return true;}catch{return false;}}};
 const facade:CareWorkspaceAuthoritySdkWeb={auth:{
  getSession:async()=>{
   const response=await invoke(getSession,auth,[],'Eigene Grundpflegesitzung bestätigen');
   if(response.error!==null||!object(response.data)||!object(response.data.session)||!object(response.data.session.user))throw Error(unavailable);
   const session=response.data.session,user=session.user as Row;
   if(!uuid(user.id)||typeof session.access_token!=='string'||!session.access_token||!Number.isSafeInteger(session.expires_at)||Number(session.expires_at)*1000<=Date.now())throw Error(unavailable);
   const fingerprint=stable([user.id,session.access_token,session.expires_at]);if(sessionOwner!==null&&fingerprint!==sessionOwner)throw Error(unavailable);sessionOwner=fingerprint;
   return response as unknown as Awaited<ReturnType<CareWorkspaceAuthoritySdkWeb['auth']['getSession']>>;
  },
  getUser:async(token)=>{const response=await invoke(getUser,auth,[token],'Eigenes Grundpflegekonto bestätigen');if(response.error!==null||!object(response.data)||!object(response.data.user)||response.data.user.is_anonymous===true)throw Error(unavailable);return response as unknown as Awaited<ReturnType<CareWorkspaceAuthoritySdkWeb['auth']['getUser']>>;},
 },rpc:async(name,args)=>{if(!['resolve_current_profile_id','current_tenant_id'].includes(name))throw Error(unavailable);return invoke(rpc,db,[name,args],'Eigenen Grundpflegekontext bestätigen');}};
 const check=async()=>{current();await requireCareWorkspaceAuthorityWeb(scope,()=>{current();return facade;},(request,label)=>withServiceQueryTimeout(Promise.resolve(request),label,20_000),unavailable);current();};
 await check();return{scope,current,check,read:async(name:string,args:Row,label:string)=>invoke(rpc,db,[name,args],label)};
}
const exact=(value:Row,keys:string)=>Object.keys(value).sort().join(',')===keys.split(',').sort().join(',');
const ids=(v:unknown):v is readonly string[]=>Array.isArray(v)&&v.every(uuid)&&new Set(v.map(x=>x.toLowerCase())).size===v.length;
function pressure(v:unknown){return v===null||object(v)&&exact(v,'markerId,assessmentIds,historyIds')&&uuid(v.markerId)&&ids(v.assessmentIds)&&ids(v.historyIds);}
function fall(v:unknown){return v===null||object(v)&&exact(v,'reviewIds,eventIds,measureIds')&&ids(v.reviewIds)&&ids(v.eventIds)&&ids(v.measureIds);}
export async function readBasicCarePrerequisites(context:Context):Promise<Result<BasicCarePrerequisites>>{
 try{const guard=await createBasicCareTransportGuard(context),response=await guard.read('web_read_basic_care_prerequisites',{p_tenant_id:guard.scope.tenantId,p_client_id:guard.scope.clientId,p_actor_profile_id:guard.scope.actorId},'Grundpflegebezüge vollständig laden');await guard.check();
  if(response.error!==null||!object(response.data)||!exact(response.data,'plans,pressure,fall')||!Array.isArray(response.data.plans)||response.data.plans.length>500||!pressure(response.data.pressure)||!fall(response.data.fall))throw Error(unavailable);
  const seen=new Set<string>();for(const p of response.data.plans){if(!object(p)||!exact(p,'planVersionId,measureId,visitId,planSnapshotSha256,kind,title,plannedAt,secondPersonRequired,pressureOriginals,fallOriginals')||![p.planVersionId,p.measureId,p.visitId].every(uuid)||!sha(p.planSnapshotSha256)||!['body_care','oral_care','dressing','transfer_positioning','pressure_prevention','fall_prevention','contracture_prevention','individual_prevention'].includes(String(p.kind))||typeof p.title!=='string'||p.title.trim().length<3||p.title.length>300||basicCareInstantMicros(p.plannedAt)===null||typeof p.secondPersonRequired!=='boolean'||!pressure(p.pressureOriginals)||!fall(p.fallOriginals))throw Error(unavailable);if(p.kind==='pressure_prevention'?(p.pressureOriginals===null||p.fallOriginals!==null):p.kind==='fall_prevention'?(p.fallOriginals===null||p.pressureOriginals!==null):(p.pressureOriginals!==null||p.fallOriginals!==null))throw Error(unavailable);const key=[p.planVersionId,p.measureId,p.visitId].join(':').toLowerCase();if(seen.has(key))throw Error(unavailable);seen.add(key);}
  guard.current();return{ok:true,data:cloneClientNativeOriginal(response.data as unknown as BasicCarePrerequisites)};
 }catch(e){return{ok:false,error:e instanceof Error?e.message:unavailable};}
}
function pageEnvelope(value:unknown){if(!object(value)||!exact(value,'rows,stateFingerprint,nextCursorRecordedAt,nextCursorId')||!Array.isArray(value.rows)||value.rows.length>100||!sha(value.stateFingerprint))throw Error(unavailable);return value as Row&{rows:unknown[];stateFingerprint:string};}
async function readHistory(context:Context,review:boolean):Promise<Result<BasicCareOriginal[]|BasicCareReviewOriginal[]>>{
 try{const guard=await createBasicCareTransportGuard(context),all:(BasicCareOriginal|BasicCareReviewOriginal)[]=[],roots=new Set<string>(),events=new Set<string>(),requests=new Set<string>();let at:string|null=null,id:string|null=null,proof='',head:unknown=null;
 const read=async(time:string|null,key:string|null)=>{await guard.check();const response=await guard.read(review?'web_read_basic_care_review_page':'web_read_basic_care_page',{p_tenant_id:guard.scope.tenantId,p_client_id:guard.scope.clientId,p_actor_profile_id:guard.scope.actorId,p_cursor_recorded_at:time,p_cursor_id:key,p_page_size:100},'Grundpflegehistorie vollständig laden');await guard.check();if(response.error!==null)throw Error(unavailable);return pageEnvelope(response.data);};
 for(let page=0;page<100;page++){const data=await read(at,id);if(proof&&proof!==data.stateFingerprint)throw Error('Der vollständige Grundpflegebestand hat sich geändert. Neu laden.');proof=data.stateFingerprint;if(head===null)head=cloneClientNativeOriginal(data);
  if(data.rows.length===0){if(data.nextCursorRecordedAt!==null||data.nextCursorId!==null)throw Error(unavailable);const latest=await read(null,null);if(!sameClientNativeOriginal(latest,head))throw Error('Der Grundpflegebestand hat sich während des Ladens geändert.');guard.current();return{ok:true,data:all as BasicCareOriginal[]|BasicCareReviewOriginal[]};}
  let previous=at===null?null:{time:basicCareInstantMicros(at)!,id:id!.toLowerCase()};
  for(const raw of data.rows){const issue=review?basicCareReviewOriginalIssue(raw,guard.scope):basicCareOriginalIssue(raw,guard.scope);if(issue)throw Error(issue);const row=raw as BasicCareOriginal|BasicCareReviewOriginal;const key=(review?row.rootId:row.id).toLowerCase(),time=basicCareInstantMicros(review?row.history[0].recordedAt:(row as BasicCareOriginal).recordedAt);if(time===null||roots.has(row.rootId.toLowerCase())||previous&&(time>previous.time||time===previous.time&&key>=previous.id))throw Error(unavailable);roots.add(row.rootId.toLowerCase());for(const e of row.history){const event=e.id.toLowerCase();if(events.has(event))throw Error(unavailable);events.add(event);if(review){const request=(e as BasicCareReviewOriginal['history'][number]).requestId.toLowerCase();if(requests.has(request))throw Error(unavailable);requests.add(request);}}all.push(cloneClientNativeOriginal(row));previous={time,id:key};}
  if(!previous||!uuid(data.nextCursorId)||typeof data.nextCursorRecordedAt!=='string'||basicCareInstantMicros(data.nextCursorRecordedAt)!==previous.time||data.nextCursorId.toLowerCase()!==previous.id)throw Error(unavailable);at=data.nextCursorRecordedAt;id=data.nextCursorId;
 }
 throw Error('Der Grundpflegebestand überschreitet die sicher vollständig lesbare Grenze.');
 }catch(e){return{ok:false,error:e instanceof Error?e.message:unavailable};}
}
export const readBasicCarePage=(context:Context)=>readHistory(context,false) as Promise<Result<BasicCareOriginal[]>>;
export const readBasicCareReviewPage=(context:Context)=>readHistory(context,true) as Promise<Result<BasicCareReviewOriginal[]>>;
async function writePacket(input:BasicCarePacket|BasicCareReviewPacket,isCurrent:()=>boolean,review:boolean,confirm:boolean):Promise<Result<BasicCareOriginal|BasicCareReviewOriginal>>{
 let packet:BasicCarePacket|BasicCareReviewPacket;try{packet=cloneClientNativeOriginal(input);const issue=review?basicCareReviewPacketIssue(packet):basicCarePacketIssue(packet);if(issue)throw Error(issue);}catch(e){return{ok:false,error:e instanceof Error?e.message:unavailable,rejected:true};}let dispatched=false;
 try{const guard=await createBasicCareTransportGuard({tenantId:packet.tenantId,clientId:packet.clientId,actorId:packet.actorId,isCurrent});const name=review?(confirm?'web_confirm_basic_care_review':'web_commit_basic_care_review'):(confirm?'web_confirm_basic_care_packet':'web_commit_basic_care_packet');const args=confirm?{p_tenant_id:packet.tenantId,p_client_id:packet.clientId,p_actor_profile_id:packet.actorId,p_request_id:packet.requestId,p_packet:packet}:{p_packet:packet};guard.current();dispatched=true;const response=await guard.read(name,args,'Grundpflege anhand unveränderter Quittung bestätigen');await guard.check();if(response.error!==null){const code=object(response.error)?response.error.code:null;return{ok:false,error:toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]),...(!confirm&&response.data===null&&['22007','22008','22023','22P02','23514','40001','42501','P0F01','P0F02'].includes(String(code))?{rejected:true}:{uncertain:dispatched})};}const issue=review?basicCareReviewReceiptIssue(response.data,packet as BasicCareReviewPacket):basicCareReceiptIssue(response.data,packet as BasicCarePacket);if(issue)throw Error(issue);guard.current();return{ok:true,data:cloneClientNativeOriginal((response.data as Row).original as BasicCareOriginal|BasicCareReviewOriginal)};
 }catch(e){return{ok:false,error:e instanceof Error?e.message:unavailable,uncertain:dispatched};}
}
export const commitBasicCarePacket=(packet:BasicCarePacket,isCurrent:()=>boolean)=>writePacket(packet,isCurrent,false,false) as Promise<Result<BasicCareOriginal>>;
export const confirmBasicCarePacket=(packet:BasicCarePacket,isCurrent:()=>boolean)=>writePacket(packet,isCurrent,false,true) as Promise<Result<BasicCareOriginal>>;
export const commitBasicCareReview=(packet:BasicCareReviewPacket,isCurrent:()=>boolean)=>writePacket(packet,isCurrent,true,false) as Promise<Result<BasicCareReviewOriginal>>;
export const confirmBasicCareReview=(packet:BasicCareReviewPacket,isCurrent:()=>boolean)=>writePacket(packet,isCurrent,true,true) as Promise<Result<BasicCareReviewOriginal>>;
