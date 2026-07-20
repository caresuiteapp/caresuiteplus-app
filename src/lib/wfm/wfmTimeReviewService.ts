import type { ServiceResult } from '@/types';
import type { WfmOfficeTimeEntry, WfmOfficeTimeEntryStatus } from '@/types/modules/wfmOfficeTimekeeping';
import { shouldAutoPendingReview } from './wfmVisitDeviationAmpelService';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { resolveCanonicalWfmEmployeeId } from './wfmWorkSessionRepository';

const REVIEWS_TABLE = 'workforce_time_entry_reviews';
const ACTIONS_TABLE = 'workforce_time_review_actions';

export type WfmTimeReviewStatus =
  | 'open'
  | 'pending_review'
  | 'needs_clarification'
  | 'approved'
  | 'rejected'
  | 'corrected'
  | 'locked'
  | 'superseded';

export type WfmTimeReviewActionType =
  | 'created'
  | 'status_changed'
  | 'review_approved'
  | 'review_rejected'
  | 'review_corrected'
  | 'clarification_requested'
  | 'comment_added'
  | 'review_reopened'
  | 'locked'
  | 'superseded'
  | 'justification_updated'
  | 'export_marked'
  | 'export_finalized'
  | 'export_voided'
  | 'export_reopened'
  | 'changed_after_export_detected'
  | 'export_change_detected'
  | 'reexport_requested'
  | 'reexport_drafted'
  | 'reexport_finalized'
  | 'export_item_superseded'
  | 'correction_export_finalized';

export type WfmTimeReviewEntryKind = 'session' | 'visit' | 'manual' | 'meeting';

export interface WfmTimeEntryReview {
  id: string;
  tenantId: string;
  employeeId: string;
  workDate: string;
  entryKind: WfmTimeReviewEntryKind;
  referenceId: string;
  referenceKey: string;
  reviewStatus: WfmTimeReviewStatus;
  exportBlocking: boolean;
  reviewNote: string | null;
  officeComment: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface WfmTimeReviewAction {
  id: string;
  tenantId: string;
  entryReviewId: string;
  action: WfmTimeReviewActionType;
  prevStatus: WfmTimeReviewStatus | null;
  newStatus: WfmTimeReviewStatus | null;
  comment: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface ParsedOfficeEntryId {
  entryKind: WfmTimeReviewEntryKind;
  rawReferenceId: string;
  workDate: string | null;
}

export interface ReviewTransitionInput {
  entryId: string;
  employeeId: string;
  workDate: string;
  entryKind?: WfmTimeReviewEntryKind;
  rawReferenceId?: string;
  nextStatus: WfmTimeReviewStatus;
  reviewNote?: string | null;
  officeComment?: string | null;
  actorId: string;
  actionComment?: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const demoReviews = new Map<string, WfmTimeEntryReview>();
const demoActions: WfmTimeReviewAction[] = [];

const TERMINAL_REVIEW_STATUSES = new Set<WfmTimeReviewStatus>(['locked', 'superseded']);

export const OPEN_REVIEW_STATUSES: WfmTimeReviewStatus[] = ['pending_review', 'needs_clarification'];

export const WFM_REVIEW_SYSTEM_ACTOR = '00000000-0000-4000-8000-000000000099';

export function resetWfmTimeReviewDemoStore(): void {
  demoReviews.clear();
  demoActions.length = 0;
}

function shouldUseDemoStore(): boolean {
  return getServiceMode() !== 'supabase' || !getSupabaseClient();
}

export function coerceReferenceUuid(rawId: string): string {
  if (UUID_RE.test(rawId)) return rawId.toLowerCase();
  let h1 = 0x811c9dc5;
  let h2 = 0;
  for (let i = 0; i < rawId.length; i++) {
    h1 ^= rawId.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 = (h2 + rawId.charCodeAt(i) * (i + 1)) >>> 0;
  }
  const hex = (n: number, len: number) => (n >>> 0).toString(16).padStart(len, '0').slice(-len);
  return `${hex(h1, 8)}-${hex(h1 >>> 16, 4)}-4${hex(h2, 3)}-a${hex(h2 >>> 12, 3)}-${hex(h1 ^ h2, 12)}`;
}

export function buildReferenceKey(
  tenantId: string,
  employeeId: string,
  workDate: string,
  entryKind: WfmTimeReviewEntryKind,
  referenceId: string,
): string {
  return `${tenantId}:${employeeId}:${workDate}:${entryKind}:${referenceId}`;
}

export function parseOfficeEntryId(entryId: string): ParsedOfficeEntryId | null {
  if (entryId.startsWith('visit:')) {
    const [, visitId, workDate] = entryId.split(':');
    if (!visitId) return null;
    return { entryKind: 'visit', rawReferenceId: visitId, workDate: workDate ?? null };
  }
  if (entryId.startsWith('session:')) {
    return {
      entryKind: 'session',
      rawReferenceId: entryId.slice('session:'.length),
      workDate: null,
    };
  }
  return { entryKind: 'manual', rawReferenceId: entryId, workDate: null };
}

export function resolveReviewContext(
  tenantId: string,
  entryId: string,
  context?: { employeeId?: string; workDate?: string; entryKind?: WfmTimeReviewEntryKind },
): {
  employeeId: string;
  workDate: string;
  entryKind: WfmTimeReviewEntryKind;
  referenceId: string;
  referenceKey: string;
} {
  const parsed = parseOfficeEntryId(entryId);
  const entryKind = context?.entryKind ?? parsed?.entryKind ?? 'manual';
  const rawReferenceId = parsed?.rawReferenceId ?? entryId;
  const employeeId = context?.employeeId ?? '00000000-0000-4000-8000-000000000001';
  const workDate = context?.workDate ?? parsed?.workDate ?? new Date().toISOString().slice(0, 10);
  const referenceId = coerceReferenceUuid(rawReferenceId);
  const referenceKey = buildReferenceKey(tenantId, employeeId, workDate, entryKind, referenceId);
  return { employeeId, workDate, entryKind, referenceId, referenceKey };
}

export function buildReferenceKeyFromEntry(tenantId: string, entry: WfmOfficeTimeEntry): string {
  const parsed = parseOfficeEntryId(entry.id);
  if (parsed) {
    const workDate = parsed.workDate ?? entry.workDate;
    return buildReferenceKey(
      tenantId,
      entry.employeeId,
      workDate,
      parsed.entryKind,
      coerceReferenceUuid(parsed.rawReferenceId),
    );
  }
  return buildReferenceKey(
    tenantId,
    entry.employeeId,
    entry.workDate,
    'manual',
    coerceReferenceUuid(entry.id),
  );
}

export function mapDbReviewStatusToUi(status: WfmTimeReviewStatus): WfmOfficeTimeEntryStatus {
  if (status === 'superseded') return 'locked';
  return status as WfmOfficeTimeEntryStatus;
}

export function mapUiReviewDecisionToDb(
  decision: 'approved' | 'rejected' | 'exported' | 'locked' | 'open' | 'needs_clarification',
): WfmTimeReviewStatus {
  if (decision === 'exported') return 'approved';
  return decision;
}

export function isOpenReviewStatus(status: WfmTimeReviewStatus | WfmOfficeTimeEntryStatus): boolean {
  return status === 'pending_review' || status === 'needs_clarification';
}

export function resolveEntryKindFromOfficeEntry(entry: WfmOfficeTimeEntry): WfmTimeReviewEntryKind {
  const parsed = parseOfficeEntryId(entry.id);
  if (parsed?.entryKind === 'visit' || parsed?.entryKind === 'session') return parsed.entryKind;
  if (entry.id.startsWith('planned:') || entry.rowKind === 'planned_missing_actual') return 'visit';
  if (entry.sessionId || entry.id.startsWith('session:')) return 'session';
  return 'manual';
}

export function resolveReferenceRawId(entry: WfmOfficeTimeEntry): string | null {
  const parsed = parseOfficeEntryId(entry.id);
  if (parsed?.rawReferenceId) return parsed.rawReferenceId;
  if (entry.id.startsWith('planned:')) {
    const parts = entry.id.split(':');
    return entry.visitId ?? entry.assignmentId ?? parts[1] ?? null;
  }
  if (entry.sessionId) return entry.sessionId;
  if (entry.visitId) return entry.visitId;
  return entry.id || null;
}

export function entryRequiresReviewMaterialization(entry: WfmOfficeTimeEntry): boolean {
  if (
    entry.reviewStatus === 'approved' ||
    entry.reviewStatus === 'rejected' ||
    entry.reviewStatus === 'corrected' ||
    entry.reviewStatus === 'locked' ||
    entry.reviewStatus === 'exported'
  ) {
    return false;
  }
  if (isOpenReviewStatus(entry.reviewStatus)) return true;
  if (entry.rowKind === 'planned_missing_actual' || entry.rowKind === 'unplanned_actual') return true;
  if (shouldAutoPendingReview(entry.startAmpel, entry.endAmpel)) return true;
  if (entry.flags.includes('missing_booking') || entry.flags.includes('unplanned')) return true;
  return false;
}

export function deriveExportStatusFromReview(
  reviewStatus: WfmTimeReviewStatus,
  fallback: WfmOfficeTimeEntry['exportStatus'] = 'not_exported',
): WfmOfficeTimeEntry['exportStatus'] {
  if (reviewStatus === 'approved') return 'export_ready';
  if (fallback === 'exported') return 'exported';
  return 'not_exported';
}

function mapReviewRow(row: Record<string, unknown>): WfmTimeEntryReview {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    employeeId: String(row.employee_id),
    workDate: String(row.work_date),
    entryKind: row.entry_kind as WfmTimeReviewEntryKind,
    referenceId: String(row.reference_id),
    referenceKey: String(row.reference_key),
    reviewStatus: row.review_status as WfmTimeReviewStatus,
    exportBlocking: Boolean(row.export_blocking),
    reviewNote: (row.review_note as string | null) ?? null,
    officeComment: (row.office_comment as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    reviewedBy: (row.reviewed_by as string | null) ?? null,
  };
}

function resolveActionForTransition(
  prevStatus: WfmTimeReviewStatus | null,
  nextStatus: WfmTimeReviewStatus,
): WfmTimeReviewActionType {
  if (prevStatus === null) return 'created';
  if (nextStatus === 'approved') return 'review_approved';
  if (nextStatus === 'rejected') return 'review_rejected';
  if (nextStatus === 'corrected') return 'review_corrected';
  if (nextStatus === 'needs_clarification') return 'clarification_requested';
  if (nextStatus === 'locked') return 'locked';
  if (nextStatus === 'superseded') return 'superseded';
  if (nextStatus === 'open' && prevStatus !== 'open') return 'review_reopened';
  return 'status_changed';
}

function demoKey(tenantId: string, referenceKey: string): string {
  return `${tenantId}:${referenceKey}`;
}

export async function listReviewsForPeriod(
  tenantId: string,
  fromDate: string,
  toDate: string,
): Promise<ServiceResult<WfmTimeEntryReview[]>> {
  if (shouldUseDemoStore()) {
    const rows = [...demoReviews.values()].filter(
      (r) =>
        r.tenantId === tenantId && r.workDate >= fromDate && r.workDate <= toDate,
    );
    return { ok: true, data: rows };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: [] };

  const { data, error } = await fromUnknownTable(supabase, REVIEWS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('work_date', fromDate)
    .lte('work_date', toDate);

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapReviewRow(row as Record<string, unknown>)) };
}

export async function getReviewByReferenceKey(
  tenantId: string,
  referenceKey: string,
): Promise<ServiceResult<WfmTimeEntryReview | null>> {
  if (shouldUseDemoStore()) {
    return { ok: true, data: demoReviews.get(demoKey(tenantId, referenceKey)) ?? null };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: null };

  const { data, error } = await fromUnknownTable(supabase, REVIEWS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('reference_key', referenceKey)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: null };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: data ? mapReviewRow(data as Record<string, unknown>) : null };
}

export async function upsertReview(
  tenantId: string,
  actorId: string,
  input: ReviewTransitionInput,
): Promise<ServiceResult<WfmTimeEntryReview>> {
  const canonicalEmployee = await resolveCanonicalWfmEmployeeId(tenantId, input.employeeId);
  if (!canonicalEmployee.ok) return canonicalEmployee;

  const ctx = resolveReviewContext(tenantId, input.entryId, {
    employeeId: canonicalEmployee.data,
    workDate: input.workDate,
    entryKind: input.entryKind,
  });
  const exportBlocking = deriveExportBlocking(input.nextStatus);
  const now = new Date().toISOString();
  const isDecision = ['approved', 'rejected', 'needs_clarification', 'corrected', 'locked'].includes(
    input.nextStatus,
  );

  if (shouldUseDemoStore()) {
    const key = demoKey(tenantId, ctx.referenceKey);
    const existing = demoReviews.get(key);
    const prevStatus = existing?.reviewStatus ?? null;
    const review: WfmTimeEntryReview = {
      id: existing?.id ?? crypto.randomUUID(),
      tenantId,
      employeeId: ctx.employeeId,
      workDate: ctx.workDate,
      entryKind: ctx.entryKind,
      referenceId: ctx.referenceId,
      referenceKey: ctx.referenceKey,
      reviewStatus: input.nextStatus,
      exportBlocking,
      reviewNote: input.reviewNote ?? existing?.reviewNote ?? null,
      officeComment: input.officeComment ?? input.reviewNote ?? existing?.officeComment ?? null,
      reviewedAt: isDecision ? now : existing?.reviewedAt ?? null,
      reviewedBy: isDecision ? actorId : existing?.reviewedBy ?? null,
    };
    demoReviews.set(key, review);
    demoActions.push({
      id: crypto.randomUUID(),
      tenantId,
      entryReviewId: review.id,
      action: resolveActionForTransition(prevStatus, input.nextStatus),
      prevStatus,
      newStatus: input.nextStatus,
      comment: input.actionComment ?? input.reviewNote ?? null,
      actorId,
      createdAt: now,
    });
    return { ok: true, data: review };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Supabase-Client nicht verfügbar.' };
  }

  const existingResult = await getReviewByReferenceKey(tenantId, ctx.referenceKey);
  if (!existingResult.ok) return existingResult;
  const existing = existingResult.data;
  const prevStatus = existing?.reviewStatus ?? null;

  const payload = {
    tenant_id: tenantId,
    employee_id: ctx.employeeId,
    work_date: ctx.workDate,
    entry_kind: ctx.entryKind,
    reference_id: ctx.referenceId,
    reference_key: ctx.referenceKey,
    review_status: input.nextStatus,
    export_blocking: exportBlocking,
    review_note: input.reviewNote ?? existing?.reviewNote ?? null,
    office_comment: input.officeComment ?? input.reviewNote ?? existing?.officeComment ?? null,
    reviewed_at: isDecision ? now : existing?.reviewedAt ?? null,
    reviewed_by: isDecision ? actorId : existing?.reviewedBy ?? null,
    metadata: { source: 'wfm_p21_service' },
  };

  const { data, error } = await fromUnknownTable(supabase, REVIEWS_TABLE)
    .upsert(payload, { onConflict: 'tenant_id,reference_key' })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'Review-Tabelle nicht verfügbar (Migration 0240 fehlt).' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const review = mapReviewRow(data as Record<string, unknown>);
  const actionResult = await appendReviewAction(tenantId, actorId, {
    entryReviewId: review.id,
    action: resolveActionForTransition(prevStatus, input.nextStatus),
    prevStatus,
    newStatus: input.nextStatus,
    comment: input.actionComment ?? input.reviewNote ?? null,
  });
  if (!actionResult.ok) return actionResult;

  return { ok: true, data: review };
}

export async function transitionReviewStatus(
  tenantId: string,
  actorId: string,
  input: ReviewTransitionInput,
): Promise<ServiceResult<WfmTimeEntryReview>> {
  const existingResult = await getReviewByReferenceKey(
    tenantId,
    resolveReviewContext(tenantId, input.entryId, {
      employeeId: input.employeeId,
      workDate: input.workDate,
      entryKind: input.entryKind,
    }).referenceKey,
  );
  if (existingResult.ok && existingResult.data) {
    const current = existingResult.data.reviewStatus;
    if (TERMINAL_REVIEW_STATUSES.has(current) && input.nextStatus !== 'open') {
      return {
        ok: false,
        error: 'Gesperrter oder ersetzter Review-Status kann nicht ohne Reopen geändert werden.',
      };
    }
  }

  return upsertReview(tenantId, actorId, input);
}

export async function appendReviewAction(
  tenantId: string,
  actorId: string,
  input: {
    entryReviewId: string;
    action: WfmTimeReviewActionType;
    prevStatus?: WfmTimeReviewStatus | null;
    newStatus?: WfmTimeReviewStatus | null;
    comment?: string | null;
  },
): Promise<ServiceResult<WfmTimeReviewAction>> {
  const now = new Date().toISOString();

  if (shouldUseDemoStore()) {
    const action: WfmTimeReviewAction = {
      id: crypto.randomUUID(),
      tenantId,
      entryReviewId: input.entryReviewId,
      action: input.action,
      prevStatus: input.prevStatus ?? null,
      newStatus: input.newStatus ?? null,
      comment: input.comment ?? null,
      actorId,
      createdAt: now,
    };
    demoActions.push(action);
    return { ok: true, data: action };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase-Client nicht verfügbar.' };

  const { data, error } = await fromUnknownTable(supabase, ACTIONS_TABLE)
    .insert({
      tenant_id: tenantId,
      entry_review_id: input.entryReviewId,
      action: input.action,
      prev_status: input.prevStatus ?? null,
      new_status: input.newStatus ?? null,
      comment: input.comment ?? null,
      actor_id: actorId,
      source: 'office',
      metadata: { source: 'wfm_p21_service' },
    })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'Review-Action-Tabelle nicht verfügbar (Migration 0240 fehlt).' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const row = data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      id: String(row.id),
      tenantId,
      entryReviewId: String(row.entry_review_id),
      action: row.action as WfmTimeReviewActionType,
      prevStatus: (row.prev_status as WfmTimeReviewStatus | null) ?? null,
      newStatus: (row.new_status as WfmTimeReviewStatus | null) ?? null,
      comment: (row.comment as string | null) ?? null,
      actorId,
      createdAt: String(row.created_at),
    },
  };
}

export function deriveExportBlocking(status: WfmTimeReviewStatus): boolean {
  return !['approved', 'locked', 'superseded'].includes(status);
}

export async function ensurePendingReviewForEntry(
  tenantId: string,
  actorId: string,
  entry: WfmOfficeTimeEntry,
): Promise<ServiceResult<WfmTimeEntryReview | null>> {
  if (!entryRequiresReviewMaterialization(entry)) {
    return { ok: true, data: null };
  }

  const rawRef = resolveReferenceRawId(entry);
  if (!rawRef || !entry.employeeId || !entry.workDate) {
    return { ok: true, data: null };
  }

  const entryKind = resolveEntryKindFromOfficeEntry(entry);
  const referenceKey = buildReferenceKey(
    tenantId,
    entry.employeeId,
    entry.workDate,
    entryKind,
    coerceReferenceUuid(rawRef),
  );
  const existing = await getReviewByReferenceKey(tenantId, referenceKey);
  if (!existing.ok) return existing;
  if (existing.data) return { ok: true, data: existing.data };

  return upsertReview(tenantId, actorId, {
    entryId: entry.id,
    employeeId: entry.employeeId,
    workDate: entry.workDate,
    entryKind,
    nextStatus: 'pending_review',
    actorId,
    actionComment: 'Auto-materialized pending review',
  });
}

export async function countOpenReviewsForPeriod(
  tenantId: string,
  fromDate: string,
  toDate: string,
): Promise<ServiceResult<number>> {
  const listed = await listReviewsForPeriod(tenantId, fromDate, toDate);
  if (!listed.ok) return listed;
  return {
    ok: true,
    data: listed.data.filter((review) => isOpenReviewStatus(review.reviewStatus)).length,
  };
}

export async function listReviewActionsForReviews(
  tenantId: string,
  reviewIds: string[],
): Promise<ServiceResult<WfmTimeReviewAction[]>> {
  if (reviewIds.length === 0) return { ok: true, data: [] };

  if (shouldUseDemoStore()) {
    return {
      ok: true,
      data: demoActions.filter((action) => reviewIds.includes(action.entryReviewId)),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: [] };

  const { data, error } = await fromUnknownTable(supabase, ACTIONS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .in('entry_review_id', reviewIds)
    .order('created_at', { ascending: false });

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return {
    ok: true,
    data: (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        tenantId,
        entryReviewId: String(r.entry_review_id),
        action: r.action as WfmTimeReviewActionType,
        prevStatus: (r.prev_status as WfmTimeReviewStatus | null) ?? null,
        newStatus: (r.new_status as WfmTimeReviewStatus | null) ?? null,
        comment: (r.comment as string | null) ?? null,
        actorId: (r.actor_id as string | null) ?? null,
        createdAt: String(r.created_at),
      };
    }),
  };
}

export function pickLatestReviewActions(
  actions: WfmTimeReviewAction[],
): Map<string, WfmTimeReviewAction> {
  const map = new Map<string, WfmTimeReviewAction>();
  for (const action of actions) {
    if (!map.has(action.entryReviewId)) {
      map.set(action.entryReviewId, action);
    }
  }
  return map;
}

export function applyReviewToEntry(
  entry: WfmOfficeTimeEntry,
  review: WfmTimeEntryReview | null | undefined,
  latestAction?: WfmTimeReviewAction | null,
): WfmOfficeTimeEntry {
  if (!review) return entry;
  const uiStatus = mapDbReviewStatusToUi(review.reviewStatus);
  return {
    ...entry,
    reviewStatus: uiStatus,
    status: uiStatus,
    officeComment: review.officeComment ?? review.reviewNote ?? entry.officeComment,
    reviewNote: review.reviewNote ?? entry.reviewNote ?? null,
    reviewedAt: review.reviewedAt ?? entry.reviewedAt ?? null,
    reviewedBy: review.reviewedBy ?? entry.reviewedBy ?? null,
    lastReviewAction: latestAction?.action ?? entry.lastReviewAction ?? null,
    lastReviewComment: latestAction?.comment ?? entry.lastReviewComment ?? null,
    exportStatus: deriveExportStatusFromReview(review.reviewStatus, entry.exportStatus),
  };
}

export function listDemoReviewActions(): WfmTimeReviewAction[] {
  return [...demoActions];
}
