import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCorrectionCsv,
  buildCorrectionReferenceKey,
  buildLogicalReferenceKey,
  buildReviewVersionHash,
  CORRECTION_CSV_HEADER,
} from '@/lib/wfm/wfmTimeExportPayloadBuilder';
import {
  canFinalizeCorrectionExport,
  canMarkExportDrift,
  getReviewCorrectionExportBlockReason,
  isReviewCorrectionCandidate,
  isReviewCorrectionExportable,
  isReviewExportable,
} from '@/lib/wfm/wfmTimeExportPolicy';
import {
  buildCorrectionExportCsv,
  createCorrectionDraft,
  createExportDraft,
  detectChangedAfterExport,
  finalizeCorrectionExport,
  finalizeExportBatch,
  listCorrectionCandidates,
  listDemoExportItems,
  mapCorrectionItemsToRpcPayload,
  markChangedAfterExport,
  resetWfmTimeExportDemoStore,
  setDemoReviewExportChanged,
  validateCorrectionDraft,
} from '@/lib/wfm/wfmTimeExportService';
import {
  listDemoReviewActions,
  resetWfmTimeReviewDemoStore,
  transitionReviewStatus,
  upsertReview,
} from '@/lib/wfm/wfmTimeReviewService';

vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'demo' }));

const TENANT = 'b2222222-2222-4222-8222-222222222201';
const EMP = 'b2222222-2222-4222-8222-222222222231';
const ACTOR = 'b2222222-2222-4222-8222-222222222211';
const ROLE = 'business_admin' as const;
const EMPLOYEE_ROLE = 'employee_portal' as const;
const WORK_DATE = '2026-07-07';
const SESSION = 'b2222222-2222-4222-8222-222222222241';
const PERIOD = { startDate: WORK_DATE, endDate: WORK_DATE };
const CORRECTION_REASON = 'Korrektur wegen geänderter Arbeitszeit nach Export';

async function seedApprovedReview(minutes = 480) {
  const entryId = `session:${SESSION}`;
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
  return entryId;
}

async function seedExportedReview() {
  await seedApprovedReview();
  const draft = await createExportDraft(TENANT, ACTOR, ROLE, PERIOD);
  if (!draft.ok) throw new Error('draft failed');
  const finalized = await finalizeExportBatch(TENANT, ACTOR, ROLE, draft.data.job.id);
  if (!finalized.ok) throw new Error('finalize failed');
  return { draft, finalized };
}

describe('wfm P2.3 policy', () => {
  it('keeps initial export policy unchanged for export_ready reviews', () => {
    const base = {
      reviewStatus: 'approved' as const,
      exportBlocking: false,
      referenceKey: 'tenant:emp:2026-07-07:session:abc',
    };
    expect(isReviewExportable(base)).toBe(true);
    expect(isReviewCorrectionCandidate({ ...base, changedAfterExport: true, hasActiveExportItem: true })).toBe(true);
    expect(isReviewExportable({ ...base, exportStatus: 'changed_after_export', changedAfterExport: true })).toBe(false);
  });

  it('blocks correction export without drift and requires reason on finalize', () => {
    const exported = {
      reviewStatus: 'approved' as const,
      exportBlocking: false,
      referenceKey: 'key',
      exportStatus: 'exported' as const,
      hasActiveExportItem: true,
      lastExportJobId: 'job-1',
    };
    expect(isReviewCorrectionCandidate(exported)).toBe(false);
    expect(getReviewCorrectionExportBlockReason(exported)).toBe('no_drift_detected');

    const drift = { ...exported, exportStatus: 'changed_after_export' as const, changedAfterExport: true };
    expect(isReviewCorrectionCandidate(drift)).toBe(true);
    expect(isReviewCorrectionExportable(drift)).toBe(true);
    expect(
      getReviewCorrectionExportBlockReason({ ...drift, correctionReason: 'zu kurz' }),
    ).toBe('missing_correction_reason');
  });

  it('enforces permissions for drift mark and correction finalize', () => {
    expect(canMarkExportDrift(ROLE)).toBeNull();
    expect(canFinalizeCorrectionExport(ROLE)).toBeNull();
    expect(canMarkExportDrift(EMPLOYEE_ROLE)?.ok).toBe(false);
    expect(canFinalizeCorrectionExport(EMPLOYEE_ROLE)?.ok).toBe(false);
  });
});

describe('wfm P2.3 payload/hash/csv', () => {
  it('versions logical and correction reference keys', () => {
    const logical = buildLogicalReferenceKey('review-uuid');
    expect(logical).toBe('review:review-uuid');
    expect(buildCorrectionReferenceKey(logical, 1)).toBe(logical);
    expect(buildCorrectionReferenceKey(logical, 2)).toBe('review:review-uuid:correction:2');
  });

  it('builds live review version hash from export-relevant fields', () => {
    const hashA = buildReviewVersionHash({
      reviewId: 'r1',
      tenantId: TENANT,
      employeeId: EMP,
      periodDate: WORK_DATE,
      entryKind: 'session',
      minutesTotal: 480,
      pauseMinutes: 30,
      referenceId: 'ref',
      referenceKey: 'key',
      logicalReferenceKey: 'review:r1',
      reviewStatus: 'approved',
      exportBlocking: false,
    });
    const hashB = buildReviewVersionHash({
      reviewId: 'r1',
      tenantId: TENANT,
      employeeId: EMP,
      periodDate: WORK_DATE,
      entryKind: 'session',
      minutesTotal: 120,
      pauseMinutes: 30,
      referenceId: 'ref',
      referenceKey: 'key',
      logicalReferenceKey: 'review:r1',
      reviewStatus: 'approved',
      exportBlocking: false,
    });
    expect(hashA).not.toBe(hashB);
  });

  it('renders delta correction csv header and row', () => {
    const csv = buildCorrectionCsv([
      {
        exportKind: 'correction_delta',
        logicalReferenceKey: 'review:r1',
        referenceKey: 'review:r1:correction:2',
        exportSequence: 2,
        originalExportJobId: 'job-1',
        correctionExportJobId: 'job-2',
        originalExportItemId: 'item-1',
        newExportItemId: 'item-2',
        employeeId: EMP,
        employeeName: 'Max',
        entryKind: 'session',
        periodDate: WORK_DATE,
        changedFields: ['minutesTotal'],
        oldValues: { minutesTotal: 480 },
        newValues: { minutesTotal: 420 },
        deltaMinutes: -60,
        correctionReason: CORRECTION_REASON,
        finalizedAt: '2026-07-08T10:00:00.000Z',
        finalizedBy: ACTOR,
        payloadHash: 'hash-new',
        previousPayloadHash: 'hash-old',
      },
    ]);
    expect(csv.startsWith(CORRECTION_CSV_HEADER)).toBe(true);
    expect(csv).toContain('correction_delta');
    expect(csv).toContain('delta_minutes');
    expect(csv).toContain('-60');
  });
});

describe('wfm P2.3 service flows', () => {
  beforeEach(() => {
    resetWfmTimeReviewDemoStore();
    resetWfmTimeExportDemoStore();
  });

  it('marks changed_after_export idempotently and lists correction candidates', async () => {
    const { finalized } = await seedExportedReview();
    const reviewId = finalized.data.items[0]?.reviewId;
    if (!reviewId) throw new Error('missing review');

    const first = await markChangedAfterExport(TENANT, ACTOR, ROLE, reviewId, CORRECTION_REASON);
    expect(first.ok).toBe(true);

    const second = await markChangedAfterExport(TENANT, ACTOR, ROLE, reviewId, CORRECTION_REASON);
    expect(second.ok).toBe(true);
    expect(
      listDemoReviewActions().filter(
        (action) =>
          action.action === 'export_change_detected' ||
          action.action === 'changed_after_export_detected',
      ),
    ).toHaveLength(1);

    const candidates = await listCorrectionCandidates(TENANT, ROLE, PERIOD);
    expect(candidates.ok).toBe(true);
    if (!candidates.ok) return;
    expect(candidates.data.some((row) => row.id === reviewId)).toBe(true);
  });

  it('createCorrectionDraft does not persist active correction items before finalize', async () => {
    const { finalized } = await seedExportedReview();
    const reviewId = finalized.data.items[0]?.reviewId;
    if (!reviewId) throw new Error('missing review');

    setDemoReviewExportChanged(TENANT, reviewId, finalized.data.job.id);

    const draft = await createCorrectionDraft(
      TENANT,
      ACTOR,
      ROLE,
      PERIOD,
      [reviewId],
      CORRECTION_REASON,
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const itemsForJob = listDemoExportItems().filter(
      (item) => item.exportJobId === draft.data.job.id,
    );
    expect(itemsForJob).toHaveLength(0);
  });

  it('mapCorrectionItemsToRpcPayload includes required rpc fields', async () => {
    const { finalized } = await seedExportedReview();
    const reviewId = finalized.data.items[0]?.reviewId;
    if (!reviewId) throw new Error('missing review');
    setDemoReviewExportChanged(TENANT, reviewId, finalized.data.job.id);

    const draft = await createCorrectionDraft(
      TENANT,
      ACTOR,
      ROLE,
      PERIOD,
      [reviewId],
      CORRECTION_REASON,
    );
    if (!draft.ok) throw new Error('draft failed');
    await validateCorrectionDraft(TENANT, ROLE, draft.data.job.id);
    const done = await finalizeCorrectionExport(TENANT, ACTOR, ROLE, draft.data.job.id);
    if (!done.ok) throw new Error('finalize failed');

    const rpcPayload = mapCorrectionItemsToRpcPayload(done.data.items);
    expect(rpcPayload[0]?.original_export_item_id).toBeTruthy();
    expect(rpcPayload[0]?.logical_reference_key).toContain('review:');
    expect(rpcPayload[0]?.new_reference_key).toContain(':correction:');
    expect(rpcPayload[0]?.correction_payload_delta).toBeTruthy();
    expect(rpcPayload[0]?.payload_hash).toBeTruthy();
  });

  it('runs correction draft validate finalize and supersedes old item', async () => {
    const { finalized } = await seedExportedReview();
    const reviewId = finalized.data.items[0]?.reviewId;
    if (!reviewId) throw new Error('missing review');

    setDemoReviewExportChanged(TENANT, reviewId, finalized.data.job.id);

    const draft = await createCorrectionDraft(
      TENANT,
      ACTOR,
      ROLE,
      PERIOD,
      [reviewId],
      CORRECTION_REASON,
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    expect(draft.data.job.exportType).toBe('reviewed_time_correction');
    expect(draft.data.job.exportScope).toBe('delta_correction');

    const validation = await validateCorrectionDraft(TENANT, ROLE, draft.data.job.id);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.data.valid).toBe(true);

    const correction = await finalizeCorrectionExport(TENANT, ACTOR, ROLE, draft.data.job.id);
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;
    expect(correction.data.job.status).toBe('finalized');
    expect(correction.data.supersededItemIds).toHaveLength(1);
    expect(correction.data.items[0]?.exportSequence).toBeGreaterThan(1);

    const csv = await buildCorrectionExportCsv(TENANT, ROLE, draft.data.job.id);
    expect(csv.ok).toBe(true);
    if (!csv.ok) return;
    expect(csv.data.rowCount).toBe(1);
    expect(csv.data.csv).toContain('correction_delta');
  });

  it('detectChangedAfterExport uses live hash and skips already marked reviews', async () => {
    const { finalized } = await seedExportedReview();
    const reviewId = finalized.data.items[0]?.reviewId;
    if (!reviewId) throw new Error('missing review');

    setDemoReviewExportChanged(TENANT, reviewId, finalized.data.job.id);
    const drift = await detectChangedAfterExport(TENANT, ACTOR, ROLE, { reviewId });
    expect(drift.ok).toBe(true);
    if (!drift.ok) return;
    expect(drift.data[0]?.changed).toBe(true);
  });
});
