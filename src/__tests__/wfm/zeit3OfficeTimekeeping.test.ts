import { describe, expect, it, beforeEach } from 'vitest';
import { resolveOfficeTimePeriod, enumerateWorkDates } from '@/lib/wfm/wfmOfficeDateRange';
import {
  combineDeviationAmpel,
  evaluateVisitTimeDeviation,
  resolveAmpelFromDeviationMinutes,
  validateDeviationJustification,
} from '@/lib/wfm/wfmVisitDeviationAmpelService';
import {
  applyWfmOfficeTimeCorrection,
  checkVisitDeviationGate,
  createWfmOfficeManualEntry,
  getWfmOfficeTimeOverview,
  reviewWfmOfficeTimeEntry,
  submitVisitDeviationJustification,
  getWfmOfficeExportWarnings,
} from '@/lib/wfm/wfmOfficeTimekeepingService';
import { listWfmOfficeAuditForEntry } from '@/lib/wfm/wfmOfficeAuditService';
import {
  resetWfmOfficeTimekeepingStore,
  setEntryOverlay,
} from '@/lib/wfm/wfmOfficeTimekeepingStore';
import { resetWfmTimeReviewDemoStore } from '@/lib/wfm/wfmTimeReviewService';

const TENANT = 'tenant-zeit3';
const ACTOR = 'actor-office';
const EMP = 'emp-zeit3';
const ROLE = 'business_manager' as const;

function plannedAt(hour: number, minute = 0): string {
  return `2026-07-04T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
}

describe('ZEIT.3 date range', () => {
  const ref = new Date('2026-07-04T12:00:00');

  it('resolves today, yesterday, week, month presets', () => {
    expect(resolveOfficeTimePeriod('today', null, null, ref).fromDate).toBe('2026-07-04');
    expect(resolveOfficeTimePeriod('yesterday', null, null, ref).fromDate).toBe('2026-07-03');
    expect(resolveOfficeTimePeriod('this_week', null, null, ref).fromDate).toBe('2026-06-29');
    expect(resolveOfficeTimePeriod('this_month', null, null, ref).fromDate).toBe('2026-07-01');
    expect(resolveOfficeTimePeriod('last_7_days', null, null, ref).fromDate).toBe('2026-06-28');
  });

  it('enumerates inclusive date range', () => {
    expect(enumerateWorkDates('2026-07-01', '2026-07-03')).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ]);
  });
});

describe('ZEIT.3 start ampel', () => {
  const planned = plannedAt(10);

  it.each([
    ['09:56', 4, 'green'],
    ['10:04', 4, 'green'],
    ['09:53', 7, 'yellow'],
    ['10:08', 8, 'yellow'],
    ['09:47', 13, 'red'],
    ['10:15', 15, 'red'],
    ['09:39', 21, 'blue'],
    ['10:21', 21, 'blue'],
  ] as const)('planned 10:00 actual %s → %s (%s)', (time, minutes, ampel) => {
    const actual = `2026-07-04T${time}:00.000Z`;
    const result = evaluateVisitTimeDeviation(planned, actual, 'start');
    expect(result.deviationMinutes).toBe(minutes);
    expect(result.ampel).toBe(ampel);
  });

  it('green allows start without justification', () => {
    const r = evaluateVisitTimeDeviation(planned, plannedAt(10, 4), 'start');
    expect(r.requiresJustification).toBe(false);
  });

  it('yellow allows without mandatory justification', () => {
    const r = evaluateVisitTimeDeviation(planned, plannedAt(9, 53), 'start');
    expect(r.requiresJustification).toBe(false);
    expect(r.ampel).toBe('yellow');
  });

  it('rot/blau require justification', () => {
    expect(evaluateVisitTimeDeviation(planned, plannedAt(9, 47), 'start').requiresJustification).toBe(true);
    expect(evaluateVisitTimeDeviation(planned, plannedAt(9, 39), 'start').requiresJustification).toBe(true);
  });
});

describe('ZEIT.3 end ampel', () => {
  const planned = plannedAt(12);

  it.each([
    ['11:56', 4, 'green'],
    ['12:04', 4, 'green'],
    ['11:53', 7, 'yellow'],
    ['12:08', 8, 'yellow'],
    ['11:47', 13, 'red'],
    ['12:15', 15, 'red'],
    ['11:39', 21, 'blue'],
    ['12:21', 21, 'blue'],
  ] as const)('planned 12:00 actual %s → %s (%s)', (time, minutes, ampel) => {
    const actual = `2026-07-04T${time}:00.000Z`;
    const result = evaluateVisitTimeDeviation(planned, actual, 'end');
    expect(result.deviationMinutes).toBe(minutes);
    expect(result.ampel).toBe(ampel);
  });
});

describe('ZEIT.3 overall ampel', () => {
  it.each([
    ['green', 'green', 'green'],
    ['green', 'yellow', 'yellow'],
    ['yellow', 'red', 'red'],
    ['red', 'blue', 'blue'],
    ['blue', 'green', 'blue'],
  ] as const)('start %s + end %s → %s', (start, end, overall) => {
    expect(combineDeviationAmpel(start, end)).toBe(overall);
  });
});

describe('ZEIT.3 deviation gate + office workflow', () => {
  beforeEach(() => {
    resetWfmOfficeTimekeepingStore();
    resetWfmTimeReviewDemoStore();
  });

  it('blocks rot start without justification then allows after submit', async () => {
    const visitId = 'visit-1';
    const planned = plannedAt(10);
    const actual = plannedAt(9, 47);
    const gateBefore = checkVisitDeviationGate(TENANT, EMP, visitId, 'start', planned, actual);
    expect(gateBefore.blocked).toBe(true);

    const submit = await submitVisitDeviationJustification(TENANT, EMP, ACTOR, {
      visitId,
      phase: 'start',
      plannedAt: planned,
      actualAt: actual,
      justification: 'Stau auf der Anfahrt zur Klientin.',
    });
    expect(submit.ok).toBe(true);

    const gateAfter = checkVisitDeviationGate(TENANT, EMP, visitId, 'start', planned, actual);
    expect(gateAfter.blocked).toBe(false);
  });

  it('rejects empty justification', () => {
    expect(validateDeviationJustification('')).toMatch(/Begründung/);
    expect(validateDeviationJustification('kurz')).toMatch(/mindestens/);
  });

  it('manual correction requires reason', async () => {
    const r = await applyWfmOfficeTimeCorrection(TENANT, ACTOR, ROLE, {
      entryId: 'entry-1',
      reason: '',
    });
    expect(r.ok).toBe(false);
  });

  it('correction with reason writes audit', async () => {
    setEntryOverlay('entry-audit', { reviewStatus: 'open' });
    const r = await applyWfmOfficeTimeCorrection(TENANT, ACTOR, ROLE, {
      entryId: 'entry-audit',
      reason: 'Korrektur laut Telefonat',
      actualStartAt: plannedAt(8),
    });
    expect(r.ok).toBe(true);
    const audit = await listWfmOfficeAuditForEntry(TENANT, ROLE, 'entry-audit');
    expect(audit.ok).toBe(true);
    expect(audit.data.some((a) => a.action === 'correction')).toBe(true);
  });

  it('manual office entry requires reason', async () => {
    const r = await createWfmOfficeManualEntry(TENANT, ACTOR, ROLE, {
      employeeId: EMP,
      workDate: '2026-07-04',
      workKind: 'buero',
      actualStartAt: plannedAt(8),
      actualEndAt: plannedAt(16),
      pauseMinutes: 30,
      reason: '',
    });
    expect(r.ok).toBe(false);
  });

  it('manual entry creates pending review row', async () => {
    const r = await createWfmOfficeManualEntry(TENANT, ACTOR, ROLE, {
      employeeId: EMP,
      workDate: '2026-07-04',
      workKind: 'nachtrag',
      actualStartAt: plannedAt(8),
      actualEndAt: plannedAt(16),
      pauseMinutes: 30,
      reason: 'Vergessene Bürozeit nachgetragen.',
    });
    expect(r.ok).toBe(true);
    expect(r.data?.reviewStatus).toBe('pending_review');
  });

  it('approval and rejection rules', async () => {
    setEntryOverlay('entry-review', { reviewStatus: 'pending_review' });
    const reject = await reviewWfmOfficeTimeEntry(TENANT, ACTOR, ROLE, 'entry-review', 'rejected');
    expect(reject.ok).toBe(false);
    const rejectOk = await reviewWfmOfficeTimeEntry(
      TENANT,
      ACTOR,
      ROLE,
      'entry-review',
      'rejected',
      'Unplausibel',
    );
    expect(rejectOk.ok).toBe(true);
    expect(rejectOk.data.reviewStatus).toBe('rejected');

    setEntryOverlay('entry-approve', { reviewStatus: 'pending_review' });
    const approve = await reviewWfmOfficeTimeEntry(TENANT, ACTOR, ROLE, 'entry-approve', 'approved', 'OK');
    expect(approve.ok).toBe(true);
    expect(approve.data.reviewStatus).toBe('approved');

    setEntryOverlay('entry-clarify', { reviewStatus: 'pending_review', employeeId: EMP, workDate: '2026-07-04' });
    const clarify = await reviewWfmOfficeTimeEntry(
      TENANT,
      ACTOR,
      ROLE,
      'entry-clarify',
      'needs_clarification',
      'Bitte Unterlagen nachreichen',
    );
    expect(clarify.ok).toBe(true);
    expect(clarify.data.reviewStatus).toBe('needs_clarification');
  });

  it('exported entry correction shows warning path', async () => {
    setEntryOverlay('entry-exported', { reviewStatus: 'exported', exportStatus: 'exported' });
    const r = await applyWfmOfficeTimeCorrection(TENANT, ACTOR, ROLE, {
      entryId: 'entry-exported',
      reason: 'Versuch',
    });
    expect(r.ok).toBe(false);
  });

  it('end time before start blocked on manual entry', async () => {
    const r = await createWfmOfficeManualEntry(TENANT, ACTOR, ROLE, {
      employeeId: EMP,
      workDate: '2026-07-04',
      workKind: 'buero',
      actualStartAt: plannedAt(16),
      actualEndAt: plannedAt(8),
      pauseMinutes: 0,
      reason: 'Test ungültige Zeiten',
    });
    expect(r.ok).toBe(false);
  });

  it('office overview loads for period presets', async () => {
    const today = await getWfmOfficeTimeOverview(TENANT, ROLE, { preset: 'today' });
    expect(today.ok).toBe(true);
    const month = await getWfmOfficeTimeOverview(TENANT, ROLE, { preset: 'this_month' });
    expect(month.ok).toBe(true);
  });

  it('rot/blau submit creates office message metadata', async () => {
    await submitVisitDeviationJustification(TENANT, EMP, ACTOR, {
      visitId: 'visit-msg',
      phase: 'end',
      plannedAt: plannedAt(12),
      actualAt: plannedAt(12, 21),
      justification: 'Einsatz länger wegen akuter Pflegesituation.',
    });
    const overview = await getWfmOfficeTimeOverview(TENANT, ROLE, {
      preset: 'last_30_days',
      filters: { onlyOfficeMessages: true },
    });
    expect(overview.ok).toBe(true);
  });

  it('export warnings mention open entries when overlays exist', async () => {
    await createWfmOfficeManualEntry(TENANT, ACTOR, ROLE, {
      employeeId: EMP,
      workDate: '2026-07-04',
      workKind: 'buero',
      actualStartAt: plannedAt(9),
      actualEndAt: plannedAt(10),
      pauseMinutes: 0,
      reason: 'Test export warn',
    });
    const w = await getWfmOfficeExportWarnings(TENANT, ROLE, 'custom', '2026-07-01', '2026-07-31');
    expect(w.ok).toBe(true);
    expect(w.data.warnings.length).toBeGreaterThan(0);
  });
});

describe('ZEIT.3 ampel thresholds unit', () => {
  it('resolveAmpelFromDeviationMinutes matches spec bands', () => {
    expect(resolveAmpelFromDeviationMinutes(5)).toBe('green');
    expect(resolveAmpelFromDeviationMinutes(6)).toBe('yellow');
    expect(resolveAmpelFromDeviationMinutes(11)).toBe('red');
    expect(resolveAmpelFromDeviationMinutes(21)).toBe('blue');
  });
});
