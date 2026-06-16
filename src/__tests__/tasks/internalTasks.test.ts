import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { createManagementTask } from '@/lib/assist/managementTaskService';
import { resetLiveMonitorStore } from '@/lib/assist/liveMonitorStore';
import {
  assignInternalTask,
  addTaskComment,
  canViewTask,
  createInternalTask,
  createTaskFromMessage,
  fetchInternalTasks,
  listInternalTasks,
  listTaskComments,
  updateInternalTaskStatus,
} from '@/lib/tasks/internalTaskService';
import { resetInternalTaskStore } from '@/lib/tasks/internalTaskStore';
import {
  addTeamThreadComment,
  archiveTeamThread,
  assertCommentSensitivityForChannel,
  createTeamThread,
  fetchTeamThreads,
  isThreadUnread,
  listTeamThreads,
  markThreadRead,
} from '@/lib/tasks/teamCommunicationService';
import { triggerWithDefaultChannel } from '@/lib/tasks/taskAutoTriggerService';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';

describe('Interne Aufgaben & Tickets (Prompt 69)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetInternalTaskStore();
    resetLiveMonitorStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetInternalTaskStore();
    resetLiveMonitorStore();
  });

  it('1. erstellt interne Aufgabe mit tenant_id', () => {
    const task = createInternalTask({
      tenantId: TENANT,
      taskType: 'general',
      title: 'Test',
      description: 'Beschreibung',
    });
    expect(task.tenantId).toBe(TENANT);
    expect(task.isInternalOnly).toBe(true);
  });

  it('2. Klient:innen sehen interne Aufgaben nicht', () => {
    const task = createInternalTask({
      tenantId: TENANT,
      taskType: 'client_request',
      title: 'Anfrage',
      description: 'Intern',
    });
    expect(canViewTask(task, 'client_portal')).toBe(false);
  });

  it('3. Mitarbeitende sehen nur zugewiesene Aufgaben', () => {
    const task = createInternalTask({
      tenantId: TENANT,
      taskType: 'employee_request',
      title: 'MA-Anfrage',
      description: 'Intern',
      employeeVisible: true,
      assignedToEmployeeId: 'emp-1',
    });
    expect(canViewTask(task, 'employee_portal', 'user-1', 'emp-1')).toBe(true);
    expect(canViewTask(task, 'employee_portal', 'user-2', 'emp-2')).toBe(false);
  });

  it('4. erstellt Aufgabe aus Klient:innennachricht ohne Portal-Sichtbarkeit', () => {
    const task = createTaskFromMessage({
      tenantId: TENANT,
      messageId: 'msg-1',
      title: 'Rückruf',
      description: 'Bitte zurückrufen',
      source: 'client_message',
    });
    expect(task.source).toBe('client_message');
    expect(task.isInternalOnly).toBe(true);
    expect(canViewTask(task, 'client_portal')).toBe(false);
  });

  it('5. kritische Aufgaben werden priorisiert gefiltert', () => {
    createInternalTask({
      tenantId: TENANT,
      taskType: 'emergency_followup',
      priority: 'critical',
      title: 'Notfall',
      description: 'Sofort',
    });
    createInternalTask({
      tenantId: TENANT,
      taskType: 'general',
      priority: 'low',
      title: 'Normal',
      description: 'Später',
    });

    const critical = listInternalTasks(TENANT, {
      view: 'critical',
      actorRoleKey: 'business_admin',
    });
    expect(critical).toHaveLength(1);
    expect(critical[0]?.priority).toBe('critical');
  });

  it('6. überfällige Aufgaben werden erkannt', () => {
    createInternalTask({
      tenantId: TENANT,
      taskType: 'billing_blocker',
      title: 'Rechnung',
      description: 'Blockiert',
      dueAt: new Date(Date.now() - 86_400_000).toISOString(),
    });

    const overdue = listInternalTasks(TENANT, {
      view: 'overdue',
      actorRoleKey: 'business_admin',
    });
    expect(overdue.length).toBeGreaterThan(0);
  });

  it('7. verknüpft management_tasks aus Prompt 65', () => {
    const mgmt = createManagementTask({
      tenantId: TENANT,
      assignmentId: 'asg-1',
      taskType: 'client_cancel_request',
      description: 'Absage',
      priority: 'high',
    });

    const linked = listInternalTasks(TENANT, { actorRoleKey: 'business_admin' }).find(
      (t) => t.managementTaskId === mgmt.id,
    );
    expect(linked).toBeDefined();
    expect(linked?.taskType).toBe('assignment_change');
  });

  it('8. Auto-Trigger erzeugt Aufgabe und Team-Thread', () => {
    const task = triggerWithDefaultChannel({
      tenantId: TENANT,
      trigger: 'invoice_blocked',
      description: 'Rechnung gesperrt',
      linkedEntityType: 'invoice',
      linkedEntityId: 'inv-1',
    });
    expect(task.taskType).toBe('billing_blocker');
    const threads = listTeamThreads(TENANT, { channelKey: 'billing' });
    expect(threads.some((t) => t.linkedTaskId === task.id)).toBe(true);
  });

  it('9. interne Kommentare sind für Klient:innen unsichtbar', () => {
    const task = createInternalTask({
      tenantId: TENANT,
      taskType: 'correction',
      title: 'Korrektur',
      description: 'Prüfen',
    });
    addTaskComment({
      tenantId: TENANT,
      taskId: task.id,
      body: 'Interner Hinweis',
      visibility: 'internal',
    });
    addTaskComment({
      tenantId: TENANT,
      taskId: task.id,
      body: 'Für MA sichtbar',
      visibility: 'employee',
    });

    expect(listTaskComments(TENANT, task.id, 'client_portal')).toHaveLength(0);
    expect(listTaskComments(TENANT, task.id, 'employee_portal')).toHaveLength(1);
    expect(listTaskComments(TENANT, task.id, 'business_admin').length).toBe(2);
  });

  it('10. blockiert sensible Daten im falschen Kanal', () => {
    const health = assertCommentSensitivityForChannel('billing', 'health_data');
    expect(health.allowed).toBe(false);
    const billing = assertCommentSensitivityForChannel('employee_questions', 'billing');
    expect(billing.allowed).toBe(false);
  });

  it('11. Team-Threads unterstützen Kommentare, Lesestatus und Archiv', () => {
    const thread = createTeamThread({
      tenantId: TENANT,
      channelKey: 'dispatch',
      title: 'Planung',
      createdByUserId: 'admin-1',
    });
    addTeamThreadComment({
      tenantId: TENANT,
      threadId: thread.id,
      body: 'Bitte prüfen @team',
      authorDisplayName: 'Admin',
      mentions: ['team'],
    });
    expect(isThreadUnread(TENANT, thread.id, 'user-2')).toBe(true);
    markThreadRead(TENANT, thread.id, 'user-2');
    expect(isThreadUnread(TENANT, thread.id, 'user-2')).toBe(false);
    archiveTeamThread(TENANT, thread.id);
    expect(listTeamThreads(TENANT).find((t) => t.id === thread.id)).toBeUndefined();
  });

  it('12. Zuweisung und Statuswechsel sind auditierbar', () => {
    const task = createInternalTask({
      tenantId: TENANT,
      taskType: 'correction',
      title: 'Korrektur',
      description: 'Prüfen',
    });
    assignInternalTask(TENANT, task.id, 'admin-2');
    const updated = updateInternalTaskStatus(TENANT, task.id, 'resolved');
    expect(updated?.status).toBe('resolved');
    expect(updated?.resolvedAt).toBeTruthy();
  });

  it('13. isoliert Mandanten — kein Cross-Tenant', async () => {
    createInternalTask({
      tenantId: TENANT,
      taskType: 'general',
      title: 'A',
      description: 'A',
    });
    createInternalTask({
      tenantId: OTHER_TENANT,
      taskType: 'general',
      title: 'B',
      description: 'B',
    });

    const result = await fetchInternalTasks(
      TENANT,
      { actorRoleKey: 'business_admin' },
      'business_admin',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.every((t) => t.tenantId === TENANT)).toBe(true);
    }
  });

  it('14. Portale dürfen Teamkommunikation nicht abrufen', async () => {
    const result = await fetchTeamThreads(TENANT, {}, 'client_portal');
    expect(result.ok).toBe(false);
  });
});
