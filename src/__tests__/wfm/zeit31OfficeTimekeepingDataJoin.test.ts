import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'demo' }));
import {
  joinOfficeTimekeepingData,
  plannedVisitJoinKey,
} from '@/lib/wfm/wfmOfficeDataJoinService';
import { getWfmOfficeTimeOverview } from '@/lib/wfm/wfmOfficeTimekeepingService';
import {
  resetWfmOfficePlannedVisitDemoStore,
  seedWfmOfficePlannedVisits,
} from '@/lib/wfm/wfmOfficePlannedVisitRepository';
import {
  resetWfmOfficeTimekeepingStore,
  saveManualEntry,
} from '@/lib/wfm/wfmOfficeTimekeepingStore';
import type { WfmOfficePlannedVisit, WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';

const TENANT = 'tenant-zeit31';
const EMP_A = 'emp-a';
const EMP_B = 'emp-b';
const ROLE = 'business_manager' as const;

function planned(overrides: Partial<WfmOfficePlannedVisit> = {}): WfmOfficePlannedVisit {
  return {
    assignmentId: 'asgn-1',
    visitId: 'asgn-1',
    tenantId: TENANT,
    employeeId: EMP_A,
    workDate: '2026-07-04',
    plannedStartAt: '2026-07-04T08:00:00.000Z',
    plannedEndAt: '2026-07-04T09:00:00.000Z',
    clientLabel: 'Erika Mustermann',
    assignmentTitle: 'Einsatz morgen',
    assignmentStatus: 'confirmed',
    ...overrides,
  };
}

function actualEntry(overrides: Partial<WfmOfficeTimeEntry> = {}): WfmOfficeTimeEntry {
  return {
    id: 'visit:asgn-1:2026-07-04',
    tenantId: TENANT,
    employeeId: EMP_A,
    employeeName: 'MA A',
    workDate: '2026-07-04',
    assignmentId: 'asgn-1',
    visitId: 'asgn-1',
    clientLabel: null,
    plannedStartAt: null,
    plannedEndAt: null,
    actualStartAt: '2026-07-04T08:12:00.000Z',
    actualEndAt: '2026-07-04T09:05:00.000Z',
    startDeviationMinutes: null,
    endDeviationMinutes: null,
    startAmpel: null,
    endAmpel: null,
    overallAmpel: null,
    startJustification: null,
    endJustification: null,
    startJustificationAt: null,
    endJustificationAt: null,
    pauseMinutes: 0,
    grossMinutes: 53,
    netMinutes: 53,
    travelMinutes: null,
    workKind: 'einsatz',
    status: 'open',
    source: 'portal',
    reviewStatus: 'open',
    exportStatus: 'not_exported',
    sessionId: 'sess-1',
    officeComment: null,
    hasOpenOfficeMessage: false,
    flags: [],
    ...overrides,
  };
}

describe('ZEIT.3.1 data join', () => {
  const names = new Map([
    [EMP_A, 'Anna A'],
    [EMP_B, 'Bernd B'],
  ]);

  beforeEach(() => {
    resetWfmOfficeTimekeepingStore();
    resetWfmOfficePlannedVisitDemoStore();
  });

  it('merges planned visit with actual times and fills plan fields', () => {
    const rows = joinOfficeTimekeepingData([planned()], [actualEntry()], names);
    expect(rows).toHaveLength(1);
    expect(rows[0].rowKind).toBe('planned_with_actual');
    expect(rows[0].plannedStartAt).toBe('2026-07-04T08:00:00.000Z');
    expect(rows[0].plannedEndAt).toBe('2026-07-04T09:00:00.000Z');
    expect(rows[0].clientLabel).toBe('Erika Mustermann');
    expect(rows[0].startAmpel).toBe('red');
    expect(rows[0].endAmpel).toBe('green');
  });

  it('shows planned visit without actual as missing booking', () => {
    const rows = joinOfficeTimekeepingData([planned()], [], names);
    expect(rows).toHaveLength(1);
    expect(rows[0].rowKind).toBe('planned_missing_actual');
    expect(rows[0].actualStartAt).toBeNull();
    expect(rows[0].flags).toContain('missing_booking');
    expect(rows[0].reviewStatus).toBe('pending_review');
    expect(rows[0].startAmpel).toBeNull();
    expect(rows[0].overallAmpel).toBeNull();
    expect(rows[0].timeSource).toBe('assignment_planned');
    expect(rows[0].displayDurationMinutes).toBeGreaterThan(0);
  });

  it('shows actual without planned assignment as unplanned', () => {
    const rows = joinOfficeTimekeepingData(
      [],
      [
        actualEntry({
          assignmentId: null,
          visitId: null,
          id: 'session:sess-x',
          workKind: 'buero',
        }),
      ],
      names,
    );
    expect(rows[0].rowKind).toBe('unplanned_actual');
    expect(rows[0].flags).toContain('unplanned');
    expect(rows[0].planDisplayStatus).toBe('no_planned_visit');
  });

  it('shows manual office entry as manual_entry row kind', () => {
    const manual = actualEntry({
      id: 'manual-1',
      source: 'manual_addition',
      workKind: 'nachtrag',
      assignmentId: null,
      visitId: null,
    });
    const rows = joinOfficeTimekeepingData([], [manual], names);
    expect(rows[0].rowKind).toBe('manual_entry');
  });

  it('includes all planned visits in period even when no actuals', () => {
    const p1 = planned({ assignmentId: 'asgn-1' });
    const p2 = planned({ assignmentId: 'asgn-2', employeeId: EMP_B, workDate: '2026-07-03' });
    const rows = joinOfficeTimekeepingData([p1, p2], [], names);
    expect(rows).toHaveLength(2);
  });

  it('does not compute ampel when plan time missing', () => {
    const p = planned({ plannedStartAt: null, plannedEndAt: null });
    const rows = joinOfficeTimekeepingData([p], [actualEntry()], names);
    expect(rows[0].startAmpel).toBeNull();
    expect(rows[0].endAmpel).toBeNull();
    expect(rows[0].planDisplayStatus).toBe('plan_missing');
  });

  it('does not compute ampel when actual time missing', () => {
    const rows = joinOfficeTimekeepingData([planned()], [], names);
    expect(rows[0].startAmpel).toBeNull();
    expect(rows[0].actualDisplayStatus).toBe('not_captured');
  });

  it('uses stable join keys per employee and assignment', () => {
    expect(plannedVisitJoinKey(EMP_A, 'asgn-1', '2026-07-04')).toBe('emp-a:asgn-1:2026-07-04');
  });

  it('does not mix data between employees', () => {
    const pA = planned({ assignmentId: 'asgn-a', employeeId: EMP_A });
    const pB = planned({ assignmentId: 'asgn-b', employeeId: EMP_B });
    const aA = actualEntry({ assignmentId: 'asgn-a', employeeId: EMP_A });
    const aB = actualEntry({
      id: 'visit:asgn-b:2026-07-04',
      assignmentId: 'asgn-b',
      visitId: 'asgn-b',
      employeeId: EMP_B,
      employeeName: 'Bernd B',
    });
    const rows = joinOfficeTimekeepingData([pA, pB], [aA, aB], names);
    const rowA = rows.find((r) => r.employeeId === EMP_A)!;
    const rowB = rows.find((r) => r.employeeId === EMP_B)!;
    expect(rowA.assignmentId).toBe('asgn-a');
    expect(rowB.assignmentId).toBe('asgn-b');
  });
});

describe('ZEIT.3.1 office overview KPIs', () => {
  beforeEach(() => {
    resetWfmOfficeTimekeepingStore();
    resetWfmOfficePlannedVisitDemoStore();
  });

  it('counts planned visits, missing bookings and manual entries in overview', async () => {
    seedWfmOfficePlannedVisits(TENANT, [
      planned({ assignmentId: 'asgn-1' }),
      planned({ assignmentId: 'asgn-2', employeeId: EMP_B }),
    ]);

    saveManualEntry({
      ...actualEntry({
        id: 'manual-office',
        source: 'manual_addition',
        workKind: 'nachtrag',
        assignmentId: null,
        visitId: null,
      }),
      reviewStatus: 'pending_review',
    });

    const overview = await getWfmOfficeTimeOverview(TENANT, ROLE, {
      preset: 'custom',
      fromDate: '2026-07-04',
      toDate: '2026-07-04',
    });
    expect(overview.ok).toBe(true);
    expect(overview.data!.kpis.plannedVisits).toBe(2);
    expect(overview.data!.kpis.missingBookings).toBeGreaterThanOrEqual(2);
    expect(overview.data!.entries.some((e) => e.rowKind === 'manual_entry')).toBe(true);
    expect(overview.data!.employees.length).toBeGreaterThanOrEqual(1);
  });
});

describe('ZEIT.3.1 display helpers contract', () => {
  it('UI uses plan/actual formatters instead of raw dashes', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const table = readFileSync(
      join(process.cwd(), 'src/components/wfm/WfmOfficeTimeEntryTable.tsx'),
      'utf8',
    );
    expect(table).toContain('formatWfmPlanTimeRange');
    expect(table).toContain('formatWfmReviewQueueIstLabel');
    expect(table).not.toMatch(/Plan: \{formatWfmTime\(entry\.plannedStartAt\)/);
  });
});
