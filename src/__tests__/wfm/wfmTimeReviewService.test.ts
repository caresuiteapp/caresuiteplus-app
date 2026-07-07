import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildReferenceKey,
  buildReferenceKeyFromEntry,
  coerceReferenceUuid,
  countOpenReviewsForPeriod,
  deriveExportBlocking,
  ensurePendingReviewForEntry,
  entryRequiresReviewMaterialization,
  isOpenReviewStatus,
  listDemoReviewActions,
  listReviewsForPeriod,
  mapDbReviewStatusToUi,
  mapUiReviewDecisionToDb,
  parseOfficeEntryId,
  resetWfmTimeReviewDemoStore,
  transitionReviewStatus,
  upsertReview,
} from '@/lib/wfm/wfmTimeReviewService';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';

vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'demo' }));

const TENANT = 'b2222222-2222-4222-8222-222222222201';
const EMP = 'b2222222-2222-4222-8222-222222222231';
const ACTOR = 'b2222222-2222-4222-8222-222222222211';
const WORK_DATE = '2026-07-07';
const SESSION = 'b2222222-2222-4222-8222-222222222241';

describe('wfmTimeReviewService', () => {
  beforeEach(() => {
    resetWfmTimeReviewDemoStore();
  });

  it('builds stable reference keys and coerces non-uuid ids', () => {
    const refUuid = coerceReferenceUuid('visit-1');
    expect(refUuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(buildReferenceKey(TENANT, EMP, WORK_DATE, 'visit', refUuid)).toBe(
      `${TENANT}:${EMP}:${WORK_DATE}:visit:${refUuid}`,
    );
  });

  it('parses office entry ids', () => {
    expect(parseOfficeEntryId(`visit:${SESSION}:${WORK_DATE}`)).toEqual({
      entryKind: 'visit',
      rawReferenceId: SESSION,
      workDate: WORK_DATE,
    });
    expect(parseOfficeEntryId(`session:${SESSION}`)?.entryKind).toBe('session');
  });

  it('creates pending review and appends created action', async () => {
    const created = await upsertReview(TENANT, ACTOR, {
      entryId: `session:${SESSION}`,
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'session',
      nextStatus: 'pending_review',
      actorId: ACTOR,
    });
    expect(created.ok).toBe(true);
    expect(created.data?.reviewStatus).toBe('pending_review');
    expect(deriveExportBlocking('pending_review')).toBe(true);
    expect(listDemoReviewActions().some((a) => a.action === 'created')).toBe(true);
  });

  it('transitions pending to approved and rejected', async () => {
    const entryId = `session:${SESSION}`;
    await upsertReview(TENANT, ACTOR, {
      entryId,
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'session',
      nextStatus: 'pending_review',
      actorId: ACTOR,
    });

    const approved = await transitionReviewStatus(TENANT, ACTOR, {
      entryId,
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'session',
      nextStatus: 'approved',
      actorId: ACTOR,
      reviewNote: 'OK',
    });
    expect(approved.ok).toBe(true);
    expect(approved.data?.reviewStatus).toBe('approved');
    expect(deriveExportBlocking('approved')).toBe(false);
    expect(listDemoReviewActions().some((a) => a.action === 'review_approved')).toBe(true);

    await upsertReview(TENANT, ACTOR, {
      entryId: 'entry-reject',
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'manual',
      nextStatus: 'pending_review',
      actorId: ACTOR,
    });
    const rejected = await transitionReviewStatus(TENANT, ACTOR, {
      entryId: 'entry-reject',
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'manual',
      nextStatus: 'rejected',
      actorId: ACTOR,
      reviewNote: 'Unplausibel',
    });
    expect(rejected.ok).toBe(true);
    expect(rejected.data?.reviewStatus).toBe('rejected');
  });

  it('supports needs_clarification transition', async () => {
    const entryId = 'entry-clarify';
    await upsertReview(TENANT, ACTOR, {
      entryId,
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'manual',
      nextStatus: 'pending_review',
      actorId: ACTOR,
    });
    const clarified = await transitionReviewStatus(TENANT, ACTOR, {
      entryId,
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'manual',
      nextStatus: 'needs_clarification',
      actorId: ACTOR,
      reviewNote: 'Bitte nachreichen',
    });
    expect(clarified.ok).toBe(true);
    expect(clarified.data?.reviewStatus).toBe('needs_clarification');
    expect(mapDbReviewStatusToUi('needs_clarification')).toBe('needs_clarification');
    expect(listDemoReviewActions().some((a) => a.action === 'clarification_requested')).toBe(true);
  });

  it('materializes pending review once for review-required entry', async () => {
    const entry = {
      id: `session:${SESSION}`,
      tenantId: TENANT,
      employeeId: EMP,
      employeeName: 'Staging Employee',
      workDate: WORK_DATE,
      rowKind: 'planned_missing_actual',
      reviewStatus: 'pending_review',
      flags: ['missing_booking'],
    } as import('@/types/modules/wfmOfficeTimekeeping').WfmOfficeTimeEntry;

    expect(entryRequiresReviewMaterialization(entry)).toBe(true);
    const first = await ensurePendingReviewForEntry(TENANT, ACTOR, entry);
    const second = await ensurePendingReviewForEntry(TENANT, ACTOR, entry);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.data?.id).toBe(second.data?.id);

    const listed = await listReviewsForPeriod(TENANT, WORK_DATE, WORK_DATE);
    expect(listed.ok).toBe(true);
    expect(listed.data.length).toBe(1);
  });

  it('counts open reviews without approved/corrected', async () => {
    await upsertReview(TENANT, ACTOR, {
      entryId: 'entry-open-1',
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'manual',
      nextStatus: 'pending_review',
      actorId: ACTOR,
    });
    await upsertReview(TENANT, ACTOR, {
      entryId: 'entry-open-2',
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'manual',
      nextStatus: 'needs_clarification',
      actorId: ACTOR,
    });
    await upsertReview(TENANT, ACTOR, {
      entryId: 'entry-approved',
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'manual',
      nextStatus: 'approved',
      actorId: ACTOR,
    });
    await upsertReview(TENANT, ACTOR, {
      entryId: 'entry-corrected',
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'manual',
      nextStatus: 'corrected',
      actorId: ACTOR,
    });

    const openCount = await countOpenReviewsForPeriod(TENANT, WORK_DATE, WORK_DATE);
    expect(openCount.ok).toBe(true);
    expect(openCount.data).toBe(2);
    expect(isOpenReviewStatus('approved')).toBe(false);
    expect(isOpenReviewStatus('corrected')).toBe(false);
    expect(isOpenReviewStatus('needs_clarification')).toBe(true);
  });

  it('lists reviews for period', async () => {
    await upsertReview(TENANT, ACTOR, {
      entryId: `session:${SESSION}`,
      employeeId: EMP,
      workDate: WORK_DATE,
      entryKind: 'session',
      nextStatus: 'pending_review',
      actorId: ACTOR,
    });
    const listed = await listReviewsForPeriod(TENANT, WORK_DATE, WORK_DATE);
    expect(listed.ok).toBe(true);
    expect(listed.data.length).toBe(1);
  });

  it('maps UI decisions without export persistence fields', () => {
    expect(mapUiReviewDecisionToDb('approved')).toBe('approved');
    expect(mapUiReviewDecisionToDb('exported')).toBe('approved');
  });

  it('merges review reference key from office entry', () => {
    const entry = {
      id: `session:${SESSION}`,
      tenantId: TENANT,
      employeeId: EMP,
      workDate: WORK_DATE,
    } as WfmOfficeTimeEntry;
    expect(buildReferenceKeyFromEntry(TENANT, entry)).toContain(`${WORK_DATE}:session:${SESSION}`);
  });
});
