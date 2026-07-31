import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePayrollPerformedMinutes } from '@/lib/payroll/payrollMonthService';

const payrollService = readFileSync(
  join(process.cwd(), 'src/lib/payroll/payrollMonthService.ts'),
  'utf8',
);
const payrollScreen = readFileSync(
  join(process.cwd(), 'src/screens/office/PayrollMonthOverviewScreen.tsx'),
  'utf8',
);
const timeAccountScreen = readFileSync(
  join(process.cwd(), 'src/components/wfm/TimeTrackingTeamScreen.tsx'),
  'utf8',
);
const historyPanel = readFileSync(
  join(process.cwd(), 'src/components/wfm/WfmOfficeTimeHistoryPanel.tsx'),
  'utf8',
);
const timekeepingService = readFileSync(
  join(process.cwd(), 'src/lib/wfm/wfmOfficeTimekeepingService.ts'),
  'utf8',
);
const realtimePreset = readFileSync(
  join(process.cwd(), 'src/lib/realtime/presets.ts'),
  'utf8',
);
const asyncQueryHook = readFileSync(
  join(process.cwd(), 'src/hooks/core/useAsyncQuery.ts'),
  'utf8',
);

describe('Payroll und WFM verwenden einen gemeinsamen aktuellen Datenstand', () => {
  it('calculates payroll actuals from the same WFM time accounts as Office', () => {
    expect(payrollService).toContain('getWfmOfficeEmployeeTimeAccounts');
    expect(payrollService).toContain('assignmentActualMinutes');
    expect(payrollService).toContain('dokumentation_offen');
    expect(payrollService).toContain('unterschrift_offen');
    expect(payrollService).not.toContain('const actualWorkMinutes = account?.actualMinutes ?? 0');
    expect(payrollService).not.toContain(
      "fromUnknownTable(supabase, 'workforce_work_sessions').select('employee_id, work_date, net_minutes",
    );
  });

  it('counts performed assignments even while documentation or signature remains open', () => {
    const julyAssignments = [
      [181, 'unterschrift_offen'], [240, 'abgeschlossen'], [150, 'abgeschlossen'],
      [180, 'abgeschlossen'], [150, 'abgeschlossen'], [240, 'abgeschlossen'],
      [150, 'dokumentation_offen'], [150, 'abgeschlossen'], [240, 'abgeschlossen'],
      [150, 'abgeschlossen'], [120, 'abgeschlossen'], [120, 'abgeschlossen'],
      [120, 'abgeschlossen'], [240, 'abgeschlossen'], [150, 'abgeschlossen'],
      [150, 'abgeschlossen'], [120, 'abgeschlossen'], [120, 'abgeschlossen'],
      [120, 'unterschrift_offen'], [150, 'unterschrift_offen'],
    ] as const;
    const actualMinutes = julyAssignments.reduce((sum, [plannedMinutes, status]) =>
      sum + resolvePayrollPerformedMinutes({ status, plannedMinutes }), 0);

    expect(actualMinutes).toBe(3_241);
    expect(resolvePayrollPerformedMinutes({ status: 'bestaetigt', plannedMinutes: 120 })).toBe(0);
    expect(resolvePayrollPerformedMinutes({
      status: 'unterschrift_offen',
      explicitMinutes: 127,
      plannedMinutes: 120,
    })).toBe(127);
  });

  it('refreshes reviews, time accounts and payroll through the shared WFM subscription', () => {
    expect(historyPanel).toContain('subscribe: subscribeToWfmLiveChanges');
    expect(timeAccountScreen).toContain('subscribe: subscribeToWfmLiveChanges');
    expect(payrollScreen).toContain('subscribe: subscribeToWfmLiveChanges');
    expect(realtimePreset).toContain("table: 'workforce_time_entry_reviews'");
    expect(realtimePreset).toContain("table: 'workforce_time_accounts'");
    expect(realtimePreset).toContain("table: 'payroll_month_statements'");
  });

  it('refreshes both the live team and employee accounts manually', () => {
    expect(timeAccountScreen).toContain(
      'Promise.all([teamQuery.refresh(), accountsQuery.refresh()])',
    );
  });

  it('queues a new refresh when a realtime event arrives during an active request', () => {
    expect(asyncQueryHook).toContain('refreshQueuedRef.current = true');
    expect(asyncQueryHook).toContain('while (refreshQueuedRef.current)');
  });

  it('ignores stale pending reviews that were created for future assignments', () => {
    expect(timekeepingService).toContain("entry.rowKind === 'planned_upcoming'");
    expect(timekeepingService).toContain("reviewStatus: 'open'");
  });
});
