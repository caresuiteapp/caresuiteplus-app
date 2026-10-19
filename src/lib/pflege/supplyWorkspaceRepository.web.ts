import { decodeSupplyContext, decodeSupplyReceipt, supplyBaseRights, supplyId, supplyJson, supplyObject, supplyVersion, validateSupplyCommand, type SupplyCommand, type SupplyContext, type SupplyReceipt, type SupplyRow } from './supplyWorkspaceDomain.web.ts';
import type { HandoverAuthority, HandoverSdk } from './caseHandoverRepository.web.ts';
export type SupplyAuthority = HandoverAuthority;
export type SupplyResult<T> = { ok: true; data: T } | { ok: false; error: string; rejected?: boolean; uncertain?: boolean };
type Options = { getSdk(): HandoverSdk | null; query<T>(request: PromiseLike<T>, operation: string): Promise<T> };
const unavailable = 'Sitzung, aktuelle Rechte oder vollständige Fallbelege sind nicht bestätigt.';
const fail = <T>(error=unavailable): SupplyResult<T> => ({ok:false,error});
export function createSupplyRepository(options: Options) {
 const current=(a:SupplyAuthority,sdk?:HandoverSdk)=>{if(!a.isCurrent() || a.expiresAt!==null && a.expiresAt<=Date.now() || sdk && options.getSdk()!==sdk)throw Error(unavailable);};
 async function authority(a:SupplyAuthority){
  current(a);const sdk=options.getSdk();if(!sdk)throw Error(unavailable);
  const session=await options.query(sdk.auth.getSession(),'Materialsitzung prüfen');current(a,sdk);const s=session.data.session;
  if(session.error || !s || s.user.id!==a.actorId || s.access_token!==a.accessToken || s.expires_at!==undefined && s.expires_at*1000<=Date.now())throw Error(unavailable);
  const user=await options.query(sdk.auth.getUser(a.accessToken),'Materialkonto bestätigen');current(a,sdk);
  if(user.error || user.data.user?.id!==a.actorId)throw Error(unavailable);return sdk;
 }
 const args=(a:SupplyAuthority,clientId?:string)=>({p_tenant_id:a.tenantId,p_actor_id:a.actorId,...(clientId?{p_client_id:clientId}:{})});
 async function call(a:SupplyAuthority,name:string,p:SupplyRow){const sdk=await authority(a);current(a,sdk);const r=await options.query(sdk.rpc(name,p),'Vollständigen Materialbestand lesen');current(a,sdk);if(r.error)throw Error(unavailable);return r.data;}
 return {
  async clients(a:SupplyAuthority):Promise<SupplyResult<SupplyRow[]>>{
   try{const v=await call(a,'web_supply_clients',args(a));if(!supplyObject(v) || Object.keys(v).length!==5 || v.version!==supplyVersion || v.tenantId!==a.tenantId || v.actorId!==a.actorId || !Array.isArray(v.clients) || v.count!==v.clients.length || v.clients.length>10000)throw Error(unavailable);
    supplyJson(v);const seen=new Set<string>();for(const r of v.clients){if(!supplyObject(r)||!supplyId(r.id)||r.tenant_id!==a.tenantId||seen.has(r.id))throw Error(unavailable);seen.add(r.id);}return {ok:true,data:structuredClone(v.clients)};
   }catch{return fail();}
  },
  async context(a:SupplyAuthority,clientId:string):Promise<SupplyResult<SupplyContext>>{
   try{if(!supplyId(clientId))throw Error(unavailable);const v=await call(a,'web_supply_context',args(a,clientId));return {ok:true,data:decodeSupplyContext(v,{tenantId:a.tenantId,actorId:a.actorId,clientId})};}catch(e){return fail(e instanceof Error?e.message:unavailable);}
  },
  async commit(a:SupplyAuthority,command:SupplyCommand):Promise<SupplyResult<SupplyReceipt>>{
   const c=structuredClone(command);let dispatched=false;
   try{validateSupplyCommand(c);if(c.tenantId!==a.tenantId||c.actorId!==a.actorId)throw Error(unavailable);const sdk=await authority(a);current(a,sdk);dispatched=true;
    const r=await options.query(sdk.rpc('web_commit_supply',{p_command:c}),'Fallbuchung verbindlich speichern');current(a,sdk);
    if(r.error){const code=supplyObject(r.error)?String(r.error.code??''):'';const rejected=r.data===null&&['22007','22008','22023','22P02','23514','23505','40001','40P01','42501','P0S01'].includes(code);return {ok:false,error:rejected?'Die Buchung wurde vollständig abgewiesen. Aktuelle Fassung und Originale erneut prüfen.':'Die Speicherantwort ist unklar. Den gesicherten Vorgang ausschließlich lesend prüfen.',...(rejected?{rejected:true}:{uncertain:true})};}
    return {ok:true,data:decodeSupplyReceipt(r.data,c)};
   }catch(e){return {ok:false,error:e instanceof Error?e.message:unavailable,...(dispatched?{uncertain:true}:{rejected:true})};}
  },
  async confirm(a:SupplyAuthority,command:SupplyCommand):Promise<SupplyResult<SupplyReceipt>>{
   const c=structuredClone(command);
   try{validateSupplyCommand(c);if(c.tenantId!==a.tenantId||c.actorId!==a.actorId)throw Error(unavailable);const r=await call(a,'web_confirm_supply',{...args(a,c.clientId),p_request_id:c.requestId,p_command:c});return {ok:true,data:decodeSupplyReceipt(r,c)};}
   catch{return {ok:false,uncertain:true,error:'Die passende native Quittung ist noch nicht bestätigt. Die Anfrage bleibt gesichert und wird nicht erneut gesendet.'};}
  },
 };
}
export { supplyBaseRights };
