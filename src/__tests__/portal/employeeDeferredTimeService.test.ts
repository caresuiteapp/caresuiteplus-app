import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEmployeeDeferredTimes, submitEmployeeDeferredTime } from '@/lib/portal/employeeDeferredTimeService.web';
import type { EmployeeDeferredTime } from '@/lib/portal/employeeDeferredTimeModel.web';
const h=vi.hoisted(()=>({rows:{} as Record<string,Record<string,unknown>[]>,queries:[] as {table:string;filters:[string,unknown][];from:number}[],fail:'',rpc:vi.fn(),planned:vi.fn()}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({rpc:h.rpc})}));
vi.mock('@/lib/services/mode',()=>({getServiceMode:()=> 'supabase'}));
vi.mock('@/lib/services/liveServiceGuard',()=>({guardServiceTenant:()=>null}));
vi.mock('@/lib/wfm/wfmOfficePlannedVisitRepository.web',()=>({listPlannedVisitsForPeriod:(...args:any[])=>h.planned(...args),fetchActiveEmployeeIds:vi.fn()}));
vi.mock('@/lib/supabase/untypedTable',()=>({fromUnknownTable:(_db:any,table:string)=>{
  const filters:[string,unknown][]=[];
  const query:any={select:()=>query,eq:(k:string,v:unknown)=>{filters.push([k,v]);return query;},lte:()=>query,order:()=>query,
    range:async(from:number,to:number)=>{h.queries.push({table,filters,from});return {data:(h.rows[table]??[]).slice(from,to+1),error:h.fail===table?{message:'Quelle nicht verfügbar'}:null};}};
  return query;
}}));
const t='11111111-1111-4111-8111-111111111111',e='22222222-2222-4222-8222-222222222222',s='33333333-3333-4333-8333-333333333333';
const revision='2026-11-01T12:00:00Z';
const session=(id=s)=>({id,tenant_id:t,employee_id:e,user_id:'actor',work_date:'2026-10-31',status:'clocked_in',work_mode:'office',
  started_at:'2026-10-31T08:00:00Z',ended_at:null,pause_minutes:0,net_minutes:0,gross_minutes:0,is_online:false,updated_at:revision});
beforeEach(()=>{vi.clearAllMocks();h.rows={'workforce_work_sessions':[session()]};h.queries=[];h.fail='';h.planned.mockResolvedValue({ok:true,data:[]});});
describe('employee-only deferred source reads',()=>{
  it('loads the same standalone work and scopes every read and planned-visit request to its owner',async()=>{
    const result=await loadEmployeeDeferredTimes(t,e,'employee_portal');expect(result.ok).toBe(true);
    if(result.ok)expect(result.data[0]).toMatchObject({id:`session:${s}`,state:'correction_needed',entryKind:'session',sourceUpdatedAt:revision});
    for(const query of h.queries)expect(query.filters).toEqual([['tenant_id',t],['employee_id',e]]);
    expect(h.planned).toHaveBeenCalledWith(t,'2026-10-31',expect.any(String),{employeeId:e});
  });
  it('paginates beyond the server default instead of silently omitting old work',async()=>{
    h.rows.workforce_work_sessions=Array.from({length:1201},(_,i)=>session(`33333333-3333-4333-8333-${String(i).padStart(12,'0')}`));
    const result=await loadEmployeeDeferredTimes(t,e,'employee_portal');expect(result.ok).toBe(true);
    if(result.ok)expect(result.data).toHaveLength(1201);
    expect(h.queries.some(q=>q.table==='workforce_work_sessions'&&q.from>=1000)).toBe(true);
  });
  it('reports failed or foreign reads rather than returning an empty complete list',async()=>{
    h.fail='workforce_time_entry_reviews';expect((await loadEmployeeDeferredTimes(t,e,'employee_portal')).ok).toBe(false);
    h.fail='';h.rows.workforce_work_sessions=[{...session(),employee_id:s}];expect((await loadEmployeeDeferredTimes(t,e,'employee_portal')).ok).toBe(false);
  });
  it('rejects an unlinked account and never substitutes an Office role to bypass access checks',async()=>{
    expect((await loadEmployeeDeferredTimes(t,'','employee_portal')).ok).toBe(false);
    expect((await loadEmployeeDeferredTimes(t,e,'business_admin')).ok).toBe(false);expect(h.queries).toEqual([]);
  });
});
describe('deferred correction submission',()=>{
  const task={id:`session:${s}`,state:'correction_needed',entryKind:'session',referenceId:s,workDate:'2026-10-31',sourceUpdatedAt:revision,reviewUpdatedAt:null,entry:{id:`session:${s}`}} as EmployeeDeferredTime;
  const input={task,startedAt:'2026-10-31T08:00:00Z',endedAt:'2026-10-31T09:00:00Z',pauseMinutes:0,reason:'Nachtrag'};
  it('sends only source, actuals, reason and expected revisions, never approval or ownership fields',async()=>{
    h.rpc.mockResolvedValue({data:{ok:true,review_status:'pending_review',review_id:s,entry_id:task.id,updated_at:revision},error:null});
    expect((await submitEmployeeDeferredTime(input)).ok).toBe(true);
    const params=h.rpc.mock.calls[0][1];expect(params).toMatchObject({p_reference_id:s,p_entry_id:task.id,p_expected_source_updated_at:revision,p_expected_review_updated_at:null});
    expect(params).not.toHaveProperty('p_employee_id');expect(params).not.toHaveProperty('p_review_status');expect(params).not.toHaveProperty('p_tenant_id');
  });
  it('requires a confirmed pending-review receipt matching the source',async()=>{
    for(const data of [null,{ok:true},{ok:true,review_status:'approved',review_id:s,entry_id:task.id,updated_at:revision}]){
      h.rpc.mockResolvedValue({data,error:null});expect((await submitEmployeeDeferredTime(input)).ok).toBe(false);
    }
  });
});
