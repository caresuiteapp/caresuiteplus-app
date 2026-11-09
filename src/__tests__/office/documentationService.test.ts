import { beforeEach,describe,expect,it,vi } from 'vitest';
import { createDocumentation,listDocumentation } from '@/lib/office/documentation/service';
import { documentationDraft } from '@/lib/office/documentation/model';
const api=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn()}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({rpc:api.rpc,auth:{getUser:api.getUser}})}));
const actor={tenantId:'11111111-1111-4111-8111-111111111111',userId:'22222222-2222-4222-8222-222222222222'};
const id='33333333-3333-4333-8333-333333333333';
const filters={month:'',area:'',clientId:'',employeeId:'',category:'',source:'',priority:'',query:'',offset:0};
const draft=()=>documentationDraft({title:'Bericht',body:'Beobachtung',occurredAt:'2026-04-01T12:00:00Z'});
beforeEach(()=>{vi.resetAllMocks();api.getUser.mockResolvedValue({data:{user:{id:actor.userId}}});});
describe('documentation persistence contract',()=>{
 it('rejects an identity change before issuing a data request',async()=>{api.getUser.mockResolvedValue({data:{user:{id}}});expect((await listDocumentation(actor,filters)).ok).toBe(false);expect(api.rpc).not.toHaveBeenCalled();});
 it('rejects a foreign tenant receipt and keeps the write uncertain',async()=>{api.rpc.mockResolvedValue({data:{id,tenant_id:id,created_at:'2026-11-05T10:00:00Z'}});expect(await createDocumentation(actor,id,draft())).toMatchObject({ok:false,uncertain:true});});
 it('only confirms a matching durable create receipt',async()=>{api.rpc.mockResolvedValue({data:{id,tenant_id:actor.tenantId,created_at:'2026-11-05T10:00:00Z'}});expect(await createDocumentation(actor,id,draft())).toEqual({ok:true,data:{id}});expect(api.rpc.mock.calls[0]).toEqual(['office_documentation_create',expect.objectContaining({p_id:id,p_tenant_id:actor.tenantId})]);});
 it('rejects incomplete server pages rather than exposing partial or malformed content',async()=>{api.rpc.mockResolvedValue({data:{items:[],total:0,months:['invalid'],clients:[],employees:[]}});expect((await listDocumentation(actor,filters)).ok).toBe(false);});
 it('sorts the surname-first labels using German alphabetical order for both selectors',async()=>{
  const people=[{id:actor.userId,name:'Zimmer, Anna'},{id:actor.tenantId,name:'Ähren, Lilli'},{id,name:'Reinhardt, Kevin'}];
  api.rpc.mockResolvedValue({data:{items:[],total:0,months:[],clients:people,employees:people}});
  const result=await listDocumentation(actor,filters);expect(result.ok).toBe(true);
  if(!result.ok)return;
  for(const options of [result.data.clients,result.data.employees])expect(options.map(person=>person.name)).toEqual(['Ähren, Lilli','Reinhardt, Kevin','Zimmer, Anna']);
 });
});
