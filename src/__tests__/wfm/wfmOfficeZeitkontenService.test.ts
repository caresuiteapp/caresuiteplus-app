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
