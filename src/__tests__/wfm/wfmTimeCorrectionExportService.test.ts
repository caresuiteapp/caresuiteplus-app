import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCorrectionPayloadDelta,
  calculateExportPayloadHash,
} from '@/lib/wfm/wfmTimeExportPayloadBuilder';
import {
  isReviewCorrectionExportable,
  validateCorrectionReason,
} from '@/lib/wfm/wfmTimeExportPolicy';
import {
  compareReviewVersionToLatestExport,
  draftReviewedTimeCorrectionExport,
  finalizeReviewedTimeCorrectionExport,
  listReviewedTimeCorrectionCandidates,
  previewChangedAfterExport,
  validateCorrectionExportDraft,
} from '@/lib/wfm/wfmTimeCorrectionExportService';
import {
  createExportDraft,
  finalizeExportBatch,
  listDemoExportItems,
  resetWfmTimeExportDemoStore,
  setDemoReviewExportChanged,
  validateCorrectionDraft,
  validateExportBatch,
} from '@/lib/wfm/wfmTimeExportService';
import {
  resetWfmTimeReviewDemoStore,
  transitionReviewStatus,
  upsertReview,
} from '@/lib/wfm/wfmTimeReviewService';

vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'demo' }));

const TENANT = 'b2222222-2222-4222-8222-222222222201';
const EMP = 'b2222222-2222-4222-8222-222222222231';
const ACTOR = 'b2222222-2222-4222-8222-222222222211';
const ROLE = 'business_admin' as const;
const EMPLOYEE_ROLE = 'employee' as const;
const WORK_DATE = '2026-07-07';
const SESSION = 'b2222222-2222-4222-8222-222222222241';
const PERIOD = { startDate: WORK_DATE, endDate: WORK_DATE };
const REASON = 'Korrektur wegen geänderter Minuten nach Export';

async function seedApprovedReview(entryId = `session:${SESSION}`) {
  await upsertReview(TENANT, ACTOR, {
    entryId,
    employeeId: EMP,
    workDate: WORK_DATE,
    entryKind: 'session',
    nextStatus: 'pending_review',
    actorId: ACTOR,
  });
  await transitionReviewStatus(TENANT, ACTOR, {
    entryId,
    employeeId: EMP,
    workDate: WORK_DATE,
    entryKind: 'session',
    nextStatus: 'approved',
    actorId: ACTOR,
  });
}

async function seedFinalizedExport() {
  await seedApprovedReview();
  const draft = await createExportDraft(TENANT, ACTOR, ROLE, PERIOD);
  if (!draft.ok) throw new Error('draft failed');
  await validateExportBatch(TENANT, ROLE, draft.data.job.id);
  const finalized = await finalizeExportBatch(TENANT, ACTOR, ROLE, draft.data.job.id);
  if (!finalized.ok) throw new Error('finalize failed');
  return finalized.data;
}

describe('wfmTimeCorrectionExportService', () => {
  beforeEach(() => {
    resetWfmTimeReviewDemoStore();
    resetWfmTimeExportDemoStore();
  });

  it('validateCorrectionReason rejects short reason', () => {
    expect(validateCorrectionReason('kurz')).toMatch(/mindestens/);
    expect(validateCorrectionReason(REASON)).toBeNull();
  });

  it('isReviewCorrectionExportable allows changed_after_export with active item', () => {
    expect(
      isReviewCorrectionExportable({
        reviewStatus: 'approved',
        exportBlocking: false,
        exportStatus: 'changed_after_export',
        changedAfterExport: true,
        referenceKey: 'rk',
        employeeId: EMP,
        lastExportJobId: 'job-1',
        latestExportItemId: 'item-1',
        hasActiveExportItem: true,
        pendingReexportJobId: null,
        correctionReason: REASON,
      }),
    ).toBe(true);
  });

  it('blocks employee role for correction draft', async () => {
    const finalized = await seedFinalizedExport();
    const reviewId = listDemoExportItems()[0].reviewId;
    setDemoReviewExportChanged(TENANT, reviewId, finalized.job.id);
    const draft = await draftReviewedTimeCorrectionExport(TENANT, ACTOR, EMPLOYEE_ROLE, {
      reviewIds: [reviewId],
      correctionOfExportJobId: finalized.job.id,
      reason: REASON,
    });
    expect(draft.ok).toBe(false);
  });

  it('draft and finalize correction export in demo without overwriting payload hash', async () => {
    const finalized = await seedFinalizedExport();
    const originalItem = listDemoExportItems()[0];
    const originalHash = originalItem.payloadHash;

    setDemoReviewExportChanged(TENANT, originalItem.reviewId, finalized.job.id);

    const candidates = await listReviewedTimeCorrectionCandidates(TENANT, ROLE);
    expect(candidates.ok).toBe(true);
    if (!candidates.ok) return;

    const reviewId = candidates.data[0]?.id;
    expect(reviewId).toBeTruthy();

    const draft = await draftReviewedTimeCorrectionExport(TENANT, ACTOR, ROLE, {
      reviewIds: [reviewId!],
      correctionOfExportJobId: finalized.job.id,
      reason: REASON,
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    expect(draft.data.job.exportType).toBe('reviewed_time_correction');
    expect(draft.data.previewItems[0]?.previousPayloadHash).toBe(originalHash);
    expect(originalItem.payloadHash).toBe(originalHash);
    expect(
      listDemoExportItems().filter((item) => item.exportJobId === draft.data.job.id),
    ).toHaveLength(0);

    await validateCorrectionDraft(TENANT, ROLE, draft.data.job.id);

    const validation = await validateCorrectionExportDraft(
      TENANT,
      ROLE,
      draft.data.job.id,
      REASON,
    );
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.data.valid).toBe(true);

    const done = await finalizeReviewedTimeCorrectionExport(TENANT, ACTOR, ROLE, draft.data.job.id, REASON);
    expect(done.ok).toBe(true);
  });

  it('compareReviewVersionToLatestExport detects payload delta', () => {
    const review = {
      id: 'r1',
      tenantId: TENANT,
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'manual' as const,
      referenceId: 'ref',
      referenceKey: 'rk',
      reviewStatus: 'approved' as const,
      exportBlocking: false,
      exportStatus: 'exported' as const,
      changedAfterExport: true,
      lastExportJobId: 'job',
      lastExportedAt: null,
      metadata: { minutes_total: 500 },
    };
    const item = {
      id: 'i1',
      tenantId: TENANT,
      exportJobId: 'job',
      reviewId: 'r1',
      employeeId: EMP,
      referenceId: 'ref',
      referenceKey: 'rk',
      entryKind: 'manual' as const,
      periodDate: WORK_DATE,
      minutesTotal: 480,
      reviewStatusAtExport: 'approved' as const,
      exportedPayload: {
        schemaVersion: 1 as const,
        employeeId: EMP,
        referenceKey: 'rk',
        referenceId: 'ref',
        entryKind: 'manual' as const,
        periodDate: WORK_DATE,
        minutesTotal: 480,
        reviewStatus: 'approved' as const,
        reviewId: 'r1',
      },
      payloadHash: calculateExportPayloadHash({
        schemaVersion: 1,
        employeeId: EMP,
        referenceKey: 'rk',
        referenceId: 'ref',
        entryKind: 'manual',
        periodDate: WORK_DATE,
        minutesTotal: 480,
        reviewStatus: 'approved',
        reviewId: 'r1',
      }),
      changedAfterExport: false,
      createdAt: new Date().toISOString(),
      logicalReferenceKey: 'rk',
      exportSequence: 1,
      itemStatus: 'active' as const,
    };

    const preview = compareReviewVersionToLatestExport(review, item);
    expect(preview?.changed).toBe(true);
    expect(preview?.delta?.deltaMinutes).toBe(20);
  });

  it('previewChangedAfterExport is read-only', async () => {
    const finalized = await seedFinalizedExport();
    const beforeCount = listDemoExportItems().length;
    const reviewId = listDemoExportItems()[0].reviewId;
    const preview = await previewChangedAfterExport(TENANT, ROLE, reviewId);
    expect(preview.ok).toBe(true);
    expect(listDemoExportItems().length).toBe(beforeCount);
    void finalized;
  });

  it('buildCorrectionPayloadDelta stays stable', () => {
    const previous = {
      schemaVersion: 1 as const,
      employeeId: EMP,
      referenceKey: 'rk',
      referenceId: null,
      entryKind: 'manual' as const,
      periodDate: WORK_DATE,
      minutesTotal: 100,
      reviewStatus: 'approved' as const,
      reviewId: 'r1',
    };
    const current = {
      ...previous,
      minutesTotal: 120,
      logicalReferenceKey: 'review:r1',
      exportSequence: 2,
      correctionReason: REASON,
    };
    const delta = buildCorrectionPayloadDelta({ oldPayload: previous, newPayload: current });
    expect(delta.changedFields).toContain('minutesTotal');
    expect(delta.deltaMinutes).toBe(20);
  });
});
