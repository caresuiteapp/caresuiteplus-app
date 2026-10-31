import {beforeEach,describe,expect,it,vi} from 'vitest';
const h=vi.hoisted(()=>({create:vi.fn(),signIn:vi.fn(),rpc:vi.fn(),signOut:vi.fn(),stop:vi.fn(async()=>{}),publish:vi.fn(),audit:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:h.create}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({auth:{setSession:h.publish}})}));
vi.mock('@/lib/supabase/config',()=>({getSupabaseConfig:()=>({url:'https://test.invalid',anonKey:'test-publishable-key'})}));
vi.mock('@/lib/platform/platformFetch',()=>({platformFetch:vi.fn()}));
vi.mock('@/lib/auth/loginAuditService',()=>({recordLoginAuditEvent:h.audit}));
import {prepareBusinessLogin} from '@/lib/auth/preparedBusinessLogin';
const session={access_token:'test-only-token',refresh_token:'test-only-refresh',user:{id:'auth-a'}};
beforeEach(()=>{vi.clearAllMocks();h.create.mockReturnValue({auth:{signInWithPassword:h.signIn,signOut:h.signOut,stopAutoRefresh:h.stop},rpc:h.rpc});h.signIn.mockResolvedValue({data:{session},error:null});h.signOut.mockResolvedValue({error:null});h.rpc.mockImplementation(async(name:string)=>name==='platform_business_access_state'?{data:{allowed:true},error:null}:{data:{profile:{tenantId:'tenant-a'}},error:null});h.publish.mockResolvedValue({data:{session},error:null});h.audit.mockResolvedValue({ok:true});});
describe('isolated business authentication for device-protected saved login',()=>{
 it('verifies credentials, workspace access and the own server tenant before publishing anything',async()=>{
  const result=await prepareBusinessLogin('Owner@example.test','password');expect(result.ok).toBe(true);expect(h.publish).not.toHaveBeenCalled();expect(h.create).toHaveBeenCalledWith('https://test.invalid','test-publishable-key',expect.objectContaining({auth:expect.objectContaining({persistSession:false,autoRefreshToken:false,detectSessionInUrl:false})}));expect(h.rpc).toHaveBeenCalledWith('account_security_bootstrap',{p_expected_user_id:'auth-a'});
  if(!result.ok)return;expect(result.data.tenantId).toBe('tenant-a');await result.data.commit();await result.data.cancel();expect(h.publish).toHaveBeenCalledWith({access_token:session.access_token,refresh_token:session.refresh_token});expect(h.signOut).not.toHaveBeenCalled();
 });
 it('revokes only the unpublished own session after cancellation and cannot later publish it',async()=>{
  const result=await prepareBusinessLogin('owner@example.test','password');if(!result.ok)throw Error(result.error);await result.data.cancel();expect(h.signOut).toHaveBeenCalledWith({scope:'local'});await expect(result.data.commit()).rejects.toThrow('abgebrochen');expect(h.publish).not.toHaveBeenCalled();
 });
 it('does not publish denied business access',async()=>{
  h.rpc.mockImplementation(async(name:string)=>({data:name==='platform_business_access_state'?{allowed:false}:{profile:{tenantId:'tenant-a'}},error:null}));expect((await prepareBusinessLogin('owner@example.test','password')).ok).toBe(false);expect(h.publish).not.toHaveBeenCalled();expect(h.signOut).toHaveBeenCalledWith({scope:'local'});
 });
 it('does not invent a tenant if the own bootstrap is unavailable',async()=>{
  h.rpc.mockImplementation(async(name:string)=>name==='platform_business_access_state'?{data:{allowed:true},error:null}:{data:null,error:{message:'unavailable'}});const result=await prepareBusinessLogin('owner@example.test','password');expect(result.ok&&result.data.tenantId).toBeNull();if(result.ok)await result.data.cancel();
 });
 it('resolves a legacy own tenant through its existing server resolver',async()=>{
  h.rpc.mockImplementation(async(name:string)=>({data:name==='platform_business_access_state'?{allowed:true}:name==='current_tenant_id'?'legacy-tenant':null,error:null}));
  const result=await prepareBusinessLogin('owner@example.test','password');expect(result.ok&&result.data.tenantId).toBe('legacy-tenant');if(result.ok)await result.data.cancel();expect(h.publish).not.toHaveBeenCalled();
 });
 it('publishes one session for duplicate commit calls',async()=>{
  const result=await prepareBusinessLogin('owner@example.test','password');if(!result.ok)throw Error(result.error);await Promise.all([result.data.commit(),result.data.commit()]);expect(h.publish).toHaveBeenCalledOnce();await result.data.cancel();
 });
 it('rejects an unexpected account from session publication',async()=>{
  h.publish.mockResolvedValue({data:{session:{...session,user:{id:'other-auth'}}},error:null});const result=await prepareBusinessLogin('owner@example.test','password');if(!result.ok)throw Error(result.error);await expect(result.data.commit()).rejects.toThrow('Sitzung');await result.data.cancel();expect(h.signOut).toHaveBeenCalledWith({scope:'local'});
 });
});
