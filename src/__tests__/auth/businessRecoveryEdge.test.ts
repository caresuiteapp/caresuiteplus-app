import {describe,expect,it,vi} from 'vitest';
import {completeBusinessRecovery,deliverBusinessRecovery,type BusinessRecoveryAdmin,type BusinessRecoveryVerifier} from '../../../supabase/functions/business-password-recovery/core';
import {resolveRegistrationWelcomeConfig} from '../../../supabase/functions/_shared/registrationWelcomeEmail';
const token='a'.repeat(64);
const target={authUserId:'admin-id',email:'admin@example.test',recipientName:'Maria <Admin>'};
const identity={id:target.authUserId,email:target.email};
const config=resolveRegistrationWelcomeConfig({RESEND_API_KEY:'key',REGISTRATION_EMAIL_FROM:'no-reply@example.test'});
function fixture() {
  const rpc=vi.fn(async(name:string)=>({data:['public_access_consume_limit','business_register_recovery_delivery','business_consume_recovery_delivery'].includes(name)?true:target,error:null}));
  const admin={getUserById:vi.fn().mockResolvedValue({data:{user:identity},error:null}),generateLink:vi.fn().mockResolvedValue({data:{user:identity,properties:{hashed_token:token,verification_type:'recovery'}},error:null}),signOut:vi.fn().mockResolvedValue({error:null}),updateUserById:vi.fn().mockResolvedValue({data:{user:identity},error:null})};
  const verifier={auth:{verifyOtp:vi.fn().mockResolvedValue({data:{user:identity,session:{access_token:'private-session'}},error:null})}};
  return {client:{rpc,auth:{admin}} as unknown as BusinessRecoveryAdmin,rpc,admin,verifier,fetcher:vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'mail'}),{status:200}))};
}
describe('administration-only password recovery',()=>{
  it('generates a one-time recovery link only for a current eligible administration identity and sends a systemmail',async()=>{
    const f=fixture();expect(await deliverBusinessRecovery(f.client,config,target.email,f.fetcher)).toEqual({accepted:true});
    expect(f.admin.generateLink).toHaveBeenCalledWith({type:'recovery',email:target.email});
    const payload=JSON.parse(f.fetcher.mock.calls[0][1].body);
    expect(payload.to).toEqual([target.email]);expect(payload.reply_to).toBe('no-reply@example.test');
    expect(payload.html).toContain('/auth/reset-password#token_hash=');expect(payload.html).toContain('&amp;type=recovery');
    expect(payload.html).toContain('Maria &lt;Admin&gt;');expect(payload.html).toContain('Bitte antworten Sie nicht');
    expect(payload.attachments).toHaveLength(2);
  });
  it('sends nothing for portal, unknown or blocked profiles rejected by the server lookup',async()=>{
    const f=fixture();f.rpc.mockResolvedValue({data:null,error:null} as never);
    expect(await deliverBusinessRecovery(f.client,config,'client@example.test',f.fetcher)).toEqual({accepted:false});
    expect(f.admin.generateLink).not.toHaveBeenCalled();expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('does not send to an old profile email or a banned/deleted Auth identity',async()=>{
    for(const user of [{...identity,email:'changed@example.test'},{...identity,deleted_at:'2026-01-01'},{...identity,banned_until:'2099-01-01'}]) {
      const f=fixture();f.admin.getUserById.mockResolvedValue({data:{user},error:null});
      expect(await deliverBusinessRecovery(f.client,config,target.email,f.fetcher)).toEqual({accepted:false});expect(f.fetcher).not.toHaveBeenCalled();
    }
  });
  it('rejects a generated token for the wrong identity or token type',async()=>{
    const f=fixture();f.admin.generateLink.mockResolvedValue({data:{user:identity,properties:{hashed_token:token,verification_type:'magiclink'}},error:null});
    await expect(deliverBusinessRecovery(f.client,config,target.email,f.fetcher)).rejects.toThrow('link_unconfirmed');expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('checks token/password/confirmation before using Auth and enforces server rate limits',async()=>{
    const f=fixture();const verify=f.verifier.auth.verifyOtp;
    expect((await completeBusinessRecovery(f.client,f.verifier,{tokenHash:'bad',password:'a'.repeat(10),confirmPassword:'a'.repeat(10)},'ip')).status).toBe(400);
    expect((await completeBusinessRecovery(f.client,f.verifier,{tokenHash:token,password:'short',confirmPassword:'short'},'ip')).status).toBe(400);expect(verify).not.toHaveBeenCalled();
    f.rpc.mockResolvedValue({data:false,error:null} as never);
    expect((await completeBusinessRecovery(f.client,f.verifier,{tokenHash:token,password:'a'.repeat(10),confirmPassword:'a'.repeat(10)},'ip')).status).toBe(429);expect(verify).not.toHaveBeenCalled();
  });
  it('uses recovery verification, rechecks eligibility, revokes refresh sessions and updates only the verified account',async()=>{
    const f=fixture();const body={tokenHash:token,password:'New Password 123!',confirmPassword:'New Password 123!',authUserId:'attacker-choice'};
    expect(await completeBusinessRecovery(f.client,f.verifier,body,'ip')).toEqual({status:200,body:{ok:true}});
    expect(f.verifier.auth.verifyOtp).toHaveBeenCalledWith({type:'recovery',token_hash:token});
    expect(f.rpc).toHaveBeenCalledWith('business_password_recovery_target',{p_email:target.email,p_auth_user_id:target.authUserId});
    expect(f.admin.signOut).toHaveBeenCalledWith('private-session','global');
    expect(f.admin.updateUserById).toHaveBeenCalledWith(target.authUserId,{password:body.password,email_confirm:true});
  });
  it('rejects a verified link when its delivery was bound to an earlier recipient address',async()=>{
    const f=fixture();f.rpc.mockImplementation(async name=>({data:name==='business_consume_recovery_delivery'?false:['public_access_consume_limit','business_register_recovery_delivery'].includes(name)?true:target,error:null}));
    const body={tokenHash:token,password:'New Password 123!',confirmPassword:'New Password 123!'};
    expect((await completeBusinessRecovery(f.client,f.verifier,body,'ip')).status).toBe(400);
    expect(f.admin.updateUserById).not.toHaveBeenCalled();
  });
  it('never changes a password when a token is expired/reused or its role was changed to a portal',async()=>{
    const f=fixture();f.verifier.auth.verifyOtp.mockResolvedValueOnce({data:{user:null,session:null},error:{code:'otp_expired'}});
    const body={tokenHash:token,password:'Password123',confirmPassword:'Password123'};
    expect((await completeBusinessRecovery(f.client,f.verifier as BusinessRecoveryVerifier,body,'ip')).status).toBe(400);
    f.rpc.mockImplementation(async(name:string)=>({data:name==='public_access_consume_limit'?true:null,error:null}) as never);
    expect((await completeBusinessRecovery(f.client,f.verifier,body,'ip')).status).toBe(400);expect(f.admin.updateUserById).not.toHaveBeenCalled();expect(f.admin.signOut).not.toHaveBeenCalled();
  });
  it('does not report success after an unconfirmed password update or failed session revocation',async()=>{
    const f=fixture();f.admin.signOut.mockResolvedValueOnce({error:{code:'unavailable'}});
    const body={tokenHash:token,password:'Password123',confirmPassword:'Password123'};
    await expect(completeBusinessRecovery(f.client,f.verifier,body,'ip')).rejects.toThrow('session_revocation_unconfirmed');expect(f.admin.updateUserById).not.toHaveBeenCalled();
    f.admin.updateUserById.mockResolvedValueOnce({data:{user:null},error:{code:'failed'}});
    await expect(completeBusinessRecovery(f.client,f.verifier,body,'ip')).rejects.toThrow('password_update_unconfirmed');
  });
});
