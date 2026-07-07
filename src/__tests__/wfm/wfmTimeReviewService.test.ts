import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildReferenceKey,
  buildReferenceKeyFromEntry,
  coerceReferenceUuid,
  deriveExportBlocking,
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
    expect(mapDbReviewStatusToUi('needs_clarification')).toBe('pending_review');
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
