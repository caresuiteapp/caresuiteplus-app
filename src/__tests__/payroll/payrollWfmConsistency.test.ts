import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
    expect(payrollService).toContain('actualWorkMinutes = account?.actualMinutes ?? 0');
    expect(payrollService).not.toContain(
      "fromUnknownTable(supabase, 'workforce_work_sessions').select('employee_id, work_date, net_minutes",
    );
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
