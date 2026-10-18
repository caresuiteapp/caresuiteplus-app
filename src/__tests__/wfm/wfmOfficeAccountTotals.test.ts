import { describe, expect, it } from 'vitest';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import {
  calculateOfficeAbsenceCredit, hasOfficeContractSchedule, isOfficeAccountOpenReview,
  officeAccountRecordedMinutes, readAllOfficeAccountRows, readOfficeEmployeeAccountRows, resolveOfficeAccountTarget,
} from '@/lib/wfm/wfmOfficeAccountTotals';

const absence = (overrides: Record<string, unknown> = {}) => ({
  status: 'approved', absence_type: 'vacation', all_day: true,
  starts_at: '2026-10-19T00:00:00.000Z', ends_at: '2026-10-19T23:59:59.999Z', ...overrides,
});
const entry = (overrides: Partial<WfmOfficeTimeEntry> = {}) => ({
  actualStartAt: '2026-10-19T08:00:00Z', actualEndAt: '2026-10-19T09:00:00Z',
  pauseMinutes: 0, netMinutes: 60, source: 'portal', reviewStatus: 'open', flags: [], ...overrides,
} as WfmOfficeTimeEntry);

describe('Office web time account calculations', () => {
  it('preserves an explicit contractual or saved zero instead of replacing it with planned visits', () => {
    expect(resolveOfficeAccountTarget(0, 480, 120)).toEqual({ targetMinutes: 0, targetSource: 'contract' });
    expect(resolveOfficeAccountTarget(null, 0, 120)).toEqual({ targetMinutes: 0, targetSource: 'saved_account' });
    expect(resolveOfficeAccountTarget(null, null, 120)).toEqual({ targetMinutes: 120, targetSource: 'planned' });
    expect(hasOfficeContractSchedule({ mon: 0 })).toBe(true);
    expect(hasOfficeContractSchedule({ mon: '7.5', tue: 0 })).toBe(true);
    expect(hasOfficeContractSchedule({})).toBe(false);
    expect(hasOfficeContractSchedule({ mon: '' })).toBe(false);
    expect(hasOfficeContractSchedule({ mon: -1 })).toBe(false);
  });

  it('does not create review work from future planned entries', () => {
    expect(isOfficeAccountOpenReview(entry({ rowKind: 'planned_upcoming' }))).toBe(false);
    expect(isOfficeAccountOpenReview(entry({ flags: ['upcoming'] }))).toBe(false);
    expect(isOfficeAccountOpenReview(entry({ reviewStatus: 'corrected' }))).toBe(true);
    expect(isOfficeAccountOpenReview(entry({ reviewStatus: 'exported' }))).toBe(false);
  });

  it('keeps zero net time and subtracts a recorded break in legacy duration fallbacks', () => {
    expect(officeAccountRecordedMinutes(entry({ netMinutes: 0, pauseMinutes: 60 }))).toBe(0);
    expect(officeAccountRecordedMinutes(entry({ netMinutes: 0, pauseMinutes: 15 }))).toBe(45);
    expect(officeAccountRecordedMinutes(entry({ netMinutes: 0, source: 'correction' }))).toBe(0);
    expect(officeAccountRecordedMinutes(entry({ actualStartAt: null, actualEndAt: null, netMinutes: 100 }))).toBe(0);
  });

  it('credits overlapping approved all-day absences once and keeps UTC all-day date markers', () => {
    expect(calculateOfficeAbsenceCredit([
      absence(), absence({ absence_type: 'sick' }), absence({ status: 'rejected' }),
    ], { mon: 8, tue: 8 }, '2026-10-19', '2026-10-20')).toBe(480);
    expect(calculateOfficeAbsenceCredit([absence({ absence_type: 'unpaid_leave' })], { mon: 8 }, '2026-10-19', '2026-10-19')).toBe(0);
    expect(calculateOfficeAbsenceCredit([absence()], { mon: 0 }, '2026-10-19', '2026-10-19')).toBe(0);
  });

  it('unions partial absences and caps the credit at the contractual day', () => {
    const partial = absence({ all_day: false, starts_at: '2026-10-19T08:00:00Z', ends_at: '2026-10-19T10:00:00Z' });
    const overlap = absence({ all_day: false, starts_at: '2026-10-19T09:00:00Z', ends_at: '2026-10-19T11:00:00Z' });
    expect(calculateOfficeAbsenceCredit([partial, overlap], { mon: 8 }, '2026-10-19', '2026-10-19')).toBe(180);
    expect(calculateOfficeAbsenceCredit([partial, overlap], { mon: 2 }, '2026-10-19', '2026-10-19')).toBe(120);
    expect(calculateOfficeAbsenceCredit([partial, absence()], { mon: 8 }, '2026-10-19', '2026-10-19')).toBe(480);
  });

  it('splits timed absences at Berlin midnight and handles the DST change without losing an hour', () => {
    const overnight = absence({ all_day: false, starts_at: '2026-10-18T21:00:00Z', ends_at: '2026-10-18T23:00:00Z' });
    expect(calculateOfficeAbsenceCredit([overnight], { mon: 8 }, '2026-10-19', '2026-10-19')).toBe(60);
    const change = absence({ all_day: false, starts_at: '2026-10-24T22:00:00Z', ends_at: '2026-10-25T03:00:00Z' });
    expect(calculateOfficeAbsenceCredit([change], { sun: 8 }, '2026-10-25', '2026-10-25')).toBe(300);
    expect(calculateOfficeAbsenceCredit([absence()], { mon: 8 }, '2026-02-30', '2026-10-19')).toBe(0);
  });

  it('reads all pages and rejects failures or malformed later pages without returning partial success', async () => {
    const calls: [number, number][] = [];
    const complete = await readAllOfficeAccountRows(async (first, last) => {
      calls.push([first, last]);
      return { data: first === 0 ? Array.from({ length: 500 }, (_, id) => ({ id })) : [{ id: 500 }], error: null };
    });
    expect(complete.error).toBeNull();
    expect(complete.data).toHaveLength(501);
    expect(calls).toEqual([[0, 499], [500, 999]]);
    const failure = await readAllOfficeAccountRows(async first => ({ data: first === 0 ? Array.from({ length: 500 }, () => ({})) : null, error: first ? { code: '42501' } : null }));
    expect(failure.data).toEqual([]);
    expect(failure.error).toEqual({ code: '42501' });
    for (const data of [null, {}, [null], [[]]]) {
      const result = await readAllOfficeAccountRows(async () => ({ data, error: null }));
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it('bounds employee filters for a large team without dropping the last batch', async () => {
    const ids = Array.from({ length: 205 }, (_, index) => `employee-${index}`);
    const batches: number[] = [];
    const result = await readOfficeEmployeeAccountRows([...ids, ids[0]], async batch => {
      batches.push(batch.length);
      return { data: batch.map(employee_id => ({ employee_id })), error: null };
    });
    expect(batches).toEqual([100, 100, 5]);
    expect(result.data).toHaveLength(205);
  });
});
