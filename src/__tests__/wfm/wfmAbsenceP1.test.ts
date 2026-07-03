import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { filterCalendarRecords, filterCalendarRecordsByRange } from '@/lib/calendar/calendarFilters';
import { recordsToUiEvents } from '@/lib/calendar/calendarFilters';
import { buildOfficeCalendarConfig } from '@/lib/calendar/calendarEventService';
import { buildCalendarEventFromAbsence } from '@/lib/calendar/calendarSyncService';
import { parseWfmAbsenceDateRange } from '@/lib/formatters/dateTimeFormatters';
import {
  eventOverlapsDay,
  eventsForDay,
  parseDateKey,
} from '@/lib/office/calendarDateUtils';
import {
  buildCalendarPayloadFromWfmAbsence,
  mapWfmAbsenceToEmployeeAbsence,
  normalizeWfmAbsenceCalendarBounds,
} from '@/lib/wfm/wfmAbsenceCalendarBridge';
import {
  listWfmAbsencesForEmployee,
  requestWfmAbsence,
  resetWfmAbsenceDemoStore,
  resolveWfmPortalRejectionReason,
} from '@/lib/wfm/wfmAbsenceService';
import { resetWfmApprovalDemoStore } from '@/lib/wfm/wfmApprovalService';
import {
  listWfmAbsenceApprovalDetails,
  reviewWfmAbsenceRequest,
} from '@/lib/wfm/wfmAbsenceApprovalWorkflow';

const TENANT = DEMO_TENANT_ID;
const USER = 'user-absence-p1';
const EMPLOYEE = 'employee_portal' as const;
const OFFICE = 'business_admin' as const;
const REVIEWER = 'reviewer-office-p1';

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  resetWfmAbsenceDemoStore();
  resetWfmApprovalDemoStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('ABSENCE.1 P1 — Urlaub rejection in portal', () => {
  it('lehnt Urlaub ab und zeigt Abgelehnt + Grund im Portal', async () => {
    const created = await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'vacation',
      startsAt: '2026-08-20T00:00:00.000Z',
      endsAt: '2026-08-22T23:59:59.000Z',
      employeeNote: 'Sommerurlaub P1',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const pending = await listWfmAbsenceApprovalDetails(TENANT, OFFICE);
    const approvalId = pending.ok
      ? pending.data.find((d) => d.absence?.id === created.data.id)?.approval.id
      : null;
    expect(approvalId).toBeTruthy();

    const rejected = await reviewWfmAbsenceRequest(
      TENANT,
      REVIEWER,
      OFFICE,
      approvalId!,
      'rejected',
      { rejectionReason: 'Personalengpass im August' },
    );
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.data.absence?.status).toBe('rejected');

    const list = await listWfmAbsencesForEmployee(TENANT, USER, EMPLOYEE);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const row = list.data.find((a) => a.id === created.data.id);
    expect(row?.status).toBe('rejected');
    expect(row?.portalRejectionReason || row?.internalNote).toBe('Personalengpass im August');
  });

  it('nutzt workforce_approvals.rejection_reason wenn internal_note leer ist', async () => {
    const created = await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'vacation',
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-09-02T23:59:59.000Z',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const pending = await listWfmAbsenceApprovalDetails(TENANT, OFFICE);
    const approvalId = pending.ok ? pending.data[0]?.approval.id : null;
    expect(approvalId).toBeTruthy();

    const rejected = await reviewWfmAbsenceRequest(
      TENANT,
      REVIEWER,
      OFFICE,
      approvalId!,
      'rejected',
      { rejectionReason: 'Aus Approval-Feld' },
    );
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;

    // Simulate legacy row where internal_note was not persisted but approval has reason.
    rejected.data.absence!.internalNote = '';

    const reason = resolveWfmPortalRejectionReason(rejected.data.absence!, new Map([
      [
        created.data.id,
        {
          rejectionReason: 'Aus Approval-Feld',
          status: 'rejected',
        },
      ],
    ]));
    expect(reason).toBe('Aus Approval-Feld');

    const list = await listWfmAbsencesForEmployee(TENANT, USER, EMPLOYEE);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const row = list.data.find((a) => a.id === created.data.id);
    expect(row?.status).toBe('rejected');
    expect(row?.portalRejectionReason || row?.internalNote).toBe('Aus Approval-Feld');
  });

  it('blockiert Ablehnung ohne Begründung', async () => {
    await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'vacation',
      startsAt: '2026-10-01T00:00:00.000Z',
      endsAt: '2026-10-03T23:59:59.000Z',
    });
    const pending = await listWfmAbsenceApprovalDetails(TENANT, OFFICE);
    const approvalId = pending.ok ? pending.data[0]?.approval.id : null;
    expect(approvalId).toBeTruthy();

    const rejected = await reviewWfmAbsenceRequest(
      TENANT,
      REVIEWER,
      OFFICE,
      approvalId!,
      'rejected',
    );
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.error).toMatch(/Ablehnungsgrund/);
  });
});

describe('ABSENCE.1 P1 — calendar bridge', () => {
  const approvedVacation = {
    id: 'abs-vac-1',
    tenantId: TENANT,
    employeeId: 'emp-1',
    absenceType: 'vacation' as const,
    status: 'approved' as const,
    startsAt: '2026-08-15T00:00:00.000Z',
    endsAt: '2026-08-15T23:59:59.000Z',
    allDay: true,
    requestedDays: 1,
    employeeNote: 'Audit P1',
    internalNote: '',
    createdAt: '',
    updatedAt: '',
  };

  it('erzeugt lesbaren Kalender-Payload für Urlaub und Abwesenheit', () => {
    const vacationPayload = buildCalendarPayloadFromWfmAbsence(approvedVacation);
    expect(vacationPayload.eventType).toBe('urlaub');
    expect(vacationPayload.sourceType).toBe('vacation');
    expect(vacationPayload.title).toBe('Audit P1');

    const sickPayload = buildCalendarPayloadFromWfmAbsence({
      ...approvedVacation,
      id: 'abs-sick-1',
      absenceType: 'sick_leave',
      employeeNote: '',
    });
    expect(sickPayload.eventType).toBe('krankheit');
    expect(sickPayload.title).toBe('Krankheit');
  });

  it('liefert Kalendereintrag in der Office-UI-Schicht', () => {
    const mapped = mapWfmAbsenceToEmployeeAbsence(approvedVacation);
    const payload = buildCalendarEventFromAbsence(mapped);
    const record = {
      id: 'cal-1',
      tenantId: TENANT,
      moduleKey: 'office' as const,
      sourceType: payload.sourceType,
      sourceId: payload.sourceId!,
      eventType: payload.eventType!,
      title: payload.title,
      description: null,
      internalNote: null,
      publicNote: null,
      startAt: payload.startAt,
      endAt: payload.endAt,
      allDay: true,
      timezone: 'Europe/Berlin',
      status: 'approved',
      priority: 'normal',
      locationType: null,
      locationName: null,
      address: null,
      room: null,
      videoUrl: null,
      phoneNumber: null,
      relatedClientId: null,
      relatedEmployeeId: approvedVacation.employeeId,
      relatedTeamId: null,
      relatedWardId: null,
      relatedCaseId: null,
      relatedDocumentId: null,
      visibilityScope: 'office',
      isOfficeVisible: true,
      isModuleVisible: true,
      isClientPortalVisible: false,
      isEmployeePortalVisible: true,
      isPublicHoliday: false,
      colorKey: 'absence',
      iconKey: null,
      recurrenceRuleId: null,
      createdAt: '',
      updatedAt: '',
      createdBy: null,
      updatedBy: null,
      archivedAt: null,
    };

    const filtered = filterCalendarRecords([record], buildOfficeCalendarConfig());
    const uiEvents = recordsToUiEvents(filtered);
    expect(uiEvents.length).toBe(1);
    expect(uiEvents[0]?.type).toBe('urlaub');
    expect(uiEvents[0]?.title).toBe('Audit P1');
  });

  it('nutzt dieselbe source_id für idempotente Upserts', () => {
    const first = buildCalendarPayloadFromWfmAbsence(approvedVacation);
    const second = buildCalendarPayloadFromWfmAbsence({
      ...approvedVacation,
      internalNote: 'Erneute Freigabe',
    });
    expect(first.sourceId).toBe(second.sourceId);
    expect(first.sourceType).toBe(second.sourceType);
  });

  it('mappt approved auf Kalenderstatus aktiv', () => {
    const payload = buildCalendarPayloadFromWfmAbsence(approvedVacation);
    expect(payload.status).toBe('aktiv');
  });
});

describe('ABSENCE.1 P1b — calendar cell visibility (all-day overlap)', () => {
  function uiEventFromRange(startInput: string, endInput: string, note = 'Audit P1b') {
    const parsed = parseWfmAbsenceDateRange(startInput, endInput);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return null;

    const absence = {
      id: `abs-${startInput}-${endInput}`,
      tenantId: TENANT,
      employeeId: 'emp-1',
      absenceType: 'vacation' as const,
      status: 'approved' as const,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      allDay: true,
      requestedDays: 1,
      employeeNote: note,
      internalNote: '',
      createdAt: '',
      updatedAt: '',
    };

    const payload = buildCalendarPayloadFromWfmAbsence(absence);
    const record = {
      id: `cal-${absence.id}`,
      tenantId: TENANT,
      moduleKey: 'office' as const,
      sourceType: payload.sourceType,
      sourceId: payload.sourceId!,
      eventType: payload.eventType!,
      title: payload.title,
      description: null,
      internalNote: null,
      publicNote: null,
      startAt: payload.startAt,
      endAt: payload.endAt,
      allDay: true,
      timezone: 'Europe/Berlin',
      status: 'aktiv',
      priority: 'normal',
      locationType: null,
      locationName: null,
      address: null,
      room: null,
      videoUrl: null,
      phoneNumber: null,
      relatedClientId: null,
      relatedEmployeeId: absence.employeeId,
      relatedTeamId: null,
      relatedWardId: null,
      relatedCaseId: null,
      relatedDocumentId: null,
      visibilityScope: 'office',
      isOfficeVisible: true,
      isModuleVisible: true,
      isClientPortalVisible: false,
      isEmployeePortalVisible: true,
      isPublicHoliday: false,
      colorKey: 'absence',
      iconKey: null,
      recurrenceRuleId: null,
      createdAt: '',
      updatedAt: '',
      createdBy: null,
      updatedBy: null,
      archivedAt: null,
    };

    const uiEvents = recordsToUiEvents(filterCalendarRecords([record], buildOfficeCalendarConfig()));
    return uiEvents[0] ?? null;
  }

  function visibleOnDays(event: { start: string; end: string; allDay?: boolean }, keys: string[]) {
    return keys.map((key) => ({
      key,
      visible: eventsForDay([event], parseDateKey(key)).length > 0,
    }));
  }

  it('1 — Einzeltag 15.08 nur auf 15.08 sichtbar', () => {
    const event = uiEventFromRange('15.08.2026', '15.08.2026');
    expect(event).toBeTruthy();
    if (!event) return;
    expect(event.start).toBe('2026-08-15T00:00:00.000Z');
    expect(event.end).toBe('2026-08-15T23:59:59.999Z');
    const days = visibleOnDays(event, ['2026-08-14', '2026-08-15', '2026-08-16']);
    expect(days).toEqual([
      { key: '2026-08-14', visible: false },
      { key: '2026-08-15', visible: true },
      { key: '2026-08-16', visible: false },
    ]);
  });

  it('2 — Mehrere Tage 15.08–16.08 auf beiden Zellen sichtbar', () => {
    const event = uiEventFromRange('15.08.2026', '16.08.2026');
    expect(event).toBeTruthy();
    if (!event) return;
    expect(event.start).toBe('2026-08-15T00:00:00.000Z');
    expect(event.end).toBe('2026-08-16T23:59:59.999Z');
    const days = visibleOnDays(event, ['2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17']);
    expect(days.find((d) => d.key === '2026-08-15')?.visible).toBe(true);
    expect(days.find((d) => d.key === '2026-08-16')?.visible).toBe(true);
    expect(days.find((d) => d.key === '2026-08-14')?.visible).toBe(false);
    expect(days.find((d) => d.key === '2026-08-17')?.visible).toBe(false);
  });

  it('3 — Einzeltag 16.08 nur auf 16.08 sichtbar', () => {
    const event = uiEventFromRange('16.08.2026', '16.08.2026');
    expect(event).toBeTruthy();
    if (!event) return;
    expect(event.start).toBe('2026-08-16T00:00:00.000Z');
    expect(event.end).toBe('2026-08-16T23:59:59.999Z');
    const days = visibleOnDays(event, ['2026-08-15', '2026-08-16', '2026-08-17']);
    expect(days.find((d) => d.key === '2026-08-16')?.visible).toBe(true);
    expect(days.find((d) => d.key === '2026-08-15')?.visible).toBe(false);
  });

  it('4 — Zeitraum mit Uhrzeit über beide Tage sichtbar', () => {
    const event = {
      start: '2026-08-15T07:00:00.000Z',
      end: '2026-08-16T10:00:00.000Z',
      allDay: false,
    };
    expect(eventOverlapsDay(event.start, event.end, parseDateKey('2026-08-15'))).toBe(true);
    expect(eventOverlapsDay(event.start, event.end, parseDateKey('2026-08-16'))).toBe(true);
    expect(eventOverlapsDay(event.start, event.end, parseDateKey('2026-08-17'))).toBe(false);
  });

  it('5 — UTC-CEST Endinstanz normalisiert auf 16.08 (kein Tag-Shift)', () => {
    const bounds = normalizeWfmAbsenceCalendarBounds(
      '2026-08-15T22:00:00.000Z',
      '2026-08-16T21:59:59.999Z',
    );
    expect(bounds.startAt).toBe('2026-08-16T00:00:00.000Z');
    expect(bounds.endAt).toBe('2026-08-16T23:59:59.999Z');
  });

  it('6 — Range-Query schließt Mehr-Tage-All-Day im August ein', () => {
    const event = uiEventFromRange('15.08.2026', '16.08.2026');
    expect(event).toBeTruthy();
    if (!event) return;
    const record = {
      id: 'cal-range',
      tenantId: TENANT,
      moduleKey: 'office' as const,
      sourceType: 'vacation' as const,
      sourceId: 'abs-range',
      eventType: 'urlaub' as const,
      title: event.title,
      description: null,
      internalNote: null,
      publicNote: null,
      startAt: event.start,
      endAt: event.end,
      allDay: true,
      timezone: 'Europe/Berlin',
      status: 'aktiv',
      priority: 'normal',
      locationType: null,
      locationName: null,
      address: null,
      room: null,
      videoUrl: null,
      phoneNumber: null,
      relatedClientId: null,
      relatedEmployeeId: 'emp-1',
      relatedTeamId: null,
      relatedWardId: null,
      relatedCaseId: null,
      relatedDocumentId: null,
      visibilityScope: 'office',
      isOfficeVisible: true,
      isModuleVisible: true,
      isClientPortalVisible: false,
      isEmployeePortalVisible: true,
      isPublicHoliday: false,
      colorKey: 'absence',
      iconKey: null,
      recurrenceRuleId: null,
      createdAt: '',
      updatedAt: '',
      createdBy: null,
      updatedBy: null,
      archivedAt: null,
    };

    const ranged = filterCalendarRecordsByRange(
      [record],
      '2026-08-01T00:00:00.000Z',
      '2026-08-31T23:59:59.999Z',
    );
    expect(ranged).toHaveLength(1);
  });

  it('7 — erneute Freigabe behält source_id (kein Duplikat)', () => {
    const parsed = parseWfmAbsenceDateRange('15.08.2026', '16.08.2026');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const base = {
      id: 'abs-dedupe',
      tenantId: TENANT,
      employeeId: 'emp-1',
      absenceType: 'sick_leave' as const,
      status: 'approved' as const,
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      allDay: true,
      requestedDays: 2,
      employeeNote: '',
      internalNote: '',
      createdAt: '',
      updatedAt: '',
    };
    const first = buildCalendarPayloadFromWfmAbsence(base);
    const second = buildCalendarPayloadFromWfmAbsence({ ...base, employeeNote: 'Update' });
    expect(first.sourceId).toBe(second.sourceId);
    expect(first.startAt).toBe(second.startAt);
    expect(first.endAt).toBe(second.endAt);
  });

  it('8 — buildCalendarEventFromAbsence setzt allDay-Flag und timezone', () => {
    const parsed = parseWfmAbsenceDateRange('15.08.2026', '16.08.2026');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const mapped = mapWfmAbsenceToEmployeeAbsence({
      id: 'abs-meta',
      tenantId: TENANT,
      employeeId: 'emp-1',
      absenceType: 'vacation',
      status: 'approved',
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      allDay: true,
      requestedDays: 2,
      employeeNote: '',
      internalNote: '',
      createdAt: '',
      updatedAt: '',
    });
    const payload = buildCalendarEventFromAbsence(mapped);
    expect(payload.allDay).toBe(true);
    expect(payload.timezone).toBe('Europe/Berlin');
    expect(payload.endAt).toBe('2026-08-16T23:59:59.999Z');
  });

  it('9 — Mehr-Tage vorher fehleranfällige CEST-Instants überlappen 16.08-Zelle', () => {
    const parsed = parseWfmAbsenceDateRange('15.08.2026', '16.08.2026');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const beforeNormalize = {
      start: parsed.startsAt,
      end: parsed.endsAt,
      allDay: false,
    };
    expect(
      eventOverlapsDay(beforeNormalize.start, beforeNormalize.end, parseDateKey('2026-08-16')),
    ).toBe(true);

    const normalized = buildCalendarPayloadFromWfmAbsence({
      id: 'abs-norm',
      tenantId: TENANT,
      employeeId: 'emp-1',
      absenceType: 'vacation',
      status: 'approved',
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      allDay: true,
      requestedDays: 2,
      employeeNote: 'P1b',
      internalNote: '',
      createdAt: '',
      updatedAt: '',
    });
    expect(
      eventsForDay(
        [{ start: normalized.startAt, end: normalized.endAt, allDay: true }],
        parseDateKey('2026-08-16'),
      ),
    ).toHaveLength(1);
  });

  it('10 — Krankheit 16.08 Payload-Titel lesbar', () => {
    const parsed = parseWfmAbsenceDateRange('16.08.2026', '16.08.2026');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const sick = buildCalendarPayloadFromWfmAbsence({
      id: 'abs-sick-16',
      tenantId: TENANT,
      employeeId: 'emp-1',
      absenceType: 'sick_leave',
      status: 'approved',
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      allDay: true,
      requestedDays: 1,
      employeeNote: '',
      internalNote: '',
      createdAt: '',
      updatedAt: '',
    });
    expect(sick.title).toBe('Krankheit');
    expect(sick.endAt).toBe('2026-08-16T23:59:59.999Z');
    expect(
      eventsForDay(
        [{ start: sick.startAt, end: sick.endAt, allDay: true }],
        parseDateKey('2026-08-16'),
      ),
    ).toHaveLength(1);
  });
});

describe('ABSENCE.1 P1 — regression', () => {
  it('listet offene Anträge im Office-Posteingang', async () => {
    await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'sick_leave',
      startsAt: '2026-11-01T00:00:00.000Z',
      endsAt: '2026-11-02T23:59:59.000Z',
    });
    await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'vacation',
      startsAt: '2026-12-01T00:00:00.000Z',
      endsAt: '2026-12-05T23:59:59.000Z',
    });

    const list = await listWfmAbsenceApprovalDetails(TENANT, OFFICE);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.length).toBeGreaterThanOrEqual(2);
  });
});
