import {describe,expect,it,vi} from 'vitest';
const delivery=vi.hoisted(()=>vi.fn());
vi.mock('../../../supabase/functions/business-password-recovery/core',()=>({deliverBusinessRecovery:delivery}));
import {manageTenantAccount,validAccountRequest,type AccountAdmin} from '../../../supabase/functions/platform-tenant-account/core';
import {resolveRegistrationWelcomeConfig} from '../../../supabase/functions/_shared/registrationWelcomeEmail';
const input={nonce:'00000000-0000-4000-8000-000000000001',tenantId:'00000000-0000-4000-8000-000000000002',tenantUserId:'00000000-0000-4000-8000-000000000003',action:'email_change' as const,newEmail:'NEW@example.test',reason:'Kundenauftrag bestätigt',authorizationConfirmed:true};
const op={id:input.nonce,tenant_id:input.tenantId,tenant_user_id:input.tenantUserId,auth_user_id:'server-identity',action:'email_change',old_email:'old@example.test',new_email:'new@example.test'};
const config=resolveRegistrationWelcomeConfig({RESEND_API_KEY:'test-key',REGISTRATION_EMAIL_FROM:'no-reply@example.test'});
function fixture() {
  delivery.mockReset().mockResolvedValue({accepted:true});
  const user={rpc:vi.fn().mockResolvedValue({data:{id:input.nonce,state:'prepared'},error:null})};
  const update=vi.fn().mockResolvedValue({data:{user:{id:op.auth_user_id,email:op.new_email}},error:null});
  const rpc=vi.fn(async(name:string)=>({data:name==='platform_claim_account_operation'?op:{ok:true,message:'Bestätigt'},error:null}));
  const admin={rpc,auth:{admin:{getUserById:vi.fn().mockResolvedValue({data:{user:{id:op.auth_user_id,email:op.old_email}},error:null}),updateUserById:update}}} as unknown as AccountAdmin;
  return {user,admin,rpc,update};
}
describe('protected tenant account operation',()=>{
  it('validates ids, email and explicit authorization before contacting Auth',()=>{
    expect(validAccountRequest(input)).toBe(true);
    for(const bad of [{authorizationConfirmed:false},{tenantId:'bad'},{newEmail:'invalid'},{reason:'x'},{action:'delete'}])
      expect(validAccountRequest({...input,...bad})).toBe(false);
  });
  it('uses only the server-selected identity, corrects the address unconfirmed, then sends a bound recovery link',async()=>{
    const f=fixture();expect((await manageTenantAccount(f.user,f.admin,config,{...input,authUserId:'untrusted'} as typeof input)).ok).toBe(true);
    expect(f.update).toHaveBeenCalledWith(op.auth_user_id,{email:'new@example.test',email_confirm:false});
    expect(f.user.rpc.mock.calls[0][1]).not.toHaveProperty('authUserId');
    expect(f.rpc).toHaveBeenCalledWith('platform_finish_account_operation',{p_operation_id:input.nonce,p_success:true,p_needs_review:false});
    expect(delivery).toHaveBeenCalledWith(f.admin,config,'new@example.test');
  });
  it('does not repeat Auth changes or mails for a completed nonce',async()=>{
    const f=fixture();f.user.rpc.mockResolvedValue({data:{id:input.nonce,state:'completed',result:{ok:true,message:'Bereits erledigt'}},error:null});
    expect((await manageTenantAccount(f.user,f.admin,config,input)).message).toBe('Bereits erledigt');
    expect(f.update).not.toHaveBeenCalled();expect(delivery).not.toHaveBeenCalled();
  });
  it('stops after a role denial or an already claimed operation',async()=>{
    const f=fixture();f.user.rpc.mockResolvedValue({data:null,error:{message:'platform_forbidden'}});
    await expect(manageTenantAccount(f.user,f.admin,config,input)).rejects.toThrow('platform_forbidden');expect(f.update).not.toHaveBeenCalled();
    f.user.rpc.mockResolvedValue({data:{id:input.nonce,state:'prepared'},error:null});f.rpc.mockResolvedValue({data:null,error:null} as never);
    await expect(manageTenantAccount(f.user,f.admin,config,input)).rejects.toThrow('account_operation_inactive');expect(f.update).not.toHaveBeenCalled();
  });
  it('blocks automatic repetition when an external account change has an uncertain outcome',async()=>{
    const f=fixture();f.update.mockRejectedValue(new Error('timeout'));
    await expect(manageTenantAccount(f.user,f.admin,config,input)).rejects.toThrow('account_update_needs_review');
    expect(f.rpc).toHaveBeenCalledWith('platform_finish_account_operation',{p_operation_id:input.nonce,p_success:false,p_needs_review:true});
  });
  it('reports a successful correction separately from a failed recovery email',async()=>{
    const f=fixture();delivery.mockRejectedValue(new Error('provider unavailable'));
    const result=await manageTenantAccount(f.user,f.admin,config,input);
    expect(result.ok).toBe(true);expect(result.message).toContain('konnte nicht versendet');
  });
});
