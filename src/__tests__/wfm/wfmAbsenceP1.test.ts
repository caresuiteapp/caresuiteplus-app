import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { filterCalendarRecords } from '@/lib/calendar/calendarFilters';
import { recordsToUiEvents } from '@/lib/calendar/calendarFilters';
import { buildOfficeCalendarConfig } from '@/lib/calendar/calendarEventService';
import { buildCalendarEventFromAbsence } from '@/lib/calendar/calendarSyncService';
import {
  buildCalendarPayloadFromWfmAbsence,
  mapWfmAbsenceToEmployeeAbsence,
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
