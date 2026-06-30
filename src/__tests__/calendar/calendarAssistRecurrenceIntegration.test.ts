import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildVisitOccurrenceId } from '@/lib/assist/visitRecurrenceExpansion';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';
import { getModuleCalendarEvents } from '@/lib/calendar/calendarEventService';
import type { CalendarEventRecord } from '@/types/calendar';
import type { CalendarEvent } from '@/types/modules/calendarEvent';

const TENANT_ID = '56180c22-b894-4fab-b55e-a563c94dd6e7';
const VISIT_ID = 'c8969244-db7e-4f72-9570-3467e2960502';

const visitSupabaseRepository = vi.hoisted(() => ({
  list: vi.fn(),
}));

const calendarEventRepository = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({
  visitSupabaseRepository,
}));

vi.mock('@/lib/calendar/calendarEventRepository', () => ({
  calendarEventRepository,
}));

vi.mock('@/lib/services/mode', () => ({
  getServiceMode: () => 'supabase',
  isDemoMode: () => false,
}));

vi.mock('@/lib/services/liveServiceGuard', () => ({
  guardServiceTenant: () => null,
}));

vi.mock('@/lib/permissions', () => ({
  enforcePermission: () => null,
}));

function baseListItem(overrides: Partial<VisitDispositionListItem> = {}): VisitDispositionListItem {
  return {
    id: VISIT_ID,
    tenantId: TENANT_ID,
    clientId: 'client-1',
    title: 'Alltagsbegleitung',
    serviceName: 'Alltagsbegleitung',
    scheduledStart: '2026-07-03T07:30:00.000Z',
    scheduledEnd: '2026-07-03T09:30:00.000Z',
    durationMinutes: 120,
    status: 'aktiv',
    planningStatus: 'scheduled',
    proofStatus: 'none',
    billingStatus: 'preview',
    location: 'Musterstraße 1',
    clientName: 'Ellen Zacharias',
    employeeId: 'employee-1',
    employeeName: 'Anna Pflege',
    isAtRisk: false,
    isIncomplete: false,
    updatedAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

function centralRecord(overrides: Partial<CalendarEventRecord> = {}): CalendarEventRecord {
  return {
    id: 'cal-1',
    tenantId: TENANT_ID,
    moduleKey: 'assist',
    sourceType: 'assist_visit',
    sourceId: VISIT_ID,
    eventType: 'einsatz',
    title: 'Entlastungsleistung',
    description: null,
    internalNote: null,
    publicNote: null,
    startAt: '2026-07-03T07:30:00.000Z',
    endAt: '2026-07-03T09:30:00.000Z',
    allDay: false,
    timezone: 'Europe/Berlin',
    status: 'bestaetigt',
    priority: 'normal',
    locationType: null,
    locationName: null,
    address: null,
    room: null,
    videoUrl: null,
    phoneNumber: null,
    relatedClientId: 'client-1',
    relatedEmployeeId: 'employee-1',
    relatedTeamId: null,
    relatedWardId: null,
    relatedCaseId: null,
    relatedDocumentId: null,
    visibilityScope: 'tenant',
    isOfficeVisible: true,
    isModuleVisible: true,
    isClientPortalVisible: false,
    isEmployeePortalVisible: true,
    archivedAt: null,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('calendar assist recurrence integration', () => {
  beforeEach(() => {
    visitSupabaseRepository.list.mockReset();
    calendarEventRepository.list.mockReset();
  });

  it('nutzt expandierte Visit-Disposition als Assist-Kalenderquelle statt nur calendar_events', async () => {
    calendarEventRepository.list.mockResolvedValue({
      ok: true,
      data: [centralRecord()],
    });

    const expanded = [
      baseListItem(),
      baseListItem({
        id: buildVisitOccurrenceId(VISIT_ID, '2026-07-10'),
        scheduledStart: '2026-07-10T07:30:00.000Z',
        scheduledEnd: '2026-07-10T09:30:00.000Z',
      }),
      baseListItem({
        id: buildVisitOccurrenceId(VISIT_ID, '2026-07-17'),
        scheduledStart: '2026-07-17T07:30:00.000Z',
        scheduledEnd: '2026-07-17T09:30:00.000Z',
      }),
    ];
    visitSupabaseRepository.list.mockResolvedValue({ ok: true, data: expanded });

    const result = await getModuleCalendarEvents('assist', TENANT_ID, 'owner', {
      rangeStart: '2026-06-01T00:00:00.000Z',
      rangeEnd: '2026-08-31T23:59:59.999Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(visitSupabaseRepository.list).toHaveBeenCalledWith(TENANT_ID, {
      dateFrom: '2026-06-01T00:00:00.000Z',
      dateTo: '2026-08-31T23:59:59.999Z',
    });
    expect(result.data).toHaveLength(3);
    expect(result.data.map((event: CalendarEvent) => event.start.slice(0, 10))).toEqual([
      '2026-07-03',
      '2026-07-10',
      '2026-07-17',
    ]);
  });
});
