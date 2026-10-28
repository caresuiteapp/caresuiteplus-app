import { beforeEach, describe, expect, it, vi } from 'vitest';
const h=vi.hoisted(()=>({data:new Map<string,string>(),get:vi.fn(),cache:vi.fn()}));
vi.mock('@/lib/security/protectedDataStorage',()=>({protectedDataStorage:{getAllKeys:async()=>[...h.data.keys()],getItem:h.get}}));
vi.mock('@/lib/offline/assignmentCacheService',()=>({readAssignmentListCache:h.cache}));
import { readDeviceSyncOverview } from '@/lib/offline/deviceSyncOverview';
const scope={tenantId:'tenant-a',userId:'person-a',employeeId:'employee-a',clientId:null,accountId:'account-a',roleKey:'employee_portal'};
beforeEach(()=>{h.data.clear();h.get.mockReset().mockImplementation(async(key:string)=>h.data.get(key)??null);h.cache.mockReset().mockResolvedValue({cachedAt:'2026-10-28T12:00:00Z'});});
describe('visible local draft queue',()=>{
  it('inspects only the exact current person and tenant and does not replay writes',async()=>{
    const task='employee-execution-task-drafts:tenant-a:employee-a:visit-a',doc='portal-visit-workflow-tenant-a:person-a:employee-a:account-a:employee_portal:visit:visit-b';
    h.data.set(task,JSON.stringify({task:{status:'done'}}));h.data.set(doc,JSON.stringify({documentationDraftText:'own draft'}));
    h.data.set('employee-execution-task-drafts:tenant-b:employee-b:foreign','secret');h.data.set('portal-visit-workflow-tenant-a:other-person:employee-a:account-a:employee_portal:visit:foreign','secret');
    const result=await readDeviceSyncOverview(scope);expect(result.pending.map(x=>x.assignmentId)).toEqual(['visit-a','visit-b']);expect(h.get.mock.calls.flat()).toEqual([task,doc]);
  });
  it('does not count server-confirmed documentation or empty task drafts as pending',async()=>{
    h.data.set('employee-execution-task-drafts:tenant-a:employee-a:visit-a','{}');
    h.data.set('portal-visit-workflow-tenant-a:person-a:employee-a:account-a:employee_portal:visit:visit-b',JSON.stringify({documentationDraftText:'saved',documentationSubmitted:true}));
    expect((await readDeviceSyncOverview(scope)).pending).toEqual([]);
  });
  it('surfaces unreadable own storage instead of reporting an empty successful queue',async()=>{
    h.data.set('employee-execution-task-drafts:tenant-a:employee-a:visit-a','broken');await expect(readDeviceSyncOverview(scope)).rejects.toThrow();
  });
});
