import {beforeEach,expect,it,vi} from 'vitest';
import type {AssistVisitProofRow} from '@/types/assistExecutionPersistence';
import type {ConfirmedBillingProofSource} from '@/types/clientBilling';
const h=vi.hoisted(()=>({rpc:vi.fn(),table:vi.fn(),fresh:vi.fn(),budgets:vi.fn(),profiles:vi.fn(),types:vi.fn(),terminal:vi.fn(),upsert:vi.fn(),mode:'write'}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({rpc:h.rpc})}));
vi.mock('@/lib/supabase/untypedTable',()=>({fromUnknownTable:h.table}));
vi.mock('@/lib/services/liveServiceGuard',()=>({guardServiceTenant:()=>null}));
vi.mock('@/lib/assist/assistVisitProofPersistenceService',async importOriginal=>{const actual=await importOriginal<typeof import('@/lib/assist/assistVisitProofPersistenceService')>();return {...actual,fetchVisitProofById:h.fresh};});
vi.mock('@/lib/client/clientBudgetSettingsService',()=>({listClientBudgetSettings:h.budgets}));
vi.mock('@/lib/client/clientServiceTypeService',()=>({listClientServiceProfiles:h.profiles,listTenantClientServiceTypes:h.types}));
import {computeVisitProofPayloadHash} from '@/lib/assist/assistVisitProofPersistenceService';
import {getProofBillingSourceSnapshot,mapApprovedProofToBillingCandidate,fetchVisitForBilling} from '@/lib/billing/clientProofBillingMapper';
import {upsertBillingCandidateFromProof} from '@/lib/billing/clientBillingCandidateService';
const visit={id:'visit',tenant_id:'tenant',client_id:'client',service_key:'service',service_name:'Service',planned_start_at:'2026-09-18T07:00:00Z',planned_end_at:'2026-09-18T12:00:00Z',duration_minutes:300,budget_amount_cents:90000};
const proof:AssistVisitProofRow={proofNumber:'LN-001',storagePath:null,generatedAt:'2026-09-18T09:30:00Z',generatedBy:'profile',approvedAt:'2026-09-18T10:00:00Z',approvedBy:'reviewer',billingReleased:false,releasedToPortalAt:null,approvalNote:null,rejectionReason:null,pdfStoragePath:'own/proof.pdf',pdfHash:'ab'.repeat(32),createdAt:'2026-09-18T09:30:00Z',updatedAt:'2026-09-18T10:00:00Z',id:'proof',tenantId:'tenant',visitId:'visit',signatureId:'signature',status:'approved',portalReleaseStatus:'none',portalVisible:false,
 payloadSnapshot:{clientId:'client',visitId:'visit',employeeId:'employee',visitTimes:{serviceStartedAt:'2026-09-18T08:00:00Z',serviceEndedAt:'2026-09-18T09:00:00Z',serviceSeconds:3000},signerName:'Klient'},payloadHash:'',};
const receipt:ConfirmedBillingProofSource={version:'workflow-assignment-record-v1',tenant_id:'tenant',visit_id:'visit',proof_id:'proof',proof_payload_hash:'',signature_id:'signature',signature_payload_hash:'sha256:signature-version',
 client_id:'client',employee_id:'employee',service_started_at:'2026-09-18T08:00:00Z',service_ended_at:'2026-09-18T09:00:00Z',actual_minutes:50,pdf_storage_path:'own/proof.pdf',pdf_sha256:'ab'.repeat(32),attested_at:'2026-09-18T10:00:00Z'};
let fresh:AssistVisitProofRow,confirmed:ConfirmedBillingProofSource;let writes:Record<string,unknown>[];
beforeEach(async()=>{vi.clearAllMocks();writes=[];fresh={...proof,payloadHash:await computeVisitProofPayloadHash(proof.payloadSnapshot)};confirmed={...receipt,proof_payload_hash:fresh.payloadHash!};
 h.fresh.mockResolvedValue({ok:true,data:fresh});h.budgets.mockResolvedValue({ok:true,data:[]});h.profiles.mockResolvedValue({ok:true,data:[]});h.types.mockResolvedValue({ok:true,data:[]});
 h.rpc.mockImplementation((name:string)=>Promise.resolve({data:name==='workflow_assignment_record_capability'?'workflow-assignment-record-v1':confirmed,error:null}));
 h.table.mockImplementation((_client:unknown,name:string)=>{let payload:Record<string,unknown>;const q:any={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,limit:()=>q,
  upsert:(value:Record<string,unknown>)=>{payload=value;writes.push(value);return q;},maybeSingle:()=>Promise.resolve({data:name==='assist_visits'?visit:null,error:null}),
  single:()=>Promise.resolve({data:{...payload,id:'candidate'},error:null}),then:(resolve:any)=>Promise.resolve({data:[],error:null}).then(resolve)};return q;});
});
it('canonical nested actual net time wins over planned duration and counts pause once',()=>{
 const mapped=mapApprovedProofToBillingCandidate('tenant',fresh,visit,{confirmedSource:confirmed,rateAmount:60});
 expect(mapped).toMatchObject({durationMinutes:50,quantity:0.8333,amountPreviewCents:5000,sourceSnapshot:{signed:true}});
});
it('names and old signature IDs alone never prove a current signed billing source',()=>{
 expect(getProofBillingSourceSnapshot(fresh,visit).signed).toBe(false);
 expect(mapApprovedProofToBillingCandidate('tenant',fresh,visit,{rateAmount:60})).toMatchObject({ok:false});
});
it('planned-only or reversed times cannot create actual service duration',()=>{
 for(const snap of [{signerName:'Klient'}, {visitTimes:{serviceStartedAt:'2026-09-18T10:00Z',serviceEndedAt:'2026-09-18T09:00Z'}}]){
  const p={...fresh,payloadSnapshot:snap};expect(getProofBillingSourceSnapshot(p,visit).durationMinutes).toBeNull();
  expect(mapApprovedProofToBillingCandidate('tenant',p,visit,{confirmedSource:confirmed})).toMatchObject({ok:false});
 }
});
it.each(['tenant_id','visit_id','proof_id','proof_payload_hash','signature_id','client_id'])('rejects an unrelated %s receipt',field=>{
 expect(mapApprovedProofToBillingCandidate('tenant',fresh,visit,{confirmedSource:{...confirmed,[field]:'other'}})).toMatchObject({ok:false});
});
it('missing rate cannot substitute the planned visit budget',()=>{
 expect(mapApprovedProofToBillingCandidate('tenant',fresh,visit,{confirmedSource:confirmed})).toMatchObject({amountPreviewCents:0});
});
it('fresh stored proof replaces caller snapshot and only a bound candidate receipt succeeds',async()=>{
 const result=await upsertBillingCandidateFromProof('tenant',{...fresh,payloadSnapshot:{signerName:'fake'},signatureId:'fake'});
 expect(result).toMatchObject({ok:true,data:{proofId:'proof',durationMinutes:50}});expect(writes).toHaveLength(1);
 expect(writes[0]?.source_snapshot).toMatchObject({confirmedSource:confirmed});
});
it('missing server capability or failed source verification cannot start any candidate write',async()=>{
 h.rpc.mockResolvedValue({data:null,error:{message:'RPC absent'}});expect((await upsertBillingCandidateFromProof('tenant',fresh)).ok).toBe(false);expect(writes).toHaveLength(0);
 h.rpc.mockImplementation((name:string)=>Promise.resolve(name==='workflow_assignment_record_capability'?{data:'workflow-assignment-record-v1',error:null}:{data:null,error:{code:'42501',message:'denied'}}));
 expect((await upsertBillingCandidateFromProof('tenant',fresh)).ok).toBe(false);expect(writes).toHaveLength(0);
});
it('fresh proof/hash/read failures propagate and never create partial truth',async()=>{
 h.fresh.mockResolvedValue({ok:false,error:'proof read failed'});expect(await upsertBillingCandidateFromProof('tenant',fresh)).toEqual({ok:false,error:'proof read failed'});
 h.fresh.mockResolvedValue({ok:true,data:{...fresh,payloadHash:'sha256:tampered'}});expect((await upsertBillingCandidateFromProof('tenant',fresh)).ok).toBe(false);expect(writes).toHaveLength(0);
 h.table.mockImplementation(()=>({select(){return this;},eq(){return this;},maybeSingle:()=>Promise.resolve({data:null,error:{message:'read failed'}})}));
 await expect(fetchVisitForBilling('tenant','visit')).rejects.toThrow();
});
it('zero-row or foreign candidate readback never announces successful preparation',async()=>{
 const original=h.table.getMockImplementation()!;h.table.mockImplementation((...args:unknown[])=>{const q=original(...args);if(args[1]==='client_billing_candidates')q.single=()=>Promise.resolve({data:null,error:null});return q;});
 expect((await upsertBillingCandidateFromProof('tenant',fresh)).ok).toBe(false);
});

it('retains the real SupabaseClient receiver when checking the source contract',async()=>{
 h.rpc.mockImplementation(function(this:unknown,name:string){expect(this).toMatchObject({rpc:h.rpc});return Promise.resolve({data:name==='workflow_assignment_record_capability'?'workflow-assignment-record-v1':confirmed,error:null});});
 expect((await upsertBillingCandidateFromProof('tenant',fresh)).ok).toBe(true);
});
