import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

vi.mock('@/lib/assist/employeeAssignmentEligibilityService', () => ({
  detectEmployeeEligibilityConflicts: () => [],
}));
import {
  createAssignmentWorkflow,
  resetAssignmentWorkflowStore,
} from '@/lib/assist/assignmentWorkflowService';
import { createClientVisitRequest, resetClientVisitRequestStore } from '@/lib/assist/clientVisitRequestService';
import { listManagementTasks } from '@/lib/assist/managementTaskService';
import { listLiveOperationEvents } from '@/lib/assist/liveOperationEventService';
import { listMonitorAuditEvents } from '@/lib/assist/monitorAuditService';
import { listMonitorNotifications } from '@/lib/assist/monitorNotificationService';
import {
  fetchDayMonitor,
  transitionAssignmentLiveStatus,
  wouldEmitFakeLiveData,
} from '@/lib/assist/liveMonitorService';
import { reportEmergency, reportProblem } from '@/lib/assist/problemReportService';
import { resetLiveMonitorStore } from '@/lib/assist/liveMonitorStore';
import { usesFakeLiveDataGenerator } from '@/lib/assist/liveMonitorRealtime';

const TENANT = DEMO_TENANT_ID;
const FOREIGN = '00000000-0000-4000-8000-000000000099';
const ADMIN = 'business_admin' as const;
const EMPLOYEE = 'caregiver' as const;
const CLIENT = 'client_portal' as const;

function todayRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return {
    start: `${y}-${m}-${d}T09:00:00.000Z`,
    end: `${y}-${m}-${d}T11:00:00.000Z`,
  };
}

function createTodayAssignment() {
  const { start, end } = todayRange();
  return createAssignmentWorkflow(
    {
      tenantId: TENANT,
      clientId: 'client-001',
      employeeId: 'employee-003',
      serviceType: 'Alltagsbegleitung',
      plannedStartAt: start,
      plannedEndAt: end,
      locationAddress: 'Musterstraße 12',
      title: 'Monitor Test',
      requiresSignature: true,
      requiresDocumentation: true,
      tasks: [{ title: 'Test' }],
    },
    ADMIN,
  );
}

describe('Live Monitor (Prompt 60)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetClientVisitRequestStore();
    resetLiveMonitorStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetClientVisitRequestStore();
    resetLiveMonitorStore();
  });

  it('1. Statuswechsel erzeugt Live-Event', () => {
    const created = createTodayAssignment();
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = transitionAssignmentLiveStatus(
      TENANT,
      created.data.id,
      'unterwegs',
      { userId: 'user-003', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE },
    );
    expect(result.ok).toBe(true);

    const events = listLiveOperationEvents(TENANT, created.data.id);
    expect(events.some((e) => e.eventType === 'employee_on_the_way')).toBe(true);
  });

  it('2. Statuswechsel erzeugt Audit-Event', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    transitionAssignmentLiveStatus(
      TENANT,
      created.data.id,
      'unterwegs',
      { userId: 'user-003', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE },
    );

    const audit = listMonitorAuditEvents(TENANT, created.data.id);
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.some((e) => e.action === 'employee_on_the_way')).toBe(true);
  });

  it('3. Admin sieht eigenen Mandanten-Status', () => {
    createTodayAssignment();
    const monitor = fetchDayMonitor(TENANT, ADMIN);
    expect(monitor.ok).toBe(true);
    if (monitor.ok) {
      expect(monitor.data.length).toBeGreaterThan(0);
      expect(monitor.data.every((r) => r.tenantId === TENANT)).toBe(true);
    }
  });

  it('4. Admin sieht keine Fremdmandanten-Daten', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    const foreignMonitor = fetchDayMonitor(FOREIGN, ADMIN);
    expect(foreignMonitor.ok).toBe(false);

    const events = listLiveOperationEvents(FOREIGN);
    expect(events.length).toBe(0);

    const tenantEvents = listLiveOperationEvents(TENANT, created.data.id);
    expect(tenantEvents.length).toBeGreaterThan(0);
  });

  it('5. Fehlende Doku erzeugt Aufgabe', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;
    const id = created.data.id;

    transitionAssignmentLiveStatus(TENANT, id, 'unterwegs', {
      userId: 'u', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE,
    });
    transitionAssignmentLiveStatus(TENANT, id, 'angekommen', {
      userId: 'u', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE,
    });
    transitionAssignmentLiveStatus(TENANT, id, 'gestartet', {
      userId: 'u', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE,
    });
    transitionAssignmentLiveStatus(TENANT, id, 'beendet', {
      userId: 'u', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE,
    });
    transitionAssignmentLiveStatus(TENANT, id, 'dokumentation_offen', {
      userId: 'u', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE,
    });

    const tasks = listManagementTasks(TENANT, { assignmentId: id });
    expect(tasks.some((t) => t.taskType === 'missing_documentation')).toBe(true);
  });

  it('6. Fehlende Signatur erzeugt Aufgabe', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;
    const id = created.data.id;

    for (const status of ['unterwegs', 'angekommen', 'gestartet', 'beendet', 'dokumentation_offen', 'unterschrift_offen'] as const) {
      transitionAssignmentLiveStatus(TENANT, id, status, {
        userId: 'u', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE,
      });
    }

    const tasks = listManagementTasks(TENANT, { assignmentId: id });
    expect(tasks.some((t) => t.taskType === 'missing_signature')).toBe(true);
  });

  it('7. Absageanfrage erzeugt Aufgabe', async () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    await createClientVisitRequest({
      tenantId: TENANT,
      assignmentId: created.data.id,
      clientId: 'client-001',
      requestType: 'cancel',
      requestedByProfileId: 'profile-client-001',
      reason: 'Termin passt nicht',
      actorRoleKey: CLIENT,
    });

    const tasks = listManagementTasks(TENANT, { assignmentId: created.data.id });
    expect(tasks.some((t) => t.taskType === 'cancel_review')).toBe(true);
  });

  it('8. Verschiebungsanfrage erzeugt Aufgabe', async () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    await createClientVisitRequest({
      tenantId: TENANT,
      assignmentId: created.data.id,
      clientId: 'client-001',
      requestType: 'reschedule',
      requestedByProfileId: 'profile-client-001',
      reason: 'Bitte verschieben',
      proposedStartAt: '2026-12-01T09:00:00.000Z',
      proposedEndAt: '2026-12-01T11:00:00.000Z',
      actorRoleKey: CLIENT,
    });

    const tasks = listManagementTasks(TENANT, { assignmentId: created.data.id });
    expect(tasks.some((t) => t.taskType === 'reschedule_review')).toBe(true);
  });

  it('9. Problem-Meldung erzeugt kritische Benachrichtigung', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    const report = reportProblem({
      tenantId: TENANT,
      assignmentId: created.data.id,
      employeeId: 'employee-003',
      reportType: 'access_denied',
      description: 'Tür verschlossen',
      actorRoleKey: EMPLOYEE,
    });
    expect(report.ok).toBe(true);

    const adminNotifs = listMonitorNotifications(TENANT, { recipientType: 'admin' });
    expect(adminNotifs.some((n) => n.priority === 'critical')).toBe(true);
  });

  it('10. Notfall-Meldung erzeugt kritische Benachrichtigung', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    const report = reportEmergency({
      tenantId: TENANT,
      assignmentId: created.data.id,
      employeeId: 'employee-003',
      description: 'Sturz gemeldet',
      actorRoleKey: EMPLOYEE,
    });
    expect(report.ok).toBe(true);

    const adminNotifs = listMonitorNotifications(TENANT, { recipientType: 'admin' });
    expect(adminNotifs.some((n) => n.eventType === 'emergency_reported' && n.priority === 'critical')).toBe(true);
  });

  it('11. Mitarbeiter sieht nur eigene Benachrichtigungen', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    reportProblem({
      tenantId: TENANT,
      assignmentId: created.data.id,
      employeeId: 'employee-003',
      reportType: 'callback_required',
      description: 'Rückruf nötig',
      actorRoleKey: EMPLOYEE,
    });

    const own = listMonitorNotifications(TENANT, { recipientType: 'employee', recipientId: 'employee-003' });
    const foreign = listMonitorNotifications(TENANT, { recipientType: 'employee', recipientId: 'employee-999' });
    expect(own.length).toBeGreaterThan(0);
    expect(foreign.length).toBe(0);
  });

  it('12. Klient sieht nur eigene Benachrichtigungen', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    transitionAssignmentLiveStatus(TENANT, created.data.id, 'unterwegs', {
      userId: 'u', roleKey: EMPLOYEE, employeeId: 'employee-003', actorRoleKey: EMPLOYEE,
    });

    const own = listMonitorNotifications(TENANT, { recipientType: 'client', recipientId: 'client-001' });
    const foreign = listMonitorNotifications(TENANT, { recipientType: 'client', recipientId: 'client-999' });
    expect(own.length).toBeGreaterThan(0);
    expect(foreign.length).toBe(0);
  });

  it('13. Production Mode ohne Fake-Live-Daten', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

    expect(usesFakeLiveDataGenerator()).toBe(false);
    expect(wouldEmitFakeLiveData()).toBe(false);

    const monitor = fetchDayMonitor(TENANT, ADMIN);
    expect(monitor.ok).toBe(false);
    if (!monitor.ok) {
      expect(monitor.error).toContain('Live-Monitor');
    }
  });

  it('blockiert Live-Monitor ohne tenant_id', () => {
    const result = fetchDayMonitor('', ADMIN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('tenant_id');
  });

  it('Mitarbeiter darf fremden Einsatz nicht ändern', () => {
    const created = createTodayAssignment();
    if (!created.ok) return;

    const denied = transitionAssignmentLiveStatus(TENANT, created.data.id, 'unterwegs', {
      userId: 'other',
      roleKey: EMPLOYEE,
      employeeId: 'employee-999',
      actorRoleKey: EMPLOYEE,
    });
    expect(denied.ok).toBe(false);
  });
});
