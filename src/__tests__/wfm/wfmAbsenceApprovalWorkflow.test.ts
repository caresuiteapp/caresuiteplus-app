import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import {
  listWfmAbsencesForEmployee,
  requestWfmAbsence,
  resetWfmAbsenceDemoStore,
  reviewWfmAbsence,
  withdrawWfmAbsence,
} from '@/lib/wfm/wfmAbsenceService';
import { resetWfmApprovalDemoStore } from '@/lib/wfm/wfmApprovalService';
import {
  listWfmAbsenceApprovalDetails,
  listWfmAbsenceOverviewDetails,
  reviewWfmAbsenceRequest,
  withdrawWfmAbsenceRequest,
} from '@/lib/wfm/wfmAbsenceApprovalWorkflow';
import { detectWfmAbsenceOverlapConflicts } from '@/lib/wfm/wfmAbsenceConflictService';
import { mapWfmAbsenceToEmployeeAbsence } from '@/lib/wfm/wfmAbsenceCalendarBridge';

const TENANT = DEMO_TENANT_ID;
const USER = 'user-absence-test';
const EMPLOYEE = 'employee_portal' as const;
const OFFICE = 'business_admin' as const;
const REVIEWER = 'reviewer-office';

beforeEach(() => {
  vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
  resetWfmAbsenceDemoStore();
  resetWfmApprovalDemoStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('wfmAbsenceService', () => {
  it('stellt Urlaubsantrag und listet ihn mit Status requested', async () => {
    const created = await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'vacation',
      startsAt: '2026-07-01T00:00:00.000Z',
      endsAt: '2026-07-05T23:59:59.000Z',
      employeeNote: 'Sommerurlaub',
    });
    expect(created.ok).toBe(true);

    const list = await listWfmAbsencesForEmployee(TENANT, USER, EMPLOYEE);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.length).toBe(1);
    expect(list.data[0]?.status).toBe('requested');
  });

  it('lehnt ohne Ablehnungsgrund ab', async () => {
    const created = await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'sick_leave',
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-02T23:59:59.000Z',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const rejected = await reviewWfmAbsence(
      TENANT,
      REVIEWER,
      OFFICE,
      created.data.id,
      'rejected',
    );
    expect(rejected.ok).toBe(false);
  });

  it('zieht ausstehenden Antrag zurück', async () => {
    const created = await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'training',
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-09-02T23:59:59.000Z',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const withdrawn = await withdrawWfmAbsence(TENANT, USER, EMPLOYEE, created.data.id);
    expect(withdrawn.ok).toBe(true);
    if (!withdrawn.ok) return;
    expect(withdrawn.data.status).toBe('cancelled');
  });
});

describe('wfmAbsenceApprovalWorkflow', () => {
  it('listet offene Anträge für Office', async () => {
    await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'vacation',
      startsAt: '2026-10-01T00:00:00.000Z',
      endsAt: '2026-10-05T23:59:59.000Z',
    });

    const list = await listWfmAbsenceApprovalDetails(TENANT, OFFICE);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.length).toBe(1);
    expect(list.data[0]?.approval.status).toBe('pending');
  });

  it('genehmigt Antrag und setzt Abwesenheit auf approved', async () => {
    const created = await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'vacation',
      startsAt: '2026-11-01T00:00:00.000Z',
      endsAt: '2026-11-03T23:59:59.000Z',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const pending = await listWfmAbsenceApprovalDetails(TENANT, OFFICE);
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;
    const approvalId = pending.data[0]?.approval.id;
    expect(approvalId).toBeTruthy();

    const approved = await reviewWfmAbsenceRequest(
      TENANT,
      REVIEWER,
      OFFICE,
      approvalId!,
      'approved',
      { approvalComment: 'Vertretung geklärt' },
    );
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.data.absence?.status).toBe('approved');

    const queue = await listWfmAbsenceApprovalDetails(TENANT, OFFICE);
    expect(queue.ok && queue.data).toHaveLength(0);
    const overview = await listWfmAbsenceOverviewDetails(TENANT, OFFICE);
    expect(overview.ok).toBe(true);
    if (!overview.ok) return;
    expect(overview.data).toHaveLength(1);
    expect(overview.data[0]?.absence.status).toBe('approved');
  });

  it('lehnt mit Pflichtbegründung ab und speichert Grund', async () => {
    const created = await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'sick_leave',
      startsAt: '2026-12-01T00:00:00.000Z',
      endsAt: '2026-12-02T23:59:59.000Z',
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
      { rejectionReason: 'Attest fehlt' },
    );
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.data.absence?.status).toBe('rejected');
    expect(rejected.data.absence?.internalNote).toBe('Attest fehlt');
  });

  it('withdrawWfmAbsenceRequest setzt Status cancelled', async () => {
    const created = await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'other',
      startsAt: '2026-12-10T00:00:00.000Z',
      endsAt: '2026-12-11T23:59:59.000Z',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const withdrawn = await withdrawWfmAbsenceRequest(TENANT, USER, EMPLOYEE, created.data.id);
    expect(withdrawn.ok).toBe(true);
    if (!withdrawn.ok) return;
    expect(withdrawn.data.status).toBe('cancelled');
  });
});

describe('wfmAbsenceConflictService', () => {
  it('erkennt überlappende Anträge', () => {
    const candidate = {
      id: 'new',
      employeeId: 'emp-1',
      startsAt: '2026-07-10T00:00:00.000Z',
      endsAt: '2026-07-12T23:59:59.000Z',
      status: 'requested' as const,
    };
    const existing = [
      {
        id: 'old',
        tenantId: TENANT,
        employeeId: 'emp-1',
        absenceType: 'vacation' as const,
        status: 'requested' as const,
        startsAt: '2026-07-11T00:00:00.000Z',
        endsAt: '2026-07-15T23:59:59.000Z',
        allDay: true,
        requestedDays: 4,
        employeeNote: '',
        internalNote: '',
        createdAt: '',
        updatedAt: '',
      },
    ];
    const conflicts = detectWfmAbsenceOverlapConflicts(candidate, existing);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]?.severity).toBe('warning');
  });
});

describe('wfmAbsenceCalendarBridge', () => {
  it('mappt WFM-Abwesenheit für Kalendersync', () => {
    const mapped = mapWfmAbsenceToEmployeeAbsence({
      id: 'abs-1',
      tenantId: TENANT,
      employeeId: 'emp-1',
      absenceType: 'vacation',
      status: 'approved',
      startsAt: '2026-07-01T00:00:00.000Z',
      endsAt: '2026-07-05T23:59:59.000Z',
      allDay: true,
      requestedDays: 5,
      employeeNote: 'Urlaub',
      internalNote: '',
      createdAt: '',
      updatedAt: '',
    });
    expect(mapped.absenceType).toBe('vacation');
    expect(mapped.id).toBe('abs-1');
  });
});
