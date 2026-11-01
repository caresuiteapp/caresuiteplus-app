import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({getById:vi.fn(),basePrepare:vi.fn(),rpc:vi.fn(),session:vi.fn()}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({rpc:mocks.rpc,auth:{getSession:mocks.session}})}));
vi.mock('@/lib/assist/repositories/assignmentRepository.supabase.ts',()=>({assignmentSupabaseRepository:{getById:mocks.getById,prepareServiceRecord:mocks.basePrepare}}));
import {assignmentSupabaseRepository as repository} from '@/lib/assist/repositories/assignmentRepository.supabase.web';

const tenant='11111111-1111-4111-8111-111111111111',assignment='22222222-2222-4222-8222-222222222222';
const actor='33333333-3333-4333-8333-333333333333',employee='44444444-4444-4444-8444-444444444444';
const draft={proofId:'55555555-5555-4555-8555-555555555555',updatedAt:'2026-11-01T10:00:00+00:00',payloadHash:'sha256:'+'a'.repeat(64),signatureId:'66666666-6666-4666-8666-666666666666'};
const ready={version:'gkv-assist-original-v1',tenantId:tenant,assignmentId:assignment,actorId:actor,employeeId:employee,
 visitId:'77777777-7777-4777-8777-777777777777',phase:'ready',draft,original:null};
const sealed={...ready,phase:'sealed',draft:null,original:{proofId:'88888888-8888-4888-8888-888888888888',draftId:draft.proofId,
 draftUpdatedAt:draft.updatedAt,payloadHash:draft.payloadHash,signatureId:draft.signatureId,sealedAt:'2026-11-01T10:00:01+00:00'}};
describe('Web assignment completion uses the immutable personal original',()=>{
 beforeEach(()=>{
  vi.resetAllMocks();
  mocks.getById.mockResolvedValue({ok:true,data:{assignmentStatus:'abgeschlossen',employeeId:employee}});
  mocks.session.mockResolvedValue({data:{session:{user:{id:actor}}},error:null});
  mocks.basePrepare.mockResolvedValue({ok:true,data:{id:'record'}});
 });
 it('live documentation remains a working projection without sealing or byte completion',async()=>{
  mocks.getById.mockResolvedValue({ok:true,data:{assignmentStatus:'gestartet',employeeId:employee}});
  expect(await repository.prepareServiceRecord(tenant,assignment)).toEqual({ok:true,data:null});
  expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.basePrepare).not.toHaveBeenCalled();
 });
 it('seals exact server draft before delegating the existing byte/record workflow with the wrapper receiver',async()=>{
  const order:string[]=[];
  mocks.rpc.mockImplementation(async(name:string)=>{order.push(name);return {data:name.endsWith('_context')?ready:sealed,error:null};});
  mocks.basePrepare.mockImplementation(async function(this:unknown){expect(this).toBe(repository);order.push('bytes');return {ok:true,data:{id:'record'}};});
  expect((await repository.prepareServiceRecord(tenant,assignment)).ok).toBe(true);
  expect(order).toEqual(['gkv_assist_original_context','gkv_assist_original_seal','bytes']);
  expect(mocks.rpc.mock.calls[1][1]).toMatchObject({t:tenant,a_id:assignment,p_expected:draft});
 });
 it('recovers lost seal reply before starting byte completion',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:ready,error:null}).mockRejectedValueOnce(Error('Network')).mockResolvedValueOnce({data:sealed,error:null});
  expect((await repository.prepareServiceRecord(tenant,assignment)).ok).toBe(true);
  expect(mocks.rpc).toHaveBeenCalledTimes(3);expect(mocks.basePrepare).toHaveBeenCalledOnce();
 });
 it('does not delegate a permission, wrong-person, incomplete or unavailable answer',async()=>{
  for(const response of [{data:null,error:{code:'42501'}},{data:{...sealed,actorId:employee},error:null},
   {data:{...ready,phase:'working',draft:null},error:null},{data:null,error:{code:'42P01'}}]){
   mocks.rpc.mockResolvedValue(response);
   expect((await repository.prepareServiceRecord(tenant,assignment)).ok).toBe(false);
  }
  expect(mocks.basePrepare).not.toHaveBeenCalled();
 });
 it('only definite absence of the optional draft installation keeps the established path',async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'Could not find public.gkv_assist_original_context'}});
  expect((await repository.prepareServiceRecord(tenant,assignment)).ok).toBe(true);expect(mocks.basePrepare).toHaveBeenCalledOnce();
 });
 it('after byte failure retries the same sealed original without another seal command',async()=>{
  mocks.rpc.mockResolvedValue({data:sealed,error:null});
  mocks.basePrepare.mockResolvedValueOnce({ok:false,error:'PDF noch nicht bestätigt'}).mockResolvedValueOnce({ok:true,data:{id:'record'}});
  expect((await repository.prepareServiceRecord(tenant,assignment)).ok).toBe(false);
  expect((await repository.prepareServiceRecord(tenant,assignment)).ok).toBe(true);
  expect(mocks.rpc.mock.calls.every(c=>c[0]==='gkv_assist_original_context')).toBe(true);
 });
 it('requires a current personal session before any original operation',async()=>{
  mocks.session.mockResolvedValue({data:{session:null},error:null});
  expect((await repository.prepareServiceRecord(tenant,assignment)).ok).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.basePrepare).not.toHaveBeenCalled();
 });
});
