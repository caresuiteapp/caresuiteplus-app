import { describe, expect, it, vi } from 'vitest';
import { verifyRegistrationIdentity } from '../../../supabase/functions/_shared/companyRegistrationIdentity';

describe('repeat registration verified credential identity', () => {
  it('returns only the server-verified user, preserving the exact entered password', async () => {
    const signInWithPassword=vi.fn().mockResolvedValue({data:{session:{access_token:'test-only-token'}},error:null});
    const getUser=vi.fn().mockResolvedValue({data:{user:{id:'verified-user',email:'OWNER@example.test'}},error:null});
    expect(await verifyRegistrationIdentity({auth:{signInWithPassword,getUser}},'owner@example.test',' Password with spaces ')).toBe('verified-user');
    expect(signInWithPassword).toHaveBeenCalledWith({email:'owner@example.test',password:' Password with spaces '}); expect(getUser).toHaveBeenCalledWith('test-only-token');
  });
  it.each([{id:'user',email:'other@example.test'},null])('rejects a missing or different verified email: %s',async user=>{
    const client={auth:{signInWithPassword:vi.fn().mockResolvedValue({data:{session:{access_token:'test-only-token'}},error:null}),getUser:vi.fn().mockResolvedValue({data:{user},error:null})}};
    expect(await verifyRegistrationIdentity(client,'owner@example.test','Password123!')).toBeNull();
  });
  it('does not trust an unverified session or create any further request after failed credentials',async()=>{
    const getUser=vi.fn(); const client={auth:{signInWithPassword:vi.fn().mockResolvedValue({data:{session:{access_token:'test-only-token'}},error:{code:'invalid_credentials'}}),getUser}};
    expect(await verifyRegistrationIdentity(client,'owner@example.test','wrong')).toBeNull(); expect(getUser).not.toHaveBeenCalled();
  });
});
