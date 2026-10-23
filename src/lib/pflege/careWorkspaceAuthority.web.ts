/** The authenticated account and its currently resolved internal profile are separate identities. */
type Session={user:{id:string};access_token:string;expires_at?:number};
type RpcResult={data:unknown;error:unknown;status?:number};
export type CareWorkspaceAuthoritySdkWeb={
 auth:{
  getSession():PromiseLike<{data:{session:Session|null};error:unknown}>;
  getUser(token?:string):PromiseLike<{data:{user:{id:string}|null};error:unknown}>;
 };
 rpc(name:string,args:Record<string,unknown>):PromiseLike<RpcResult>;
};
type Context={tenantId:string;actorId:string;isCurrent():boolean};
type Query=(request:PromiseLike<RpcResult>,operation:string)=>PromiseLike<RpcResult>;
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const liveSession=(session:Session|null):session is Session=>!!session&&uuid(session.user?.id)&&typeof session.access_token==='string'&&session.access_token.length>0&&typeof session.expires_at==='number'&&Number.isFinite(session.expires_at)&&session.expires_at*1000>Date.now();

/**
 * Preflight only. Every clinical RPC must still check its current session, own
 * profile, tenant, permissions and record scope on the server. No profile cache,
 * account-wide profile search or auth-user-as-profile fallback is accepted.
 */
export async function requireCareWorkspaceAuthorityWeb<T extends CareWorkspaceAuthoritySdkWeb>(
 context:Context,getSdk:()=>T|null,query:Query,unavailable:string,
):Promise<T>{
 const tenantId=context.tenantId,actorId=context.actorId,db=getSdk();
 const fail=()=>new Error(unavailable);
 if(!uuid(tenantId)||!uuid(actorId)||!db)throw fail();
 const current=()=>{
  if(context.tenantId!==tenantId||context.actorId!==actorId||context.isCurrent()!==true||getSdk()!==db||context.isCurrent()!==true)throw fail();
 };
 current();
 const before=await db.auth.getSession();current();
 if(before.error||!liveSession(before.data.session))throw fail();
 const token=before.data.session.access_token,userId=before.data.session.user.id,expiresAt=before.data.session.expires_at;
 const verified=await db.auth.getUser(token);current();
 if(verified.error||verified.data.user?.id!==userId)throw fail();
 const profile=await query(db.rpc('resolve_current_profile_id',{}),'Aktuelles internes Pflegeprofil bestätigen');current();
 if(profile.error||profile.data!==actorId)throw fail();
 const tenant=await query(db.rpc('current_tenant_id',{}),'Aktuellen Pflegemandanten bestätigen');current();
 if(tenant.error||tenant.data!==tenantId)throw fail();
 const after=await db.auth.getSession();current();
 if(after.error||!liveSession(after.data.session)||after.data.session.access_token!==token||after.data.session.user.id!==userId||after.data.session.expires_at!==expiresAt)throw fail();
 return db;
}
