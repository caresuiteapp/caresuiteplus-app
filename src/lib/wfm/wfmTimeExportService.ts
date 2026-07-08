import type { RoleKey, ServiceResult } from '@/types';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  buildCorrectionCsv,
  buildCorrectionExportPayload,
  buildCorrectionPayloadDelta,
  buildExportPayloadForReview,
  buildLogicalReferenceKey,
  buildReviewVersionHash,
  calculateExportPayloadHash,
  normalizeExportMinutes,
  type WfmCorrectionExportPayload,
  type WfmCorrectionPayloadDelta,
  type WfmTimeExportPayload,
} from './wfmTimeExportPayloadBuilder';
import {
  canCreateReviewedTimeExport,
  canFinalizeCorrectionExport,
  canMarkExportDrift,
  correctionExportBlockReasonLabel,
  exportBlockReasonLabel,
  getReviewCorrectionExportBlockReason,
  getReviewExportBlockReason,
  isFinalizedExportJobStatus,
  isReviewCorrectionCandidate,
  isReviewCorrectionExportable,
  isReviewExportable,
  normalizeExportPeriod,
  type WfmTimeCorrectionExportBlockReason,
  type WfmTimeCorrectionExportReviewInput,
  type WfmTimeExportBlockReason,
  type WfmTimeExportJobStatus,
  type WfmTimeExportPeriod,
  type WfmTimeExportReviewInput,
  type WfmTimeExportStatus,
  type WfmTimeExportType,
  type WfmTimeExportItemStatus,
  type WfmTimeExportScope,
} from './wfmTimeExportPolicy';
import {
  appendReviewAction,
  type WfmTimeReviewActionType,
  type WfmTimeReviewEntryKind,
  type WfmTimeReviewStatus,
} from './wfmTimeReviewService';

function p23Action(action: string): WfmTimeReviewActionType {
  return action as WfmTimeReviewActionType;
}

const EXPORT_JOBS_TABLE = 'workforce_export_jobs';
const EXPORT_ITEMS_TABLE = 'workforce_time_export_items';
const REVIEWS_TABLE = 'workforce_time_entry_reviews';

export interface WfmTimeExportJob {
  id: string;
  tenantId: string;
  requestedBy: string;
  exportType: WfmTimeExportType;
  exportFormat: string;
  periodYear: number;
  periodMonth: number;
  periodStart: string | null;
  periodEnd: string | null;
  status: WfmTimeExportJobStatus;
  rowCount: number;
  contentHash: string | null;
  notes: string | null;
  finalizedAt: string | null;
  finalizedBy: string | null;
  canceledAt: string | null;
  canceledBy: string | null;
  createdAt: string;
  updatedAt: string;
  correctionOfExportJobId?: string | null;
  correctionReason?: string | null;
  correctionSequence?: number | null;
  exportScope?: WfmTimeExportScope | null;
}

export interface WfmTimeExportItem {
  id: string;
  tenantId: string;
  exportJobId: string;
  reviewId: string;
  employeeId: string;
  referenceId: string | null;
  referenceKey: string;
  entryKind: WfmTimeReviewEntryKind;
  periodDate: string;
  minutesTotal: number;
  reviewStatusAtExport: WfmTimeReviewStatus;
  exportedPayload: WfmTimeExportPayload;
  payloadHash: string;
  changedAfterExport: boolean;
  createdAt: string;
  logicalReferenceKey?: string;
  exportSequence?: number;
  itemStatus?: WfmTimeExportItemStatus;
  supersedesExportItemId?: string | null;
  supersededByExportItemId?: string | null;
  correctionReason?: string | null;
  sourceReviewVersionHash?: string | null;
  previousPayloadHash?: string | null;
  correctionPayloadDelta?: WfmCorrectionPayloadDelta | Record<string, unknown> | null;
  supersededAt?: string | null;
}

export interface WfmTimeExportReviewRow {
  id: string;
  tenantId: string;
  employeeId: string;
  workDate: string;
  entryKind: WfmTimeReviewEntryKind;
  referenceId: string;
  referenceKey: string;
  reviewStatus: WfmTimeReviewStatus;
  exportBlocking: boolean;
  exportStatus: WfmTimeExportStatus;
  changedAfterExport: boolean;
  lastExportJobId: string | null;
  lastExportedAt: string | null;
  metadata: Record<string, unknown>;
  exportVersion?: number;
  changedAfterExportReason?: string | null;
  changedAfterExportDetectedAt?: string | null;
  latestExportItemId?: string | null;
  pendingReexportJobId?: string | null;
}

export interface WfmTimeExportBlockedReview {
  reviewId: string;
  referenceKey: string;
  reason: WfmTimeExportBlockReason | WfmTimeCorrectionExportBlockReason;
  reasonLabel: string;
}

export interface WfmTimeCorrectionValidationResult {
  jobId: string;
  valid: boolean;
  exportableReviews: WfmTimeExportReviewRow[];
  blockedReviews: WfmTimeExportBlockedReview[];
  exportableCount: number;
  blockedCount: number;
}

export interface WfmTimeCorrectionDraftResult {
  job: WfmTimeExportJob;
  period: WfmTimeExportPeriod;
  exportableCount: number;
  blockedCount: number;
}

export interface WfmTimeCorrectionFinalizeResult {
  job: WfmTimeExportJob;
  items: WfmTimeExportItem[];
  supersededItemIds: string[];
  exportedCount: number;
}

/** RPC payload element for wfm_finalize_correction_export(p_export_job_id, p_items). */
export interface WfmCorrectionRpcItem {
  review_id: string;
  employee_id: string;
  reference_id: string | null;
  entry_kind: WfmTimeReviewEntryKind;
  period_date: string;
  minutes_total: number;
  original_export_item_id: string;
  logical_reference_key: string;
  new_reference_key: string;
  export_sequence: number;
  exported_payload: WfmCorrectionExportPayload;
  correction_payload_delta: WfmCorrectionPayloadDelta;
  previous_payload_hash: string;
  payload_hash: string;
  correction_reason: string;
  source_review_version_hash?: string | null;
}

export function mapCorrectionItemsToRpcPayload(items: WfmTimeExportItem[]): WfmCorrectionRpcItem[] {
  return items.map((item) => ({
    review_id: item.reviewId,
    employee_id: item.employeeId,
    reference_id: item.referenceId,
    entry_kind: item.entryKind,
    period_date: item.periodDate,
    minutes_total: item.minutesTotal,
    original_export_item_id: item.supersedesExportItemId ?? '',
    logical_reference_key: item.logicalReferenceKey ?? buildLogicalReferenceKey(item.reviewId),
    new_reference_key: item.referenceKey,
    export_sequence: item.exportSequence ?? 2,
    exported_payload: item.exportedPayload as WfmCorrectionExportPayload,
    correction_payload_delta: item.correctionPayloadDelta as WfmCorrectionPayloadDelta,
    previous_payload_hash: item.previousPayloadHash ?? '',
    payload_hash: item.payloadHash,
    correction_reason: item.correctionReason ?? '',
    source_review_version_hash: item.sourceReviewVersionHash ?? null,
  }));
}

export interface WfmTimeExportDraftResult {
  job: WfmTimeExportJob;
  period: WfmTimeExportPeriod;
  exportableCount: number;
  blockedCount: number;
}

export interface WfmTimeExportValidationResult {
  jobId: string;
  valid: boolean;
  exportableReviews: WfmTimeExportReviewRow[];
  blockedReviews: WfmTimeExportBlockedReview[];
  exportableCount: number;
  blockedCount: number;
}

export interface WfmTimeExportFinalizeResult {
  job: WfmTimeExportJob;
  items: WfmTimeExportItem[];
  exportedCount: number;
}

export interface WfmTimeExportBatchFilters {
  status?: WfmTimeExportJobStatus | WfmTimeExportJobStatus[];
  exportType?: WfmTimeExportType;
  limit?: number;
}

const demoJobs = new Map<string, WfmTimeExportJob>();
const demoItems: WfmTimeExportItem[] = [];
const demoReviewExportState = new Map<
  string,
  {
    exportStatus: WfmTimeExportStatus;
    changedAfterExport: boolean;
    lastExportJobId: string | null;
    lastExportedAt: string | null;
    latestExportItemId: string | null;
    pendingReexportJobId: string | null;
    changedAfterExportDetectedAt: string | null;
    changedAfterExportReason: string | null;
    exportVersion: number;
  }
>();
const demoFinalizedReferenceKeys = new Set<string>();

export function resetWfmTimeExportDemoStore(): void {
  demoJobs.clear();
  demoItems.length = 0;
  demoReviewExportState.clear();
  demoFinalizedReferenceKeys.clear();
}

function useDemoStore(): boolean {
  return getServiceMode() !== 'supabase' || !getSupabaseClient();
}

function demoReviewKey(tenantId: string, reviewId: string): string {
  return `${tenantId}:${reviewId}`;
}

function demoReferenceKey(tenantId: string, referenceKey: string): string {
  return `${tenantId}:${referenceKey}`;
}

function periodParts(period: WfmTimeExportPeriod): { year: number; month: number } {
  const [year, month] = period.startDate.split('-').map(Number);
  return { year, month };
}

function mapJobRow(row: Record<string, unknown>): WfmTimeExportJob {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    requestedBy: String(row.requested_by),
    exportType: (row.export_type as WfmTimeExportType) ?? 'session_legacy',
    exportFormat: String(row.export_format ?? 'csv'),
    periodYear: Number(row.period_year),
    periodMonth: Number(row.period_month),
    periodStart: (row.period_start as string | null) ?? null,
    periodEnd: (row.period_end as string | null) ?? null,
    status: row.status as WfmTimeExportJobStatus,
    rowCount: Number(row.row_count ?? 0),
    contentHash: (row.content_hash as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    finalizedAt: (row.finalized_at as string | null) ?? null,
    finalizedBy: (row.finalized_by as string | null) ?? null,
    canceledAt: (row.canceled_at as string | null) ?? null,
    canceledBy: (row.canceled_by as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    correctionOfExportJobId: (row.correction_of_export_job_id as string | null) ?? null,
    correctionReason: (row.correction_reason as string | null) ?? null,
    correctionSequence: row.correction_sequence != null ? Number(row.correction_sequence) : null,
    exportScope: (row.export_scope as WfmTimeExportScope | null) ?? null,
  };
}

function mapItemRow(row: Record<string, unknown>): WfmTimeExportItem {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    exportJobId: String(row.export_job_id),
    reviewId: String(row.review_id),
    employeeId: String(row.employee_id),
    referenceId: (row.reference_id as string | null) ?? null,
    referenceKey: String(row.reference_key),
    entryKind: row.entry_kind as WfmTimeReviewEntryKind,
    periodDate: String(row.period_date),
    minutesTotal: Number(row.minutes_total),
    reviewStatusAtExport: row.review_status_at_export as WfmTimeReviewStatus,
    exportedPayload: row.exported_payload as WfmTimeExportPayload,
    payloadHash: String(row.payload_hash),
    changedAfterExport: Boolean(row.changed_after_export),
    createdAt: String(row.created_at),
    logicalReferenceKey: row.logical_reference_key != null ? String(row.logical_reference_key) : undefined,
    exportSequence: row.export_sequence != null ? Number(row.export_sequence) : undefined,
    itemStatus: row.item_status as WfmTimeExportItemStatus | undefined,
    supersedesExportItemId: (row.supersedes_export_item_id as string | null) ?? null,
    supersededByExportItemId: (row.superseded_by_export_item_id as string | null) ?? null,
    correctionReason: (row.correction_reason as string | null) ?? null,
    sourceReviewVersionHash: (row.source_review_version_hash as string | null) ?? null,
    previousPayloadHash: (row.previous_payload_hash as string | null) ?? null,
    correctionPayloadDelta: (row.correction_payload_delta as Record<string, unknown> | null) ?? null,
    supersededAt: (row.superseded_at as string | null) ?? null,
  };
}

function mapReviewRow(row: Record<string, unknown>): WfmTimeExportReviewRow {
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
    exportStatus: (row.export_status as WfmTimeExportStatus) ?? 'not_exported',
    changedAfterExport: Boolean(row.changed_after_export),
    lastExportJobId: (row.last_export_job_id as string | null) ?? null,
    lastExportedAt: (row.last_exported_at as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    exportVersion: row.export_version != null ? Number(row.export_version) : undefined,
    changedAfterExportReason: (row.changed_after_export_reason as string | null) ?? null,
    changedAfterExportDetectedAt: (row.changed_after_export_detected_at as string | null) ?? null,
    latestExportItemId: (row.latest_export_item_id as string | null) ?? null,
    pendingReexportJobId: (row.pending_reexport_job_id as string | null) ?? null,
  };
}

function toReviewInput(
  review: WfmTimeExportReviewRow,
  hasFinalizedExportItem: boolean,
): WfmTimeExportReviewInput {
  return {
    reviewStatus: review.reviewStatus,
    exportBlocking: review.exportBlocking,
    exportStatus: review.exportStatus,
    changedAfterExport: review.changedAfterExport,
    referenceKey: review.referenceKey,
    hasFinalizedExportItem,
  };
}

function resolveReviewPauseMinutes(review: WfmTimeExportReviewRow): number {
  const raw = review.metadata?.pause_minutes ?? review.metadata?.pauseMinutes;
  return normalizeExportMinutes(typeof raw === 'number' ? raw : Number(raw ?? 0));
}

function buildLiveReviewVersionHash(review: WfmTimeExportReviewRow): string {
  return buildReviewVersionHash({
    reviewId: review.id,
    tenantId: review.tenantId,
    employeeId: review.employeeId,
    periodDate: review.workDate,
    entryKind: review.entryKind,
    minutesTotal: resolveReviewMinutes(review),
    pauseMinutes: resolveReviewPauseMinutes(review),
    referenceId: review.referenceId,
    referenceKey: review.referenceKey,
    logicalReferenceKey: buildLogicalReferenceKey(review.id),
    reviewStatus: review.reviewStatus,
    exportBlocking: review.exportBlocking,
    approvedAt: (review.metadata?.approved_at as string | null) ?? review.lastExportedAt,
    approvedBy: (review.metadata?.approved_by as string | null) ?? null,
    sourceSessionId: (review.metadata?.source_session_id as string | null) ?? null,
    sourceKind: (review.metadata?.source_kind as string | null) ?? review.entryKind,
    employeeName: (review.metadata?.employee_name as string | null) ?? null,
    entryLabel: (review.metadata?.entry_label as string | null) ?? null,
  });
}

function toCorrectionReviewInput(
  review: WfmTimeExportReviewRow,
  options?: {
    hasActiveExportItem?: boolean;
    driftDetected?: boolean;
    correctionReason?: string | null;
    pendingReexportJobId?: string | null;
    currentCorrectionJobId?: string | null;
  },
): WfmTimeCorrectionExportReviewInput {
  return {
    reviewId: review.id,
    employeeId: review.employeeId,
    reviewStatus: review.reviewStatus,
    exportBlocking: review.exportBlocking,
    exportStatus: review.exportStatus,
    changedAfterExport: review.changedAfterExport,
    referenceKey: review.referenceKey,
    lastExportJobId: review.lastExportJobId,
    latestExportItemId: review.latestExportItemId ?? null,
    hasActiveExportItem: options?.hasActiveExportItem,
    driftDetected: options?.driftDetected,
    correctionReason: options?.correctionReason,
    pendingReexportJobId:
      options?.pendingReexportJobId !== undefined
        ? options.pendingReexportJobId
        : review.pendingReexportJobId ?? null,
    currentCorrectionJobId: options?.currentCorrectionJobId ?? null,
  };
}

function getDemoReviewExportState(tenantId: string, reviewId: string) {
  return demoReviewExportState.get(demoReviewKey(tenantId, reviewId));
}

export function setDemoReviewExportState(
  tenantId: string,
  reviewId: string,
  patch: Partial<{
    exportStatus: WfmTimeExportStatus;
    changedAfterExport: boolean;
    lastExportJobId: string | null;
    lastExportedAt: string | null;
    latestExportItemId: string | null;
    pendingReexportJobId: string | null;
    changedAfterExportDetectedAt: string | null;
    changedAfterExportReason: string | null;
    exportVersion: number;
  }>,
): void {
  const key = demoReviewKey(tenantId, reviewId);
  const current = demoReviewExportState.get(key) ?? {
    exportStatus: 'not_exported' as WfmTimeExportStatus,
    changedAfterExport: false,
    lastExportJobId: null,
    lastExportedAt: null,
    latestExportItemId: null,
    pendingReexportJobId: null,
    changedAfterExportDetectedAt: null,
    changedAfterExportReason: null,
    exportVersion: 1,
  };
  demoReviewExportState.set(key, { ...current, ...patch });
}

function findActiveExportItemForReview(
  tenantId: string,
  review: WfmTimeExportReviewRow,
): WfmTimeExportItem | null {
  if (review.latestExportItemId) {
    const byId = demoItems.find(
      (item) =>
        item.tenantId === tenantId &&
        item.id === review.latestExportItemId &&
        (item.itemStatus ?? 'active') === 'active',
    );
    if (byId) return byId;
  }
  const logicalKey = buildLogicalReferenceKey(review.id);
  return (
    demoItems.find(
      (item) =>
        item.tenantId === tenantId &&
        item.reviewId === review.id &&
        (item.logicalReferenceKey ?? item.referenceKey) === logicalKey &&
        (item.itemStatus ?? 'active') === 'active',
    ) ??
    demoItems.find(
      (item) =>
        item.tenantId === tenantId &&
        item.reviewId === review.id &&
        (item.itemStatus ?? 'active') === 'active',
    ) ??
    null
  );
}

async function loadReviewById(
  tenantId: string,
  reviewId: string,
): Promise<ServiceResult<WfmTimeExportReviewRow | null>> {
  if (useDemoStore()) {
    const { listReviewsForPeriod } = await import('./wfmTimeReviewService');
    const listed = await listReviewsForPeriod(tenantId, '1970-01-01', '2999-12-31');
    if (!listed.ok) return listed;
    const review = listed.data.find((row) => row.id === reviewId);
    if (!review) return { ok: true, data: null };
    const state = getDemoReviewExportState(tenantId, reviewId);
    return {
      ok: true,
      data: {
        id: review.id,
        tenantId: review.tenantId,
        employeeId: review.employeeId,
        workDate: review.workDate,
        entryKind: review.entryKind,
        referenceId: review.referenceId,
        referenceKey: review.referenceKey,
        reviewStatus: review.reviewStatus,
        exportBlocking: review.exportBlocking,
        exportStatus: state?.exportStatus ?? 'not_exported',
        changedAfterExport: state?.changedAfterExport ?? false,
        lastExportJobId: state?.lastExportJobId ?? null,
        lastExportedAt: state?.lastExportedAt ?? null,
        latestExportItemId: state?.latestExportItemId ?? null,
        pendingReexportJobId: state?.pendingReexportJobId ?? null,
        changedAfterExportDetectedAt: state?.changedAfterExportDetectedAt ?? null,
        changedAfterExportReason: state?.changedAfterExportReason ?? null,
        exportVersion: state?.exportVersion ?? 1,
        metadata: {},
      },
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: null };

  const { data, error } = await fromUnknownTable(supabase, REVIEWS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', reviewId)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: null };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: data ? mapReviewRow(data as Record<string, unknown>) : null };
}

function resolveReviewMinutes(review: WfmTimeExportReviewRow): number {
  const raw = review.metadata?.minutes_total ?? review.metadata?.minutesTotal;
  return normalizeExportMinutes(typeof raw === 'number' ? raw : Number(raw ?? 0));
}

async function loadFinalizedReferenceKeys(tenantId: string): Promise<Set<string>> {
  if (useDemoStore()) {
    return new Set(
      [...demoFinalizedReferenceKeys].filter((key) => key.startsWith(`${tenantId}:`)),
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) return new Set();

  const { data, error } = await fromUnknownTable(supabase, EXPORT_ITEMS_TABLE)
    .select('reference_key')
    .eq('tenant_id', tenantId);

  if (error) {
    if (isSupabaseMissingTableError(error)) return new Set();
    return new Set();
  }

  return new Set((data ?? []).map((row) => demoReferenceKey(tenantId, String((row as Record<string, unknown>).reference_key))));
}

function hasFinalizedItemForReference(
  tenantId: string,
  referenceKey: string,
  finalizedKeys: Set<string>,
): boolean {
  return finalizedKeys.has(demoReferenceKey(tenantId, referenceKey));
}

async function listReviewsForExportPeriod(
  tenantId: string,
  period: WfmTimeExportPeriod,
): Promise<ServiceResult<WfmTimeExportReviewRow[]>> {
  if (useDemoStore()) {
    const { listReviewsForPeriod } = await import('./wfmTimeReviewService');
    const listed = await listReviewsForPeriod(tenantId, period.startDate, period.endDate);
    if (!listed.ok) return listed;
    return {
      ok: true,
      data: listed.data.map((review) => {
        const state = getDemoReviewExportState(tenantId, review.id);
        return {
          id: review.id,
          tenantId: review.tenantId,
          employeeId: review.employeeId,
          workDate: review.workDate,
          entryKind: review.entryKind,
          referenceId: review.referenceId,
          referenceKey: review.referenceKey,
          reviewStatus: review.reviewStatus,
          exportBlocking: review.exportBlocking,
          exportStatus: state?.exportStatus ?? 'not_exported',
          changedAfterExport: state?.changedAfterExport ?? false,
          lastExportJobId: state?.lastExportJobId ?? null,
          lastExportedAt: state?.lastExportedAt ?? null,
          latestExportItemId: state?.latestExportItemId ?? null,
          pendingReexportJobId: state?.pendingReexportJobId ?? null,
          changedAfterExportDetectedAt: state?.changedAfterExportDetectedAt ?? null,
          changedAfterExportReason: state?.changedAfterExportReason ?? null,
          exportVersion: state?.exportVersion ?? 1,
          metadata: {},
        };
      }),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: [] };

  const { data, error } = await fromUnknownTable(supabase, REVIEWS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('work_date', period.startDate)
    .lte('work_date', period.endDate);

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapReviewRow(row as Record<string, unknown>)) };
}

export async function listExportableReviews(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  periodInput: WfmTimeExportPeriod,
): Promise<ServiceResult<WfmTimeExportReviewRow[]>> {
  const denied = canCreateReviewedTimeExport(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const period = normalizeExportPeriod(periodInput);
  if (!period) return { ok: false, error: 'Ungültiger Exportzeitraum.' };

  const listed = await listReviewsForExportPeriod(tenantId, period);
  if (!listed.ok) return listed;

  const finalizedKeys = await loadFinalizedReferenceKeys(tenantId);
  return {
    ok: true,
    data: listed.data.filter((review) =>
      isReviewExportable(
        toReviewInput(review, hasFinalizedItemForReference(tenantId, review.referenceKey, finalizedKeys)),
      ),
    ),
  };
}

async function partitionReviewsForExport(
  tenantId: string,
  period: WfmTimeExportPeriod,
): Promise<ServiceResult<{ exportable: WfmTimeExportReviewRow[]; blocked: WfmTimeExportBlockedReview[] }>> {
  const listed = await listReviewsForExportPeriod(tenantId, period);
  if (!listed.ok) return listed;

  const finalizedKeys = await loadFinalizedReferenceKeys(tenantId);
  const exportable: WfmTimeExportReviewRow[] = [];
  const blocked: WfmTimeExportBlockedReview[] = [];

  for (const review of listed.data) {
    const hasItem = hasFinalizedItemForReference(tenantId, review.referenceKey, finalizedKeys);
    const reason = getReviewExportBlockReason(toReviewInput(review, hasItem));
    if (reason) {
      if (review.reviewStatus === 'approved' || review.exportStatus === 'export_ready') {
        blocked.push({
          reviewId: review.id,
          referenceKey: review.referenceKey,
          reason,
          reasonLabel: exportBlockReasonLabel(reason),
        });
      }
      continue;
    }
    exportable.push(review);
  }

  return { ok: true, data: { exportable, blocked } };
}

export async function createExportDraft(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  periodInput: WfmTimeExportPeriod,
  options?: { notes?: string | null },
): Promise<ServiceResult<WfmTimeExportDraftResult>> {
  const denied = canCreateReviewedTimeExport(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const period = normalizeExportPeriod(periodInput);
  if (!period) return { ok: false, error: 'Ungültiger Exportzeitraum.' };

  const partitioned = await partitionReviewsForExport(tenantId, period);
  if (!partitioned.ok) return partitioned;

  const { year, month } = periodParts(period);
  const now = new Date().toISOString();
  const jobId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `export-draft-${Date.now()}`;

  const job: WfmTimeExportJob = {
    id: jobId,
    tenantId,
    requestedBy: userId,
    exportType: 'reviewed_time',
    exportFormat: 'csv',
    periodYear: year,
    periodMonth: month,
    periodStart: period.startDate,
    periodEnd: period.endDate,
    status: 'draft',
    rowCount: 0,
    contentHash: null,
    notes: options?.notes ?? null,
    finalizedAt: null,
    finalizedBy: null,
    canceledAt: null,
    canceledBy: null,
    createdAt: now,
    updatedAt: now,
  };

  if (useDemoStore()) {
    demoJobs.set(jobId, job);
    return {
      ok: true,
      data: {
        job,
        period,
        exportableCount: partitioned.data.exportable.length,
        blockedCount: partitioned.data.blocked.length,
      },
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase-Client nicht verfügbar.' };

  const { data, error } = await fromUnknownTable(supabase, EXPORT_JOBS_TABLE)
    .insert({
      id: jobId,
      tenant_id: tenantId,
      requested_by: userId,
      export_format: 'csv',
      export_type: 'reviewed_time',
      period_year: year,
      period_month: month,
      period_start: period.startDate,
      period_end: period.endDate,
      status: 'draft',
      row_count: 0,
      notes: options?.notes ?? null,
      metadata: { source: 'wfm_p22_service' },
    })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'Export-Jobs nicht verfügbar (Migration 0248 fehlt).' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return {
    ok: true,
    data: {
      job: mapJobRow(data as Record<string, unknown>),
      period,
      exportableCount: partitioned.data.exportable.length,
      blockedCount: partitioned.data.blocked.length,
    },
  };
}

async function getExportJobById(
  tenantId: string,
  jobId: string,
): Promise<ServiceResult<WfmTimeExportJob | null>> {
  if (useDemoStore()) {
    const job = demoJobs.get(jobId);
    if (!job || job.tenantId !== tenantId) return { ok: true, data: null };
    return { ok: true, data: job };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: null };

  const { data, error } = await fromUnknownTable(supabase, EXPORT_JOBS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: null };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: data ? mapJobRow(data as Record<string, unknown>) : null };
}

function jobPeriod(job: WfmTimeExportJob): WfmTimeExportPeriod | null {
  if (job.periodStart && job.periodEnd) {
    return normalizeExportPeriod({ startDate: job.periodStart, endDate: job.periodEnd });
  }
  const startDate = `${job.periodYear}-${String(job.periodMonth).padStart(2, '0')}-01`;
  const endDay = new Date(job.periodYear, job.periodMonth, 0).getDate();
  const endDate = `${job.periodYear}-${String(job.periodMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  return normalizeExportPeriod({ startDate, endDate });
}

export async function validateExportBatch(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  batchId: string,
): Promise<ServiceResult<WfmTimeExportValidationResult>> {
  const denied = canCreateReviewedTimeExport(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const jobResult = await getExportJobById(tenantId, batchId);
  if (!jobResult.ok) return jobResult;
  if (!jobResult.data) return { ok: false, error: 'Export-Batch nicht gefunden.' };
  if (jobResult.data.exportType !== 'reviewed_time') {
    return { ok: false, error: 'Batch ist kein Review-Export.' };
  }
  if (isFinalizedExportJobStatus(jobResult.data.status) || jobResult.data.status === 'canceled') {
    return { ok: false, error: 'Export-Batch ist nicht mehr bearbeitbar.' };
  }

  const period = jobPeriod(jobResult.data);
  if (!period) return { ok: false, error: 'Export-Zeitraum im Batch ungültig.' };

  const partitioned = await partitionReviewsForExport(tenantId, period);
  if (!partitioned.ok) return partitioned;

  const valid = partitioned.data.blocked.length === 0 && partitioned.data.exportable.length > 0;

  if (useDemoStore()) {
    const job = demoJobs.get(batchId);
    if (job && valid) {
      demoJobs.set(batchId, { ...job, status: 'validated', updatedAt: new Date().toISOString() });
    }
  } else if (valid) {
    const supabase = getSupabaseClient();
    if (supabase) {
      await fromUnknownTable(supabase, EXPORT_JOBS_TABLE)
        .update({ status: 'validated' })
        .eq('tenant_id', tenantId)
        .eq('id', batchId);
    }
  }

  return {
    ok: true,
    data: {
      jobId: batchId,
      valid,
      exportableReviews: partitioned.data.exportable,
      blockedReviews: partitioned.data.blocked,
      exportableCount: partitioned.data.exportable.length,
      blockedCount: partitioned.data.blocked.length,
    },
  };
}

export async function finalizeExportBatch(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  batchId: string,
): Promise<ServiceResult<WfmTimeExportFinalizeResult>> {
  const validation = await validateExportBatch(tenantId, actorRoleKey, batchId);
  if (!validation.ok) return validation;
  if (!validation.data.valid) {
    return {
      ok: false,
      error: 'Export-Batch kann nicht finalisiert werden (blockierte oder fehlende Reviews).',
    };
  }

  const jobResult = await getExportJobById(tenantId, batchId);
  if (!jobResult.ok) return jobResult;
  if (!jobResult.data) return { ok: false, error: 'Export-Batch nicht gefunden.' };

  const now = new Date().toISOString();
  const items: WfmTimeExportItem[] = [];

  for (const review of validation.data.exportableReviews) {
    const logicalReferenceKey = buildLogicalReferenceKey(review.id);
    const versionHash = buildLiveReviewVersionHash(review);
    const payload = buildExportPayloadForReview({
      reviewId: review.id,
      employeeId: review.employeeId,
      referenceKey: review.referenceKey,
      referenceId: review.referenceId,
      entryKind: review.entryKind,
      periodDate: review.workDate,
      minutesTotal: resolveReviewMinutes(review),
      reviewStatus: 'approved',
    });
    const payloadHash = calculateExportPayloadHash(payload);
    const itemId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `export-item-${Date.now()}-${items.length}`;

    items.push({
      id: itemId,
      tenantId,
      exportJobId: batchId,
      reviewId: review.id,
      employeeId: review.employeeId,
      referenceId: review.referenceId,
      referenceKey: review.referenceKey,
      entryKind: review.entryKind,
      periodDate: review.workDate,
      minutesTotal: payload.minutesTotal,
      reviewStatusAtExport: 'approved',
      exportedPayload: payload,
      payloadHash,
      sourceReviewVersionHash: versionHash,
      previousPayloadHash: null,
      correctionPayloadDelta: null,
      correctionReason: null,
      supersedesExportItemId: null,
      supersededByExportItemId: null,
      changedAfterExport: false,
      createdAt: now,
      logicalReferenceKey,
      exportSequence: 1,
      itemStatus: 'active',
    });
  }

  if (useDemoStore()) {
    for (const item of items) {
      if (demoFinalizedReferenceKeys.has(demoReferenceKey(tenantId, item.referenceKey))) {
        return { ok: false, error: 'Doppel-Finalexport für reference_key blockiert.' };
      }
    }

    demoItems.push(...items);
    for (const item of items) {
      demoFinalizedReferenceKeys.add(demoReferenceKey(tenantId, item.referenceKey));
      setDemoReviewExportState(tenantId, item.reviewId, {
        exportStatus: 'exported',
        changedAfterExport: false,
        lastExportJobId: batchId,
        lastExportedAt: now,
        latestExportItemId: item.id,
        changedAfterExportDetectedAt: null,
        changedAfterExportReason: null,
        exportVersion: 1,
      });
      await appendReviewAction(tenantId, userId, {
        entryReviewId: item.reviewId,
        action: 'export_finalized',
        prevStatus: 'approved',
        newStatus: 'approved',
        comment: `Export-Batch ${batchId}`,
      });
    }

    const finalizedJob: WfmTimeExportJob = {
      ...jobResult.data,
      status: 'finalized',
      rowCount: items.length,
      contentHash: calculateExportPayloadHash({
        schemaVersion: 1,
        employeeId: 'batch',
        referenceKey: batchId,
        referenceId: null,
        entryKind: 'manual',
        periodDate: jobResult.data.periodStart ?? `${jobResult.data.periodYear}-01-01`,
        minutesTotal: items.reduce((sum, item) => sum + item.minutesTotal, 0),
        reviewStatus: 'approved',
        reviewId: batchId,
      }),
      finalizedAt: now,
      finalizedBy: userId,
      updatedAt: now,
    };
    demoJobs.set(batchId, finalizedJob);

    return { ok: true, data: { job: finalizedJob, items, exportedCount: items.length } };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase-Client nicht verfügbar.' };

  for (const item of items) {
    const { error: itemError } = await fromUnknownTable(supabase, EXPORT_ITEMS_TABLE).insert({
      id: item.id,
      tenant_id: tenantId,
      export_job_id: batchId,
      review_id: item.reviewId,
      employee_id: item.employeeId,
      reference_id: item.referenceId,
      reference_key: item.referenceKey,
      entry_kind: item.entryKind,
      period_date: item.periodDate,
      minutes_total: item.minutesTotal,
      review_status_at_export: 'approved',
      exported_payload: item.exportedPayload,
      payload_hash: item.payloadHash,
      source_review_version_hash: item.sourceReviewVersionHash,
      changed_after_export: false,
      logical_reference_key: item.logicalReferenceKey,
      export_sequence: 1,
      item_status: 'active',
    });
    if (itemError) {
      return { ok: false, error: toGermanSupabaseError(itemError) };
    }

    const { error: reviewError } = await fromUnknownTable(supabase, REVIEWS_TABLE)
      .update({
        export_status: 'exported',
        last_export_job_id: batchId,
        last_exported_at: now,
        latest_export_item_id: item.id,
        changed_after_export: false,
        changed_after_export_detected_at: null,
        changed_after_export_reason: null,
      })
      .eq('tenant_id', tenantId)
      .eq('id', item.reviewId);

    if (reviewError) {
      return { ok: false, error: toGermanSupabaseError(reviewError) };
    }

    const actionResult = await appendReviewAction(tenantId, userId, {
      entryReviewId: item.reviewId,
      action: 'export_finalized',
      prevStatus: 'approved',
      newStatus: 'approved',
      comment: `Export-Batch ${batchId}`,
    });
    if (!actionResult.ok) return actionResult;
  }

  const contentHash =
    items.length > 0
      ? items.map((item) => item.payloadHash).sort().join('|')
      : null;

  const { data, error } = await fromUnknownTable(supabase, EXPORT_JOBS_TABLE)
    .update({
      status: 'finalized',
      row_count: items.length,
      content_hash: contentHash,
      finalized_at: now,
      finalized_by: userId,
      completed_at: now,
    })
    .eq('tenant_id', tenantId)
    .eq('id', batchId)
    .select('*')
    .single();

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return {
    ok: true,
    data: {
      job: mapJobRow(data as Record<string, unknown>),
      items,
      exportedCount: items.length,
    },
  };
}

export async function listExportBatches(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  filters?: WfmTimeExportBatchFilters,
): Promise<ServiceResult<WfmTimeExportJob[]>> {
  const denied = canCreateReviewedTimeExport(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (useDemoStore()) {
    let rows = [...demoJobs.values()].filter(
      (job) => job.tenantId === tenantId && job.exportType === 'reviewed_time',
    );
    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      rows = rows.filter((job) => statuses.includes(job.status));
    }
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { ok: true, data: rows.slice(0, filters?.limit ?? 50) };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: [] };

  let query = fromUnknownTable(supabase, EXPORT_JOBS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('export_type', 'reviewed_time')
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 50);

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in('status', statuses);
  }

  const { data, error } = await query;
  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapJobRow(row as Record<string, unknown>)) };
}

export async function listExportItems(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  exportJobId: string,
): Promise<ServiceResult<WfmTimeExportItem[]>> {
  const denied = canCreateReviewedTimeExport(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (useDemoStore()) {
    return {
      ok: true,
      data: demoItems.filter((item) => item.tenantId === tenantId && item.exportJobId === exportJobId),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: [] };

  const { data, error } = await fromUnknownTable(supabase, EXPORT_ITEMS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('export_job_id', exportJobId)
    .order('created_at', { ascending: true });

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: (data ?? []).map((row) => mapItemRow(row as Record<string, unknown>)) };
}

export async function cancelExportBatch(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  exportJobId: string,
): Promise<ServiceResult<WfmTimeExportJob>> {
  const denied = canCreateReviewedTimeExport(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const jobResult = await getExportJobById(tenantId, exportJobId);
  if (!jobResult.ok) return jobResult;
  if (!jobResult.data) return { ok: false, error: 'Export-Batch nicht gefunden.' };
  if (isFinalizedExportJobStatus(jobResult.data.status)) {
    return { ok: false, error: 'Finalisierter Export kann nicht abgebrochen werden.' };
  }

  const now = new Date().toISOString();

  if (useDemoStore()) {
    const canceled: WfmTimeExportJob = {
      ...jobResult.data,
      status: 'canceled',
      canceledAt: now,
      canceledBy: userId,
      updatedAt: now,
    };
    demoJobs.set(exportJobId, canceled);
    return { ok: true, data: canceled };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase-Client nicht verfügbar.' };

  const { data, error } = await fromUnknownTable(supabase, EXPORT_JOBS_TABLE)
    .update({
      status: 'canceled',
      canceled_at: now,
      canceled_by: userId,
    })
    .eq('tenant_id', tenantId)
    .eq('id', exportJobId)
    .select('*')
    .single();

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: mapJobRow(data as Record<string, unknown>) };
}

export async function detectChangedAfterExport(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  filters?: { reviewId?: string; exportJobId?: string },
): Promise<ServiceResult<{ reviewId: string; changed: boolean; previousHash: string; currentHash: string }[]>> {
  const denied = canMarkExportDrift(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  let reviewIds: string[] = [];
  if (filters?.reviewId) {
    reviewIds = [filters.reviewId];
  } else if (filters?.exportJobId) {
    const listed = await listExportItems(tenantId, actorRoleKey, filters.exportJobId);
    if (!listed.ok) return listed;
    reviewIds = [...new Set(listed.data.map((item) => item.reviewId))];
  } else if (useDemoStore()) {
    reviewIds = [...new Set(demoItems.filter((item) => item.tenantId === tenantId).map((item) => item.reviewId))];
  } else {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: true, data: [] };
    const { data, error } = await fromUnknownTable(supabase, EXPORT_ITEMS_TABLE)
      .select('review_id')
      .eq('tenant_id', tenantId);
    if (error) {
      if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    reviewIds = [...new Set((data ?? []).map((row) => String((row as Record<string, unknown>).review_id)))];
  }

  const results: { reviewId: string; changed: boolean; previousHash: string; currentHash: string }[] = [];

  for (const reviewId of reviewIds) {
    const drift = await detectChangedAfterExportForReview(tenantId, userId, actorRoleKey, reviewId);
    if (!drift.ok) return drift;
    if (drift.data) results.push(drift.data);
  }

  return { ok: true, data: results };
}

async function detectChangedAfterExportForReview(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  reviewId: string,
): Promise<ServiceResult<{ reviewId: string; changed: boolean; previousHash: string; currentHash: string } | null>> {
  const reviewResult = await loadReviewById(tenantId, reviewId);
  if (!reviewResult.ok) return reviewResult;
  if (!reviewResult.data) return { ok: true, data: null };

  const review = reviewResult.data;
  if (review.exportStatus !== 'exported' && !review.lastExportJobId) {
    return { ok: true, data: null };
  }

  const activeItem = useDemoStore()
    ? findActiveExportItemForReview(tenantId, review)
    : null;

  let previousHash: string | null = null;
  if (activeItem) {
    previousHash = activeItem.sourceReviewVersionHash ?? activeItem.payloadHash;
  } else if (!useDemoStore()) {
    const supabase = getSupabaseClient();
    if (supabase && review.latestExportItemId) {
      const { data } = await fromUnknownTable(supabase, EXPORT_ITEMS_TABLE)
        .select('source_review_version_hash,payload_hash')
        .eq('tenant_id', tenantId)
        .eq('id', review.latestExportItemId)
        .maybeSingle();
      if (data) {
        const row = data as Record<string, unknown>;
        previousHash =
          (row.source_review_version_hash as string | null) ?? String(row.payload_hash ?? '');
      }
    }
  }

  if (!previousHash) return { ok: true, data: null };

  const currentHash = buildLiveReviewVersionHash(review);
  const changed = currentHash !== previousHash;
  const result = { reviewId, changed, previousHash, currentHash };

  if (changed && review.exportStatus !== 'changed_after_export' && !review.changedAfterExport) {
    const mark = await markChangedAfterExport(tenantId, userId, actorRoleKey, reviewId, 'export_change_detected');
    if (!mark.ok) return mark;
  }

  return { ok: true, data: result };
}

export async function markChangedAfterExport(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  reviewId: string,
  reason: string,
): Promise<ServiceResult<WfmTimeExportReviewRow>> {
  const denied = canMarkExportDrift(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const trimmedReason = reason?.trim();
  if (!trimmedReason) return { ok: false, error: 'Drift-Grund ist Pflicht.' };

  const reviewResult = await loadReviewById(tenantId, reviewId);
  if (!reviewResult.ok) return reviewResult;
  if (!reviewResult.data) return { ok: false, error: 'Review nicht gefunden.' };
  if (!reviewResult.data.lastExportJobId) {
    return { ok: false, error: 'Review wurde noch nicht exportiert.' };
  }

  const now = new Date().toISOString();
  const alreadyMarked =
    reviewResult.data.exportStatus === 'changed_after_export' || reviewResult.data.changedAfterExport;

  if (useDemoStore()) {
    setDemoReviewExportState(tenantId, reviewId, {
      exportStatus: 'changed_after_export',
      changedAfterExport: true,
      changedAfterExportDetectedAt: reviewResult.data.changedAfterExportDetectedAt ?? now,
      changedAfterExportReason: trimmedReason,
    });
    if (!alreadyMarked) {
      await appendReviewAction(tenantId, userId, {
        entryReviewId: reviewId,
        action: p23Action('export_change_detected'),
        prevStatus: 'approved',
        newStatus: 'approved',
        comment: trimmedReason,
      });
    }
    const refreshed = await loadReviewById(tenantId, reviewId);
    if (!refreshed.ok || !refreshed.data) {
      return { ok: false, error: 'Review konnte nach Markierung nicht geladen werden.' };
    }
    return { ok: true, data: refreshed.data };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase-Client nicht verfügbar.' };

  const { error } = await fromUnknownTable(supabase, REVIEWS_TABLE)
    .update({
      export_status: 'changed_after_export',
      changed_after_export: true,
      changed_after_export_detected_at: now,
      changed_after_export_reason: trimmedReason,
    })
    .eq('tenant_id', tenantId)
    .eq('id', reviewId);

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  if (!alreadyMarked) {
    const actionResult = await appendReviewAction(tenantId, userId, {
      entryReviewId: reviewId,
      action: p23Action('export_change_detected'),
      prevStatus: 'approved',
      newStatus: 'approved',
      comment: trimmedReason,
    });
    if (!actionResult.ok) return actionResult;
  }

  const refreshed = await loadReviewById(tenantId, reviewId);
  if (!refreshed.ok || !refreshed.data) {
    return { ok: false, error: 'Review konnte nach Markierung nicht geladen werden.' };
  }
  return { ok: true, data: refreshed.data };
}

export async function listCorrectionCandidates(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  periodInput?: WfmTimeExportPeriod,
): Promise<ServiceResult<WfmTimeExportReviewRow[]>> {
  const denied = canCreateReviewedTimeExport(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  let reviews: WfmTimeExportReviewRow[] = [];
  if (periodInput) {
    const period = normalizeExportPeriod(periodInput);
    if (!period) return { ok: false, error: 'Ungültiger Exportzeitraum.' };
    const listed = await listReviewsForExportPeriod(tenantId, period);
    if (!listed.ok) return listed;
    reviews = listed.data;
  } else if (useDemoStore()) {
    const { listReviewsForPeriod } = await import('./wfmTimeReviewService');
    const listed = await listReviewsForPeriod(tenantId, '1970-01-01', '2999-12-31');
    if (!listed.ok) return listed;
    reviews = listed.data.map((review) => {
      const state = getDemoReviewExportState(tenantId, review.id);
      return {
        id: review.id,
        tenantId: review.tenantId,
        employeeId: review.employeeId,
        workDate: review.workDate,
        entryKind: review.entryKind,
        referenceId: review.referenceId,
        referenceKey: review.referenceKey,
        reviewStatus: review.reviewStatus,
        exportBlocking: review.exportBlocking,
        exportStatus: state?.exportStatus ?? 'not_exported',
        changedAfterExport: state?.changedAfterExport ?? false,
        lastExportJobId: state?.lastExportJobId ?? null,
        lastExportedAt: state?.lastExportedAt ?? null,
        latestExportItemId: state?.latestExportItemId ?? null,
        pendingReexportJobId: state?.pendingReexportJobId ?? null,
        changedAfterExportDetectedAt: state?.changedAfterExportDetectedAt ?? null,
        changedAfterExportReason: state?.changedAfterExportReason ?? null,
        exportVersion: state?.exportVersion ?? 1,
        metadata: {},
      };
    });
  } else {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: true, data: [] };
    const { data, error } = await fromUnknownTable(supabase, REVIEWS_TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .in('export_status', ['changed_after_export', 'exported']);
    if (error) {
      if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    reviews = (data ?? []).map((row) => mapReviewRow(row as Record<string, unknown>));
  }

  const candidates = reviews.filter((review) => {
    const hasActive = useDemoStore()
      ? Boolean(findActiveExportItemForReview(tenantId, review))
      : Boolean(review.latestExportItemId);
    return isReviewCorrectionCandidate(
      toCorrectionReviewInput(review, { hasActiveExportItem: hasActive }),
    );
  });

  return { ok: true, data: candidates };
}

async function partitionReviewsForCorrection(
  tenantId: string,
  reviewIds: string[],
  correctionReason: string,
  options?: { currentCorrectionJobId?: string },
): Promise<ServiceResult<{ exportable: WfmTimeExportReviewRow[]; blocked: WfmTimeExportBlockedReview[] }>> {
  const exportable: WfmTimeExportReviewRow[] = [];
  const blocked: WfmTimeExportBlockedReview[] = [];

  for (const reviewId of reviewIds) {
    const reviewResult = await loadReviewById(tenantId, reviewId);
    if (!reviewResult.ok) return reviewResult;
    if (!reviewResult.data) {
      blocked.push({
        reviewId,
        referenceKey: '',
        reason: 'not_exported_yet',
        reasonLabel: correctionExportBlockReasonLabel('not_exported_yet'),
      });
      continue;
    }

    const review = reviewResult.data;
    const hasActive = useDemoStore()
      ? Boolean(findActiveExportItemForReview(tenantId, review))
      : Boolean(review.latestExportItemId);
    const pendingReexportJobId =
      options?.currentCorrectionJobId &&
      review.pendingReexportJobId === options.currentCorrectionJobId
        ? null
        : review.pendingReexportJobId ?? null;
    const input = toCorrectionReviewInput(review, {
      hasActiveExportItem: hasActive,
      correctionReason,
      pendingReexportJobId,
    });
    const reason = getReviewCorrectionExportBlockReason(input);
    if (reason) {
      blocked.push({
        reviewId: review.id,
        referenceKey: review.referenceKey,
        reason,
        reasonLabel: correctionExportBlockReasonLabel(reason),
      });
      continue;
    }
    if (!isReviewCorrectionExportable(input)) continue;
    exportable.push(review);
  }

  return { ok: true, data: { exportable, blocked } };
}

export async function createCorrectionDraft(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  periodInput: WfmTimeExportPeriod,
  reviewIds: string[],
  correctionReason: string,
): Promise<ServiceResult<WfmTimeCorrectionDraftResult>> {
  const denied = canCreateReviewedTimeExport(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const period = normalizeExportPeriod(periodInput);
  if (!period) return { ok: false, error: 'Ungültiger Exportzeitraum.' };
  if (!reviewIds.length) return { ok: false, error: 'Mindestens eine Review-ID erforderlich.' };
  if (correctionReason.trim().length < 10) {
    return { ok: false, error: 'Korrekturgrund muss mindestens 10 Zeichen haben.' };
  }

  const partitioned = await partitionReviewsForCorrection(tenantId, reviewIds, correctionReason);
  if (!partitioned.ok) return partitioned;
  if (partitioned.data.exportable.length === 0) {
    return { ok: false, error: 'Keine exportierbaren Korrektur-Reviews gefunden.' };
  }

  const parentJobId = partitioned.data.exportable[0]?.lastExportJobId;
  if (!parentJobId) return { ok: false, error: 'Ursprungs-Export-Job fehlt.' };

  const { year, month } = periodParts(period);
  const now = new Date().toISOString();
  const jobId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `correction-draft-${Date.now()}`;

  const maxSequence = partitioned.data.exportable.reduce((max, review) => {
    return Math.max(max, review.exportVersion ?? 1);
  }, 1);

  const job: WfmTimeExportJob = {
    id: jobId,
    tenantId,
    requestedBy: userId,
    exportType: 'reviewed_time_correction',
    exportFormat: 'csv',
    periodYear: year,
    periodMonth: month,
    periodStart: period.startDate,
    periodEnd: period.endDate,
    status: 'draft',
    rowCount: 0,
    contentHash: null,
    notes: null,
    finalizedAt: null,
    finalizedBy: null,
    canceledAt: null,
    canceledBy: null,
    correctionOfExportJobId: parentJobId,
    correctionReason: correctionReason.trim(),
    correctionSequence: maxSequence + 1,
    exportScope: 'delta_correction',
    createdAt: now,
    updatedAt: now,
  };

  if (useDemoStore()) {
    demoJobs.set(jobId, job);
    for (const review of partitioned.data.exportable) {
      setDemoReviewExportState(tenantId, review.id, { pendingReexportJobId: jobId });
      await appendReviewAction(tenantId, userId, {
        entryReviewId: review.id,
        action: p23Action('reexport_drafted'),
        prevStatus: 'approved',
        newStatus: 'approved',
        comment: correctionReason.trim(),
      });
    }
    return {
      ok: true,
      data: {
        job,
        period,
        exportableCount: partitioned.data.exportable.length,
        blockedCount: partitioned.data.blocked.length,
      },
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase-Client nicht verfügbar.' };

  const { data, error } = await fromUnknownTable(supabase, EXPORT_JOBS_TABLE)
    .insert({
      id: jobId,
      tenant_id: tenantId,
      requested_by: userId,
      export_format: 'csv',
      export_type: 'reviewed_time_correction',
      period_year: year,
      period_month: month,
      period_start: period.startDate,
      period_end: period.endDate,
      status: 'draft',
      row_count: 0,
      correction_of_export_job_id: parentJobId,
      correction_reason: correctionReason.trim(),
      correction_sequence: maxSequence + 1,
      export_scope: 'delta_correction',
      metadata: { source: 'wfm_p23_service' },
    })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: false, error: 'Korrektur-Export-Jobs nicht verfügbar (Migration 0252 fehlt).' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  for (const review of partitioned.data.exportable) {
    await fromUnknownTable(supabase, REVIEWS_TABLE)
      .update({ pending_reexport_job_id: jobId })
      .eq('tenant_id', tenantId)
      .eq('id', review.id);
    await appendReviewAction(tenantId, userId, {
      entryReviewId: review.id,
      action: p23Action('reexport_drafted'),
      prevStatus: 'approved',
      newStatus: 'approved',
      comment: correctionReason.trim(),
    });
  }

  return {
    ok: true,
    data: {
      job: mapJobRow(data as Record<string, unknown>),
      period,
      exportableCount: partitioned.data.exportable.length,
      blockedCount: partitioned.data.blocked.length,
    },
  };
}

export async function validateCorrectionDraft(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  jobId: string,
): Promise<ServiceResult<WfmTimeCorrectionValidationResult>> {
  const denied = canCreateReviewedTimeExport(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const jobResult = await getExportJobById(tenantId, jobId);
  if (!jobResult.ok) return jobResult;
  if (!jobResult.data) return { ok: false, error: 'Korrektur-Export nicht gefunden.' };
  if (jobResult.data.exportType !== 'reviewed_time_correction') {
    return { ok: false, error: 'Job ist kein Korrektur-Export.' };
  }
  if (isFinalizedExportJobStatus(jobResult.data.status) || jobResult.data.status === 'canceled') {
    return { ok: false, error: 'Korrektur-Export ist nicht mehr bearbeitbar.' };
  }
  if (!jobResult.data.correctionReason || jobResult.data.correctionReason.trim().length < 10) {
    return { ok: false, error: 'Korrekturgrund fehlt oder ist zu kurz.' };
  }

  const period = jobPeriod(jobResult.data);
  if (!period) return { ok: false, error: 'Export-Zeitraum im Job ungültig.' };

  let reviewIds: string[] = [];
  if (useDemoStore()) {
    reviewIds = [...demoReviewExportState.entries()]
      .filter(([, state]) => state.pendingReexportJobId === jobId)
      .map(([key]) => key.split(':').slice(1).join(':'));
  } else {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await fromUnknownTable(supabase, REVIEWS_TABLE)
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('pending_reexport_job_id', jobId);
      reviewIds = (data ?? []).map((row) => String((row as Record<string, unknown>).id));
    }
  }

  const partitioned = await partitionReviewsForCorrection(
    tenantId,
    reviewIds,
    jobResult.data.correctionReason,
    { currentCorrectionJobId: jobId },
  );
  if (!partitioned.ok) return partitioned;

  const valid = partitioned.data.blocked.length === 0 && partitioned.data.exportable.length > 0;

  if (useDemoStore()) {
    const job = demoJobs.get(jobId);
    if (job && valid) {
      demoJobs.set(jobId, { ...job, status: 'validated', updatedAt: new Date().toISOString() });
    }
  } else if (valid) {
    const supabase = getSupabaseClient();
    if (supabase) {
      await fromUnknownTable(supabase, EXPORT_JOBS_TABLE)
        .update({ status: 'validated' })
        .eq('tenant_id', tenantId)
        .eq('id', jobId);
    }
  }

  return {
    ok: true,
    data: {
      jobId,
      valid,
      exportableReviews: partitioned.data.exportable,
      blockedReviews: partitioned.data.blocked,
      exportableCount: partitioned.data.exportable.length,
      blockedCount: partitioned.data.blocked.length,
    },
  };
}

export async function finalizeCorrectionExport(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  jobId: string,
): Promise<ServiceResult<WfmTimeCorrectionFinalizeResult>> {
  const denied = canFinalizeCorrectionExport(actorRoleKey);
  if (denied) return denied;

  const validation = await validateCorrectionDraft(tenantId, actorRoleKey, jobId);
  if (!validation.ok) return validation;
  if (!validation.data.valid) {
    return { ok: false, error: 'Korrektur-Export kann nicht finalisiert werden.' };
  }

  const jobResult = await getExportJobById(tenantId, jobId);
  if (!jobResult.ok) return jobResult;
  if (!jobResult.data) return { ok: false, error: 'Korrektur-Export nicht gefunden.' };
  if (isFinalizedExportJobStatus(jobResult.data.status)) {
    return { ok: false, error: 'Korrektur-Export ist bereits finalisiert.' };
  }

  const correctionReason = jobResult.data.correctionReason?.trim() ?? '';
  const now = new Date().toISOString();
  const newItems: WfmTimeExportItem[] = [];
  const supersededItemIds: string[] = [];

  for (const review of validation.data.exportableReviews) {
    let oldItem: WfmTimeExportItem | null = null;
    if (useDemoStore()) {
      oldItem = findActiveExportItemForReview(tenantId, review);
    } else {
      const supabase = getSupabaseClient();
      if (supabase && review.latestExportItemId) {
        const { data } = await fromUnknownTable(supabase, EXPORT_ITEMS_TABLE)
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('id', review.latestExportItemId)
          .maybeSingle();
        if (data) oldItem = mapItemRow(data as Record<string, unknown>);
      }
    }

    if (!oldItem) {
      return { ok: false, error: `Ursprungs-Item für Review ${review.id} fehlt.` };
    }

    await buildCorrectionItemForReview(
      tenantId,
      jobId,
      review,
      oldItem,
      correctionReason,
      (oldItem.exportSequence ?? 1) + 1,
      now,
      newItems,
    );
    supersededItemIds.push(oldItem.id);
  }

  if (useDemoStore()) {
    for (const newItem of newItems) {
      const oldItem = demoItems.find((item) => item.id === newItem.supersedesExportItemId);
      if (!oldItem) {
        return { ok: false, error: 'Supersede-Ziel nicht gefunden.' };
      }
      if ((oldItem.itemStatus ?? 'active') !== 'active') {
        return { ok: false, error: 'Supersede-Ziel ist nicht aktiv.' };
      }
      oldItem.itemStatus = 'superseded';
      oldItem.supersededByExportItemId = newItem.id;
      oldItem.supersededAt = now;
      demoItems.push(newItem);

      setDemoReviewExportState(tenantId, newItem.reviewId, {
        exportStatus: 'exported',
        changedAfterExport: false,
        lastExportJobId: jobId,
        lastExportedAt: now,
        latestExportItemId: newItem.id,
        pendingReexportJobId: null,
        changedAfterExportDetectedAt: null,
        changedAfterExportReason: null,
        exportVersion: (getDemoReviewExportState(tenantId, newItem.reviewId)?.exportVersion ?? 1) + 1,
      });

      await appendReviewAction(tenantId, userId, {
        entryReviewId: newItem.reviewId,
        action: p23Action('export_item_superseded'),
        prevStatus: 'approved',
        newStatus: 'approved',
        comment: correctionReason,
      });
      await appendReviewAction(tenantId, userId, {
        entryReviewId: newItem.reviewId,
        action: p23Action('reexport_finalized'),
        prevStatus: 'approved',
        newStatus: 'approved',
        comment: correctionReason,
      });
    }

    const finalizedJob: WfmTimeExportJob = {
      ...jobResult.data,
      status: 'finalized',
      rowCount: newItems.length,
      finalizedAt: now,
      finalizedBy: userId,
      updatedAt: now,
    };
    demoJobs.set(jobId, finalizedJob);

    return {
      ok: true,
      data: {
        job: finalizedJob,
        items: newItems,
        supersededItemIds,
        exportedCount: newItems.length,
      },
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase-Client nicht verfügbar.' };

  const rpcItems = mapCorrectionItemsToRpcPayload(newItems);
  const client = supabase;
  const { error: rpcError } = await (
    client.rpc as (
      fn: string,
      args?: Record<string, unknown>,
    ) => ReturnType<typeof client.rpc>
  )('wfm_finalize_correction_export', {
    p_export_job_id: jobId,
    p_items: rpcItems,
  });
  if (rpcError) return { ok: false, error: toGermanSupabaseError(rpcError) };

  const refreshedJob = await getExportJobById(tenantId, jobId);
  if (!refreshedJob.ok) return refreshedJob;
  if (!refreshedJob.data || !isFinalizedExportJobStatus(refreshedJob.data.status)) {
    return { ok: false, error: 'Korrektur-Finalize-RPC hat den Job nicht finalisiert.' };
  }

  const listed = await listExportItems(tenantId, actorRoleKey, jobId);
  if (!listed.ok) return listed;

  return {
    ok: true,
    data: {
      job: refreshedJob.data,
      items: listed.data,
      supersededItemIds,
      exportedCount: listed.data.length,
    },
  };
}

async function buildCorrectionItemForReview(
  tenantId: string,
  jobId: string,
  review: WfmTimeExportReviewRow,
  oldItem: WfmTimeExportItem,
  correctionReason: string,
  exportSequence: number,
  now: string,
  target: WfmTimeExportItem[],
): Promise<void> {
  const logicalReferenceKey = buildLogicalReferenceKey(review.id);
  const newPayload = buildCorrectionExportPayload({
    reviewId: review.id,
    employeeId: review.employeeId,
    referenceKey: review.referenceKey,
    referenceId: review.referenceId,
    entryKind: review.entryKind,
    periodDate: review.workDate,
    minutesTotal: resolveReviewMinutes(review),
    reviewStatus: 'approved',
    logicalReferenceKey,
    exportSequence,
    correctionReason,
    employeeName: oldItem.exportedPayload.display?.employeeName,
    entryLabel: oldItem.exportedPayload.display?.entryLabel,
  });
  const payloadHash = calculateExportPayloadHash(newPayload);
  const versionHash = buildLiveReviewVersionHash(review);
  const delta = buildCorrectionPayloadDelta({
    oldPayload: oldItem.exportedPayload,
    newPayload,
  });
  const itemId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `correction-item-${Date.now()}-${target.length}`;

  target.push({
    id: itemId,
    tenantId,
    exportJobId: jobId,
    reviewId: review.id,
    employeeId: review.employeeId,
    referenceId: review.referenceId,
    referenceKey: newPayload.referenceKey,
    entryKind: review.entryKind,
    periodDate: review.workDate,
    minutesTotal: newPayload.minutesTotal,
    reviewStatusAtExport: 'approved',
    exportedPayload: newPayload,
    payloadHash,
    sourceReviewVersionHash: versionHash,
    previousPayloadHash: oldItem.payloadHash,
    correctionPayloadDelta: delta,
    correctionReason,
    supersedesExportItemId: oldItem.id,
    supersededByExportItemId: null,
    changedAfterExport: false,
    createdAt: now,
    logicalReferenceKey,
    exportSequence,
    itemStatus: 'active',
  });
}

export async function buildCorrectionExportCsv(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  exportJobId: string,
): Promise<ServiceResult<{ csv: string; rowCount: number }>> {
  const denied = canCreateReviewedTimeExport(actorRoleKey);
  if (denied) return denied;

  const jobResult = await getExportJobById(tenantId, exportJobId);
  if (!jobResult.ok) return jobResult;
  if (!jobResult.data) return { ok: false, error: 'Export-Job nicht gefunden.' };
  if (jobResult.data.exportType !== 'reviewed_time_correction') {
    return { ok: false, error: 'Job ist kein Korrektur-Export.' };
  }

  const listed = await listExportItems(tenantId, actorRoleKey, exportJobId);
  if (!listed.ok) return listed;

  const rows = listed.data.map((item) => {
    const payload = item.exportedPayload as WfmCorrectionExportPayload;
    const delta = (item.correctionPayloadDelta as WfmCorrectionPayloadDelta | null) ?? {
      changedFields: [],
      oldValues: {},
      newValues: {},
      deltaMinutes: 0,
    };
    const originalItemId = item.supersedesExportItemId ?? '';
    const originalJobId = jobResult.data?.correctionOfExportJobId ?? '';
    return {
      exportKind: 'correction_delta' as const,
      logicalReferenceKey: item.logicalReferenceKey ?? buildLogicalReferenceKey(item.reviewId),
      referenceKey: item.referenceKey,
      exportSequence: item.exportSequence ?? 2,
      originalExportJobId: originalJobId,
      correctionExportJobId: exportJobId,
      originalExportItemId: originalItemId,
      newExportItemId: item.id,
      employeeId: item.employeeId,
      employeeName: payload.display?.employeeName,
      entryKind: item.entryKind,
      periodDate: item.periodDate,
      changedFields: delta.changedFields,
      oldValues: delta.oldValues,
      newValues: delta.newValues,
      deltaMinutes: delta.deltaMinutes,
      correctionReason: item.correctionReason ?? jobResult.data?.correctionReason ?? '',
      finalizedAt: jobResult.data?.finalizedAt ?? '',
      finalizedBy: jobResult.data?.finalizedBy ?? '',
      payloadHash: item.payloadHash,
      previousPayloadHash: item.previousPayloadHash ?? '',
    };
  });

  return {
    ok: true,
    data: {
      csv: buildCorrectionCsv(rows),
      rowCount: rows.length,
    },
  };
}

export async function buildInternalCsv(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  exportJobId: string,
): Promise<ServiceResult<{ csv: string; rowCount: number }>> {
  const listed = await listExportItems(tenantId, actorRoleKey, exportJobId);
  if (!listed.ok) return listed;

  const header =
    'reference_key;employee_id;entry_kind;period_date;minutes_total;review_status;payload_hash';
  const rows = listed.data.map((item) => {
    const payload = item.exportedPayload;
    return [
      payload.referenceKey,
      payload.employeeId,
      payload.entryKind,
      payload.periodDate,
      String(payload.minutesTotal),
      payload.reviewStatus,
      item.payloadHash,
    ].join(';');
  });

  return {
    ok: true,
    data: {
      csv: rows.length > 0 ? `${header}\n${rows.join('\n')}` : header,
      rowCount: rows.length,
    },
  };
}

export function listDemoExportItems(): WfmTimeExportItem[] {
  return [...demoItems];
}

export function listDemoExportJobs(): WfmTimeExportJob[] {
  return [...demoJobs.values()];
}

export function getDemoReviewExportMeta(
  tenantId: string,
  reviewId: string,
): {
  exportStatus: WfmTimeExportStatus;
  changedAfterExport: boolean;
  lastExportJobId: string | null;
  lastExportedAt: string | null;
} | null {
  return demoReviewExportState.get(demoReviewKey(tenantId, reviewId)) ?? null;
}

export function setDemoReviewExportChanged(
  tenantId: string,
  reviewId: string,
  exportJobId: string,
): void {
  setDemoReviewExportState(tenantId, reviewId, {
    exportStatus: 'changed_after_export',
    changedAfterExport: true,
    lastExportJobId: exportJobId,
    lastExportedAt: new Date().toISOString(),
    changedAfterExportDetectedAt: new Date().toISOString(),
    changedAfterExportReason: 'manual_demo_mark',
  });
}

export function registerDemoExportJob(job: WfmTimeExportJob): void {
  demoJobs.set(job.id, job);
}

export function registerDemoExportItems(items: WfmTimeExportItem[]): void {
  demoItems.push(...items);
}

export function mapWfmTimeExportJobRow(row: Record<string, unknown>): WfmTimeExportJob {
  return mapJobRow(row);
}
