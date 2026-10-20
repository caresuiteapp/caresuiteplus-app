import {describe,expect,it,vi} from 'vitest';
import {submitPublicSupport,validatePublicSupport} from '../../../supabase/functions/public-support-ticket/core';
const input={nonce:crypto.randomUUID(),name:'Anna Beispiel',email:'ANNA@example.test',organization:'Firma',subject:'Hilfe bei der Anmeldung',category:'account',message:'Meine Anmeldung zeigt eine Fehlermeldung an.',privacyAccepted:true,website:''};
describe('anonymous support ticket endpoint',()=>{
  it('stores only validated contact data through a service-only RPC and returns a confirmed receipt',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:{reference:'PUB-000123'},error:null});
    expect(await submitPublicSupport({rpc},input,'127.0.0.1')).toEqual({status:201,body:{ok:true,reference:'PUB-000123'}});
    const args=rpc.mock.calls[0][1];expect(args.p_data.email).toBe('anna@example.test');expect(args.p_data).not.toHaveProperty('tenant_id');
    expect(args.p_ip_hash).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(args)).not.toContain('127.0.0.1');
  });
  it('rejects missing privacy acknowledgement, malformed/long fields and a filled trap before touching the database',async()=>{
    for(const bad of [{privacyAccepted:false},{email:'invalid'},{message:'short'},{subject:'x'.repeat(181)},{name:null},{nonce:'not-a-uuid'},{website:'spam.example.test'},{category:'fake'}]) {
      expect(validatePublicSupport({...input,...bad})).not.toBeNull();const rpc=vi.fn();
      expect((await submitPublicSupport({rpc},{...input,...bad},'ip')).status).toBe(400);expect(rpc).not.toHaveBeenCalled();
    }
  });
  it('does not claim an incoming ticket on rate limits, failed saves or malformed acknowledgements',async()=>{
    const rpc=vi.fn().mockResolvedValueOnce({data:{rateLimited:true},error:null}).mockResolvedValueOnce({data:null,error:{message:'secret-db-details'}}).mockResolvedValueOnce({data:{},error:null});
    expect((await submitPublicSupport({rpc},input,'ip')).status).toBe(429);
    await expect(submitPublicSupport({rpc},input,'ip')).rejects.toThrow('save_unconfirmed');
    await expect(submitPublicSupport({rpc},input,'ip')).rejects.toThrow('receipt_unconfirmed');
  });
});
