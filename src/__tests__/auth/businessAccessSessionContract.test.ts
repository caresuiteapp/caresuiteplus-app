import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkBusinessAccess } from '@/lib/auth/businessAccessService.shared';
const h=vi.hoisted(()=>({userId:'auth-a',session:vi.fn(),signOut:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({auth:{getSession:h.session,signOut:h.signOut}})}));
vi.mock('@/lib/platformConsole/platformSupabaseClient',()=>({platformRpc:h.rpc}));
beforeEach(()=>{vi.clearAllMocks();h.userId='auth-a';h.session.mockImplementation(async()=>({data:{session:{user:{id:h.userId}}}}));h.rpc.mockResolvedValue({data:{allowed:true},error:null});h.signOut.mockResolvedValue({error:null});});
describe('shared first-login workspace access and session contract',()=>{
  it('accepts only the current authenticated account after a positive server workspace gate',async()=>{
    expect(await checkBusinessAccess('auth-a')).toEqual({ok:true,data:null});expect(h.rpc).toHaveBeenCalledWith('platform_business_access_state');expect(h.signOut).not.toHaveBeenCalled();
  });
  it('ends only this device session after a confirmed denial of the same account',async()=>{
    h.rpc.mockResolvedValue({data:{allowed:false,message:'Unternehmen gesperrt.'},error:null});expect(await checkBusinessAccess('auth-a')).toEqual({ok:false,error:'Unternehmen gesperrt.'});expect(h.signOut).toHaveBeenCalledWith({scope:'local'});
  });
  it.each([true,false])('never accepts or signs out a different account after an old server response: %s',async allowed=>{
    let finish!:(result:unknown)=>void;h.rpc.mockReturnValue(new Promise(resolve=>{finish=resolve;}));const pending=checkBusinessAccess('auth-a');await Promise.resolve();await Promise.resolve();h.userId='auth-b';finish({data:{allowed},error:null});expect((await pending).ok).toBe(false);expect(h.signOut).not.toHaveBeenCalled();
  });
});
