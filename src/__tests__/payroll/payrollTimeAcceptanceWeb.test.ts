import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { mapOfficeReviewRow } from '@/lib/wfm/wfmOfficeTimekeepingReads';
import { deferredPayrollEntry, payrollTimeRegistry } from '@/lib/payroll/payrollTimeDeferral.web';
import { acceptPayrollTime, mapPayrollTimeAcceptance, payrollTimeAcceptanceOptions } from '@/lib/payroll/payrollTimeAcceptance.web';
const h=vi.hoisted(()=>({rpc:vi.fn(),denied:false,tenant:false,connected:true}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>h.connected?{rpc:h.rpc}:null}));
vi.mock('@/lib/permissions',()=>({enforcePermission:()=>h.denied?{ok:false,error:'Keine Berechtigung'}:null,isPortalOnlyRole:(role:string)=>role==='employee_portal'}));
vi.mock('@/lib/services/liveServiceGuard',()=>({guardServiceTenant:()=>h.tenant?{ok:false,error:'Falscher Mandant'}:null}));
vi.mock('@/lib/services/mode',()=>({getServiceMode:()=> 'supabase'}));
const tenant='11111111-1111-4111-8111-111111111111',employee='22222222-2222-4222-8222-222222222222',reviewId='33333333-3333-4333-8333-333333333333';
const revision='2026-11-05T06:00:00Z',now=Date.parse('2026-11-05T07:00:00Z');
const source={id:'manual-time',tenantId:tenant,employeeId:employee,workDate:'2026-10-31',assignmentId:null,visitId:null,sessionId:null,clientLabel:'Test',assignmentTitle:'Begleitung',
  actualStartAt:'2026-10-31T08:00:00Z',actualEndAt:'2026-10-31T09:30:00Z',plannedStartAt:null,plannedEndAt:null,pauseMinutes:0,grossMinutes:90,netMinutes:90,
  source:'correction',reviewStatus:'pending_review',exportStatus:'not_exported',workKind:'einsatz',flags:[], employeeName:'Test Person',
  startDeviationMinutes:null,endDeviationMinutes:null,startAmpel:null,endAmpel:null,overallAmpel:null,
  startJustification:null,endJustification:null,startJustificationAt:null,endJustificationAt:null,
  status:'pending_review',travelMinutes:0,officeComment:null,hasOpenOfficeMessage:false} satisfies WfmOfficeTimeEntry;
const pending=deferredPayrollEntry(source,'incomplete');
const rawReview=()=>({id:reviewId,tenant_id:tenant,employee_id:employee,work_date:source.workDate,entry_kind:'manual',reference_id:reviewId,reference_key:'key',review_status:'pending_review',updated_at:revision,metadata:{office_time_entry:source}});
const record=()=>({id:'44444444-4444-4444-8444-444444444444',tenant_id:tenant,employee_id:employee,deferred_key:pending.key,target_year:2026,target_month:11,
  review_id:reviewId,review_updated_at:revision,updated_at:revision,work_date:source.workDate,office_entry:source});
const registry=()=>payrollTimeRegistry([{employee_id:employee,period_year:2026,period_month:10,version:1,status:'published',deferred_time_entries:[pending]}],employee);
function options(extra:Partial<Parameters<typeof payrollTimeAcceptanceOptions>[0]>={}){return payrollTimeAcceptanceOptions({registry:registry(),reviews:[mapOfficeReviewRow(rawReview())],acceptances:[],statements:[],year:2026,month:10,now,...extra});}
beforeEach(()=>{h.rpc.mockReset().mockResolvedValue({data:record(),error:null});h.denied=false;h.tenant=false;h.connected=true;});
describe('Office period acceptance of employee corrections',()=>{
  it('offers both decisions only for a valid corrected source and shows accepted month without including it in the other',()=>{
    expect(options()[0]).toMatchObject({reviewId,reviewUpdatedAt:revision,currentBlock:null,nextBlock:null,entry:expect.objectContaining({netMinutes:90})});
    const accepted=mapPayrollTimeAcceptance(record());
    expect(options({acceptances:[accepted]})[0]).toMatchObject({currentBlock:null,nextBlock:'Für diesen Monat bereits angenommen.'});
    expect(options({reviews:[]})[0].currentBlock).toContain('Noch keine');
  });
  it('retains a blocked current month and a usable next month, including a year change',()=>{
    const own=options({statements:[{period_year:2026,period_month:10,status:'paid'}]})[0];
    expect(own.currentBlock).toContain('ausgezahlt');expect(own.nextBlock).toBeNull();
    expect(options({year:2026,month:12,statements:[{period_year:2027,period_month:1,status:'locked'}]})[0].nextBlock).toContain('gesperrt');
  });
  it('requires renewed acceptance for modified values and omits settled sources',()=>{
    const accepted=mapPayrollTimeAcceptance(record()),changed=rawReview();changed.metadata.office_time_entry={...source,pauseMinutes:10,netMinutes:80};
    expect(options({acceptances:[accepted],reviews:[mapOfficeReviewRow(changed)]})[0].nextBlock).toBeNull();
    const settled=registry();settled.settled.set(pending.key,{period:2026*12+11,item:{...pending,sourceEntryId:source.id,minutes:90,travelMinutes:0,actualStartAt:source.actualStartAt!,actualEndAt:source.actualEndAt!,reviewedAt:revision}});
    expect(options({registry:settled})).toEqual([]);
  });
  it('submits scope, month and both revisions without accepting caller-supplied minutes or approval state',async()=>{
    const result=await acceptPayrollTime({tenantId:tenant,employeeId:employee,option:options()[0],year:2026,month:11,role:'business_admin'});
    expect(result.ok).toBe(true);expect(h.rpc).toHaveBeenCalledWith('payroll_accept_corrected_time',{
      p_tenant_id:tenant,p_employee_id:employee,p_deferred_key:pending.key,p_review_id:reviewId,p_expected_review_updated_at:revision,
      p_target_year:2026,p_target_month:11,p_expected_acceptance_updated_at:null});
  });
  it('rejects portal access, missing edit permission and wrong tenant before any write',async()=>{
    const args={tenantId:tenant,employeeId:employee,option:options()[0],year:2026,month:11,role:'business_admin' as const};
    expect((await acceptPayrollTime({...args,role:'employee_portal'})).ok).toBe(false);
    h.denied=true;expect((await acceptPayrollTime(args)).ok).toBe(false);h.denied=false;
    h.tenant=true;expect((await acceptPayrollTime(args)).ok).toBe(false);expect(h.rpc).not.toHaveBeenCalled();
  });
  it('does not claim success for a failed or mismatched server confirmation',async()=>{
    const args={tenantId:tenant,employeeId:employee,option:options()[0],year:2026,month:11,role:'business_admin' as const};
    h.rpc.mockResolvedValueOnce({data:null,error:{message:'Inzwischen geändert'}});expect(await acceptPayrollTime(args)).toEqual({ok:false,error:'Inzwischen geändert'});
    h.rpc.mockResolvedValueOnce({data:{...record(),target_month:12},error:null});expect((await acceptPayrollTime(args)).ok).toBe(false);
  });
});
