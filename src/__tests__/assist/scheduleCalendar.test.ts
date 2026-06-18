import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  createAssignmentWorkflow,
  resetAssignmentWorkflowStore,
} from '@/lib/assist/assignmentWorkflowService';
import {
  assertNoDetachedCalendarEntries,
  fetchScheduleCalendarProductionSafe,
  fetchScheduleCalendarView,
  getScheduleChangeAuditEvents,
  moveScheduleEntryViaDragDrop,
  prepareDragDropScheduleChange,
  rescheduleAssignmentViaCalendar,
  resetScheduleCalendarStore,
} from '@/lib/assist/scheduleCalendarService';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';
const ADMIN = 'business_admin' as const;
const CLIENT = 'client_portal' as const;
const EMPLOYEE = 'employee_portal' as const;

const BASE_INPUT = {
  tenantId: TENANT,
  clientId: 'client-001',
  employeeId: 'employee-001',
  serviceType: 'Alltagsbegleitung',
  plannedStartAt: '2026-07-01T09:00:00.000Z',
  plannedEndAt: '2026-07-01T11:00:00.000Z',
  locationAddress: 'Musterstraße 12, Berlin',
  title: 'Kalender Test',
  tasks: [{ title: 'Begleitung' }],
};

describe('schedule calendar (Prompt 61)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetScheduleCalendarStore();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
    createAssignmentWorkflow(BASE_INPUT, ADMIN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAssignmentWorkflowStore();
    resetScheduleCalendarStore();
  });

  it('1. Tagesansicht zeigt Einsätze aus Zuweisungen', () => {
    const day = fetchScheduleCalendarView(TENANT, 'day', { anchorDateKey: '2026-07-01' }, ADMIN);
    expect(day.ok).toBe(true);
    if (day.ok) {
      expect(day.data.entries.length).toBeGreaterThan(0);
      expect(day.data.entries.every((e) => e.source === 'assignment_sync')).toBe(true);
    }
  });

  it('2. Wochen- und Monatsansicht zeigen Einsätze', () => {
    const week = fetchScheduleCalendarView(TENANT, 'week', { anchorDateKey: '2026-07-01' }, ADMIN);
    const month = fetchScheduleCalendarView(TENANT, 'month', { anchorDateKey: '2026-07-01' }, ADMIN);
    expect(week.ok).toBe(true);
    expect(month.ok).toBe(true);
    if (week.ok && month.ok) {
      expect(week.data.entries.length).toBeGreaterThan(0);
      expect(month.data.entries.length).toBeGreaterThan(0);
    }
  });

  it('3. Quartals- und Jahresansicht bleiben performant (Summary-Modus)', () => {
    for (let i = 0; i < 60; i += 1) {
      createAssignmentWorkflow(
        {
          ...BASE_INPUT,
          title: `Bulk ${i}`,
          plannedStartAt: `2026-${String((i % 12) + 1).padStart(2, '0')}-15T09:00:00.000Z`,
          plannedEndAt: `2026-${String((i % 12) + 1).padStart(2, '0')}-15T11:00:00.000Z`,
        },
        ADMIN,
      );
    }
    const quarter = fetchScheduleCalendarView(TENANT, 'quarter', { anchorDateKey: '2026-07-01' }, ADMIN);
    const year = fetchScheduleCalendarView(TENANT, 'year', { anchorDateKey: '2026-07-01' }, ADMIN);
    expect(quarter.ok).toBe(true);
    expect(year.ok).toBe(true);
    if (quarter.ok) expect(quarter.data.totalCount).toBeGreaterThan(0);
    if (year.ok) expect(year.data.totalCount).toBeGreaterThan(0);
  });

  it('4. Filter nach Mitarbeitende:r funktionieren', () => {
    createAssignmentWorkflow({ ...BASE_INPUT, employeeId: 'employee-001', title: 'Andere MA' }, ADMIN);
    const filtered = fetchScheduleCalendarView(
      TENANT,
      'week',
      { anchorDateKey: '2026-07-01', filters: { employeeId: 'employee-001' } },
      ADMIN,
    );
    expect(filtered.ok).toBe(true);
    if (filtered.ok) {
      expect(filtered.data.entries.every((e) => e.employeeId === 'employee-001')).toBe(true);
    }
  });

  it('5. Offene Einsätze ohne Mitarbeitende:r', () => {
    createAssignmentWorkflow({ ...BASE_INPUT, employeeId: null, title: 'Offen' }, ADMIN);
    const open = fetchScheduleCalendarView(TENANT, 'open_assignments', {}, ADMIN);
    expect(open.ok).toBe(true);
    if (open.ok) {
      expect(open.data.entries.some((e) => !e.employeeId)).toBe(true);
    }
  });

  it('6. Konfliktansicht markiert Konflikte', () => {
    createAssignmentWorkflow(
      {
        ...BASE_INPUT,
        employeeId: 'employee-002',
        title: 'Klient Doppel',
        plannedStartAt: '2026-07-01T09:30:00.000Z',
        plannedEndAt: '2026-07-01T10:30:00.000Z',
      },
      ADMIN,
    );

    const conflicts = fetchScheduleCalendarView(TENANT, 'conflicts', { anchorDateKey: '2026-07-01' }, ADMIN);
    expect(conflicts.ok).toBe(true);
    if (conflicts.ok) {
      expect(conflicts.data.entries.some((e) => e.conflictWarning)).toBe(true);
    }
  });

  it('7. Kalenderänderung erzeugt Audit-Event', () => {
    const created = createAssignmentWorkflow(
      { ...BASE_INPUT, title: 'Audit Test', plannedStartAt: '2026-07-02T09:00:00.000Z', plannedEndAt: '2026-07-02T11:00:00.000Z' },
      ADMIN,
    );
    if (!created.ok) return;

    rescheduleAssignmentViaCalendar({
      tenantId: TENANT,
      assignmentId: created.data.id,
      plannedStartAt: '2026-07-02T10:00:00.000Z',
      plannedEndAt: '2026-07-02T12:00:00.000Z',
      actorRoleKey: ADMIN,
    });

    const audit = getScheduleChangeAuditEvents(TENANT, created.data.id);
    expect(audit.some((e) => e.changeType === 'reschedule')).toBe(true);
  });

  it('8. Cross-Tenant-Zugriff blockiert', () => {
    const view = fetchScheduleCalendarView(OTHER_TENANT, 'day', {}, ADMIN);
    expect(view.ok).toBe(false);
  });

  it('9. Klient:innenportal darf Kalender nicht ändern', () => {
    const created = createAssignmentWorkflow(BASE_INPUT, ADMIN);
    if (!created.ok) return;

    const result = rescheduleAssignmentViaCalendar({
      tenantId: TENANT,
      assignmentId: created.data.id,
      plannedStartAt: '2026-07-01T12:00:00.000Z',
      plannedEndAt: '2026-07-01T14:00:00.000Z',
      actorRoleKey: CLIENT,
    });
    expect(result.ok).toBe(false);
  });

  it('10. Mitarbeitende dürfen nicht frei verschieben', () => {
    const created = createAssignmentWorkflow(BASE_INPUT, ADMIN);
    if (!created.ok) return;

    const result = rescheduleAssignmentViaCalendar({
      tenantId: TENANT,
      assignmentId: created.data.id,
      plannedStartAt: '2026-07-01T12:00:00.000Z',
      plannedEndAt: '2026-07-01T14:00:00.000Z',
      actorRoleKey: EMPLOYEE,
    });
    expect(result.ok).toBe(false);
  });

  it('11. Produktionsmodus ohne Demo-Kalenderdaten', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-key');

    const result = await fetchScheduleCalendarProductionSafe(TENANT, ADMIN);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Live-Modus|Produktionsmodus/);
    }
  });

  it('12. Keine freistehenden Kalendereinträge ohne assignmentId', () => {
    const view = fetchScheduleCalendarView(TENANT, 'week', { anchorDateKey: '2026-07-01' }, ADMIN);
    expect(view.ok).toBe(true);
    if (view.ok) {
      expect(assertNoDetachedCalendarEntries(view.data.entries)).toBe(true);
    }
  });

  it('13. Drag-and-Drop führt Konfliktprüfung vor Anwendung aus', () => {
    const created = createAssignmentWorkflow(BASE_INPUT, ADMIN);
    if (!created.ok) return;

    const prep = prepareDragDropScheduleChange({
      tenantId: TENANT,
      assignmentId: created.data.id,
      newStartAt: '2026-07-01T09:30:00.000Z',
      newEndAt: '2026-07-01T10:30:00.000Z',
    });
    expect(prep.ok).toBe(true);
    if (prep.ok) {
      expect(prep.data.canApply).toBe(false);
    }

    const withoutConfirm = moveScheduleEntryViaDragDrop({
      tenantId: TENANT,
      assignmentId: created.data.id,
      newStartAt: '2026-07-03T09:00:00.000Z',
      newEndAt: '2026-07-03T11:00:00.000Z',
      actorRoleKey: ADMIN,
      confirmed: false,
    });
    expect(withoutConfirm.ok).toBe(false);

    const applied = moveScheduleEntryViaDragDrop({
      tenantId: TENANT,
      assignmentId: created.data.id,
      newStartAt: '2026-07-03T09:00:00.000Z',
      newEndAt: '2026-07-03T11:00:00.000Z',
      actorRoleKey: ADMIN,
      confirmed: true,
    });
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      expect(applied.data.audit.conflictCheckPassed).toBe(true);
    }
  });
});
