import {requireCareWorkspaceAuthorityWeb} from './careWorkspaceAuthority.web';
import {getSupabaseClient} from '@/lib/supabase/client';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {basicCareOriginalIssue,basicCarePacketIssue,basicCareReviewOriginalIssue,basicCareReviewPacketIssue,type BasicCareOriginal,type BasicCarePacket,type BasicCareReviewOriginal,type BasicCareReviewPacket} from './basicCarePacket.web';

type Row=Record<string,unknown>;
type Context={tenantId:string;clientId:string;actorId:string;isCurrent():boolean};
type Result<T>={ok:true;data:T}|{ok:false;error:string;uncertain?:boolean;rejected?:boolean};
export type BasicCarePrerequisites=Readonly<{
 plans:readonly Readonly<{planVersionId:string;measureId:string;visitId:string;planSnapshotSha256:string;kind:BasicCarePacket['entry']['kind'];title:string;plannedAt:string;secondPersonRequired:boolean;pressureOriginals:BasicCarePacket['pressureOriginals'];fallOriginals:BasicCarePacket['fallOriginals']}>[];
 pressure:Readonly<{markerId:string;assessmentIds:readonly string[];historyIds:readonly string[]}>|null;
 fall:Readonly<{reviewIds:readonly string[];eventIds:readonly string[];measureIds:readonly string[]}>|null;
}>;
const unavailable='Der vollständige Grundpflegebestand konnte nicht bestätigt werden.';
const object=(value:unknown):value is Row=>!!value&&typeof value==='object'&&!Array.isArray(value);
const client=()=>getSupabaseClient() as unknown as {auth:{getSession():Promise<{data:{session:null|{user:{id:string};access_token:string;expires_at?:number}};error:unknown}>;getUser(token?:string):Promise<{data:{user:null|{id:string}};error:unknown}>};rpc(name:string,args:Row):Promise<{data:unknown;error:unknown;status?:number}>}|null;
const stable=(value:unknown):string=>JSON.stringify(value,(_key,item:unknown)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);

async function authority(context:Context){return requireCareWorkspaceAuthorityWeb(context,client,(request,operation)=>withServiceQueryTimeout(Promise.resolve(request),operation,20_000),unavailable);}
function decode(value:unknown,context:Pick<Context,'tenantId'|'clientId'>):BasicCareOriginal{const issue=basicCareOriginalIssue(value,context);if(issue)throw Error(issue);return structuredClone(value as BasicCareOriginal);}
function decodeReview(value:unknown,context:Pick<Context,'tenantId'|'clientId'>):BasicCareReviewOriginal{const issue=basicCareReviewOriginalIssue(value,context);if(issue)throw Error(issue);return structuredClone(value as BasicCareReviewOriginal);}
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const ids=(value:unknown):value is readonly string[]=>Array.isArray(value)&&value.every(uuid)&&new Set(value).size===value.length;
const instant=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
const planKinds=new Set(['body_care','oral_care','dressing','transfer_positioning','pressure_prevention','fall_prevention','contracture_prevention','individual_prevention']);

export async function readBasicCarePrerequisites(context:Context):Promise<Result<BasicCarePrerequisites>>{
 try{
  const db=await authority(context);const response=await withServiceQueryTimeout(db.rpc('web_read_basic_care_prerequisites',{p_tenant_id:context.tenantId,p_client_id:context.clientId,p_actor_profile_id:context.actorId}),'Grundpflegebezüge vollständig laden',20_000);
  if(!context.isCurrent()||client()!==db||response.error||!object(response.data)||!Array.isArray(response.data.plans)||response.data.plans.length>500)return {ok:false,error:unavailable};const plans=response.data.plans,pressure=response.data.pressure,fall=response.data.fall;
  if(plans.some(value=>{if(!object(value)||!uuid(value.planVersionId)||!uuid(value.measureId)||!uuid(value.visitId)||typeof value.planSnapshotSha256!=='string'||!/^sha256:[0-9a-f]{64}$/.test(value.planSnapshotSha256)||!planKinds.has(String(value.kind))||typeof value.title!=='string'||value.title.trim().length<3||!instant(value.plannedAt)||typeof value.secondPersonRequired!=='boolean')return true;const pressureRefs=value.pressureOriginals,fallRefs=value.fallOriginals;if(value.kind==='pressure_prevention')return !object(pressureRefs)||!uuid(pressureRefs.markerId)||!ids(pressureRefs.assessmentIds)||!ids(pressureRefs.historyIds)||fallRefs!==null;if(value.kind==='fall_prevention')return !object(fallRefs)||!ids(fallRefs.reviewIds)||!ids(fallRefs.eventIds)||!ids(fallRefs.measureIds)||pressureRefs!==null;return pressureRefs!==null||fallRefs!==null;})||new Set(plans.map(value=>`${value.planVersionId}:${value.measureId}:${value.visitId}`)).size!==plans.length)return {ok:false,error:unavailable};
  if(pressure!==null&&(!object(pressure)||!uuid(pressure.markerId)||!ids(pressure.assessmentIds)||!ids(pressure.historyIds)))return {ok:false,error:unavailable};
  if(fall!==null&&(!object(fall)||!ids(fall.reviewIds)||!ids(fall.eventIds)||!ids(fall.measureIds)))return {ok:false,error:unavailable};
  return {ok:true,data:structuredClone({plans,pressure,fall} as BasicCarePrerequisites)};
 }catch(cause){return {ok:false,error:cause instanceof Error?cause.message:unavailable};}
}

export async function readBasicCarePage(context:Context):Promise<Result<BasicCareOriginal[]>>{
 try{
  const db=await authority(context),rows:BasicCareOriginal[]=[];let cursorRecorded:string|null=null,cursorId:string|null=null;
  for(let page=0;page<100;page++){
   const response=await withServiceQueryTimeout(db.rpc('web_read_basic_care_page',{p_tenant_id:context.tenantId,p_client_id:context.clientId,p_actor_profile_id:context.actorId,p_cursor_recorded_at:cursorRecorded,p_cursor_id:cursorId,p_page_size:100}),'Grundpflege vollständig laden',20_000);
   if(!context.isCurrent()||client()!==db||response.error||!object(response.data)||!Array.isArray(response.data.rows)||response.data.rows.length>100)return {ok:false,error:unavailable};
   if(response.data.rows.length===0)return {ok:true,data:rows};
   for(const raw of response.data.rows){const row=decode(raw,context);if(rows.some(existing=>existing.id===row.id))throw Error(unavailable);rows.push(row);cursorRecorded=row.recordedAt;cursorId=row.id;}
  }
  return {ok:false,error:'Der Grundpflegebestand überschreitet die sicher vollständig lesbare Grenze.'};
 }catch(cause){return {ok:false,error:cause instanceof Error?cause.message:unavailable};}
}

export async function readBasicCareReviewPage(context:Context):Promise<Result<BasicCareReviewOriginal[]>>{
 try{
  const db=await authority(context),rows:BasicCareReviewOriginal[]=[];let cursorRecorded:string|null=null,cursorId:string|null=null;
  for(let page=0;page<100;page++){
   const response=await withServiceQueryTimeout(db.rpc('web_read_basic_care_review_page',{p_tenant_id:context.tenantId,p_client_id:context.clientId,p_actor_profile_id:context.actorId,p_cursor_recorded_at:cursorRecorded,p_cursor_id:cursorId,p_page_size:100}),'Grundpflegeprüfungen vollständig laden',20_000);
   if(!context.isCurrent()||client()!==db||response.error||!object(response.data)||!Array.isArray(response.data.rows)||response.data.rows.length>100)return {ok:false,error:unavailable};
   if(response.data.rows.length===0)return {ok:true,data:rows};
   for(const raw of response.data.rows){const row=decodeReview(raw,context);if(rows.some(existing=>existing.rootId===row.rootId))throw Error(unavailable);rows.push(row);cursorRecorded=row.history[0].recordedAt;cursorId=row.rootId;}
  }
  return {ok:false,error:'Der Prüfbestand überschreitet die sicher vollständig lesbare Grenze.'};
 }catch(cause){return {ok:false,error:cause instanceof Error?cause.message:unavailable};}
}

function receipt(value:unknown,packet:BasicCarePacket):BasicCareOriginal|null{
 if(!object(value)||value.requestId!==packet.requestId||stable(value.packet)!==stable(packet))return null;
 try{return decode(value.original,{tenantId:packet.tenantId,clientId:packet.clientId});}catch{return null;}
}

export async function commitBasicCarePacket(packet:BasicCarePacket,isCurrent:()=>boolean):Promise<Result<BasicCareOriginal>>{
 const issue=basicCarePacketIssue(packet);if(issue)return {ok:false,error:issue,rejected:true};let dispatched=false;
 try{
  const context={tenantId:packet.tenantId,clientId:packet.clientId,actorId:packet.actorId,isCurrent};const db=await authority(context);dispatched=true;
  const response=await withServiceQueryTimeout(db.rpc('web_commit_basic_care_packet',{p_packet:structuredClone(packet)}),'Grundpflege transaktional speichern',20_000);
  if(!isCurrent()||client()!==db)return {ok:false,error:unavailable,uncertain:true};
  if(response.error){const code=object(response.error)?String(response.error.code??''):'';return {ok:false,error:toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]),...(response.data===null&&['22023','23514','40001','42501','P0F01','P0F02'].includes(code)?{rejected:true}:{uncertain:true})};}
  const saved=receipt(response.data,packet);return saved?{ok:true,data:saved}:{ok:false,error:unavailable,uncertain:true};
 }catch(cause){return {ok:false,error:cause instanceof Error?cause.message:unavailable,uncertain:dispatched};}
}

export async function confirmBasicCarePacket(packet:BasicCarePacket,isCurrent:()=>boolean):Promise<Result<BasicCareOriginal>>{
 const issue=basicCarePacketIssue(packet);if(issue)return {ok:false,error:issue,rejected:true};
 try{
  const context={tenantId:packet.tenantId,clientId:packet.clientId,actorId:packet.actorId,isCurrent};const db=await authority(context);
  const response=await withServiceQueryTimeout(db.rpc('web_confirm_basic_care_packet',{p_tenant_id:packet.tenantId,p_client_id:packet.clientId,p_actor_profile_id:packet.actorId,p_request_id:packet.requestId,p_packet:structuredClone(packet)}),'Unklare Grundpflege anhand nativer Quittung prüfen',20_000);
  if(!isCurrent()||client()!==db||response.error)return {ok:false,error:unavailable};const saved=receipt(response.data,packet);return saved?{ok:true,data:saved}:{ok:false,error:unavailable};
 }catch(cause){return {ok:false,error:cause instanceof Error?cause.message:unavailable};}
}

function reviewReceipt(value:unknown,packet:BasicCareReviewPacket):BasicCareReviewOriginal|null{
 if(!object(value)||value.requestId!==packet.requestId||stable(value.packet)!==stable(packet))return null;
 try{return decodeReview(value.original,{tenantId:packet.tenantId,clientId:packet.clientId});}catch{return null;}
}
export async function commitBasicCareReview(packet:BasicCareReviewPacket,isCurrent:()=>boolean):Promise<Result<BasicCareReviewOriginal>>{
 const issue=basicCareReviewPacketIssue(packet);if(issue)return {ok:false,error:issue,rejected:true};let dispatched=false;
 try{
  const context={tenantId:packet.tenantId,clientId:packet.clientId,actorId:packet.actorId,isCurrent};const db=await authority(context);dispatched=true;
  const response=await withServiceQueryTimeout(db.rpc('web_commit_basic_care_review',{p_packet:structuredClone(packet)}),'Grundpflegeprüfung transaktional speichern',20_000);
  if(!isCurrent()||client()!==db)return {ok:false,error:unavailable,uncertain:true};
  if(response.error){const code=object(response.error)?String(response.error.code??''):'';return {ok:false,error:toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]),...(response.data===null&&['22023','23514','40001','42501','P0F02'].includes(code)?{rejected:true}:{uncertain:true})};}
  const saved=reviewReceipt(response.data,packet);return saved?{ok:true,data:saved}:{ok:false,error:unavailable,uncertain:true};
 }catch(cause){return {ok:false,error:cause instanceof Error?cause.message:unavailable,uncertain:dispatched};}
}
export async function confirmBasicCareReview(packet:BasicCareReviewPacket,isCurrent:()=>boolean):Promise<Result<BasicCareReviewOriginal>>{
 const issue=basicCareReviewPacketIssue(packet);if(issue)return {ok:false,error:issue,rejected:true};
 try{
  const context={tenantId:packet.tenantId,clientId:packet.clientId,actorId:packet.actorId,isCurrent};const db=await authority(context);
  const response=await withServiceQueryTimeout(db.rpc('web_confirm_basic_care_review',{p_tenant_id:packet.tenantId,p_client_id:packet.clientId,p_actor_profile_id:packet.actorId,p_request_id:packet.requestId,p_packet:structuredClone(packet)}),'Unklare Grundpflegeprüfung anhand nativer Quittung prüfen',20_000);
  if(!isCurrent()||client()!==db||response.error)return {ok:false,error:unavailable};const saved=reviewReceipt(response.data,packet);return saved?{ok:true,data:saved}:{ok:false,error:unavailable};
 }catch(cause){return {ok:false,error:cause instanceof Error?cause.message:unavailable};}
}
