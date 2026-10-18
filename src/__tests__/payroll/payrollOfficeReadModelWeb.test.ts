import { describe, expect, it } from 'vitest';
import type { WfmOfficeEmployeeTimeAccount, WfmOfficePlannedVisit, WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { employeeAssignmentTimeLines, isPayrollEmployeeInPeriod, payrollAbsenceCredits, payrollAbsenceWorkConflicts, payrollBerlinDay, payrollBerlinMidnight, payrollEmploymentRange, payrollPeriodRange, payrollRemainingPlannedMinutes, payrollSettingsIssues, payrollTimeReadiness, resolvePayrollPerformedMinutes } from '@/lib/payroll/payrollOfficeReadModel.web';

function visit(overrides: Partial<WfmOfficePlannedVisit> = {}): WfmOfficePlannedVisit {
  return { tenantId: 'tenant-1', employeeId: 'employee-1', assignmentId: 'assignment-1', visitId: 'visit-1', workDate: '2026-10-12',
    plannedStartAt: '2026-10-12T08:00:00Z', plannedEndAt: '2026-10-12T10:00:00Z', plannedDurationMinutes: 120,
    clientLabel: 'Kundin A', assignmentTitle: 'Begleitung', assignmentStatus: 'confirmed', ...overrides };
}
function entry(overrides: Partial<WfmOfficeTimeEntry> = {}): WfmOfficeTimeEntry {
  return { id: 'entry-1', tenantId: 'tenant-1', employeeId: 'employee-1', workDate: '2026-10-12', assignmentId: 'assignment-1', visitId: 'visit-1',
    plannedStartAt: '2026-10-12T08:00:00Z', plannedEndAt: '2026-10-12T10:00:00Z', actualStartAt: '2026-10-12T08:10:00Z', actualEndAt: '2026-10-12T09:50:00Z',
    plannedDurationMinutes: 120, netMinutes: 90, pauseMinutes: 10, travelMinutes: 0, source: 'portal', reviewStatus: 'approved', rowKind: 'planned_with_actual',
    flags: [], clientLabel: 'Kundin A', ...overrides } as WfmOfficeTimeEntry;
}
function account(entries: WfmOfficeTimeEntry[], actualMinutes = 90): WfmOfficeEmployeeTimeAccount { return { employeeId: 'employee-1', entries, actualMinutes } as WfmOfficeEmployeeTimeAccount; }
const workDays = { mon: 8, tue: 8, wed: 8, thu: 8, fri: 8 };
const absence = { employee_id: 'employee-1', absence_type: 'vacation', status: 'approved', all_day: true, starts_at: '2026-10-12T00:00:00Z', ends_at: '2026-10-13T23:59:59Z' };

describe('Web payroll source assembly', () => {
  it('rejects invalid months and uses Berlin dates independently of browser timezone', () => {
    expect(() => payrollPeriodRange(2026, 13)).toThrow();
    expect(payrollPeriodRange(2024, 2).toDate).toBe('2024-02-29');
    expect(payrollBerlinDay(Date.parse('2026-10-17T22:30:00Z'))).toBe('2026-10-18');
    expect(payrollBerlinMidnight('2026-10-25')).toBe('2026-10-24T22:00:00.000Z');
    expect(payrollBerlinMidnight('2026-10-26')).toBe('2026-10-25T23:00:00.000Z');
  });
  it('retains departed staff in historical months and retained monthly evidence', () => {
    expect(isPayrollEmployeeInPeriod({ status: 'terminated', entry_date: '2025-01-01', exit_date: '2026-09-30' }, '2026-09-01', '2026-09-30', false)).toBe(true);
    expect(isPayrollEmployeeInPeriod({ status: 'terminated', exit_date: '2026-09-30' }, '2026-10-01', '2026-10-31', false)).toBe(false);
    expect(isPayrollEmployeeInPeriod({ status: 'archiviert' }, '2026-10-01', '2026-10-31', true)).toBe(true);
    expect(isPayrollEmployeeInPeriod({ status: 'active', entry_date: '2026-11-01' }, '2026-10-01', '2026-10-31', false)).toBe(false);
  });
  it('clips contractual days to entry and exit dates', () => {
    expect(payrollEmploymentRange({ entry_date: '2026-10-09', exit_date: '2026-10-23' }, '2026-10-01', '2026-10-31')).toEqual({ fromDate: '2026-10-09', toDate: '2026-10-23' });
  });
  it('distinguishes missing wage data and an explicit zero-hour payout limit', () => {
    expect(payrollSettingsIssues(undefined)).not.toEqual([]);
    expect(payrollSettingsIssues({ compensation_type: 'salary', compensation_amount: null })).not.toEqual([]);
    expect(payrollSettingsIssues({ compensation_type: 'hourly', compensation_amount: '20.50', max_payout_hours_month: 0 })).toEqual([]);
    expect(payrollSettingsIssues({ compensation_type: 'hourly', compensation_amount: 'not a number' })).not.toEqual([]);
  });
  it('keeps captured duration and zero net even for completed assignments', () => {
    expect(resolvePayrollPerformedMinutes({ status: 'completed', plannedMinutes: 120, explicitMinutes: 90 })).toBe(90);
    expect(resolvePayrollPerformedMinutes({ status: 'completed', plannedMinutes: 120, explicitMinutes: 0 })).toBe(0);
    expect(resolvePayrollPerformedMinutes({ status: 'completed', plannedMinutes: 120 })).toBe(0);
    expect(employeeAssignmentTimeLines(account([entry()]), [visit()], 'employee-1')[0].actualMinutes).toBe(90);
  });
  it('preserves multiple series occurrences and maps each captured visit only once', () => {
    const visits = [visit(), visit({ workDate: '2026-10-19', plannedStartAt: '2026-10-19T08:00:00Z', plannedEndAt: '2026-10-19T10:00:00Z' })];
    const lines = employeeAssignmentTimeLines(account([entry()]), visits, 'employee-1');
    expect(lines).toHaveLength(2); expect(lines.map(line => line.actualMinutes)).toEqual([90, 0]);
  });
  it('uses client identity for orphan matching and does not merge unrelated same-time work', () => {
    const orphan = entry({ assignmentId: null, visitId: null });
    expect(employeeAssignmentTimeLines(account([orphan]), [visit()], 'employee-1')).toHaveLength(1);
    expect(employeeAssignmentTimeLines(account([entry({ ...orphan, clientLabel: 'Andere Kundin' })]), [visit()], 'employee-1')).toHaveLength(2);
  });
  it('never lets a pair of null visit IDs suppress another remaining planned visit', () => {
    const plan = visit({ assignmentId: 'future', visitId: null, plannedStartAt: '2026-10-12T15:00:00Z', plannedEndAt: '2026-10-12T17:00:00Z' });
    expect(payrollRemainingPlannedMinutes([plan], account([entry({ assignmentId: 'other', visitId: null })]), 'employee-1', Date.parse('2026-10-12T12:00:00Z'))).toBe(120);
  });
  it('does not project past or already conducted work again', () => {
    expect(payrollRemainingPlannedMinutes([visit()], account([entry()]), 'employee-1', Date.parse('2026-10-18T12:00:00Z'))).toBe(0);
    expect(payrollRemainingPlannedMinutes([visit({ assignmentStatus: 'completed' })], undefined, 'employee-1', Date.parse('2026-10-01T12:00:00Z'))).toBe(0);
  });
  it('unions duplicate full-day absences and clips to the selected range', () => {
    const result = payrollAbsenceCredits([absence, absence], workDays, '2026-10-13', '2026-10-31');
    expect(result.vacationMinutes).toBe(480); expect(result.overlap).toBe(false);
  });
  it('caps partial absence credits to the contractual day and exposes cross-type conflicts', () => {
    const partial = { ...absence, all_day: false, starts_at: '2026-10-12T08:00:00Z', ends_at: '2026-10-12T10:00:00Z' };
    expect(payrollAbsenceCredits([partial, { ...partial, starts_at: '2026-10-12T09:00:00Z', ends_at: '2026-10-12T11:00:00Z' }], workDays, '2026-10-01', '2026-10-31').vacationMinutes).toBe(180);
    expect(payrollAbsenceCredits([absence, { ...absence, absence_type: 'sick_leave' }], workDays, '2026-10-01', '2026-10-31').overlap).toBe(true);
  });
  it('identifies work/leave conflicts without blocking adjacent partial-day periods', () => {
    const line = employeeAssignmentTimeLines(account([entry()]), [visit()], 'employee-1');
    expect(payrollAbsenceWorkConflicts([absence], line)).toBe(true);
    expect(payrollAbsenceWorkConflicts([{ ...absence, all_day: false, starts_at: '2026-10-12T06:00:00Z', ends_at: '2026-10-12T08:00:00Z' }], line)).toBe(false);
  });
  it('shows unapproved recorded time provisionally but blocks publication', () => {
    const result = payrollTimeReadiness(account([entry({ reviewStatus: 'pending_review' })]), Date.parse('2026-10-18T12:00:00Z'));
    expect(result.actualWorkMinutes).toBe(90); expect(result.unapprovedEntryCount).toBe(1); expect(result.blockers).not.toEqual([]);
  });
  it('excludes rejected and unfinished session amounts from payable time', () => {
    const result = payrollTimeReadiness(account([entry({ reviewStatus: 'rejected' }), entry({ id: 'open', actualEndAt: null, reviewStatus: 'open', netMinutes: 30 })], 120), Date.parse('2026-10-18T12:00:00Z'));
    expect(result.actualWorkMinutes).toBe(0); expect(result.blockers.length).toBeGreaterThan(1);
  });
  it('marks missing accounts and malformed capture timestamps as uncomputable', () => {
    expect(payrollTimeReadiness(undefined, Date.parse('2026-10-18T12:00:00Z')).calculationIssues.length).toBeGreaterThan(0);
    const invalid = payrollTimeReadiness(account([entry({ actualEndAt: 'invalid' })]), Date.parse('2026-10-18T12:00:00Z'));
    expect(invalid.calculationIssues.length).toBeGreaterThan(0);
    expect(payrollTimeReadiness(account([entry({ actualEndAt: '2026-10-12T07:00:00Z' })]), Date.parse('2026-10-18T12:00:00Z')).calculationIssues.length).toBeGreaterThan(0);
  });

});
