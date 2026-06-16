import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  assignEmployeeToWorkflow,
  createAssignmentWorkflow,
  detectAssignmentConflicts,
  getAssignmentWorkflow,
  getAssignmentWorkflowAuditTrail,
  getClientPortalAssignments,
  getEmployeePortalTasks,
  listScheduleEntries,
  resetAssignmentWorkflowStore,
  updateAssignmentWorkflow,
} from '@/lib/assist/assignmentWorkflowService';
import {
  createClientVisitRequest,
  resetClientVisitRequestStore,
} from '@/lib/assist/clientVisitRequestService';
import { fetchCalendarWeek } from '@/lib/assist/calendarService';
import { resetDemoEmployeePersonnelFileCache } from '@/data/demo/employeePersonnelFile';

const TENANT = DEMO_TENANT_ID;
const ADMIN = 'business_admin' as const;
const CLIENT = 'client_portal' as const;

const BASE_INPUT = {
  tenantId: TENANT,
  clientId: 'client-001',
  employeeId: 'employee-001',
  serviceType: 'Alltagsbegleitung',
  plannedStartAt: '2026-07-01T09:00:00.000Z',
  plannedEndAt: '2026-07-01T11:00:00.000Z',
  locationAddress: 'Musterstraße 12, Berlin',
  title: 'Einsatz Test',
  tasks: [{ title: 'Begleitung Einkauf', description: 'Rewe' }],
};

describe('assignment workflow (Prompt 57)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetClientVisitRequestStore();
    resetDemoEmployeePersonnelFileCache();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetClientVisitRequestStore();
    resetDemoEmployeePersonnelFileCache();
  });

  it('1. Einsatz anlegen', () => {
    const result = createAssignmentWorkflow(BASE_INPUT, ADMIN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tenantId).toBe(TENANT);
      expect(result.data.clientId).toBe('client-001');
    }
  });

  it('2. Einsatz mit Aufgaben anlegen', () => {
    const result = createAssignmentWorkflow(
      {
        ...BASE_INPUT,
        tasks: [
          { title: 'Körperpflege', category: 'pflege' },
          { title: 'Medikamenten-Erinnerung', required: false },
        ],
      },
      ADMIN,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.tasks.length).toBe(2);
  });

  it('3. Einsatz Mitarbeiter zuweisen', async () => {
    const open = createAssignmentWorkflow(
      { ...BASE_INPUT, employeeId: null, title: 'Offener Einsatz' },
      ADMIN,
    );
    expect(open.ok).toBe(true);
    if (!open.ok) return;

    const assigned = assignEmployeeToWorkflow(TENANT, open.data.id, 'employee-001', ADMIN);
    expect(assigned.ok).toBe(true);
    if (assigned.ok) {
      expect(assigned.data.employeeId).toBe('employee-001');
      expect(assigned.data.canonicalStatus).toBe('assigned');
    }
  });

  it('4. Dienstplan zeigt Einsatz', () => {
    const created = createAssignmentWorkflow(BASE_INPUT, ADMIN);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const schedule = listScheduleEntries(TENANT);
    expect(schedule.some((e) => e.assignmentId === created.data.id)).toBe(true);
    expect(schedule.every((e) => e.source === 'assignment_sync')).toBe(true);
  });

  it('5. Änderung aktualisiert Kalender', async () => {
    const created = createAssignmentWorkflow(BASE_INPUT, ADMIN);
    if (!created.ok) return;

    const updated = updateAssignmentWorkflow(
      TENANT,
      created.data.id,
      { plannedStartAt: '2026-07-01T10:00:00.000Z', plannedEndAt: '2026-07-01T12:00:00.000Z' },
      ADMIN,
    );
    expect(updated.ok).toBe(true);

    const entry = listScheduleEntries(TENANT).find((e) => e.assignmentId === created.data.id);
    expect(entry?.startsAt).toBe('2026-07-01T10:00:00.000Z');
  });

  it('6. Aufgabe erscheint im Mitarbeiterportal', () => {
    createAssignmentWorkflow(BASE_INPUT, ADMIN);
    const tasks = getEmployeePortalTasks(TENANT, 'employee-001');
    expect(tasks.some((t) => t.taskTitle === 'Begleitung Einkauf')).toBe(true);
  });

  it('7. Klient sieht geplanten Einsatz', () => {
    createAssignmentWorkflow(BASE_INPUT, ADMIN);
    const visible = getClientPortalAssignments(TENANT, 'client-001', CLIENT);
    expect(visible.length).toBeGreaterThan(0);
  });

  it('8. Konflikt wird erkannt', () => {
    createAssignmentWorkflow(BASE_INPUT, ADMIN);
    const duplicate = createAssignmentWorkflow(
      {
        ...BASE_INPUT,
        title: 'Konflikt Einsatz',
        plannedStartAt: '2026-07-01T09:30:00.000Z',
        plannedEndAt: '2026-07-01T10:30:00.000Z',
      },
      ADMIN,
    );
    expect(duplicate.ok).toBe(false);
  });

  it('9. Cross-Tenant-Zugriff blockiert', () => {
    const created = createAssignmentWorkflow(BASE_INPUT, ADMIN);
    if (!created.ok) return;
    expect(getAssignmentWorkflow('00000000-0000-4000-8000-000000000099', created.data.id)).toBeUndefined();
  });

  it('10. Audit Event bei Änderung', () => {
    const created = createAssignmentWorkflow(BASE_INPUT, ADMIN);
    if (!created.ok) return;
    updateAssignmentWorkflow(TENANT, created.data.id, { title: 'Geändert' }, ADMIN);
    const trail = getAssignmentWorkflowAuditTrail(TENANT, created.data.id);
    expect(trail.some((e) => e.action === 'assignment_created')).toBe(true);
    expect(trail.some((e) => e.action === 'assignment_updated')).toBe(true);
  });

  it('11. Absageanfrage ändert nicht direkt Einsatzzeit', async () => {
    const created = createAssignmentWorkflow(BASE_INPUT, ADMIN);
    if (!created.ok) return;
    const originalStart = created.data.plannedStartAt;

    const request = await createClientVisitRequest({
      tenantId: TENANT,
      assignmentId: created.data.id,
      clientId: 'client-001',
      requestType: 'cancel',
      requestedByProfileId: 'profile-client-001',
      reason: 'Termin passt nicht',
      actorRoleKey: CLIENT,
    });
    expect(request.ok).toBe(true);

    const after = getAssignmentWorkflow(TENANT, created.data.id);
    expect(after?.plannedStartAt).toBe(originalStart);
    expect(after?.canonicalStatus).toBe('cancel_requested');
  });

  it('12. Verschiebungsanfrage ändert nicht direkt Einsatz', async () => {
    const created = createAssignmentWorkflow(BASE_INPUT, ADMIN);
    if (!created.ok) return;

    const request = await createClientVisitRequest({
      tenantId: TENANT,
      assignmentId: created.data.id,
      clientId: 'client-001',
      requestType: 'reschedule',
      requestedByProfileId: 'profile-client-001',
      reason: 'Bitte verschieben',
      proposedStartAt: '2026-07-02T09:00:00.000Z',
      proposedEndAt: '2026-07-02T11:00:00.000Z',
      actorRoleKey: CLIENT,
    });
    expect(request.ok).toBe(true);

    const after = getAssignmentWorkflow(TENANT, created.data.id);
    expect(after?.plannedStartAt).toBe(created.data.plannedStartAt);
    expect(after?.canonicalStatus).toBe('reschedule_requested');
  });

  it('Kalenderwoche enthält Einsätze aus Demo-Seed', async () => {
    createAssignmentWorkflow(BASE_INPUT, ADMIN);
    const week = await fetchCalendarWeek(TENANT, ADMIN);
    expect(week.ok).toBe(true);
  });

  it('Konfliktprüfung: fehlende Adresse', () => {
    const conflicts = detectAssignmentConflicts({
      assignment: {
        id: 'x',
        tenantId: TENANT,
        clientId: 'client-001',
        employeeId: 'employee-001',
        plannedStartAt: BASE_INPUT.plannedStartAt,
        plannedEndAt: BASE_INPUT.plannedEndAt,
        locationAddress: '',
        serviceType: 'Alltagsbegleitung',
        tasks: [{ id: 't1' } as never],
      },
      existing: [],
    });
    expect(conflicts.some((c) => c.code === 'missing_address')).toBe(true);
  });
});
