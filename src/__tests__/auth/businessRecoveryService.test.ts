import {beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('@/lib/supabase/edgeFunctions',()=>({invokeEdgeFunction:api.invoke}));
import {requestBusinessPasswordReset,completeBusinessPasswordReset,readBusinessRecoveryToken} from '@/lib/auth/passwordResetService.web';
beforeEach(()=>{api.invoke.mockReset();vi.stubEnv('EXPO_PUBLIC_DEMO_MODE','false');vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY','anon');});
describe('web administration recovery service',()=>{
  it('uses the role-restricted Edge endpoint instead of generic Auth email reset',async()=>{
    api.invoke.mockResolvedValue({ok:true,data:{message:'Neutrale Empfangsbestätigung'}});
    expect(await requestBusinessPasswordReset(' ADMIN@example.test ')).toEqual({ok:true,data:{message:'Neutrale Empfangsbestätigung'}});
    expect(api.invoke).toHaveBeenCalledWith('business-password-recovery',{action:'request',email:'admin@example.test'});
  });
  it('accepts only a recovery token hash, never a normal login/session/magic link',()=>{
    const token='a'.repeat(64);expect(readBusinessRecoveryToken(`#token_hash=${token}&type=recovery`)).toBe(token);
    expect(readBusinessRecoveryToken(`#token_hash=${token}&type=magiclink`)).toBeNull();expect(readBusinessRecoveryToken('#access_token=private&refresh_token=private&type=recovery')).toBeNull();
  });
  it('preserves failed password updates and requires explicit confirmation from the backend',async()=>{
    api.invoke.mockResolvedValueOnce({ok:false,error:'Link ungültig'}).mockResolvedValueOnce({ok:true,data:{}}).mockResolvedValueOnce({ok:true,data:{ok:true}});
    const args=['a'.repeat(64),'Password123','Password123'] as const;
    expect(await completeBusinessPasswordReset(...args)).toEqual({ok:false,error:'Link ungültig'});
    expect((await completeBusinessPasswordReset(...args)).ok).toBe(false);expect((await completeBusinessPasswordReset(...args)).ok).toBe(true);
  });
  it('rejects invalid addresses and mismatched passwords without a transport request',async()=>{
    expect((await requestBusinessPasswordReset('invalid')).ok).toBe(false);
    expect((await completeBusinessPasswordReset('token','short','different')).ok).toBe(false);expect(api.invoke).not.toHaveBeenCalled();
  });
});
