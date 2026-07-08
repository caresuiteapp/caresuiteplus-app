import { describe, expect, it } from 'vitest';
import {
  buildExportPayloadForReview,
  calculateExportPayloadHash,
  normalizeExportMinutes,
} from '@/lib/wfm/wfmTimeExportPayloadBuilder';

const INPUT = {
  reviewId: 'review-1',
  employeeId: 'emp-1',
  referenceKey: 'tenant:emp:2026-07-07:session:abc',
  referenceId: 'abc',
  entryKind: 'session' as const,
  periodDate: '2026-07-07',
  minutesTotal: 480,
  reviewStatus: 'approved' as const,
};

describe('wfmTimeExportPayloadBuilder', () => {
  it('normalizes minutes to non-negative integers', () => {
    expect(normalizeExportMinutes(-5)).toBe(0);
    expect(normalizeExportMinutes(90.6)).toBe(91);
  });

  it('requires reference_key in payload', () => {
    expect(() =>
      buildExportPayloadForReview({ ...INPUT, referenceKey: '   ' }),
    ).toThrow(/reference_key/);
  });

  it('produces deterministic payload hash', () => {
    const payloadA = buildExportPayloadForReview(INPUT);
    const payloadB = buildExportPayloadForReview(INPUT);
    expect(calculateExportPayloadHash(payloadA)).toBe(calculateExportPayloadHash(payloadB));
  });

  it('changes hash when minutes change', () => {
    const base = buildExportPayloadForReview(INPUT);
    const changed = buildExportPayloadForReview({ ...INPUT, minutesTotal: 120 });
    expect(calculateExportPayloadHash(base)).not.toBe(calculateExportPayloadHash(changed));
  });

  it('includes csv-relevant fields', () => {
    const payload = buildExportPayloadForReview(INPUT);
    expect(payload.referenceKey).toBe(INPUT.referenceKey);
    expect(payload.employeeId).toBe(INPUT.employeeId);
    expect(payload.entryKind).toBe('session');
    expect(payload.periodDate).toBe('2026-07-07');
    expect(payload.minutesTotal).toBe(480);
    expect(payload.reviewStatus).toBe('approved');
  });
});
