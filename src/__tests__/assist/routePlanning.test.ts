import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  createAssignmentWorkflow,
  resetAssignmentWorkflowStore,
} from '@/lib/assist/assignmentWorkflowService';
import { resetLiveMonitorStore } from '@/lib/assist/liveMonitorStore';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { resetAbsenceStore } from '@/lib/office/absenceStore';
import {
  buildReplacementSuggestions,
  checkEmployeeAvailabilityForPlanning,
  checkEmployeeQualificationForAssignment,
  confirmRoutePlanningChange,
  detectRoutePlanningConflicts,
  estimateTravelTimePlausibility,
  fetchTourView,
  hasBlockingPlanningConflicts,
  listOpenAssignmentsForPlanning,
  listRoutePlanningAuditTrail,
  notifyEmployeeOfPlanningChange,
  resetRoutePlanningStore,
} from '@/lib/assist/routePlanningService';
import { detectRoutePlanningConflictsForAssignment } from '@/lib/assist/routePlanningConflictService';

const TENANT = DEMO_TENANT_ID;
const ADMIN = 'business_admin' as const;
const DISPATCH = 'dispatch' as const;

const BASE_INPUT = {
  tenantId: TENANT,
  clientId: 'client-001',
  employeeId: null as string | null,
  serviceType: 'Alltagsbegleitung',
  plannedStartAt: '2026-08-04T09:00:00.000Z',
  plannedEndAt: '2026-08-04T11:00:00.000Z',
  locationAddress: 'Musterstraße 12, 10115 Berlin',
  title: 'Offener Einsatz',
  tasks: [{ title: 'Begleitung' }],
};

describe('route planning & Vertretung (Tourenplanung)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetRoutePlanningStore();
    resetAssignmentWorkflowStore();
    resetAbsenceStore();
    resetLiveMonitorStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetRoutePlanningStore();
    resetAssignmentWorkflowStore();
    resetAbsenceStore();
    resetLiveMonitorStore();
  });

  it('1. Offene Einsätze werden angezeigt', () => {
    createAssignmentWorkflow(BASE_INPUT, ADMIN);
    createAssignmentWorkflow(
      { ...BASE_INPUT, employeeId: 'employee-001', title: 'Zugewiesen' },
      ADMIN,
    );

    const result = listOpenAssignmentsForPlanning(TENANT, DISPATCH);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBe(1);
      expect(result.data[0]!.title).toBe('Offener Einsatz');
    }

    const audit = listRoutePlanningAuditTrail(TENANT);
    expect(audit.some((e) => e.action === 'open_assignments_viewed')).toBe(true);
  });

  it('2. Vertretungsvorschläge berücksichtigen Qualifikation und Verfügbarkeit', () => {
    const created = createAssignmentWorkflow(
      { ...BASE_INPUT, employeeId: 'employee-001', title: 'Vertretung nötig' },
      ADMIN,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const suggestions = buildReplacementSuggestions(TENANT, created.data.id, ADMIN);
    expect(suggestions.ok).toBe(true);
    if (suggestions.ok) {
      expect(suggestions.data.length).toBeGreaterThan(0);
      expect(suggestions.data.every((s) => s.qualificationMatch)).toBe(true);
      expect(suggestions.data.every((s) => s.availabilityOk)).toBe(true);
      expect(suggestions.data[0]!.score).toBeGreaterThanOrEqual(suggestions.data.at(-1)!.score);
    }
  });

  it('3. Zuweisung ohne Qualifikation wird blockiert', () => {
    const created = createAssignmentWorkflow(BASE_INPUT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const qual = checkEmployeeQualificationForAssignment(
      TENANT,
      'employee-006',
      'Alltagsbegleitung',
      ADMIN,
    );
    expect(qual.ok).toBe(true);
    if (qual.ok) {
      expect(qual.data.assignable).toBe(false);
    }

    const confirm = confirmRoutePlanningChange(
      TENANT,
      {
        assignmentId: created.data.id,
        newEmployeeId: 'employee-006',
        confirmed: true,
      },
      ADMIN,
    );
    expect(confirm.ok).toBe(false);
  });

  it('4. Fahrzeit-Plausibilität als Heuristik ohne Provider', async () => {
    const estimate = estimateTravelTimePlausibility({
      tenantId: TENANT,
      fromAddress: '10115 Berlin',
      toAddress: '10117 Berlin',
    });
    expect(estimate.ok).toBe(true);
    if (estimate.ok) {
      expect(estimate.data.source).toBe('heuristic');
      expect(estimate.data.providerKey).toBeNull();
      expect(estimate.data.disclaimer).toContain('Plausibilität');
    }

    const blocked = estimateTravelTimePlausibility({
      tenantId: TENANT,
      fromAddress: '10115 Berlin',
      toAddress: '80331 München',
      requireProvider: true,
    });
    expect(blocked.ok).toBe(false);
  });

  it('5. Tourenansicht zeigt sortierte Einsätze eines Tages', () => {
    createAssignmentWorkflow(
      {
        ...BASE_INPUT,
        employeeId: 'employee-001',
        title: 'Tour A',
        plannedStartAt: '2026-08-04T14:00:00.000Z',
        plannedEndAt: '2026-08-04T15:00:00.000Z',
      },
      ADMIN,
    );
    createAssignmentWorkflow(
      {
        ...BASE_INPUT,
        employeeId: 'employee-001',
        title: 'Tour B',
        plannedStartAt: '2026-08-04T09:00:00.000Z',
        plannedEndAt: '2026-08-04T10:00:00.000Z',
      },
      ADMIN,
    );

    const tour = fetchTourView(TENANT, 'employee-001', '2026-08-04', DISPATCH);
    expect(tour.ok).toBe(true);
    if (tour.ok) {
      expect(tour.data.routePlan.totalStops).toBe(2);
      expect(tour.data.items[0]!.sortOrder).toBe(0);
      expect(tour.data.items[0]!.plannedArrivalAt).toBe('2026-08-04T09:00:00.000Z');
      expect(tour.data.travelEstimates.length).toBe(1);
    }
  });

  it('6. Konfliktwarnungen bei fehlender Adresse und Überlappung', () => {
    const a = createAssignmentWorkflow(
      {
        ...BASE_INPUT,
        employeeId: 'employee-001',
        title: 'Basis Einsatz',
      },
      ADMIN,
    );
    expect(a.ok).toBe(true);
    if (!a.ok) return;

    const overlapDraft = {
      ...a.data,
      id: 'asg-overlap-test',
      title: 'Überlappung',
      plannedStartAt: '2026-08-04T09:30:00.000Z',
      plannedEndAt: '2026-08-04T11:30:00.000Z',
    };

    const missingAddress = detectRoutePlanningConflictsForAssignment({
      assignment: { ...a.data, locationAddress: '' },
      existing: [a.data],
    });
    expect(missingAddress.some((c) => c.code === 'missing_address')).toBe(true);

    const overlap = detectRoutePlanningConflictsForAssignment({
      assignment: overlapDraft,
      existing: [a.data],
    });
    expect(overlap.some((c) => c.code === 'overlapping_assignment')).toBe(true);
    expect(hasBlockingPlanningConflicts(overlap)).toBe(true);
  });

  it('7. Änderung nur nach Bestätigung und Mitarbeiterbenachrichtigung', () => {
    const created = createAssignmentWorkflow(BASE_INPUT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const withoutConfirm = confirmRoutePlanningChange(
      TENANT,
      { assignmentId: created.data.id, newEmployeeId: 'employee-001', confirmed: false },
      ADMIN,
    );
    expect(withoutConfirm.ok).toBe(false);
    if (!withoutConfirm.ok) {
      expect(withoutConfirm.error).toContain('Bestätigung');
    }

    const withConfirm = confirmRoutePlanningChange(
      TENANT,
      {
        assignmentId: created.data.id,
        newEmployeeId: 'employee-001',
        confirmed: true,
        reason: 'Vertretung bestätigt',
      },
      ADMIN,
    );
    expect(withConfirm.ok).toBe(true);
    if (withConfirm.ok) {
      expect(withConfirm.data.notified).toBe(true);
    }

    const notify = notifyEmployeeOfPlanningChange(
      TENANT,
      {
        assignmentId: created.data.id,
        employeeId: 'employee-001',
        title: 'Neuer Einsatz',
        body: 'Bitte Termin prüfen.',
      },
      ADMIN,
    );
    expect(notify.ok).toBe(true);

    const audit = listRoutePlanningAuditTrail(TENANT);
    expect(audit.some((e) => e.action === 'change_confirmed')).toBe(true);
    expect(audit.some((e) => e.action === 'employee_notified')).toBe(true);
  });

  it('Live-Modus blockiert Demo-Fallbacks', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

    const block = guardLiveDemoFeature(TENANT, 'Touren & Vertretung');
    expect(block?.ok).toBe(false);

    const open = listOpenAssignmentsForPlanning(TENANT, DISPATCH);
    expect(open.ok).toBe(false);
  });

  it('Verfügbarkeitsprüfung ohne Abwesenheit', () => {
    const result = checkEmployeeAvailabilityForPlanning(
      TENANT,
      'employee-001',
      '2026-08-04T09:00:00.000Z',
      '2026-08-04T11:00:00.000Z',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.available).toBe(true);
    }
  });
});
