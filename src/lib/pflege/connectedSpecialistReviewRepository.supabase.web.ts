import {getSupabaseClient} from '@/lib/supabase/client';
import {toGermanSupabaseError} from '@/lib/supabase/errors';
import {withServiceQueryTimeout} from '@/lib/services/queryTimeout';
import {connectedReviewOriginalIssue,connectedReviewPacketIssue,connectedReviewStable,instantMicros,type ConnectedReviewDomain,type ConnectedReviewOriginal,type ConnectedReviewPacket} from './connectedSpecialistReview.web';

type Row=Record<string,unknown>;
type Context={tenantId:string;clientId:string;actorId:string;domain?:ConnectedReviewDomain;isCurrent():boolean};
type Result<T>={ok:true;data:T}|{ok:false;error:string;uncertain?:boolean;rejected?:boolean};
const unavailable='Der vollständige Fachprüfbestand konnte nicht bestätigt werden.';
const object=(v:unknown):v is Row=>!!v&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const dbClient=()=>getSupabaseClient() as unknown as {auth:{getSession():Promise<{data:{session:null|{user:{id:string};access_token:string;expires_at?:number}};error:unknown}>;getUser(token?:string):Promise<{data:{user:null|{id:string}};error:unknown}>};rpc(name:string,args:Row):Promise<{data:unknown;error:unknown}>}|null;

function decode(v:unknown,c:Pick<Context,'tenantId'|'clientId'>):ConnectedReviewOriginal{const issue=connectedReviewOriginalIssue(v,c);if(issue)throw Error(issue);return structuredClone(v as ConnectedReviewOriginal);}
function receipt(v:unknown,p:ConnectedReviewPacket):ConnectedReviewOriginal|null{
 if(!object(v)||v.requestId!==p.requestId||connectedReviewStable(v.packet)!==connectedReviewStable(p))return null;
 try{
  const o=decode(v.original,p),last=o.history.at(-1)!;
  return o.revision===p.expectedRevision+1&&o.domain===p.subject.domain&&o.subjectRootId===p.subject.rootId&&o.subjectHeadId===p.subject.headId&&o.subjectKind===p.subject.kind&&o.subjectFingerprint===p.subject.contentFingerprint&&last.requestId===p.requestId&&last.actorId===p.actorId&&last.action===p.action&&last.reason===p.reason&&last.requiredChange===p.requiredChange&&last.rationale===p.rationale&&(p.reviewOriginal===null||o.rootId===p.reviewOriginal.rootId&&connectedReviewStable(o.history.slice(0,-1))===connectedReviewStable(p.reviewOriginal.history))?o:null;
 }catch{return null;}
}

export async function readConnectedReviewPage(c:Context):Promise<Result<ConnectedReviewOriginal[]>>{
 try{
  const guard=await authority(c),rows:ConnectedReviewOriginal[]=[],cursors=new Set<string>();let at:string|null=null,id:string|null=null;
  for(let page=0;page<100;page++){
   await guard.check();
   const response: { data: unknown; error: unknown; status?: number } = await withServiceQueryTimeout(guard.db.rpc('web_read_connected_specialist_review_page',{p_tenant_id:c.tenantId,p_client_id:c.clientId,p_actor_profile_id:c.actorId,p_domain:c.domain??null,p_cursor_recorded_at:at,p_cursor_id:id,p_page_size:100}),'Fachprüfungen vollständig laden',20_000);await guard.check();
   if(response.error||!object(response.data)||!Array.isArray(response.data.rows)||response.data.rows.length>100)throw Error(unavailable);
   if(response.data.rows.length===0)return {ok:true,data:rows};
   const nextAt=response.data.nextCursorRecordedAt,nextId=response.data.nextCursorId;
   if(typeof nextAt!=='string'||instantMicros(nextAt)===null||!uuid(nextId)||cursors.has(`${nextAt}:${nextId}`)||at!==null&&(instantMicros(nextAt)!>instantMicros(at)!||instantMicros(nextAt)===instantMicros(at)&&nextId>=id!))throw Error(unavailable);
   for(const raw of response.data.rows){const row=decode(raw,c);if(c.domain&&row.domain!==c.domain||rows.some(existing=>existing.rootId===row.rootId))throw Error(unavailable);rows.push(row);}
   cursors.add(`${nextAt}:${nextId}`);at=nextAt;id=nextId;
  }
  throw Error('Der Fachprüfbestand überschreitet die sicher vollständig lesbare Grenze.');
 }catch(cause){return {ok:false,error:cause instanceof Error?cause.message:unavailable};}
}

async function operation(input:ConnectedReviewPacket,isCurrent:()=>boolean,confirm:boolean):Promise<Result<ConnectedReviewOriginal>>{
 const packet=structuredClone(input);if(!confirm){const issue=connectedReviewPacketIssue(packet);if(issue)return {ok:false,error:issue,rejected:true};}
 let dispatched=false;
 try{
  const guard=await authority({...packet,isCurrent});await guard.check();dispatched=!confirm;
  const response: { data: unknown; error: unknown; status?: number } = await withServiceQueryTimeout(guard.db.rpc(confirm?'web_confirm_connected_specialist_review':'web_commit_connected_specialist_review',confirm?{p_tenant_id:packet.tenantId,p_client_id:packet.clientId,p_actor_profile_id:packet.actorId,p_request_id:packet.requestId,p_packet:packet}:{p_packet:packet}),'Fachprüfung transaktional sichern oder Quittung lesen',20_000);await guard.check();
  if(response.error){const code=object(response.error)?String(response.error.code??''):'';return {ok:false,error:toGermanSupabaseError(response.error as Parameters<typeof toGermanSupabaseError>[0]),...(!confirm&&response.data===null&&['22007','22008','22023','22P02','23514','40001','42501'].includes(code)?{rejected:true}:{uncertain:true})};}
  const saved=receipt(response.data,packet);return saved?{ok:true,data:saved}:{ok:false,error:unavailable,uncertain:true};
 }catch(cause){return {ok:false,error:cause instanceof Error?cause.message:unavailable,...(dispatched||confirm?{uncertain:true}:{rejected:true})};}
}
export const commitConnectedReview=(p:ConnectedReviewPacket,current:()=>boolean)=>operation(p,current,false);
export const confirmConnectedReview=(p:ConnectedReviewPacket,current:()=>boolean)=>operation(p,current,true);

async function authority(c:Context){
 const db=dbClient();if(!db||!c.isCurrent())throw Error(unavailable);let token:string|null=null,userId:string|null=null;
 const check=async()=>{
  if(!c.isCurrent()||dbClient()!==db)throw Error(unavailable);
  const before=await db.auth.getSession(),session=before.data.session;
  if(before.error||!session||!uuid(session.user.id)||userId!==null&&session.user.id!==userId||!session.access_token||session.expires_at!==undefined&&session.expires_at*1000<=Date.now()||token!==null&&session.access_token!==token)throw Error(unavailable);
  token=session.access_token;userId=session.user.id;
  const user=await db.auth.getUser(token);if(user.error||user.data.user?.id!==userId||!c.isCurrent()||dbClient()!==db)throw Error(unavailable);
  const profile=await withServiceQueryTimeout(db.rpc('resolve_current_profile_id',{}),'Aktuelles internes Profil bestätigen',20_000);
  if(profile.error||profile.data!==c.actorId||!c.isCurrent()||dbClient()!==db)throw Error(unavailable);
  const after=await db.auth.getSession();if(after.error||after.data.session?.access_token!==token||after.data.session?.user.id!==userId||after.data.session.expires_at!==undefined&&after.data.session.expires_at*1000<=Date.now())throw Error(unavailable);
 };
 await check();return {db,check};
}
