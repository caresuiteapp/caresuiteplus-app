import { describe, expect, it } from 'vitest';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { localDateTimeInput, localDateTimeToIso, reviewCorrectionChanged, reviewEntryProtected, validateReviewCorrection, validateReviewRange, validReviewDate } from '@/components/wfm/wfmOfficeReviewDraft.web';

const baseline = { actualStartAt: '2026-10-17T20:00:00.000Z', actualEndAt: '2026-10-18T04:00:00.000Z', pauseMinutes: 30, reviewStatus: 'pending_review', exportStatus: 'not_exported' } as WfmOfficeTimeEntry;
const now = Date.parse('2026-10-18T06:00:00Z');

describe('Web Arbeitszeit correction draft', () => {
  it('preserves a complete overnight interval, seconds and local date', () => {
    const iso = '2026-10-17T22:41:37.000Z';
    expect(localDateTimeToIso(localDateTimeInput(iso))).toBe(iso);
    expect(validateReviewCorrection(baseline.actualStartAt!, baseline.actualEndAt!, '30', now)).toBeNull();
  });
  it.each(['2026-02-30T09:00', '2026-13-01T09:00', '2026-10-18T25:00', 'invalid', '2026-10-18'])('rejects an invalid date or time without normalising it: %s', value => {
    expect(localDateTimeToIso(value)).toBe('');
  });
  it.each(['', '-1', '1.5', '1e2', 'NaN', 'Infinity', '999999999999999999'])('rejects invalid pause input: %s', pause => {
    expect(validateReviewCorrection(baseline.actualStartAt!, baseline.actualEndAt!, pause, now)).not.toBeNull();
  });
  it('rejects future, reversed, incomplete and over-paused work times', () => {
    expect(validateReviewCorrection('', baseline.actualEndAt!, '0', now)).not.toBeNull();
    expect(validateReviewCorrection(baseline.actualEndAt!, baseline.actualStartAt!, '0', now)).not.toBeNull();
    expect(validateReviewCorrection(baseline.actualStartAt!, '2026-10-19T00:00:00Z', '0', now)).not.toBeNull();
    expect(validateReviewCorrection(baseline.actualStartAt!, baseline.actualEndAt!, '481', now)).not.toBeNull();
    expect(validateReviewCorrection(baseline.actualStartAt!, baseline.actualEndAt!, '480', now)).toBeNull();
  });
  it('identifies edits without losing assignment-only defaults', () => {
    expect(reviewCorrectionChanged(baseline, baseline.actualStartAt!, baseline.actualEndAt!, '30')).toBe(false);
    expect(reviewCorrectionChanged(baseline, baseline.actualStartAt!, baseline.actualEndAt!, '31')).toBe(true);
    const assignment = { ...baseline, actualStartAt: null, actualEndAt: null, assignmentActualStartAt: baseline.actualStartAt, assignmentActualEndAt: baseline.actualEndAt };
    expect(reviewCorrectionChanged(assignment, baseline.actualStartAt!, baseline.actualEndAt!, '30')).toBe(false);
  });
  it('protects exported and locked entries independently of editable flags', () => {
    expect(reviewEntryProtected(baseline)).toBe(false);
    expect(reviewEntryProtected({ ...baseline, exportStatus: 'exported', canEdit: true })).toBe(true);
    expect(reviewEntryProtected({ ...baseline, reviewStatus: 'exported' })).toBe(true);
    expect(reviewEntryProtected({ ...baseline, reviewStatus: 'locked' })).toBe(true);
  });
  it('requires valid ordered custom dates including leap days', () => {
    expect(validReviewDate('2026-02-29')).toBe(false);
    expect(validReviewDate('2028-02-29')).toBe(true);
    expect(validateReviewRange('2026-10-18', '2026-10-01')).not.toBeNull();
    expect(validateReviewRange('2026-10-01', '2026-10-18')).toBeNull();
  });
});
