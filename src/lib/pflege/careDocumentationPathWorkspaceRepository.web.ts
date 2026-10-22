import type{HandoverSdk}from'@/lib/pflege/caseHandoverRepository.web';
import{cloneClientNativeOriginal}from'../clients/clientRecordNativeOriginal.web.ts';
import{requireCareWorkspaceAuthorityWeb,type CareWorkspaceAuthoritySdkWeb}from'./careWorkspaceAuthority.web.ts';
import{decodeCareDocumentationPathContext,validateCareDocumentationPathCommand,type CareDocumentationPathCommand,type CareDocumentationPathContext,type CareDocumentationPathReceipt}from'./careDocumentationPathWorkspaceDomain.web.ts';

export type CareDocumentationPathAuthority={tenantId:string;clientId:string;actorId:string;accessToken:string;expiresAt:number|null;isCurrent():boolean};
export type CareDocumentationPathResult<T>={ok:true;data:T}|{ok:false;error:string;rejected?:boolean;uncertain?:boolean};
type Options={getSdk():HandoverSdk|null;query<T>(request:PromiseLike<T>,operation:string):Promise<T>};
const unavailable='Sitzung, aktuelle Dokumentationspfadrechte oder vollständige Dokumentationspfadoriginale sind nicht bestätigt.';
const row=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function createCareDocumentationPathRepository(options:Options){
 async function operation(a:CareDocumentationPathAuthority){
  const owner={tenantId:a.tenantId,clientId:a.clientId,actorId:a.actorId,accessToken:a.accessToken,expiresAt:a.expiresAt,callback:a.isCurrent},sdk=options.getSdk();
  if(!sdk||!owner.accessToken||!Number.isSafeInteger(owner.expiresAt)||Number(owner.expiresAt)<=Date.now())throw Error(unavailable);
  const auth=sdk.auth,getSession=auth.getSession,getUser=auth.getUser,rpc=sdk.rpc;let authId:string|null=null;
  const current=()=>{if(a.tenantId!==owner.tenantId||a.clientId!==owner.clientId||a.actorId!==owner.actorId||a.accessToken!==owner.accessToken||a.expiresAt!==owner.expiresAt||a.isCurrent!==owner.callback||owner.callback()!==true||Number(owner.expiresAt)<=Date.now()||options.getSdk()!==sdk||sdk.auth!==auth||auth.getSession!==getSession||auth.getUser!==getUser||sdk.rpc!==rpc)throw Error(unavailable);};
  const call=async(method:Function,receiver:unknown,args:unknown[],label:string)=>{current();const pending=Reflect.apply(method,receiver,args);current();const raw=await options.query(Promise.resolve(pending),label);current();const response=cloneClientNativeOriginal(raw);current();if(!row(response)||!Object.hasOwn(response,'data')||!Object.hasOwn(response,'error')||response.error!==null)throw Error(unavailable);return response;};
  const facade:CareWorkspaceAuthoritySdkWeb={auth:{
   getSession:async()=>{const result=await call(getSession,auth,[],'Eigene Dokumentationspfadsitzung bestätigen');if(!row(result.data)||!row(result.data.session)||!row(result.data.session.user))throw Error(unavailable);const session=result.data.session,user=session.user as Record<string,unknown>;if(typeof user.id!=='string'||authId!==null&&user.id!==authId||session.access_token!==owner.accessToken||!Number.isSafeInteger(session.expires_at)||Number(session.expires_at)*1000!==owner.expiresAt)throw Error(unavailable);authId=user.id;return result as unknown as Awaited<ReturnType<CareWorkspaceAuthoritySdkWeb['auth']['getSession']>>;},
   getUser:async(token)=>{const result=await call(getUser,auth,[token],'Eigenes Dokumentationspfadkonto bestätigen');if(!row(result.data)||!row(result.data.user)||result.data.user.is_anonymous===true)throw Error(unavailable);return result as unknown as Awaited<ReturnType<CareWorkspaceAuthoritySdkWeb['auth']['getUser']>>;},
  },rpc:async(name,args)=>{if(!['resolve_current_profile_id','current_tenant_id'].includes(name))throw Error(unavailable);return await call(rpc,sdk,[name,args],'Internes Dokumentationsprofil bestätigen') as unknown as Awaited<ReturnType<CareWorkspaceAuthoritySdkWeb['rpc']>>;}};
  const scope={tenantId:owner.tenantId,clientId:owner.clientId,actorId:owner.actorId,isCurrent:()=>{current();return true;}};
  const check=async()=>{current();await requireCareWorkspaceAuthorityWeb(scope,()=>{current();return facade;},(request,label)=>options.query(request,label),unavailable);current();};
  await check();return{scope,check,current,call:()=>call(rpc,sdk,['web_care_documentation_path_workspace_context',{p_tenant_id:owner.tenantId,p_client_id:owner.clientId,p_actor_id:owner.actorId}],'Dokumentationspfadoriginale lesen')};
 }
 return{
  async context(a:CareDocumentationPathAuthority):Promise<CareDocumentationPathResult<CareDocumentationPathContext>>{try{const guard=await operation(a),result=await guard.call();await guard.check();const data=decodeCareDocumentationPathContext(result.data,guard.scope);guard.current();return{ok:true,data};}catch(error){return{ok:false,error:error instanceof Error?error.message:unavailable};}},
  async commit(a:CareDocumentationPathAuthority,command:CareDocumentationPathCommand):Promise<CareDocumentationPathResult<CareDocumentationPathReceipt>>{try{const copy=cloneClientNativeOriginal(command);validateCareDocumentationPathCommand(copy);if(copy.tenantId!==a.tenantId||copy.clientId!==a.clientId||copy.actorId!==a.actorId)throw Error(unavailable);return{ok:false,rejected:true,error:'Für diesen Dokumentationspfad fehlen die bestätigten nativen Fachbelege. Es wurde nichts gesendet.'};}catch(error){return{ok:false,rejected:true,error:error instanceof Error?error.message:unavailable};}},
  async confirm(_a:CareDocumentationPathAuthority,_command:CareDocumentationPathCommand):Promise<CareDocumentationPathResult<CareDocumentationPathReceipt>>{return{ok:false,uncertain:true,error:'Das ursprüngliche Konto der historischen Pfadquittung ist nicht belegt. Die Anfrage bleibt gesichert; es wurde nichts gesendet.'};},
 };
}
