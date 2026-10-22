import {cloneClientNativeOriginal} from '../clients/clientRecordNativeOriginal.web.ts';
import {requireCareWorkspaceAuthorityWeb} from './careWorkspaceAuthority.web';
import {getSupabaseClient} from '@/lib/supabase/client';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {woundPathOriginalIssue,woundPathPacketIssue,woundPathSourcesIssue,type WoundPathOriginal,type WoundPathPacket,type WoundPathSources} from './woundPathPacket.web';
type Row=Record<string,unknown>;type Context={tenantId:string;clientId:string;woundId:string;actorId:string;isCurrent():boolean};type Result<T>={ok:true;data:T}|{ok:false;error:string;uncertain?:boolean;rejected?:boolean};
const unavailable='Der vollständige Wund-, Befund-, Bild-, Plan-, Versorgungs-, Kontakt-, Personen- und Statusbezug konnte nicht bestätigt werden.';
const object=(v:unknown):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v);const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);const stable=(v:unknown)=>JSON.stringify(v,(_key,item:unknown)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item);
const dbClient=()=>getSupabaseClient() as unknown as {auth:{getSession():Promise<{data:{session:null|{user:{id:string};access_token:string;expires_at?:number}};error:unknown}>;getUser(token?:string):Promise<{data:{user:null|{id:string}};error:unknown}>};rpc(name:string,args:Row):Promise<{data:unknown;error:unknown;status?:number}>}|null;
async function authority(context:Context){return requireCareWorkspaceAuthorityWeb(context,dbClient,(request,operation)=>withServiceQueryTimeout(Promise.resolve(request),operation,20_000),unavailable);}
function decode(v:unknown,c:Pick<Context,'tenantId'|'clientId'|'woundId'>){const issue=woundPathOriginalIssue(v,c);if(issue)throw Error(issue);return structuredClone(v as WoundPathOriginal);}
export async function readWoundPathSources(c:Context):Promise<Result<WoundPathSources>>{try{const db=await authority(c),response: { data: unknown; error: unknown; status?: number } = await withServiceQueryTimeout(db.rpc('web_read_wound_path_context',{p_tenant_id:c.tenantId,p_client_id:c.clientId,p_wound_id:c.woundId,p_actor_profile_id:c.actorId}),'Wundpfadquellen vollständig laden',20_000);if(!c.isCurrent()||dbClient()!==db||response.error||woundPathSourcesIssue(response.data))return {ok:false,error:unavailable};return {ok:true,data:structuredClone(response.data as WoundPathSources)};}catch(cause){return {ok:false,error:cause instanceof Error?cause.message:unavailable};}}
/** Every page, including the empty terminator, belongs to one complete server ledger. */
export async function readWoundPathPage(c:Context):Promise<Result<WoundPathOriginal[]>>{
 try{
  const db=await authority(c),rows:WoundPathOriginal[]=[],cursors=new Set<string>();
  let recorded:string|null=null,id:string|null=null,stateFingerprint:string|null=null,firstPage:string|null=null;
  const read=async(at:string|null,cursor:string|null)=>{
   const response:{data:unknown;error:unknown;status?:number}=await withServiceQueryTimeout(db.rpc('web_read_wound_path_page',{p_tenant_id:c.tenantId,p_client_id:c.clientId,p_wound_id:c.woundId,p_actor_profile_id:c.actorId,p_cursor_recorded_at:at,p_cursor_id:cursor,p_page_size:100}),'Wundpfadverlauf vollständig laden',20_000);
   const data=response.data;
   if(!c.isCurrent()||dbClient()!==db||response.error||!object(data)||!Array.isArray(data.rows)||data.rows.length>100||typeof data.stateFingerprint!=='string'||!/^sha256:[0-9a-f]{64}$/.test(data.stateFingerprint)||stateFingerprint!==null&&data.stateFingerprint!==stateFingerprint)throw Error(unavailable);
   stateFingerprint=data.stateFingerprint;
   if(data.rows.length===0){if(data.nextCursorRecordedAt!==null||data.nextCursorId!==null)throw Error(unavailable);}
   else if(typeof data.nextCursorRecordedAt!=='string'||!uuid(data.nextCursorId))throw Error(unavailable);
   return data;
  };
  for(let page=0;page<100;page++){
   const data=await read(recorded,id);
   if(firstPage===null)firstPage=stable(data);
   if((data.rows as unknown[]).length===0){
    // A later decision can change an older page without changing the first head IDs.
    if(await authority(c)!==db||stable(await read(null,null))!==firstPage)throw Error(unavailable);
    return {ok:true,data:rows};
   }
   const nextRecorded=data.nextCursorRecordedAt as string,nextId=data.nextCursorId as string,key=`${nextRecorded}:${nextId}`;
   if(cursors.has(key))throw Error(unavailable);
   for(const raw of data.rows as unknown[]){const row=decode(raw,c);if(rows.some(x=>x.rootId===row.rootId))throw Error(unavailable);rows.push(row);}
   cursors.add(key);recorded=nextRecorded;id=nextId;
  }
  return {ok:false,error:'Der Wundpfadverlauf überschreitet die sicher vollständig lesbare Grenze.'};
 }catch(cause){return {ok:false,error:cause instanceof Error?cause.message:unavailable};}
}

function receipt(v:unknown,p:WoundPathPacket):WoundPathOriginal|null{
 if(!object(v)||v.requestId!==p.requestId||stable(v.packet)!==stable(p))return null;
 try{
  const saved=decode(v.original,p),last=saved.history.at(-1)!;
  if(saved.revision!==p.expectedRevision+1||last.id!==p.requestId||last.previousId!==p.expectedHeadId||last.recordedBy!==p.actorId||last.reason!==p.reason||stable(last.payload)!==stable(p.entry))return null;
  if(p.original){if(saved.rootId!==p.original.rootId||stable(saved.history.slice(0,-1))!==stable(p.original.history))return null;}
  else if(saved.rootId!==p.requestId||saved.history.length!==1)return null;
  return saved;
 }catch{return null;}
}
export async function commitWoundPathPacket(p:WoundPathPacket,isCurrent:()=>boolean):Promise<Result<WoundPathOriginal>>{const captured=structuredClone(p),issue=woundPathPacketIssue(captured);if(issue)return {ok:false,error:issue,rejected:true};let dispatched=false;try{const c={tenantId:captured.tenantId,clientId:captured.clientId,woundId:captured.woundId,actorId:captured.actorId,isCurrent};const db=await authority(c);dispatched=true;const response: { data: unknown; error: unknown; status?: number } = cloneClientNativeOriginal(await withServiceQueryTimeout(db.rpc('web_commit_wound_path_packet',{p_packet:captured}),'Wundpfadpaket transaktional speichern',20_000));if(!isCurrent()||dbClient()!==db)return {ok:false,error:unavailable,uncertain:true};if(response.error){const code=object(response.error)?String(response.error.code??''):'';return {ok:false,error:toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]),...(response.data===null&&['22007','22008','22023','22P02','23514','40001','42501','P0H01','P0H02'].includes(code)?{rejected:true}:{uncertain:true})};}const saved=receipt(response.data,captured);return saved?{ok:true,data:saved}:{ok:false,error:unavailable,uncertain:true};}catch(cause){return {ok:false,error:cause instanceof Error?cause.message:unavailable,uncertain:dispatched};}}
export async function confirmWoundPathPacket(p:WoundPathPacket,isCurrent:()=>boolean):Promise<Result<WoundPathOriginal>>{const captured=structuredClone(p),issue=woundPathPacketIssue(captured);if(issue)return {ok:false,error:issue,rejected:true};try{const c={tenantId:captured.tenantId,clientId:captured.clientId,woundId:captured.woundId,actorId:captured.actorId,isCurrent};const db=await authority(c),response: { data: unknown; error: unknown; status?: number } = cloneClientNativeOriginal(await withServiceQueryTimeout(db.rpc('web_confirm_wound_path_packet',{p_tenant_id:captured.tenantId,p_client_id:captured.clientId,p_wound_id:captured.woundId,p_actor_profile_id:captured.actorId,p_request_id:captured.requestId,p_packet:captured}),'Unklaren Wundpfadausgang anhand nativer Quittung prüfen',20_000));if(!c.isCurrent()||dbClient()!==db||response.error)return {ok:false,error:unavailable};const saved=receipt(response.data,captured);return saved?{ok:true,data:saved}:{ok:false,error:unavailable};}catch(cause){return {ok:false,error:cause instanceof Error?cause.message:unavailable};}}
