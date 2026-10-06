import { deliverBusinessRecovery, type BusinessRecoveryAdmin } from '../business-password-recovery/core.ts';
import type { RegistrationWelcomeConfig } from '../_shared/registrationWelcomeEmail.ts';

type Result<T> = {data:T;error:unknown};
type RpcClient = {rpc(name:string,args:Record<string,unknown>):PromiseLike<Result<unknown>>};
type Operation = {id:string;tenant_id:string;tenant_user_id:string;auth_user_id:string;action:string;old_email:string;new_email:string|null};
export type AccountAdmin = RpcClient & BusinessRecoveryAdmin & {auth:{admin:BusinessRecoveryAdmin['auth']['admin'] & {
  updateUserById(id:string,input:{email:string;email_confirm:boolean}):PromiseLike<Result<{user:{id:string;email?:string}|null}>>;
}}};
export type AccountRequest = {nonce:string;tenantId:string;tenantUserId:string;action:'email_change'|'password_recovery'|'welcome_resend';newEmail?:string;reason:string;authorizationConfirmed:boolean};
export class AccountActionError extends Error {
  constructor(public readonly code:string,public readonly needsReview=false){super(code);}
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validAccountRequest(value:unknown):value is AccountRequest {
  const b=value as Partial<AccountRequest>|null;
  return !!b && uuid.test(String(b.nonce)) && uuid.test(String(b.tenantId)) && uuid.test(String(b.tenantUserId))
    && ['email_change','password_recovery','welcome_resend'].includes(String(b.action))
    && typeof b.reason==='string' && b.reason.trim().length>=5 && b.reason.trim().length<=1000
    && b.authorizationConfirmed===true
    && (b.action==='email_change' ? typeof b.newEmail==='string' && b.newEmail.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.newEmail.trim()) : !b.newEmail);
}
async function rpc<T>(client:RpcClient,name:string,args:Record<string,unknown>):Promise<T> {
  const result=await client.rpc(name,args);
  if(result.error) throw new AccountActionError((result.error as {message?:string}).message||'account_save_unconfirmed');
  return result.data as T;
}

/** The user-scoped RPC checks the role; only the server receives Auth identities. */
export async function manageTenantAccount(user:RpcClient,admin:AccountAdmin,config:RegistrationWelcomeConfig,body:AccountRequest) {
  if(!validAccountRequest(body)) throw new AccountActionError('account_request_invalid');
  if(!config.provider) throw new AccountActionError('account_mail_unavailable');
  const prepared=await rpc<{id:string;state:string;result?:{ok:boolean;message:string}}>(user,'platform_prepare_account_operation',{
    p_nonce:body.nonce,p_tenant_id:body.tenantId,p_tenant_user_id:body.tenantUserId,p_action:body.action,
    p_new_email:body.action==='email_change'?body.newEmail!.trim().toLowerCase():null,
    p_reason:body.reason.trim(),p_authorization_confirmed:body.authorizationConfirmed,
  });
  if(prepared.state==='completed' && prepared.result) return prepared.result;
  if(prepared.state==='needs_review') throw new AccountActionError('account_update_needs_review',true);
  if(prepared.state!=='prepared') throw new AccountActionError('account_operation_inactive');
  const operation=await rpc<Operation|null>(admin,'platform_claim_account_operation',{p_operation_id:prepared.id});
  if(!operation) throw new AccountActionError('account_operation_inactive');
  let authChanged=false;
  let externalRequestStarted=false;
  try {
    const current=await admin.auth.admin.getUserById(operation.auth_user_id);
    if(current.error || !current.data.user || current.data.user.email?.toLowerCase()!==operation.old_email)
      throw new AccountActionError('account_identity_mismatch');
    if(operation.action==='email_change') {
      externalRequestStarted=true;
      const updated=await admin.auth.admin.updateUserById(operation.auth_user_id,{email:operation.new_email!,email_confirm:false});
      if(updated.error || updated.data.user?.id!==operation.auth_user_id || updated.data.user?.email?.toLowerCase()!==operation.new_email)
        throw new AccountActionError('account_email_update_unconfirmed',true);
      authChanged=true;
    } else if(operation.action==='password_recovery') {
      externalRequestStarted=true;
      const delivered=await deliverBusinessRecovery(admin,config,operation.old_email);
      if(!delivered.accepted) throw new AccountActionError('account_identity_mismatch');
    }
    const result=await rpc<{ok:boolean;message:string}>(admin,'platform_finish_account_operation',{
      p_operation_id:operation.id,p_success:true,p_needs_review:false,
    });
    if(operation.action==='email_change') {
      try {
        const delivered=await deliverBusinessRecovery(admin,config,operation.new_email!);
        if(!delivered.accepted) throw new Error();
        return {...result,message:'Die Anmelde-E-Mail wurde korrigiert und der Rücksetz-Link an die neue Adresse versendet. Die neue Adresse wird beim Einlösen des Links bestätigt.'};
      } catch {
        return {...result,message:'Die Anmelde-E-Mail wurde korrigiert. Der Rücksetz-Link konnte nicht versendet werden. Bitte die Passwortwiederherstellung erneut anfordern.'};
      }
    }
    return result;
  } catch(cause) {
    // A transport timeout can occur after Auth or the provider accepted the action.
    // Never retry such an operation automatically with a fresh identity or mail.
    const review=authChanged||externalRequestStarted||(cause instanceof AccountActionError&&cause.needsReview);
    try {await rpc(admin,'platform_finish_account_operation',{p_operation_id:operation.id,p_success:false,p_needs_review:review});}
    catch {throw new AccountActionError('account_update_needs_review',true);}
    throw new AccountActionError(review?'account_update_needs_review':cause instanceof AccountActionError?cause.code:'account_save_unconfirmed',review);
  }
}
