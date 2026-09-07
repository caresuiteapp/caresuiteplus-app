import { describe, expect, it, vi } from 'vitest';
import { provisionBusinessRegistration, validateRegistrationBody } from '../../../supabase/functions/register-business-tenant/provision';

const body = { companyName:'Betrieb',legalForm:'GmbH',industry:'Pflege',street:'Weg 1',zip:'12345',city:'Berlin',phone:'0123',email:'office@example.test',adminFirstName:'Test',adminLastName:'Owner',adminEmail:'owner@example.test',adminPassword:'LongTestPassword!',termsAccepted:true,selectedModules:[] };
function setup(responses: Array<unknown | Error>, owner: unknown = null) {
  const createUser=vi.fn().mockResolvedValue({ data:{user:{id:'new-user'}},error:null });
  const deleteUser=vi.fn().mockResolvedValue({ error:null });
  const rpc=vi.fn().mockImplementation(async()=>{const value=responses.shift();if(value instanceof Error)throw value;return value;});
  const from=vi.fn((table:string)=>{const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({error:null,data:table==='tenant_users'?owner:{tenant_id:null}})};return query;});
  const client={auth:{admin:{createUser,deleteUser}},rpc,from};
  return {client:client as never,rpc,createUser,deleteUser};
}
describe('company registration provisioning',()=>{
  it('accepts complete registration without a module choice and requires consent',()=>{
    expect(validateRegistrationBody(body)).toBeNull();
    expect(validateRegistrationBody({...body,termsAccepted:false})).not.toBeNull();
    expect(validateRegistrationBody({...body,adminPassword:'short'})).not.toBeNull();
  });
  it('never forwards a password or selected products to the database',async()=>{
    const c=setup([{data:{ok:true,tenantId:'company'},error:null}]);
    const result=await provisionBusinessRegistration(c.client,body);
    expect(result.status).toBe(201);
    expect(c.rpc.mock.calls[0][1].p_data).not.toHaveProperty('adminPassword');
    expect(c.rpc.mock.calls[0][1].p_data).not.toHaveProperty('selectedModules');
    expect(c.deleteUser).not.toHaveBeenCalled();
  });
  it('recovers a lost response using the same registration identity',async()=>{
    const c=setup([new Error('lost response'),{data:{ok:true,tenantId:'company'},error:null}]);
    expect((await provisionBusinessRegistration(c.client,body)).status).toBe(201);
    expect(c.createUser).toHaveBeenCalledTimes(1);
    expect(c.rpc.mock.calls[0][1]).toEqual(c.rpc.mock.calls[1][1]);
    expect(c.deleteUser).not.toHaveBeenCalled();
  });
  it('does not delete an identity when a transport failure could still commit',async()=>{
    const c=setup([new Error('network'),new Error('network')]);
    expect((await provisionBusinessRegistration(c.client,body)).status).toBe(503);
    expect(c.deleteUser).not.toHaveBeenCalled();
  });
  it('removes only the newly created unprovisioned identity after confirmed database rollback',async()=>{
    const failure={data:null,error:{code:'23514',message:'check failure'}};
    const c=setup([failure,failure]);
    expect((await provisionBusinessRegistration(c.client,body)).status).toBe(503);
    expect(c.deleteUser).toHaveBeenCalledWith('new-user');
  });
  it('recognizes a committed workspace even when the RPC response was lost',async()=>{
    const c=setup([new Error('network'),new Error('network')],{id:'owner-row',tenant_id:'company',username:'admin',email:body.adminEmail,role_key:'owner',display_name:'Test Owner'});
    expect((await provisionBusinessRegistration(c.client,body)).status).toBe(201);
    expect(c.deleteUser).not.toHaveBeenCalled();
  });
});
