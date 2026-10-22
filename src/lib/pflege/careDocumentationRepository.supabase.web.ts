import {requireCareWorkspaceAuthorityWeb} from './careWorkspaceAuthority.web';
import {getSupabaseClient} from '@/lib/supabase/client';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {careDocumentationOriginalIssue,careDocumentationPacketIssue,type CareDocumentationOriginal,type CareDocumentationPacket} from './careDocumentationPacket.web';

type Row=Record<string,unknown>;
type Context={tenantId:string;clientId:string|null;actorId:string;isCurrent():boolean};
type Result<T>={ok:true;data:T}|{ok:false;error:string;uncertain?:boolean;rejected?:boolean};
const unavailable='Die vollständige Pflegedokumentation konnte nicht bestätigt werden.';
const object=(value:unknown):value is Row=>!!value&&typeof value==='object'&&!Array.isArray(value);
const rpcClient=()=>getSupabaseClient() as unknown as {auth:{getSession():Promise<{data:{session:null|{user:{id:string};access_token:string;expires_at?:number}};error:unknown}>;getUser(token?:string):Promise<{data:{user:null|{id:string}};error:unknown}>};rpc(name:string,args:Row):Promise<{data:unknown;error:unknown;status?:number}>}|null;
const stable=(value:unknown):string=>JSON.stringify(value,(_key,entry:unknown)=>object(entry)?Object.fromEntries(Object.keys(entry).sort().map(key=>[key,entry[key]])):entry);

async function authority(context:Context){return requireCareWorkspaceAuthorityWeb(context,rpcClient,(request,operation)=>withServiceQueryTimeout(Promise.resolve(request),operation,20_000),unavailable);}
function decodeOriginal(value:unknown,context:{tenantId:string;clientId:string}):CareDocumentationOriginal{
 const issue=careDocumentationOriginalIssue(value,context);if(issue)throw Error(issue);return structuredClone(value as CareDocumentationOriginal);
}

export async function readCareDocumentation(context:Context):Promise<Result<CareDocumentationOriginal[]>>{
 if(!context.clientId)return {ok:false,error:'Aktiven Pflegefall wählen.'};
 try{
  const client=await authority(context),all:CareDocumentationOriginal[]=[];let cursorOccurred:string|null=null,cursorId:string|null=null;
  for(let page=0;page<100;page++){
   const response=await withServiceQueryTimeout(client.rpc('web_read_care_documentation_page',{p_tenant_id:context.tenantId,p_client_id:context.clientId,p_actor_profile_id:context.actorId,p_cursor_occurred_at:cursorOccurred,p_cursor_id:cursorId,p_page_size:100}),'Pflegedokumentation vollständig laden',20_000);
   if(!context.isCurrent()||rpcClient()!==client||response.error||!object(response.data)||!Array.isArray(response.data.rows)||response.data.rows.length>100)return {ok:false,error:unavailable};
   if(response.data.rows.length===0)return {ok:true,data:all}; // A short page is not proof of exhaustion.
   for(const value of response.data.rows){const row=decodeOriginal(value,{tenantId:context.tenantId,clientId:context.clientId});if(all.some(existing=>existing.id===row.id))throw Error(unavailable);all.push(row);cursorOccurred=row.occurredAt;cursorId=row.id;}
  }
  return {ok:false,error:'Der Dokumentationsbestand überschreitet die sicher vollständig lesbare Grenze.'};
 }catch(error){return {ok:false,error:error instanceof Error?error.message:unavailable};
 }
}

export async function readCareDocumentationRecord(context:Context,id:string):Promise<Result<CareDocumentationOriginal>>{
 if(!context.clientId)return {ok:false,error:'Aktiven Pflegefall wählen.'};
 try{
  const client=await authority(context);const response=await withServiceQueryTimeout(client.rpc('web_read_care_documentation_record',{p_tenant_id:context.tenantId,p_client_id:context.clientId,p_actor_profile_id:context.actorId,p_entry_id:id}),'Dokumentationsoriginal laden',20_000);
  if(!context.isCurrent()||rpcClient()!==client||response.error)return {ok:false,error:unavailable};
  return {ok:true,data:decodeOriginal(response.data,{tenantId:context.tenantId,clientId:context.clientId})};
 }catch(error){return {ok:false,error:error instanceof Error?error.message:unavailable};}
}

function receipt(value:unknown,packet:CareDocumentationPacket):CareDocumentationOriginal|null{
 if(!object(value)||value.requestId!==packet.requestId||stable(value.packet)!==stable(packet))return null;
 try{return decodeOriginal(value.original,{tenantId:packet.tenantId,clientId:packet.clientId});}catch{return null;}
}

export async function commitCareDocumentationPacket(packet:CareDocumentationPacket,isCurrent:()=>boolean,replay=false):Promise<Result<CareDocumentationOriginal>>{
 const issue=careDocumentationPacketIssue(packet);if(issue)return {ok:false,error:issue,rejected:true};
 let dispatched=false;
 try{
  const context={tenantId:packet.tenantId,clientId:packet.clientId,actorId:packet.actorId,isCurrent};const client=await authority(context);dispatched=true;
  const response=await withServiceQueryTimeout(client.rpc('web_commit_care_documentation_packet',{p_packet:structuredClone(packet)}),'Pflegedokumentation transaktional speichern',20_000);
  if(!isCurrent()||rpcClient()!==client)return {ok:false,error:unavailable,uncertain:true};
  if(response.error){const code=object(response.error)?String(response.error.code??''):'';return {ok:false,error:toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]),...(response.data===null&&['22023','23514','40001','42501','P0E01','P0E02'].includes(code)?{rejected:true}:{uncertain:true})};}
  const confirmed=receipt(response.data,packet);return confirmed?{ok:true,data:confirmed}:{ok:false,error:unavailable,uncertain:true};
 }catch(error){return {ok:false,error:error instanceof Error?error.message:unavailable,uncertain:dispatched||replay};}
}

export async function confirmCareDocumentationPacket(packet:CareDocumentationPacket,isCurrent:()=>boolean):Promise<Result<CareDocumentationOriginal>>{
 const issue=careDocumentationPacketIssue(packet);if(issue)return {ok:false,error:issue,rejected:true};
 try{
  const context={tenantId:packet.tenantId,clientId:packet.clientId,actorId:packet.actorId,isCurrent};const client=await authority(context);
  const response=await withServiceQueryTimeout(client.rpc('web_confirm_care_documentation_packet',{p_tenant_id:packet.tenantId,p_client_id:packet.clientId,p_actor_profile_id:packet.actorId,p_request_id:packet.requestId,p_packet:structuredClone(packet)}),'Unklare Dokumentation anhand nativer Quittung prüfen',20_000);
  if(!isCurrent()||rpcClient()!==client||response.error)return {ok:false,error:unavailable};const confirmed=receipt(response.data,packet);return confirmed?{ok:true,data:confirmed}:{ok:false,error:unavailable};
 }catch(error){return {ok:false,error:error instanceof Error?error.message:unavailable};}
}
