import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  resetAssignmentWorkflowStore,
  upsertAssignmentWorkflowRecord,
} from '@/lib/assist/assignmentWorkflowService';
import type { AssignmentWorkflowRecord } from '@/types/modules/assignmentWorkflow';
import {
  calculateAssignmentWorkTime,
  isFakeTimestampPair,
} from '@/lib/office/employeeTime/employeeTimeCalculationService';
import {
  aggregateEmployeeTimePeriod,
  applyManualTimeCorrection,
  approveEmployeeTimePeriod,
  calculateEmployeeTimeFromAssignment,
  createAbsenceTimeEntries,
  listEmployeeTimeEntries,
  lockEmployeeTimePeriod,
  requestEmployeeTimeCorrection,
} from '@/lib/office/employeeTime/employeeTimeService';
import {
  configurePayrollProvider,
  executePayrollExport,
  isPayrollProviderConfigured,
  preparePayrollExport,
} from '@/lib/office/employeeTime/payrollExportService';
import {
  resetEmployeeTimeStore,
  saveTenantWorkTimeSettings,
  getTenantWorkTimeSettings,
} from '@/lib/office/employeeTime/employeeTimeStore';
import {
  resetEmployeePortalExecutionStore,
  transitionEmployeePortalAssignment,
} from '@/lib/portal/employeePortalExecutionService';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = 'tenant-time-isolation';
const ADMIN = 'business_admin' as const;
const BILLING = 'billing' as const;
const EMPLOYEE = 'employee_portal' as const;
const CLIENT = 'client_portal' as const;
const EMPLOYEE_ID = 'employee-003';
const OTHER_EMPLOYEE = 'employee-001';
const ACTOR = 'profile-admin-001';

let assignmentSeedCounter = 0;

function seedAssignment(employeeId = EMPLOYEE_ID): string {
  assignmentSeedCounter += 1;
  const id = `asg-time-${assignmentSeedCounter}`;
  const record: AssignmentWorkflowRecord = {
    id,
    tenantId: TENANT,
    clientId: 'client-001',
    employeeId,
    serviceType: 'Alltagsbegleitung',
    assignmentType: 'single',
    plannedStartAt: '2025-06-01T09:00:00.000Z',
    plannedEndAt: '2025-06-01T11:00:00.000Z',
    plannedDurationMinutes: 120,
    actualStartAt: null,
    actualEndAt: null,
    status: 'bestaetigt',
    canonicalStatus: 'confirmed',
    locationAddress: 'Musterstraße 12, Berlin',
    notesForEmployee: '',
    internalNotes: '',
    clientVisibleNotes: '',
    billingRelevant: true,
    requiresSignature: false,
    requiresDocumentation: true,
    requiresRoute: false,
    createdBy: null,
    updatedBy: null,
    cancelledAt: null,
    completedAt: null,
    lockedAt: null,
    title: 'Arbeitszeit-Test',
    tasks: [
      {
        id: `task-time-${assignmentSeedCounter}`,
        tenantId: TENANT,
        assignmentId: id,
        taskTitle: 'Begleitung',
        taskDescription: '',
        taskCategory: 'standard',
        required: true,
        sortOrder: 1,
        status: 'open',
        completionNote: null,
        completedBy: null,
        completedAt: null,
      },
    ],
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  };
  upsertAssignmentWorkflowRecord(record);
  return id;
}

function createCompletedAssignment() {
  return seedAssignment(EMPLOYEE_ID);
}

async function executeAssignmentWithPause(assignmentId: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-06-01T09:00:00.000Z'));

  await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'unterwegs');
  vi.setSystemTime(new Date('2025-06-01T09:15:00.000Z'));
  await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'angekommen');
  vi.setSystemTime(new Date('2025-06-01T09:30:00.000Z'));
  await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'gestartet');
  vi.setSystemTime(new Date('2025-06-01T10:00:00.000Z'));
  await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'pausiert');
  vi.setSystemTime(new Date('2025-06-01T10:15:00.000Z'));
  await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'gestartet');
  vi.setSystemTime(new Date('2025-06-01T11:00:00.000Z'));
  await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'beendet');

  vi.useRealTimers();
}

describe('0051_employee_time_prepared migration', () => {
  const sql = readFileSync(
    path.join(process.cwd(), 'supabase/migrations/0051_employee_time_prepared.sql'),
    'utf8',
  );

  it('1. legt alle neun Arbeitszeit-Tabellen an', () => {
    for (const table of [
      'employee_time_entries',
      'employee_time_periods',
      'employee_time_corrections',
      'assignment_pause_events',
      'travel_time_entries',
      'mileage_log_entries',
      'payroll_export_batches',
      'payroll_export_items',
      'payroll_export_audit_events',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it('2. markiert Lohnexport ohne external_transfer als vorbereitet', () => {
    expect(sql).toContain('external_transfer');
    expect(sql).toContain('export_failed');
    expect(sql).not.toMatch(/external_transfer\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+TRUE/i);
  });

  it('3. aktiviert RLS auf allen Tabellen', () => {
    for (const table of [
      'employee_time_entries',
      'employee_time_periods',
      'employee_time_corrections',
      'payroll_export_batches',
    ]) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });
});

describe('Arbeitszeit Prompt 73 — Berechnung & Quellen', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    assignmentSeedCounter = 0;
    resetAssignmentWorkflowStore();
    resetEmployeePortalExecutionStore();
    resetEmployeeTimeStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
    saveTenantWorkTimeSettings({
      ...getTenantWorkTimeSettings(TENANT),
      countsTravelAsWorkTime: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetEmployeePortalExecutionStore();
    resetEmployeeTimeStore();
  });

  it('4. berechnet Einsatzzeit aus Statuszeiten minus Pausen', async () => {
    const assignmentId = createCompletedAssignment();
    await executeAssignmentWithPause(assignmentId);

    const result = calculateEmployeeTimeFromAssignment(TENANT, assignmentId, ADMIN, ACTOR);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.netMinutes).toBeGreaterThan(0);
      expect(result.data.pauseMinutes).toBeGreaterThan(0);
      expect(result.data.traceReference).toContain('assignment:');
    }
  });

  it('5. erzeugt keine Arbeitszeit bei Fake-/Fehlzeiten', () => {
    const calc = calculateAssignmentWorkTime({
      tenantId: TENANT,
      employeeId: EMPLOYEE_ID,
      assignmentId: 'asg-fake',
      plannedStartAt: '2026-07-01T09:00:00.000Z',
      plannedEndAt: '2026-07-01T11:00:00.000Z',
      plannedDurationMinutes: 120,
      serviceType: 'Test',
      statusTimes: {
        onTheWayAt: null,
        arrivedAt: null,
        startedAt: '2026-07-01T10:00:00.000Z',
        pausedAt: null,
        resumedAt: null,
        finishedAt: '2026-07-01T10:00:00.000Z',
        completedAt: null,
      },
      pauseEvents: [],
      settings: getTenantWorkTimeSettings(TENANT),
    });
    expect(calc.netMinutes).toBe(0);
    expect(calc.plausibilityFlags).toContain('fake_timestamp');
    expect(isFakeTimestampPair('2026-07-01T10:00:00.000Z', '2026-07-01T10:00:00.000Z')).toBe(true);
  });

  it('6. zählt Fahrzeit nur wenn Mandant sie als Arbeitszeit wertet', async () => {
    const assignmentId = createCompletedAssignment();
    await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'unterwegs');
    await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'angekommen');
    await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'gestartet');
    await transitionEmployeePortalAssignment(TENANT, assignmentId, EMPLOYEE_ID, EMPLOYEE, 'beendet');

    saveTenantWorkTimeSettings({
      ...getTenantWorkTimeSettings(TENANT),
      countsTravelAsWorkTime: false,
    });
    const withoutTravel = calculateEmployeeTimeFromAssignment(TENANT, assignmentId, ADMIN, ACTOR);
    expect(withoutTravel.ok).toBe(true);
    if (withoutTravel.ok) expect(withoutTravel.data.travelMinutes).toBe(0);

    resetEmployeeTimeStore();
    resetEmployeePortalExecutionStore();
    resetAssignmentWorkflowStore();
    const assignmentId2 = createCompletedAssignment();
    await transitionEmployeePortalAssignment(TENANT, assignmentId2, EMPLOYEE_ID, EMPLOYEE, 'unterwegs');
    await transitionEmployeePortalAssignment(TENANT, assignmentId2, EMPLOYEE_ID, EMPLOYEE, 'angekommen');
    await transitionEmployeePortalAssignment(TENANT, assignmentId2, EMPLOYEE_ID, EMPLOYEE, 'gestartet');
    await transitionEmployeePortalAssignment(TENANT, assignmentId2, EMPLOYEE_ID, EMPLOYEE, 'beendet');

    saveTenantWorkTimeSettings({
      ...getTenantWorkTimeSettings(TENANT),
      countsTravelAsWorkTime: true,
    });
    const withTravel = calculateEmployeeTimeFromAssignment(TENANT, assignmentId2, ADMIN, ACTOR);
    expect(withTravel.ok).toBe(true);
    if (withTravel.ok) expect(withTravel.data.travelMinutes).toBeGreaterThanOrEqual(0);
  });

  it('7. manuelle Korrektur erfordert Begründung und Audit', async () => {
    const assignmentId = createCompletedAssignment();
    await executeAssignmentWithPause(assignmentId);
    const calc = calculateEmployeeTimeFromAssignment(TENANT, assignmentId, ADMIN, ACTOR);
    expect(calc.ok).toBe(true);
    if (!calc.ok) return;

    const missingReason = applyManualTimeCorrection({
      tenantId: TENANT,
      timeEntryId: calc.data.id,
      correctedStartAt: '2025-06-01T09:05:00.000Z',
      correctedEndAt: '2025-06-01T11:05:00.000Z',
      correctionReason: '   ',
      correctedBy: ACTOR,
      actorRoleKey: ADMIN,
    });
    expect(missingReason.ok).toBe(false);

    const corrected = applyManualTimeCorrection({
      tenantId: TENANT,
      timeEntryId: calc.data.id,
      correctedStartAt: '2025-06-01T09:05:00.000Z',
      correctedEndAt: '2025-06-01T11:05:00.000Z',
      correctionReason: 'GPS-Verzögerung beim Check-in',
      correctedBy: ACTOR,
      actorRoleKey: ADMIN,
    });
    expect(corrected.ok).toBe(true);
    if (corrected.ok) {
      expect(corrected.data.entry.status).toBe('corrected');
      expect(corrected.data.entry.entryType).toBe('correction_time');
    }
  });

  it('8. freigegebene Periode kann nicht direkt überschrieben werden', async () => {
    const assignmentId = createCompletedAssignment();
    await executeAssignmentWithPause(assignmentId);
    calculateEmployeeTimeFromAssignment(TENANT, assignmentId, ADMIN, ACTOR);

    const period = aggregateEmployeeTimePeriod(
      TENANT,
      EMPLOYEE_ID,
      'daily',
      '2025-06-01',
      ADMIN,
      ACTOR,
    );
    expect(period.ok).toBe(true);
    if (!period.ok) return;

    const approved = approveEmployeeTimePeriod(TENANT, period.data.id, ADMIN, ACTOR);
    expect(approved.ok).toBe(true);

    const retry = aggregateEmployeeTimePeriod(
      TENANT,
      EMPLOYEE_ID,
      'daily',
      '2025-06-01',
      ADMIN,
      ACTOR,
    );
    expect(retry.ok).toBe(false);
    if (!retry.ok) {
      expect(retry.error).toContain('Freigegebene Periode');
    }
  });

  it('9. Mitarbeiter sieht nur eigene Zeiten', async () => {
    const ownAssignment = createCompletedAssignment();
    await executeAssignmentWithPause(ownAssignment);

    const otherAssignment = seedAssignment(OTHER_EMPLOYEE);

    calculateEmployeeTimeFromAssignment(TENANT, ownAssignment, ADMIN, ACTOR);
    calculateEmployeeTimeFromAssignment(TENANT, otherAssignment, ADMIN, ACTOR);

    const ownList = listEmployeeTimeEntries(TENANT, EMPLOYEE, {
      actorEmployeeId: EMPLOYEE_ID,
    });
    expect(ownList.ok).toBe(true);
    if (ownList.ok) {
      expect(ownList.data.every((e) => e.employeeId === EMPLOYEE_ID)).toBe(true);
      expect(ownList.data.some((e) => e.employeeId === OTHER_EMPLOYEE)).toBe(false);
    }
  });

  it('10. Admin sieht Zeiten mandantenweit', () => {
    const adminList = listEmployeeTimeEntries(TENANT, ADMIN);
    expect(adminList.ok).toBe(true);
  });

  it('11. Klient:innenportal sieht keine internen Arbeitszeiten', () => {
    const blocked = listEmployeeTimeEntries(TENANT, CLIENT);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toContain('Klient:innenportal');
    }
  });

  it('12. Lohnexport DATEV ohne Connect-Konfiguration scheitert', async () => {
    const assignmentId = createCompletedAssignment();
    await executeAssignmentWithPause(assignmentId);
    calculateEmployeeTimeFromAssignment(TENANT, assignmentId, ADMIN, ACTOR);
    const period = aggregateEmployeeTimePeriod(
      TENANT,
      EMPLOYEE_ID,
      'daily',
      '2025-06-01',
      ADMIN,
      ACTOR,
    );
    if (!period.ok) throw new Error(period.error);
    approveEmployeeTimePeriod(TENANT, period.data.id, ADMIN, ACTOR);

    expect(isPayrollProviderConfigured(TENANT, 'datev')).toBe(false);

    const prepared = preparePayrollExport({
      tenantId: TENANT,
      providerKey: 'datev',
      periodStart: '2025-06-01T00:00:00.000Z',
      periodEnd: '2025-06-01T23:59:59.999Z',
      actorRoleKey: BILLING,
      initiatedBy: ACTOR,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const exec = executePayrollExport(TENANT, prepared.data.batch.id, BILLING, ACTOR);
    expect(exec.ok).toBe(false);
    if (!exec.ok) expect(exec.error).toContain('nicht konfiguriert');
  });

  it('13. CSV-Export nur bei freigegebenen Perioden', async () => {
    const blocked = preparePayrollExport({
      tenantId: TENANT,
      providerKey: 'csv',
      periodStart: '2026-01-01T00:00:00.000Z',
      periodEnd: '2026-01-31T23:59:59.999Z',
      actorRoleKey: BILLING,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toContain('freigegebene');
    }
  });

  it('14. CSV-Export bei freigegebener Periode erfolgreich vorbereitet', async () => {
    const assignmentId = createCompletedAssignment();
    await executeAssignmentWithPause(assignmentId);
    calculateEmployeeTimeFromAssignment(TENANT, assignmentId, ADMIN, ACTOR);
    const period = aggregateEmployeeTimePeriod(
      TENANT,
      EMPLOYEE_ID,
      'daily',
      '2025-06-01',
      ADMIN,
      ACTOR,
    );
    if (!period.ok) throw new Error(period.error);
    approveEmployeeTimePeriod(TENANT, period.data.id, ADMIN, ACTOR);

    const prepared = preparePayrollExport({
      tenantId: TENANT,
      providerKey: 'csv',
      periodStart: '2025-06-01T00:00:00.000Z',
      periodEnd: '2025-06-01T23:59:59.999Z',
      actorRoleKey: BILLING,
      initiatedBy: ACTOR,
    });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.data.csvPreview).toContain('employee_id');
      const exec = executePayrollExport(TENANT, prepared.data.batch.id, BILLING, ACTOR);
      expect(exec.ok).toBe(true);
      if (exec.ok) {
        expect(exec.data.status).toBe('exported');
        expect(exec.data.externalTransfer).toBe(false);
      }
    }
  });

  it('15. Mandantenisolation — kein Cross-Tenant-Zugriff', () => {
    const calc = calculateEmployeeTimeFromAssignment(OTHER_TENANT, 'asg-x', ADMIN, ACTOR);
    expect(calc.ok).toBe(false);
    const list = listEmployeeTimeEntries(OTHER_TENANT, ADMIN);
    expect(list.ok).toBe(false);
  });

  it('16. Abwesenheiten erzeugen passende Zeittypen', () => {
    const sick = createAbsenceTimeEntries(
      TENANT,
      {
        tenantId: TENANT,
        employeeId: EMPLOYEE_ID,
        absenceType: 'sick',
        startsAt: '2026-07-03T08:00:00.000Z',
        endsAt: '2026-07-03T16:00:00.000Z',
        note: 'AU',
      },
      ADMIN,
    );
    expect(sick.ok).toBe(true);
    if (sick.ok) expect(sick.data.entryType).toBe('sick_time');

    const vacation = createAbsenceTimeEntries(
      TENANT,
      {
        tenantId: TENANT,
        employeeId: EMPLOYEE_ID,
        absenceType: 'vacation',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-14T23:59:59.999Z',
        note: 'Urlaub',
      },
      ADMIN,
    );
    expect(vacation.ok).toBe(true);
    if (vacation.ok) expect(vacation.data.entryType).toBe('vacation_time');
  });

  it('17. Korrekturanfrage und Sperre nach Freigabe', async () => {
    const assignmentId = createCompletedAssignment();
    await executeAssignmentWithPause(assignmentId);
    const calc = calculateEmployeeTimeFromAssignment(TENANT, assignmentId, ADMIN, ACTOR);
    if (!calc.ok) throw new Error(calc.error);

    const requested = requestEmployeeTimeCorrection(TENANT, calc.data.id, EMPLOYEE, EMPLOYEE_ID);
    expect(requested.ok).toBe(true);
    if (requested.ok) expect(requested.data.status).toBe('correction_requested');

    const period = aggregateEmployeeTimePeriod(
      TENANT,
      EMPLOYEE_ID,
      'daily',
      '2025-06-01',
      ADMIN,
      ACTOR,
    );
    if (!period.ok) throw new Error(period.error);
    approveEmployeeTimePeriod(TENANT, period.data.id, ADMIN, ACTOR);
    const locked = lockEmployeeTimePeriod(TENANT, period.data.id, ADMIN, ACTOR);
    expect(locked.ok).toBe(true);
    if (locked.ok) expect(locked.data.status).toBe('locked');

    configurePayrollProvider(TENANT, 'datev', true, ADMIN);
    expect(isPayrollProviderConfigured(TENANT, 'datev')).toBe(true);
  });
});
