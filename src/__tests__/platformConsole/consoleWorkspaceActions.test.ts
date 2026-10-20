import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock=vi.hoisted(()=>({rpc:vi.fn(),createPlan:vi.fn(),createVersion:vi.fn(),setFlag:vi.fn(),release:vi.fn()}));
vi.mock('@/lib/platformConsole/index',()=>({PLATFORM_ROLE_LABELS:{platform_owner:'Owner',platform_readonly:'Lesen'},createPlatformPlan:mock.createPlan,createPlatformPlanVersion:mock.createVersion,setPlatformFeatureFlag:mock.setFlag,registerPlatformRelease:mock.release}));
vi.mock('@/lib/platformConsole/platformSupabaseClient',()=>({platformRpc:mock.rpc}));
vi.mock('@/lib/platformConsole/platformCompanyDirectoryService',()=>({listPlatformCompanies:vi.fn()}));
vi.mock('@/lib/services/mode',()=>({getServiceMode:()=> 'supabase'}));
import { consoleActions, type ConsoleData } from '@/lib/platformConsole/consoleWorkspaceService';
const data:ConsoleData={rows:[],tenants:[{tenantId:'tenant-a',tenantName:'Beispiel A'},{tenantId:'tenant-b',tenantName:'Beispiel B'}],related:[{id:'invoice-a',tenant_id:'tenant-a',invoice_number:'TEST-1',amount_cents:10000,status:'open'}],warnings:[],hasMore:false};
beforeEach(()=>{vi.clearAllMocks();mock.rpc.mockResolvedValue({data:{id:'saved'},error:null});mock.createPlan.mockResolvedValue({ok:true,data:{}});mock.createVersion.mockResolvedValue({ok:true,data:{}});mock.setFlag.mockResolvedValue({ok:true,data:{}});mock.release.mockResolvedValue({ok:true,data:{}});});
describe('Platform Console actions',()=>{
  it.each(['plans','addons','discounts','billing','payments'] as const)('offers no creation or assignment for retired %s even with existing catalog data',section=>{
    expect(consoleActions(section,null,data)).toEqual([]);
    expect(consoleActions(section,{plan_key:'free_platform',addon_key:'sms_pack',status:'active'},data)).toEqual([]);
    expect(mock.rpc).not.toHaveBeenCalled();expect(mock.createPlan).not.toHaveBeenCalled();
  });
  it('requires a tenant for scoped flags and bounds rollout',async()=>{const action=consoleActions('feature-flags',null,data)[0];await expect(action.run({key:'feature_v2',scope:'tenant',tenant:'',enabled:'true',rollout:'100'},'Freigabe geprüft')).rejects.toThrow();await expect(action.run({key:'feature_v2',scope:'global',enabled:'true',rollout:'101'},'Freigabe geprüft')).rejects.toThrow();expect(mock.setFlag).not.toHaveBeenCalled();});
  it('does not infer successful checks from a ready release',async()=>{await consoleActions('releases',null,data)[0].run({version:'Test-1',environment:'preview',status:'ready',commit:'abcdef0',url:'',migration:'',build:'not_checked',smoke:'failed',visual:'not_checked',notes:''},'Prüfstand dokumentiert');expect(mock.release.mock.calls[0][0].checks).toEqual({build:'not_checked',smoke:'failed',visual:'not_checked',recorded_in_console:true});});
  it('never offers editing for protected settings or provider-owned payments',()=>{expect(consoleActions('system',{setting_key:'smtp_config',value:'secret',is_sensitive:true},data)).toEqual([]);expect(consoleActions('payments',{provider:'stripe'},data)).toEqual([]);});
});
