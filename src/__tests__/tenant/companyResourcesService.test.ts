import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyContractInput, CompanyResourcesSnapshot } from '@/types/tenant/companyResources';
import { archiveCompanyResource, getCompanyResourceDeadlines, linkCompanyLogbookVehicle, loadCompanyResources, returnCompanyVehicle, saveCompanyContract } from '@/lib/tenant/companyResourcesService.web';
const h = vi.hoisted(() => ({ rpc: vi.fn(), mode: 'supabase', denied: false, blocked: false }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: h.rpc }) }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => h.mode }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => h.blocked ? { ok: false, error: 'Mandant gesperrt' } : null }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: (_: unknown, permission: string, options?: { effectivePermissions?: readonly string[] }) => h.denied || (options?.effectivePermissions && !options.effectivePermissions.includes(permission)) ? { ok: false, error: 'Keine Berechtigung' } : null }));
const ID = '11111111-1111-4111-8111-111111111111';
const scope = { tenantId: ID, actorRoleKey: 'business_admin' as const };
const contract: CompanyContractInput = { title: 'Büromiete', contractType: 'rent', counterparty: 'Test', reference: null, status: 'active', startsOn: '2026-10-01', endsOn: null, noticeOn: null, noticeRule: null, renewalRule: null, reviewOn: null, responsibleEmployeeId: null, costCents: 10000, paymentInterval: 'monthly', currency: 'EUR', documentId: null, notes: null, entityId: null, siteId: null, departmentId: null };
beforeEach(() => { h.mode='supabase'; h.denied=false; h.blocked=false; h.rpc.mockReset(); h.rpc.mockResolvedValue({ data: { id: ID, version: 1 }, error: null }); });

describe('company resources live RPC adapter', () => {
 it.each(['demo','mock'])('never substitutes fixtures in %s mode', async mode => { h.mode=mode; expect((await loadCompanyResources(scope)).ok).toBe(false); expect(h.rpc).not.toHaveBeenCalled(); });
 it('rejects missing runtime permission before querying', async () => { expect((await loadCompanyResources({ ...scope, effectivePermissions: [] })).ok).toBe(false); expect(h.rpc).not.toHaveBeenCalled(); });
 it('rejects a blocked tenant before querying', async () => { h.blocked=true; expect((await loadCompanyResources(scope)).ok).toBe(false); expect(h.rpc).not.toHaveBeenCalled(); });
 it('uses a single transactional RPC, serializes explicit nullable fields and maps versions', async () => {
  h.rpc.mockResolvedValueOnce({ data: { id: ID, tenant_id: ID, expected_version: 4, policy_number: '123' }, error: null });
  const r=await saveCompanyContract(scope,{...contract,id:ID,expectedVersion:3});
  expect(h.rpc).toHaveBeenCalledWith('company_resources_save',{p_tenant:ID,p_kind:'contract',p_input:expect.objectContaining({id:ID,expected_version:3,cost_cents:10000,entity_id:null,document_id:null})});
  expect(r).toEqual({ok:true,data:{id:ID,tenantId:ID,expectedVersion:4,policyNumber:'123'}});
 });
 it.each([{startsOn:'2026-02-30'},{costCents:-1},{costCents:1.2},{endsOn:'2026-09-30'},{id:ID},{documentId:'https://bad.example/file'}])('rejects invalid inputs %j',async patch=>{expect((await saveCompanyContract(scope,{...contract,...patch})).ok).toBe(false);expect(h.rpc).not.toHaveBeenCalled();});
 it('reports missing server setup as unavailable, never as an empty successful list',async()=>{h.rpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'not found'}});expect(await loadCompanyResources(scope)).toMatchObject({ok:false,unavailable:true});});
 it('reports stale versions and conflicts without inventing success',async()=>{h.rpc.mockResolvedValue({data:null,error:{code:'40001',message:'stale'}});expect(await archiveCompanyResource(scope,'contract',ID,2)).toMatchObject({ok:false,conflict:true,reloadRequired:true});});
 it('guards duplicate submissions until first RPC settles',async()=>{let resolve!: (value:unknown)=>void;h.rpc.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const first=saveCompanyContract(scope,contract);const second=await saveCompanyContract(scope,contract);expect(second.ok).toBe(false);expect(h.rpc).toHaveBeenCalledTimes(1);resolve({data:{id:ID},error:null});expect((await first).ok).toBe(true);});
 it('rejects a return without the known allocation version or actual mileage',async()=>{expect((await returnCompanyVehicle(scope,{id:ID,expectedVersion:0,returnedAt:'2026-10-15T12:00:00Z',returnMileage:50,returnCondition:'Gut'})).ok).toBe(false);expect(h.rpc).not.toHaveBeenCalled();});
 it('links an explicitly selected logbook identity only',async()=>{await linkCompanyLogbookVehicle(scope,{vehicleId:ID,logbookVehicleId:ID,expectedVersion:2});expect(h.rpc).toHaveBeenCalledWith('company_resources_link_logbook',{p_tenant:ID,p_input:{vehicle_id:ID,logbook_vehicle_id:ID,expected_version:2}});});
 it('exposes explicit stored due dates without calculating a legal notice date',()=>{const snapshot={contracts:[{id:ID,title:'Vertrag',status:'active',noticeRule:'3 Monate zum Jahresende',noticeOn:null,endsOn:'2026-12-31',reviewOn:'2026-10-01'},{id:'archived',title:'Alt',status:'archived',noticeOn:'2026-10-01'}],policies:[],vehicles:[],allocations:[]} as unknown as CompanyResourcesSnapshot;const due=getCompanyResourceDeadlines(snapshot,'2026-10-15');expect(due.map(x=>[x.label,x.dueOn,x.overdue])).toEqual([['Wiedervorlage','2026-10-01',true],['Vertragsende','2026-12-31',false]]);});
});
