import { describe, expect, it } from 'vitest';
import {
  deriveReviewExportStatus,
  getReviewExportBlockReason,
  isFinalizedExportJobStatus,
  isReviewExportable,
  normalizeExportPeriod,
} from '@/lib/wfm/wfmTimeExportPolicy';

const base = {
  reviewStatus: 'approved' as const,
  exportBlocking: false,
  referenceKey: 'tenant:emp:2026-07-07:session:abc',
};

describe('wfmTimeExportPolicy', () => {
  it('allows approved with export_blocking=false', () => {
    expect(isReviewExportable(base)).toBe(true);
    expect(getReviewExportBlockReason(base)).toBeNull();
    expect(deriveReviewExportStatus(base)).toBe('export_ready');
  });

  it('blocks approved with export_blocking=true', () => {
    const review = { ...base, exportBlocking: true };
    expect(isReviewExportable(review)).toBe(false);
    expect(getReviewExportBlockReason(review)).toBe('export_blocking');
  });

  it('blocks non-approved review statuses', () => {
    const cases = [
      ['open', 'review_status_open'],
      ['pending_review', 'review_status_pending_review'],
      ['needs_clarification', 'review_status_needs_clarification'],
      ['rejected', 'review_status_rejected'],
      ['corrected', 'review_status_corrected'],
      ['locked', 'review_status_locked'],
      ['superseded', 'review_status_superseded'],
    ] as const;

    for (const [status, reason] of cases) {
      const review = { ...base, reviewStatus: status };
      expect(isReviewExportable(review)).toBe(false);
      expect(getReviewExportBlockReason(review)).toBe(reason);
    }
  });

  it('blocks already exported and changed_after_export', () => {
    expect(
      isReviewExportable({ ...base, exportStatus: 'exported' }),
    ).toBe(false);
    expect(
      getReviewExportBlockReason({ ...base, exportStatus: 'exported' }),
    ).toBe('already_exported');

    expect(
      isReviewExportable({ ...base, exportStatus: 'changed_after_export' }),
    ).toBe(false);
    expect(
      isReviewExportable({ ...base, changedAfterExport: true }),
    ).toBe(false);
  });

  it('blocks duplicate finalized reference keys', () => {
    const review = { ...base, hasFinalizedExportItem: true };
    expect(isReviewExportable(review)).toBe(false);
    expect(getReviewExportBlockReason(review)).toBe('already_exported');
  });

  it('normalizes export period', () => {
    expect(
      normalizeExportPeriod({ startDate: '2026-07-01', endDate: '2026-07-31' }),
    ).toEqual({ startDate: '2026-07-01', endDate: '2026-07-31' });
    expect(
      normalizeExportPeriod({ startDate: '2026-07-31', endDate: '2026-07-01' }),
    ).toBeNull();
  });

  it('detects finalized job statuses', () => {
    expect(isFinalizedExportJobStatus('finalized')).toBe(true);
    expect(isFinalizedExportJobStatus('completed')).toBe(true);
    expect(isFinalizedExportJobStatus('draft')).toBe(false);
  });
});
