import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  assignmentProfileClickCount,
  scheduleAssignmentProfileDates,
  selectAssignmentProfileDate,
} from '../../components/calendar/assignmentProfileMultiDay';
import { isDefiniteAssignmentScheduleRejection } from '../../lib/office/clientAssignmentScheduleOutcome';

describe('Einsatzprofile: mehrere Kalendertage auswählen', () => {
  it('adds separate days and removes only the day clicked again', () => {
    const original = ['2026-10-02'];
    const selected = selectAssignmentProfileDate(original, '2026-10-01', 1);
    assert.deepEqual(selected, ['2026-10-01', '2026-10-02']);
    assert.deepEqual(original, ['2026-10-02']);
    assert.deepEqual(selectAssignmentProfileDate(selected, '2026-10-02', 1), ['2026-10-01']);
    assert.deepEqual(selectAssignmentProfileDate(['2026-10-01'], '2026-10-01', 1), []);
  });

  it('handles browser click counts 1, 1, 2 by keeping only the double-clicked day', () => {
    let selected: string[] = [];
    for (const [date, detail] of [
      ['2026-10-01', 1],
      ['2026-10-02', 1],
      ['2026-10-02', 2],
    ] as const) {
      selected = selectAssignmentProfileDate(
        selected,
        date,
        assignmentProfileClickCount({ nativeEvent: { detail } }),
      );
    }
    assert.deepEqual(selected, ['2026-10-02']);
  });

  it('keeps an already selected day after both clicks of a double-click', () => {
    let selected = ['2026-10-01', '2026-10-02', '2026-10-03'];
    selected = selectAssignmentProfileDate(selected, '2026-10-02', 1);
    assert.deepEqual(selected, ['2026-10-01', '2026-10-03']);
    selected = selectAssignmentProfileDate(selected, '2026-10-02', 2);
    assert.deepEqual(selected, ['2026-10-02']);
  });

  it('treats keyboard activation with detail zero and a native press as single selections', () => {
    const keyboardCount = assignmentProfileClickCount({ nativeEvent: { detail: 0 } });
    assert.deepEqual(
      selectAssignmentProfileDate(['2026-10-01'], '2026-10-02', keyboardCount),
      ['2026-10-01', '2026-10-02'],
    );
    assert.deepEqual(
      selectAssignmentProfileDate(['2026-10-01'], '2026-10-01', keyboardCount),
      [],
    );
    assert.equal(assignmentProfileClickCount({ nativeEvent: {} }), 1);
    assert.equal(assignmentProfileClickCount({}), 1);
  });
});

describe('Einsatzprofile: mehrere Tage mit gemeinsamer Uhrzeit freigeben', () => {
  it('deduplicates and orders local calendar dates without shifting daylight-saving dates', async () => {
    const requested = ['2026-10-26', '2026-10-25', '2026-03-29', '2026-10-25'];
    const calls: string[] = [];
    const result = await scheduleAssignmentProfileDates(requested, async (date) => {
      calls.push(date);
      return { ok: true };
    });
    assert.deepEqual(calls, ['2026-03-29', '2026-10-25', '2026-10-26']);
    assert.deepEqual(result.confirmedDates, calls);
    assert.deepEqual(result.remainingDates, []);
    assert.equal(result.error, null);
    assert.equal(result.interrupted, false);
    assert.equal(result.uncertain, false);
    assert.deepEqual(requested, ['2026-10-26', '2026-10-25', '2026-03-29', '2026-10-25']);
  });

  it('waits for each save and immediately confirms it before starting the next date', async () => {
    const trace: string[] = [];
    let releaseFirst!: (value: { ok: true }) => void;
    const firstSave = new Promise<{ ok: true }>((resolve) => { releaseFirst = resolve; });
    const batch = scheduleAssignmentProfileDates(
      ['2026-10-01', '2026-10-02'],
      (date) => {
        trace.push(`save:${date}`);
        return date === '2026-10-01' ? firstSave : Promise.resolve({ ok: true });
      },
      { onConfirmed: (date) => { trace.push(`confirmed:${date}`); } },
    );
    assert.deepEqual(trace, ['save:2026-10-01']);
    releaseFirst({ ok: true });
    const result = await batch;
    assert.deepEqual(trace, [
      'save:2026-10-01',
      'confirmed:2026-10-01',
      'save:2026-10-02',
      'confirmed:2026-10-02',
    ]);
    assert.deepEqual(result.confirmedDates, ['2026-10-01', '2026-10-02']);
  });

  it('stops at a rejected date and retries only failed and unattempted days', async () => {
    const calls: string[] = [];
    const confirmed: string[] = [];
    const first = await scheduleAssignmentProfileDates(
      ['2026-10-01', '2026-10-02', '2026-10-03'],
      async (date) => {
        calls.push(date);
        return date === '2026-10-02'
          ? { ok: false, error: 'Die mitarbeitende Person ist zu dieser Zeit bereits eingeplant.' }
          : { ok: true };
      },
      { onConfirmed: (date) => { confirmed.push(date); } },
    );
    assert.deepEqual(calls, ['2026-10-01', '2026-10-02']);
    assert.deepEqual(confirmed, ['2026-10-01']);
    assert.deepEqual(first.confirmedDates, ['2026-10-01']);
    assert.deepEqual(first.remainingDates, ['2026-10-02', '2026-10-03']);
    assert.equal(first.failedDate, '2026-10-02');
    assert.equal(first.error, 'Die mitarbeitende Person ist zu dieser Zeit bereits eingeplant.');
    assert.equal(first.uncertain, false);
    assert.equal(first.interrupted, false);

    const retried = await scheduleAssignmentProfileDates(first.remainingDates, async (date) => {
      calls.push(date);
      return { ok: true };
    });
    assert.deepEqual(calls, ['2026-10-01', '2026-10-02', '2026-10-02', '2026-10-03']);
    assert.deepEqual(retried.confirmedDates, ['2026-10-02', '2026-10-03']);
    assert.deepEqual(retried.remainingDates, []);
  });

  it('marks a thrown save as uncertain and neither retries it nor attempts later dates', async () => {
    const calls: string[] = [];
    const result = await scheduleAssignmentProfileDates(
      ['2026-10-01', '2026-10-02', '2026-10-03'],
      async (date) => {
        calls.push(date);
        if (date === '2026-10-02') throw new Error('Connection lost after sending the request');
        return { ok: true };
      },
    );
    assert.deepEqual(calls, ['2026-10-01', '2026-10-02']);
    assert.deepEqual(result.confirmedDates, ['2026-10-01']);
    assert.deepEqual(result.remainingDates, ['2026-10-02', '2026-10-03']);
    assert.equal(result.failedDate, '2026-10-02');
    assert.equal(result.uncertain, true);
    assert.equal(result.interrupted, false);
    assert.equal(typeof result.error, 'string');
    assert.ok(result.error);
  });

  it('preserves an unconfirmed RPC response as uncertain without submitting further days', async () => {
    const calls: string[] = [];
    const confirmed: string[] = [];
    const result = await scheduleAssignmentProfileDates(
      ['2026-10-01', '2026-10-02', '2026-10-03'],
      async (date) => {
        calls.push(date);
        return date === '2026-10-02'
          ? { ok: false, error: 'Verbindung unterbrochen.', uncertain: true }
          : { ok: true };
      },
      { onConfirmed: (date) => { confirmed.push(date); } },
    );
    assert.deepEqual(calls, ['2026-10-01', '2026-10-02']);
    assert.deepEqual(confirmed, ['2026-10-01']);
    assert.deepEqual(result.confirmedDates, ['2026-10-01']);
    assert.deepEqual(result.remainingDates, ['2026-10-02', '2026-10-03']);
    assert.equal(result.failedDate, '2026-10-02');
    assert.equal(result.uncertain, true);
    assert.equal(result.interrupted, false);
    assert.ok(result.error);
  });

  it('keeps an in-flight confirmation but stops later dates after the tenant or filter changes', async () => {
    let currentScope = true;
    let releaseSave!: (value: { ok: true }) => void;
    const inFlightSave = new Promise<{ ok: true }>((resolve) => { releaseSave = resolve; });
    const calls: string[] = [];
    const confirmed: string[] = [];
    const batch = scheduleAssignmentProfileDates(
      ['2026-10-01', '2026-10-02', '2026-10-03'],
      (date) => {
        calls.push(date);
        return inFlightSave;
      },
      {
        shouldContinue: () => currentScope,
        onConfirmed: (date) => { confirmed.push(date); },
      },
    );
    assert.deepEqual(calls, ['2026-10-01']);
    currentScope = false;
    releaseSave({ ok: true });
    const result = await batch;
    assert.deepEqual(calls, ['2026-10-01']);
    assert.deepEqual(confirmed, ['2026-10-01']);
    assert.deepEqual(result.confirmedDates, ['2026-10-01']);
    assert.deepEqual(result.remainingDates, ['2026-10-02', '2026-10-03']);
    assert.equal(result.interrupted, true);
    assert.equal(result.failedDate, null);
    assert.equal(result.error, null);
    assert.equal(result.uncertain, false);
  });

  it('does not start a save when the scope is already invalid', async () => {
    let callCount = 0;
    const result = await scheduleAssignmentProfileDates(
      ['2026-10-01'],
      async () => { callCount += 1; return { ok: true }; },
      { shouldContinue: () => false },
    );
    assert.equal(callCount, 0);
    assert.deepEqual(result.confirmedDates, []);
    assert.deepEqual(result.remainingDates, ['2026-10-01']);
    assert.equal(result.interrupted, true);
  });
});

describe('Einsatzprofile: bestätigte Ablehnung oder unklarer Speicherstatus', () => {
  it('recognizes database conflicts, invalid input, permissions and explicit rollback errors', () => {
    const rejections = [
      '23P01', '23505', '23502', '23503', '23514',
      '22P02', '22004', '22007', '22008',
      '42501', '42703', '42883', '42P01',
      'P0001', 'P0002', '40001', '40P01',
    ];
    for (const code of rejections) {
      assert.equal(isDefiniteAssignmentScheduleRejection({ code }), true, code);
    }
  });

  it('keeps missing, connection-related and unknown codes uncertain', () => {
    for (const error of [
      null,
      undefined,
      'fetch failed',
      new Error('fetch failed'),
      {},
      { message: 'fetch failed' },
      { code: '' },
      { code: null },
      { code: 23505 },
      { code: '08006', message: 'connection failure' },
      { code: 'ECONNRESET' },
      { code: 'ETIMEDOUT' },
      { code: 'PGRST000' },
      { code: 'unknown-error' },
    ]) {
      assert.equal(isDefiniteAssignmentScheduleRejection(error), false, JSON.stringify(error));
    }
  });
});
