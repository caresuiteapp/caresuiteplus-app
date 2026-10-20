import { describe, expect, it } from 'vitest';
import {
  summarizeOfficeTimeAccountKpis,
} from '@/lib/wfm/wfmOfficeZeitkontenService';
import type { WfmOfficeEmployeeTimeAccount } from '@/types/modules/wfmOfficeTimekeeping';

describe('wfmOfficeZeitkontenService', () => {
  it('summarizes employee time account KPIs', () => {
    const accounts: WfmOfficeEmployeeTimeAccount[] = [
      {
        employeeId: 'e1',
        employeeName: 'Alex',
        plannedMinutes: 480,
        actualMinutes: 420,
        approvedMinutes: 360,
        exportedMinutes: 300,
        saldoMinutes: -60,
        openReviewCount: 2,
        targetMinutes: 480,
        overtimeMinutes: 0,
        undertimeMinutes: 60,
        travelMinutes: 30,
        absenceMinutes: 0,
        vacationDaysUsed: 5,
        sickDays: 1,
        annualVacationDays: 30,
        remainingVacationDays: 25,
        payrollStatements: [],
        entries: [],
      },
      {
        employeeId: 'e2',
        employeeName: 'Bea',
        plannedMinutes: 240,
        actualMinutes: 300,
        approvedMinutes: 300,
        exportedMinutes: 0,
        saldoMinutes: 60,
        openReviewCount: 0,
        targetMinutes: 240,
        overtimeMinutes: 60,
        undertimeMinutes: 0,
        travelMinutes: 0,
        absenceMinutes: 120,
        vacationDaysUsed: 0,
        sickDays: 0,
        annualVacationDays: 30,
        remainingVacationDays: 30,
        payrollStatements: [],
        entries: [],
      },
    ];
    const kpis = summarizeOfficeTimeAccountKpis(accounts);
    expect(kpis.employees).toBe(2);
    expect(kpis.plannedHours).toBe(12);
    expect(kpis.actualHours).toBe(12);
    expect(kpis.approvedHours).toBe(11);
    expect(kpis.openReviews).toBe(2);
  });
});
