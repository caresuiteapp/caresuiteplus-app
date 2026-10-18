import { describe, expect, it } from 'vitest';
import { berlinClockCandidates, berlinWorkDate, manualEntryRequest, validateManualEntryDraft, type ManualEntryDraft } from '@/components/wfm/wfmManualEntryDraft.web';

const base: ManualEntryDraft = { employeeId: 'employee', workDate: '2026-10-17', endDate: '2026-10-17', startTime: '08:00', endTime: '16:00', startClock: 'auto', endClock: 'auto', pauseMinutes: '30', workKind: 'buero', reason: 'Zeiterfassung war nicht verfügbar.' };
const now = Date.parse('2026-10-26T12:00:00Z');

describe('Web manual worktime draft', () => {
  it('uses the Berlin workday and produces exact instants independent of device timezone', () => {
    expect(berlinWorkDate(new Date('2026-10-17T22:30:00Z'))).toBe('2026-10-18');
    const result = validateManualEntryDraft(base, ['employee'], now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.actualStartAt).toBe('2026-10-17T06:00:00.000Z');
    expect(result.input.actualEndAt).toBe('2026-10-17T14:00:00.000Z');
    expect(result.netMinutes).toBe(450);
  });
  it('handles overnight shifts with an explicit end date', () => {
    const result = validateManualEntryDraft({ ...base, startTime: '22:00', endTime: '06:00', endDate: '2026-10-18' }, ['employee'], now);
    expect(result.ok && result.grossMinutes).toBe(480);
    expect(validateManualEntryDraft({ ...base, startTime: '22:00', endTime: '06:00' }, ['employee'], now).ok).toBe(false);
  });
  it('rejects nonexistent spring clock times and counts the real elapsed time across DST', () => {
    expect(berlinClockCandidates('2026-03-29', '02:30')).toEqual([]);
    expect(validateManualEntryDraft({ ...base, workDate: '2026-03-29', endDate: '2026-03-29', startTime: '02:30', endTime: '04:00' }, ['employee'], now).ok).toBe(false);
    const result = validateManualEntryDraft({ ...base, workDate: '2026-03-29', endDate: '2026-03-29', startTime: '01:30', endTime: '03:30', pauseMinutes: '0' }, ['employee'], now);
    expect(result.ok && result.netMinutes).toBe(60);
  });
  it('requires an explicit choice for repeated autumn clock times', () => {
    const repeat = { ...base, workDate: '2026-10-25', endDate: '2026-10-25', startTime: '02:15', endTime: '02:45', pauseMinutes: '0' };
    expect(berlinClockCandidates('2026-10-25', '02:15')).toHaveLength(2);
    expect(validateManualEntryDraft(repeat, ['employee'], now).ok).toBe(false);
    const result = validateManualEntryDraft({ ...repeat, startClock: 'summer', endClock: 'winter' }, ['employee'], now);
    expect(result.ok && result.netMinutes).toBe(90);
  });
  it.each([
    { patch: { pauseMinutes: '' } }, { patch: { pauseMinutes: '-1' } }, { patch: { pauseMinutes: '1.5' } },
    { patch: { pauseMinutes: '481' } }, { patch: { reason: '  ' } }, { patch: { employeeId: 'other' } },
    { patch: { workDate: '2026-02-30' } },
  ])('rejects invalid required values %#', ({ patch }) => {
    expect(validateManualEntryDraft({ ...base, ...patch }, ['employee'], now).ok).toBe(false);
  });
  it('rejects future work rather than silently creating a planned booking', () => {
    expect(validateManualEntryDraft(base, ['employee'], Date.parse('2026-10-17T10:00:00Z')).ok).toBe(false);
  });
  it('reuses the request UUID only for an identical retry', () => {
    const validated = validateManualEntryDraft(base, ['employee'], now);
    if (!validated.ok) throw new Error(validated.error);
    let sequence = 0;
    const createId = () => `request-${++sequence}`;
    const first = manualEntryRequest(null, validated.input, createId);
    expect(manualEntryRequest(first, { ...validated.input }, createId)).toBe(first);
    expect(sequence).toBe(1);
    const edited = manualEntryRequest(first, { ...validated.input, reason: 'Korrigierte Begründung' }, createId);
    expect(edited.id).toBe('request-2');
  });
});
