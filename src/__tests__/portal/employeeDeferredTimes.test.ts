import { describe, expect, it, vi } from 'vitest';
import type { WfmOfficeTimeEntry, WfmOfficePlannedVisit } from '@/types/modules/wfmOfficeTimekeeping';
import type { WfmTimeEntryReview } from '@/lib/wfm/wfmTimeReviewService';
import { employeeDeferredTimes } from '@/lib/portal/employeeDeferredTimeModel.web';
import { officeReviewIdentity } from '@/lib/wfm/wfmOfficeReviewIntegrity';
import { deferredPayrollEntry, payrollTimeRegistry, resolvePayrollCatchUp } from '@/lib/payroll/payrollTimeDeferral.web';
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => null }));
const tenantId = '11111111-1111-4111-8111-111111111111', employeeId = '22222222-2222-4222-8222-222222222222';
const id = (i: number) => `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`;
const now = Date.parse('2026-11-04T12:00:00Z'), revision = '2026-11-03T12:00:00Z';
function entry(i: number, extra: Partial<WfmOfficeTimeEntry> = {}): WfmOfficeTimeEntry {
  return { id: `visit:${id(i)}:2026-10-31`, tenantId, employeeId, employeeName: 'Test Person', workDate: '2026-10-31',
    assignmentId: id(i), visitId: id(i), sessionId: null, assignmentTitle: 'Begleitung', clientLabel: `Klient ${i}`,
    plannedStartAt: `2026-10-31T${String(6+i).padStart(2,'0')}:00:00Z`, plannedEndAt: `2026-10-31T${String(7+i).padStart(2,'0')}:00:00Z`,
    actualStartAt: '2026-10-31T06:00:00Z', actualEndAt: null, assignmentStatus: 'completed', rowKind: 'planned_with_actual',
    grossMinutes: 0, netMinutes: 0, pauseMinutes: 0, travelMinutes: 0, reviewStatus: 'approved', status: 'approved', exportStatus: 'export_ready',
    source: 'portal', workKind: 'einsatz', flags: [], officeComment: null, hasOpenOfficeMessage: false,
    startDeviationMinutes: null, endDeviationMinutes: null, startAmpel: null, endAmpel: null, overallAmpel: null,
    startJustification: null, endJustification: null, startJustificationAt: null, endJustificationAt: null, ...extra };
}
function review(selected: WfmOfficeTimeEntry, extra: Partial<WfmTimeEntryReview> = {}): WfmTimeEntryReview {
  const identity = officeReviewIdentity(selected);
  return { id: id(80), tenantId, ...identity, referenceId: identity.referenceId,
    reviewStatus: 'approved', exportStatus: 'export_ready', exportBlocking: false, updatedAt: revision,
    reviewNote: null, officeComment: null, reviewedAt: revision, reviewedBy: id(99), ...extra };
}
function fixture(entries = [entry(1)]) {
  return { tenantId, employeeId, now, entries, visits: [] as WfmOfficePlannedVisit[], reviews: entries.map(e => review(e)), statements: [] as Record<string, unknown>[],
    visitSources: entries.filter(e => e.visitId).map(e => ({ id: e.visitId!, updatedAt: revision })),
    sessionSources: entries.filter(e => e.sessionId).map(e => ({ id: e.sessionId!, updatedAt: revision })) };
}
describe('employee follow-up uses the payroll source identities', () => {
  it('shows all 16 deferred rows, including completed visits, a missing capture and standalone work', () => {
    const rows = Array.from({length:14}, (_, i) => entry(i+1));
    rows.push(entry(15, { id: `session:${id(40)}`, visitId: null, assignmentId: null, sessionId: id(40), clientLabel: null, assignmentTitle: undefined, rowKind: 'session_only' }));
    const input = fixture(rows);
    input.visits.push({ tenantId, employeeId, assignmentId:id(16), visitId:id(16), workDate:'2026-10-28',
      plannedStartAt:'2026-10-28T14:00:00Z',plannedEndAt:'2026-10-28T15:00:00Z',assignmentActualStartAt:null,assignmentActualEndAt:null,
      clientLabel:'Fehlende Zeiterfassung',assignmentTitle:'Begleitung',assignmentStatus:'completed' });
    input.visitSources.push({ id:id(16),updatedAt:revision });
    const tasks=employeeDeferredTimes(input);
    expect(tasks).toHaveLength(16);
    expect(tasks.filter(t=>t.state==='correction_needed')).toHaveLength(16);
    expect(tasks.find(t=>t.referenceId===id(16))?.reason).toBe('missing');
    expect(tasks.find(t=>t.entryKind==='session')).toMatchObject({label:'Arbeitszeit',visitRouteId:null});
  });
  it('retains pending review after submission and only makes approved corrections available to the next month', () => {
    const original=entry(1), input=fixture([original]), deferred=deferredPayrollEntry(original,'incomplete');
    input.statements=[{tenant_id:tenantId,employee_id:employeeId,period_year:2026,period_month:10,version:1,status:'published',deferred_time_entries:[deferred]}];
    const saved={...original,actualEndAt:'2026-10-31T07:30:00Z',grossMinutes:90,netMinutes:90,source:'correction' as const,reviewStatus:'pending_review' as const};
    input.reviews=[review(original,{reviewStatus:'pending_review',officeEntry:saved,reviewedAt:null,reviewedBy:null})];
    expect(employeeDeferredTimes(input)).toEqual([expect.objectContaining({state:'awaiting_review',entry:expect.objectContaining({netMinutes:90})})]);
    const registry=payrollTimeRegistry(input.statements,employeeId);
    expect(resolvePayrollCatchUp(registry,[saved],2026,11,now).catchUp).toEqual([]);
    input.reviews=[review(original,{officeEntry:{...saved,reviewStatus:'approved'}})];
    expect(employeeDeferredTimes(input)).toEqual([]);
    const approved={...saved,reviewStatus:'approved' as const};
    expect(resolvePayrollCatchUp(registry,[approved],2026,11,now,[{id:id(70),employeeId,deferredKey:deferred.key,targetYear:2026,targetMonth:11,reviewId:id(80),reviewUpdatedAt:revision,updatedAt:revision,entry:approved}]).catchUp).toEqual([expect.objectContaining({minutes:90,workDate:'2026-10-31'})]);
    expect(resolvePayrollCatchUp(registry,[approved],2026,10,now).catchUp).toEqual([]);
  });
  it('does not confuse another tenant, employee or repeated occurrence with the selected work', () => {
    const own=entry(1), other=entry(2,{employeeId:id(90)}), foreign=entry(3,{tenantId:id(91)});
    expect(employeeDeferredTimes(fixture([own,other,foreign])).map(t=>t.id)).toEqual([own.id]);
  });
  it('shows locked/exported work for Office clarification and does not offer an employee edit', () => {
    const input=fixture(); input.reviews=[review(input.entries[0],{exportStatus:'exported'})];
    expect(employeeDeferredTimes(input)[0].state).toBe('office_required');
  });
  it('keeps missing historical sources visible across years and skips settled sources', () => {
    const original=entry(1,{workDate:'2025-12-31'}), pending=deferredPayrollEntry(original,'incomplete');
    const input=fixture([]);input.statements=[{tenant_id:tenantId,employee_id:employeeId,period_year:2025,period_month:12,version:1,status:'superseded',deferred_time_entries:[pending]}];
    expect(employeeDeferredTimes(input)).toEqual([expect.objectContaining({workDate:'2025-12-31',state:'office_required'})]);
    input.statements.push({tenant_id:tenantId,employee_id:employeeId,period_year:2026,period_month:1,version:1,status:'published',catch_up_time_entries:[{...pending,sourceEntryId:original.id,minutes:90,travelMinutes:0}]});
    expect(employeeDeferredTimes(input)).toEqual([]);
  });
  it('does not duplicate a published deferral alongside its live source', () => {
    const input=fixture(), pending=deferredPayrollEntry(input.entries[0],'incomplete');
    input.statements=[{tenant_id:tenantId,employee_id:employeeId,period_year:2026,period_month:10,version:1,status:'published',deferred_time_entries:[pending]}];
    expect(employeeDeferredTimes(input)).toHaveLength(1);
  });
  it('shows published visits sharing a session once and retains an orphan source for Office', () => {
    const sharedSession = id(40);
    const rows = [entry(1, { sessionId: sharedSession }), entry(2, { sessionId: sharedSession })];
    const orphan = entry(3, { sessionId: sharedSession, assignmentId: null, clientLabel: null, assignmentTitle: 'Arbeitszeit',
      rowKind: 'session_only', plannedStartAt: null, plannedEndAt: null });
    const input = fixture([...rows, orphan]);
    input.visitSources = input.visitSources.filter(source => source.id !== orphan.visitId);
    input.statements = [{ tenant_id: tenantId, employee_id: employeeId, period_year: 2026, period_month: 10, version: 1,
      status: 'published', deferred_time_entries: [...rows, orphan].map(row => deferredPayrollEntry(row, 'incomplete')) }];
    const tasks = employeeDeferredTimes(input);
    expect(tasks).toHaveLength(3);
    expect(tasks.filter(task => task.state === 'correction_needed')).toHaveLength(2);
    expect(tasks.find(task => task.id === orphan.id)).toMatchObject({ label: 'Arbeitszeit', state: 'office_required' });
  });
});
