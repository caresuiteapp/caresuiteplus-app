import { buildBusinessRecoveryEmail } from '../_shared/businessRecoveryEmail.ts';
import { type RegistrationWelcomeConfig,sendCareSuiteSystemEmail } from '../_shared/registrationWelcomeEmail.ts';
import { consumePublicAccessLimit,PUBLIC_EMAIL_PATTERN,type PublicAccessDb } from '../_shared/publicAccess.ts';

export const BUSINESS_RECOVERY_MESSAGE = 'Falls ein aktives Verwaltungskonto mit dieser E-Mail-Adresse besteht, erhalten Sie eine Systemmail mit dem Rücksetz-Link. Bitte prüfen Sie auch den Spam-Ordner.';
export const INVALID_RECOVERY_MESSAGE = 'Der Rücksetz-Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an.';
type Identity = { id:string;email?:string;deleted_at?:string|null;banned_until?:string|null };
type Target = { authUserId:string;email:string;recipientName:string };
export type BusinessRecoveryAdmin = PublicAccessDb & {auth:{admin:{
  getUserById(id:string):PromiseLike<{data:{user:Identity|null};error:unknown}>;
  generateLink(input:{type:'recovery';email:string}):PromiseLike<{data:{user:Identity|null;properties:{hashed_token?:string;verification_type?:string}|null};error:unknown}>;
  signOut(token:string,scope:'global'):PromiseLike<{error:unknown}>;
  updateUserById(id:string,input:{password:string;email_confirm?:boolean}):PromiseLike<{data:{user:Identity|null};error:unknown}>;
}}};
export type BusinessRecoveryVerifier = {auth:{verifyOtp(input:{type:'recovery';token_hash:string}):PromiseLike<{
  data:{user:Identity|null;session:{access_token:string}|null};error:unknown;
}>}};
export const isRecoveryTokenHash = (value:unknown):value is string => typeof value==='string' && /^[a-zA-Z0-9_-]{32,128}$/.test(value);
export const isValidRecoveryEmail = (value:unknown):value is string => typeof value==='string' && value.trim().length<=254 && PUBLIC_EMAIL_PATTERN.test(value.trim());

const recoveryDigest = async (token:string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(byte=>byte.toString(16).padStart(2,'0')).join('');

async function targetFor(client:BusinessRecoveryAdmin,email:string,id?:string):Promise<Target|null> {
  const {data,error}=await client.rpc('business_password_recovery_target',{p_email:email,p_auth_user_id:id??null});
  if(error) throw new Error('business_recovery_target_unconfirmed');
  if(!data) return null;
  const target=data as Target;
  if(typeof target.authUserId!=='string' || target.email!==email) throw new Error('business_recovery_target_invalid');
  return target;
}
function matches(user:Identity|null,target:Target) {
  return !!user && !user.deleted_at && (!user.banned_until || Date.parse(user.banned_until)<=Date.now())
    && user.id===target.authUserId && user.email?.toLowerCase()===target.email;
}

/** No identity or token is ever returned to the public request endpoint. */
export async function deliverBusinessRecovery(
  client:BusinessRecoveryAdmin,config:RegistrationWelcomeConfig,email:string,fetcher:typeof fetch=fetch,delivery:'web'|'native'='web',
) {
  const target=await targetFor(client,email);
  if(!target) return {accepted:false};
  const identity=await client.auth.admin.getUserById(target.authUserId);
  if(identity.error) throw new Error('business_recovery_identity_unconfirmed');
  if(!matches(identity.data.user,target)) return {accepted:false};
  const generated=await client.auth.admin.generateLink({type:'recovery',email:target.email});
  if(generated.error || !generated.data.properties || !matches(generated.data.user,target)
    || generated.data.properties.verification_type!=='recovery' || !isRecoveryTokenHash(generated.data.properties.hashed_token)) {
    throw new Error('business_recovery_link_unconfirmed');
  }
  const link=delivery==='native' ? new URL('caresuiteplus:///auth/reset-password') : new URL('/auth/reset-password',config.appUrl);
  const registered=await client.rpc('business_register_recovery_delivery',{p_token_digest:await recoveryDigest(generated.data.properties.hashed_token),p_auth_user_id:target.authUserId,p_email:target.email});
  if(registered.error||registered.data!==true) throw new Error('business_recovery_delivery_binding_unconfirmed');
  link.hash=new URLSearchParams({token_hash:generated.data.properties.hashed_token,type:'recovery'}).toString();
  const content=buildBusinessRecoveryEmail(target.recipientName || 'und willkommen',link.href,config);
  const result=await sendCareSuiteSystemEmail(config,target.email,content,`business-password-recovery-v1/${crypto.randomUUID()}`,fetcher);
  if(!result.ok) throw new Error(result.code);
  return {accepted:true};
}

export async function completeBusinessRecovery(client:BusinessRecoveryAdmin,verifier:BusinessRecoveryVerifier,body:Record<string,unknown>,ip:string) {
  if(!isRecoveryTokenHash(body.tokenHash)) return {status:400,body:{ok:false,error:INVALID_RECOVERY_MESSAGE}};
  if(typeof body.password!=='string' || body.password.length<10 || body.password.length>128 || body.password!==body.confirmPassword) {
    return {status:400,body:{ok:false,error:'Bitte zwei übereinstimmende Passwörter mit 10 bis 128 Zeichen eingeben.'}};
  }
  if(!await consumePublicAccessLimit(client,'reset_complete',ip,body.tokenHash)) return {status:429,body:{ok:false,error:'Zu viele Versuche. Bitte warten Sie 15 Minuten.'}};
  // A separate Auth client is essential: verifyOtp must not replace the service
  // client's Authorization header with the recovered user's session.
  const verified=await verifier.auth.verifyOtp({type:'recovery',token_hash:body.tokenHash});
  const user=verified.data.user;
  if(verified.error || !user?.email || !verified.data.session) return {status:400,body:{ok:false,error:INVALID_RECOVERY_MESSAGE}};
  const target=await targetFor(client,user.email.toLowerCase(),user.id);
  if(!target || !matches(user,target)) return {status:400,body:{ok:false,error:INVALID_RECOVERY_MESSAGE}};
  const current=await client.auth.admin.getUserById(user.id);
  if(current.error || !matches(current.data.user,target)) return {status:400,body:{ok:false,error:INVALID_RECOVERY_MESSAGE}};
  const consumed=await client.rpc('business_consume_recovery_delivery',{p_token_digest:await recoveryDigest(body.tokenHash),p_auth_user_id:user.id,p_email:target.email});
  if(consumed.error||consumed.data!==true) return {status:400,body:{ok:false,error:INVALID_RECOVERY_MESSAGE}};
  const signedOut=await client.auth.admin.signOut(verified.data.session.access_token,'global');
  if(signedOut.error) throw new Error('business_recovery_session_revocation_unconfirmed');
  const updated=await client.auth.admin.updateUserById(user.id,{password:body.password,email_confirm:true});
  if(updated.error || !matches(updated.data.user,target)) throw new Error('business_recovery_password_update_unconfirmed');
  return {status:200,body:{ok:true}};
}
