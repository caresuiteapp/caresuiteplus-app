import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildInternalCsv,
  cancelExportBatch,
  createExportDraft,
  finalizeExportBatch,
  listDemoExportItems,
  listExportItems,
  resetWfmTimeExportDemoStore,
  validateExportBatch,
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
const WORK_DATE = '2026-07-07';
const SESSION = 'b2222222-2222-4222-8222-222222222241';
const PERIOD = { startDate: WORK_DATE, endDate: WORK_DATE };

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

describe('wfmTimeExportService', () => {
  beforeEach(() => {
    resetWfmTimeReviewDemoStore();
    resetWfmTimeExportDemoStore();
  });

  it('createExportDraft writes draft job without items', async () => {
    await seedApprovedReview();
    const draft = await createExportDraft(TENANT, ACTOR, ROLE, PERIOD);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    expect(draft.data.job.status).toBe('draft');
    expect(draft.data.job.exportType).toBe('reviewed_time');
    expect(listDemoExportItems()).toHaveLength(0);
  });

  it('validateExportBatch detects blocked corrected reviews', async () => {
    await seedApprovedReview();
    await upsertReview(TENANT, ACTOR, {
      entryId: 'entry-corrected',
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'manual',
      nextStatus: 'corrected',
      actorId: ACTOR,
    });

    const draft = await createExportDraft(TENANT, ACTOR, ROLE, PERIOD);
    if (!draft.ok) throw new Error('draft failed');
    const validation = await validateExportBatch(TENANT, ROLE, draft.data.job.id);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.data.exportableCount).toBe(1);
    expect(validation.data.valid).toBe(true);
  });

  it('finalizeExportBatch writes items and marks reviews exported', async () => {
    await seedApprovedReview();
    const draft = await createExportDraft(TENANT, ACTOR, ROLE, PERIOD);
    if (!draft.ok) throw new Error('draft failed');

    const finalized = await finalizeExportBatch(TENANT, ACTOR, ROLE, draft.data.job.id);
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) return;

    expect(finalized.data.job.status).toBe('finalized');
    expect(finalized.data.items).toHaveLength(1);
    expect(finalized.data.items[0]?.reviewStatusAtExport).toBe('approved');

    const items = await listExportItems(TENANT, ROLE, draft.data.job.id);
    expect(items.ok).toBe(true);
    if (!items.ok) return;
    expect(items.data).toHaveLength(1);

    expect(
      listDemoReviewActions().some((action) => action.action === 'export_finalized'),
    ).toBe(true);
  });

  it('prevents duplicate finalize for same reference_key', async () => {
    await seedApprovedReview();
    const draft1 = await createExportDraft(TENANT, ACTOR, ROLE, PERIOD);
    if (!draft1.ok) throw new Error('draft1 failed');
    const first = await finalizeExportBatch(TENANT, ACTOR, ROLE, draft1.data.job.id);
    expect(first.ok).toBe(true);

    await seedApprovedReview();
    const draft2 = await createExportDraft(TENANT, ACTOR, ROLE, PERIOD);
    if (!draft2.ok) throw new Error('draft2 failed');
    const validation = await validateExportBatch(TENANT, ROLE, draft2.data.job.id);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.data.valid).toBe(false);
    expect(validation.data.blockedCount).toBeGreaterThan(0);
  });

  it('cancelExportBatch sets canceled status', async () => {
    await seedApprovedReview();
    const draft = await createExportDraft(TENANT, ACTOR, ROLE, PERIOD);
    if (!draft.ok) throw new Error('draft failed');
    const canceled = await cancelExportBatch(TENANT, ACTOR, ROLE, draft.data.job.id);
    expect(canceled.ok).toBe(true);
    if (!canceled.ok) return;
    expect(canceled.data.status).toBe('canceled');
  });

  it('buildInternalCsv renders payload-based csv', async () => {
    await seedApprovedReview();
    const draft = await createExportDraft(TENANT, ACTOR, ROLE, PERIOD);
    if (!draft.ok) throw new Error('draft failed');
    await finalizeExportBatch(TENANT, ACTOR, ROLE, draft.data.job.id);

    const csv = await buildInternalCsv(TENANT, ROLE, draft.data.job.id);
    expect(csv.ok).toBe(true);
    if (!csv.ok) return;
    expect(csv.data.csv.startsWith('reference_key;employee_id')).toBe(true);
    expect(csv.data.rowCount).toBe(1);
  });
});
