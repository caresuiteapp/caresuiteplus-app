import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { parseWfmAbsenceDateRange } from '@/lib/formatters/dateTimeFormatters';
import {
  listWfmAbsencesForEmployee,
  requestWfmAbsence,
  resetWfmAbsenceDemoStore,
} from '@/lib/wfm/wfmAbsenceService';
import { resetWfmApprovalDemoStore } from '@/lib/wfm/wfmApprovalService';
import {
  listWfmAbsenceApprovalDetails,
  reviewWfmAbsenceRequest,
} from '@/lib/wfm/wfmAbsenceApprovalWorkflow';

const TENANT = DEMO_TENANT_ID;
const USER = 'user-absence-portal-date';
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

describe('WfmAbsencePortalScreen date submit path', () => {
  it('verwendet parseWfmAbsenceDateRange statt new Date(string)', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/wfm/WfmAbsencePortalScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('parseWfmAbsenceDateRange');
    expect(source).not.toMatch(/new Date\(startsAt\)\.toISOString/);
  });
});

describe('Abwesenheit workflow with German dates', () => {
  it('erstellt Krankmeldung aus DD.MM.YYYY als Ausstehend', async () => {
    const parsed = parseWfmAbsenceDateRange('15.08.2026', '16.08.2026');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const created = await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'sick_leave',
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      employeeNote: 'Krank',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.status).toBe('requested');

    const list = await listWfmAbsencesForEmployee(TENANT, USER, EMPLOYEE);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.some((a) => a.id === created.data.id)).toBe(true);
  });

  it('ist im Office sichtbar und genehmigbar', async () => {
    const parsed = parseWfmAbsenceDateRange('01.09.2026', '02.09.2026');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'training',
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
    });

    const pending = await listWfmAbsenceApprovalDetails(TENANT, OFFICE);
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;
    expect(pending.data.length).toBeGreaterThan(0);

    const approvalId = pending.data[0]!.approval.id;
    const approved = await reviewWfmAbsenceRequest(
      TENANT,
      REVIEWER,
      OFFICE,
      approvalId,
      'approved',
    );
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.data.absence?.status).toBe('approved');
  });

  it('lehnt mit Pflichtbegründung ab', async () => {
    const parsed = parseWfmAbsenceDateRange('10.12.2026', '11.12.2026');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'other',
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
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
      { rejectionReason: 'Nicht genehmigt' },
    );
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.data.absence?.status).toBe('rejected');
    expect(rejected.data.absence?.internalNote).toBe('Nicht genehmigt');
  });
});

describe('Urlaub regression with German dates', () => {
  it('erstellt Urlaubsantrag aus DD.MM.YYYY korrekt', async () => {
    const parsed = parseWfmAbsenceDateRange('10.08.2026', '12.08.2026');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const created = await requestWfmAbsence(TENANT, USER, EMPLOYEE, {
      absenceType: 'vacation',
      startsAt: parsed.startsAt,
      endsAt: parsed.endsAt,
      employeeNote: 'Sommerurlaub',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const start = new Date(created.data.startsAt);
    const end = new Date(created.data.endsAt);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(7);
    expect(start.getDate()).toBe(10);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(7);
    expect(end.getDate()).toBe(12);
  });
});
