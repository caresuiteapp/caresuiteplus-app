import type { RoleKey, ServiceResult } from '@/types';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  buildCorrectionExportPayload,
  buildCorrectionPayloadDelta,
  buildExportPayloadForReview,
  buildLogicalReferenceKey,
  calculateExportPayloadHash,
  normalizeExportMinutes,
  type WfmCorrectionExportPayload,
  type WfmCorrectionPayloadDelta,
  type WfmTimeExportPayload,
} from './wfmTimeExportPayloadBuilder';
import {
  canCreateReviewedTimeCorrectionExport,
  isReviewCorrectionCandidate,
  validateCorrectionReason,
  type WfmTimeCorrectionExportReviewInput,
  type WfmTimeExportPeriod,
} from './wfmTimeExportPolicy';
import { appendReviewAction } from './wfmTimeReviewService';
import {
  listExportItems,
  registerDemoExportJob,
  mapWfmTimeExportJobRow,
  validateCorrectionDraft,
  finalizeCorrectionExport,
  setDemoReviewExportState,
  type WfmTimeExportItem,
  type WfmTimeExportJob,
  type WfmTimeExportReviewRow,
} from './wfmTimeExportService';

const EXPORT_JOBS_TABLE = 'workforce_export_jobs';
const EXPORT_ITEMS_TABLE = 'workforce_time_export_items';
const REVIEWS_TABLE = 'workforce_time_entry_reviews';

export interface WfmReviewExportState extends WfmTimeExportReviewRow {
  activeItem: WfmTimeExportItem | null;
  driftPreview: WfmReviewDriftPreview | null;
}

export interface WfmReviewDriftPreview {
  changed: boolean;
  previousHash: string;
  currentHash: string;
  delta: WfmCorrectionPayloadDelta | null;
}

export interface WfmCorrectionExportDraftParams {
  reviewIds: string[];
  correctionOfExportJobId: string;
  reason: string;
  correctionSequence?: number;
}

export interface WfmCorrectionExportDraftResult {
  job: WfmTimeExportJob;
  previewItems: WfmTimeExportItem[];
}

export interface WfmCorrectionExportValidationResult {
  jobId: string;
  valid: boolean;
  reasonError: string | null;
  itemCount: number;
}

export interface WfmCorrectionExportFinalizeResult {
  jobId: string;
  finalized: boolean;
}

function useDemoStore(): boolean {
  return getServiceMode() !== 'supabase' || !getSupabaseClient();
}

function resolveReviewMinutes(review: WfmTimeExportReviewRow): number {
  const raw = review.metadata?.minutes_total ?? review.metadata?.minutesTotal;
  return normalizeExportMinutes(typeof raw === 'number' ? raw : Number(raw ?? 0));
}

function versionedReferenceKey(baseKey: string, sequence: number): string {
  return `${baseKey}:v${sequence}`;
}

async function getDemoExportJob(jobId: string): Promise<WfmTimeExportJob | null> {
  const { listDemoExportJobs } = await import('./wfmTimeExportService');
  return listDemoExportJobs().find((job) => job.id === jobId) ?? null;
}

function permissionDenied<T>(
  denied: ReturnType<typeof canCreateReviewedTimeCorrectionExport>,
): ServiceResult<T> | null {
  if (!denied || denied.ok !== false) return null;
  return { ok: false, error: denied.error };
}

async function listAllReviewExportJobs(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  limit = 50,
): Promise<ServiceResult<WfmTimeExportJob[]>> {
  const denied = permissionDenied<WfmTimeExportJob[]>(
    canCreateReviewedTimeCorrectionExport(actorRoleKey),
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (useDemoStore()) {
    const { listDemoExportJobs } = await import('./wfmTimeExportService');
    return {
      ok: true,
      data: listDemoExportJobs()
        .filter(
          (job) =>
            job.tenantId === tenantId &&
            (job.exportType === 'reviewed_time' || job.exportType === 'reviewed_time_correction'),
        )
        .slice(0, limit),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: [] };

  const { data, error } = await fromUnknownTable(supabase, EXPORT_JOBS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .in('export_type', ['reviewed_time', 'reviewed_time_correction'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return {
    ok: true,
    data: (data ?? []).map((row) => mapWfmTimeExportJobRow(row as Record<string, unknown>)),
  };
}

async function listReviewRows(
  tenantId: string,
  filters?: { changedAfterExportOnly?: boolean; reviewId?: string },
): Promise<ServiceResult<WfmTimeExportReviewRow[]>> {
  if (useDemoStore()) {
    const { listReviewsForPeriod } = await import('./wfmTimeReviewService');
    const listed = await listReviewsForPeriod(tenantId, '2000-01-01', '2099-12-31');
    if (!listed.ok) return listed;

    const { listDemoExportItems, getDemoReviewExportMeta } = await import('./wfmTimeExportService');
    const items = listDemoExportItems().filter((item) => item.tenantId === tenantId);

    let rows: WfmTimeExportReviewRow[] = listed.data.map((review) => {
      const item = items.find((i) => i.reviewId === review.id && i.itemStatus !== 'superseded');
      const meta = getDemoReviewExportMeta(tenantId, review.id);
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
        exportStatus: meta?.exportStatus ?? (item ? 'exported' : 'not_exported'),
        changedAfterExport: meta?.changedAfterExport ?? item?.changedAfterExport ?? false,
        lastExportJobId: meta?.lastExportJobId ?? item?.exportJobId ?? null,
        lastExportedAt: meta?.lastExportedAt ?? item?.createdAt ?? null,
        metadata: {},
        exportVersion: item?.exportSequence ?? 1,
        latestExportItemId: item?.id ?? null,
        pendingReexportJobId: null,
      };
    });

    if (filters?.reviewId) rows = rows.filter((row) => row.id === filters.reviewId);
    if (filters?.changedAfterExportOnly) {
      rows = rows.filter(
        (row) => row.changedAfterExport || row.exportStatus === 'changed_after_export',
      );
    }
    return { ok: true, data: rows };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: [] };

  let query = fromUnknownTable(supabase, REVIEWS_TABLE).select('*').eq('tenant_id', tenantId);
  if (filters?.reviewId) query = query.eq('id', filters.reviewId);
  if (filters?.changedAfterExportOnly) {
    query = query.or('changed_after_export.eq.true,export_status.eq.changed_after_export');
  }

  const { data, error } = await query;
  if (error) {
    if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  const rows = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      tenantId: String(r.tenant_id),
      employeeId: String(r.employee_id),
      workDate: String(r.work_date),
      entryKind: r.entry_kind as WfmTimeExportReviewRow['entryKind'],
      referenceId: String(r.reference_id),
      referenceKey: String(r.reference_key),
      reviewStatus: r.review_status as WfmTimeExportReviewRow['reviewStatus'],
      exportBlocking: Boolean(r.export_blocking),
      exportStatus: (r.export_status as WfmTimeExportReviewRow['exportStatus']) ?? 'not_exported',
      changedAfterExport: Boolean(r.changed_after_export),
      lastExportJobId: (r.last_export_job_id as string | null) ?? null,
      lastExportedAt: (r.last_exported_at as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      exportVersion: r.export_version != null ? Number(r.export_version) : undefined,
      changedAfterExportReason: (r.changed_after_export_reason as string | null) ?? null,
      changedAfterExportDetectedAt: (r.changed_after_export_detected_at as string | null) ?? null,
      latestExportItemId: (r.latest_export_item_id as string | null) ?? null,
      pendingReexportJobId: (r.pending_reexport_job_id as string | null) ?? null,
    } satisfies WfmTimeExportReviewRow;
  });

  return { ok: true, data: rows };
}

async function findActiveItemForReview(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  review: WfmTimeExportReviewRow,
): Promise<WfmTimeExportItem | null> {
  if (review.latestExportItemId) {
    if (useDemoStore()) {
      const { listDemoExportItems } = await import('./wfmTimeExportService');
      return (
        listDemoExportItems().find(
          (item) =>
            item.tenantId === tenantId &&
            item.id === review.latestExportItemId &&
            item.itemStatus !== 'superseded',
        ) ?? null
      );
    }

    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = await fromUnknownTable(supabase, EXPORT_ITEMS_TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', review.latestExportItemId)
      .maybeSingle();
    if (!data) return null;
    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      exportJobId: String(row.export_job_id),
      reviewId: String(row.review_id),
      employeeId: String(row.employee_id),
      referenceId: (row.reference_id as string | null) ?? null,
      referenceKey: String(row.reference_key),
      entryKind: row.entry_kind as WfmTimeExportItem['entryKind'],
      periodDate: String(row.period_date),
      minutesTotal: Number(row.minutes_total),
      reviewStatusAtExport: row.review_status_at_export as WfmTimeExportItem['reviewStatusAtExport'],
      exportedPayload: row.exported_payload as WfmTimeExportPayload,
      payloadHash: String(row.payload_hash),
      changedAfterExport: Boolean(row.changed_after_export),
      createdAt: String(row.created_at),
      logicalReferenceKey: row.logical_reference_key != null ? String(row.logical_reference_key) : undefined,
      exportSequence: row.export_sequence != null ? Number(row.export_sequence) : undefined,
      itemStatus: row.item_status as WfmTimeExportItem['itemStatus'],
    };
  }

  if (!review.lastExportJobId) return null;
  const items = await listExportItems(tenantId, actorRoleKey, review.lastExportJobId);
  if (!items.ok) return null;
  return (
    items.data.find(
      (item) =>
        item.reviewId === review.id &&
        (item.itemStatus === 'active' || item.itemStatus == null),
    ) ?? null
  );
}

export async function listReviewedTimeExports(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  limit = 50,
): Promise<ServiceResult<WfmTimeExportJob[]>> {
  return listAllReviewExportJobs(tenantId, actorRoleKey, limit);
}

export async function listChangedAfterExportReviews(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): Promise<ServiceResult<WfmTimeExportReviewRow[]>> {
  const denied = permissionDenied<WfmTimeExportReviewRow[]>(
    canCreateReviewedTimeCorrectionExport(actorRoleKey),
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  return listReviewRows(tenantId, { changedAfterExportOnly: true });
}

export async function listReviewedTimeCorrectionCandidates(
  tenantId: string,
  actorRoleKey: RoleKey | null,
): Promise<ServiceResult<WfmTimeExportReviewRow[]>> {
  const listed = await listReviewRows(tenantId);
  if (!listed.ok) return listed;

  const candidates: WfmTimeExportReviewRow[] = [];
  for (const review of listed.data) {
    const activeItem = await findActiveItemForReview(tenantId, actorRoleKey, review);
    const input: WfmTimeCorrectionExportReviewInput = {
      reviewId: review.id,
      employeeId: review.employeeId,
      reviewStatus: review.reviewStatus,
      exportBlocking: review.exportBlocking,
      exportStatus: review.exportStatus,
      changedAfterExport: review.changedAfterExport,
      referenceKey: review.referenceKey,
      lastExportJobId: review.lastExportJobId,
      latestExportItemId: review.latestExportItemId ?? activeItem?.id ?? null,
      hasActiveExportItem: Boolean(activeItem),
      pendingReexportJobId: review.pendingReexportJobId ?? null,
      driftDetected: review.exportStatus === 'changed_after_export' || review.changedAfterExport,
    };
    if (isReviewCorrectionCandidate(input)) candidates.push(review);
  }

  return { ok: true, data: candidates };
}

export function compareReviewVersionToLatestExport(
  review: WfmTimeExportReviewRow,
  activeItem: WfmTimeExportItem | null,
): WfmReviewDriftPreview | null {
  if (!activeItem) return null;

  const currentPayload = buildExportPayloadForReview({
    reviewId: review.id,
    employeeId: review.employeeId,
    referenceKey: review.referenceKey,
    referenceId: review.referenceId,
    entryKind: review.entryKind,
    periodDate: review.workDate,
    minutesTotal: resolveReviewMinutes(review),
    reviewStatus: 'approved',
    employeeName: activeItem.exportedPayload.display?.employeeName,
    entryLabel: activeItem.exportedPayload.display?.entryLabel,
  });

  const previousPayload = activeItem.exportedPayload;
  const previousHash = activeItem.payloadHash;
  const currentHash = calculateExportPayloadHash(currentPayload);
  const changed = currentHash !== previousHash;

  return {
    changed,
    previousHash,
    currentHash,
    delta: changed
      ? buildCorrectionPayloadDelta({
          oldPayload: previousPayload,
          newPayload: {
            ...currentPayload,
            logicalReferenceKey: activeItem.logicalReferenceKey ?? buildLogicalReferenceKey(review.id),
            exportSequence: (activeItem.exportSequence ?? 1) + 1,
            correctionReason: 'preview',
          },
        })
      : null,
  };
}

export async function getReviewExportState(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  reviewId: string,
): Promise<ServiceResult<WfmReviewExportState | null>> {
  const denied = permissionDenied<WfmReviewExportState | null>(
    canCreateReviewedTimeCorrectionExport(actorRoleKey),
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const listed = await listReviewRows(tenantId, { reviewId });
  if (!listed.ok) return listed;
  const review = listed.data[0];
  if (!review) return { ok: true, data: null };

  const activeItem = await findActiveItemForReview(tenantId, actorRoleKey, review);
  const driftPreview = compareReviewVersionToLatestExport(review, activeItem);

  return {
    ok: true,
    data: {
      ...review,
      activeItem,
      driftPreview,
    },
  };
}

export async function getExportItemTimeline(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  logicalReferenceKey: string,
): Promise<ServiceResult<WfmTimeExportItem[]>> {
  const denied = permissionDenied<WfmTimeExportItem[]>(
    canCreateReviewedTimeCorrectionExport(actorRoleKey),
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (useDemoStore()) {
    const { listDemoExportItems } = await import('./wfmTimeExportService');
    return {
      ok: true,
      data: listDemoExportItems()
        .filter(
          (item) =>
            item.tenantId === tenantId &&
            (item.logicalReferenceKey === logicalReferenceKey ||
              item.referenceKey === logicalReferenceKey),
        )
        .sort((a, b) => (a.exportSequence ?? 1) - (b.exportSequence ?? 1)),
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, data: [] };

  const { data, error } = await fromUnknownTable(supabase, EXPORT_ITEMS_TABLE)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('logical_reference_key', logicalReferenceKey)
    .order('export_sequence', { ascending: true });

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
        tenantId: String(r.tenant_id),
        exportJobId: String(r.export_job_id),
        reviewId: String(r.review_id),
        employeeId: String(r.employee_id),
        referenceId: (r.reference_id as string | null) ?? null,
        referenceKey: String(r.reference_key),
        entryKind: r.entry_kind as WfmTimeExportItem['entryKind'],
        periodDate: String(r.period_date),
        minutesTotal: Number(r.minutes_total),
        reviewStatusAtExport: r.review_status_at_export as WfmTimeExportItem['reviewStatusAtExport'],
        exportedPayload: r.exported_payload as WfmTimeExportPayload,
        payloadHash: String(r.payload_hash),
        changedAfterExport: Boolean(r.changed_after_export),
        createdAt: String(r.created_at),
        logicalReferenceKey: String(r.logical_reference_key),
        exportSequence: Number(r.export_sequence),
        itemStatus: r.item_status as WfmTimeExportItem['itemStatus'],
        supersedesExportItemId: (r.supersedes_export_item_id as string | null) ?? null,
        previousPayloadHash: (r.previous_payload_hash as string | null) ?? null,
        correctionPayloadDelta: (r.correction_payload_delta as Record<string, unknown> | null) ?? null,
        supersededAt: (r.superseded_at as string | null) ?? null,
      };
    }),
  };
}

export async function previewChangedAfterExport(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  reviewId: string,
): Promise<ServiceResult<WfmReviewDriftPreview | null>> {
  const state = await getReviewExportState(tenantId, actorRoleKey, reviewId);
  if (!state.ok) return state;
  return { ok: true, data: state.data?.driftPreview ?? null };
}

export async function requestReexportForReview(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  reviewId: string,
  reason: string,
): Promise<ServiceResult<{ reviewId: string }>> {
  const denied = permissionDenied<{ reviewId: string }>(
    canCreateReviewedTimeCorrectionExport(actorRoleKey),
  );
  if (denied) return denied;
  const reasonError = validateCorrectionReason(reason);
  if (reasonError) return { ok: false, error: reasonError };

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const action = await appendReviewAction(tenantId, userId, {
    entryReviewId: reviewId,
    action: 'reexport_requested',
    prevStatus: 'approved',
    newStatus: 'approved',
    comment: reason.trim() || 'Korrekturexport angefordert',
  });
  if (!action.ok) return action;

  return { ok: true, data: { reviewId } };
}

export async function validateCorrectionExportDraft(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  jobId: string,
  reason?: string,
): Promise<ServiceResult<WfmCorrectionExportValidationResult>> {
  const denied = permissionDenied<WfmCorrectionExportValidationResult>(
    canCreateReviewedTimeCorrectionExport(actorRoleKey),
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const reasonError = reason != null ? validateCorrectionReason(reason) : null;
  const validation = await validateCorrectionDraft(tenantId, actorRoleKey, jobId);
  if (!validation.ok) return validation;

  return {
    ok: true,
    data: {
      jobId,
      valid: !reasonError && validation.data.valid,
      reasonError,
      itemCount: validation.data.exportableCount,
    },
  };
}

export async function draftReviewedTimeCorrectionExport(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  params: WfmCorrectionExportDraftParams,
): Promise<ServiceResult<WfmCorrectionExportDraftResult>> {
  const denied = permissionDenied<WfmCorrectionExportDraftResult>(
    canCreateReviewedTimeCorrectionExport(actorRoleKey),
  );
  if (denied) return denied;
  const reasonError = validateCorrectionReason(params.reason);
  if (reasonError) return { ok: false, error: reasonError };
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (params.reviewIds.length === 0) {
    return { ok: false, error: 'Mindestens ein Review für den Korrekturexport auswählen.' };
  }

  const now = new Date().toISOString();
  const jobId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `correction-draft-${Date.now()}`;

  const previewItems: WfmTimeExportItem[] = [];

  for (const reviewId of params.reviewIds) {
    const state = await getReviewExportState(tenantId, actorRoleKey, reviewId);
    if (!state.ok) return state;
    if (!state.data?.activeItem) {
      return { ok: false, error: `Kein aktives Export-Item für Review ${reviewId}.` };
    }

    const review = state.data;
    const activeItem = state.data.activeItem;
    const logicalKey = activeItem.logicalReferenceKey ?? buildLogicalReferenceKey(review.id);
    const nextSequence = (activeItem.exportSequence ?? 1) + 1;
    const correctionPayload = buildCorrectionExportPayload({
      reviewId: review.id,
      employeeId: review.employeeId,
      referenceKey: review.referenceKey,
      referenceId: review.referenceId,
      entryKind: review.entryKind,
      periodDate: review.workDate,
      minutesTotal: resolveReviewMinutes(review),
      reviewStatus: 'approved',
      employeeName: activeItem.exportedPayload.display?.employeeName,
      entryLabel: activeItem.exportedPayload.display?.entryLabel,
      logicalReferenceKey: logicalKey,
      exportSequence: nextSequence,
      correctionReason: params.reason.trim(),
    });
    const delta = buildCorrectionPayloadDelta({
      oldPayload: activeItem.exportedPayload,
      newPayload: correctionPayload,
    });
    const itemId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `correction-item-${Date.now()}-${previewItems.length}`;

    previewItems.push({
      id: itemId,
      tenantId,
      exportJobId: jobId,
      reviewId: review.id,
      employeeId: review.employeeId,
      referenceId: review.referenceId,
      referenceKey: correctionPayload.referenceKey,
      entryKind: review.entryKind,
      periodDate: review.workDate,
      minutesTotal: correctionPayload.minutesTotal,
      reviewStatusAtExport: 'approved',
      exportedPayload: correctionPayload,
      payloadHash: calculateExportPayloadHash(correctionPayload),
      changedAfterExport: false,
      createdAt: now,
      logicalReferenceKey: logicalKey,
      exportSequence: nextSequence,
      itemStatus: 'active',
      supersedesExportItemId: activeItem.id,
      correctionReason: params.reason.trim(),
      previousPayloadHash: activeItem.payloadHash,
      correctionPayloadDelta: delta as unknown as Record<string, unknown>,
    });
  }

  const firstReview = previewItems[0];
  const periodDate = firstReview?.periodDate ?? now.slice(0, 10);
  const [year, month] = periodDate.split('-').map(Number);

  const job: WfmTimeExportJob = {
    id: jobId,
    tenantId,
    requestedBy: userId,
    exportType: 'reviewed_time_correction',
    exportFormat: 'csv',
    periodYear: year,
    periodMonth: month,
    periodStart: periodDate,
    periodEnd: periodDate,
    status: 'draft',
    rowCount: previewItems.length,
    contentHash: null,
    notes: null,
    finalizedAt: null,
    finalizedBy: null,
    canceledAt: null,
    canceledBy: null,
    createdAt: now,
    updatedAt: now,
    correctionOfExportJobId: params.correctionOfExportJobId,
    correctionReason: params.reason.trim(),
    correctionSequence: params.correctionSequence ?? 1,
    exportScope: 'delta_correction',
  };

  if (useDemoStore()) {
    registerDemoExportJob(job);
    for (const item of previewItems) {
      setDemoReviewExportState(tenantId, item.reviewId, { pendingReexportJobId: jobId });
      await appendReviewAction(tenantId, userId, {
        entryReviewId: item.reviewId,
        action: 'reexport_drafted',
        prevStatus: 'approved',
        newStatus: 'approved',
        comment: `${params.reason.trim()} — Korrekturexport-Entwurf ${jobId}`,
      });
    }
    return { ok: true, data: { job, previewItems } };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase-Client nicht verfügbar.' };

  const { error: jobError } = await fromUnknownTable(supabase, EXPORT_JOBS_TABLE).insert({
    id: jobId,
    tenant_id: tenantId,
    requested_by: userId,
    export_format: 'csv',
    export_type: 'reviewed_time_correction',
    period_year: year,
    period_month: month,
    period_start: periodDate,
    period_end: periodDate,
    status: 'draft',
    row_count: previewItems.length,
    correction_of_export_job_id: params.correctionOfExportJobId,
    correction_reason: params.reason.trim(),
    correction_sequence: params.correctionSequence ?? 1,
    export_scope: 'delta_correction',
    metadata: { source: 'wfm_p23_service' },
  });

  if (jobError) {
    return { ok: false, error: toGermanSupabaseError(jobError) };
  }

  for (const item of previewItems) {
    await appendReviewAction(tenantId, userId, {
      entryReviewId: item.reviewId,
      action: 'reexport_drafted',
      prevStatus: 'approved',
      newStatus: 'approved',
      comment: `${params.reason.trim()} — Korrekturexport-Entwurf ${jobId}`,
    });

    await fromUnknownTable(supabase, REVIEWS_TABLE)
      .update({ pending_reexport_job_id: jobId })
      .eq('tenant_id', tenantId)
      .eq('id', item.reviewId);
  }

  return { ok: true, data: { job, previewItems } };
}

export async function finalizeReviewedTimeCorrectionExport(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  jobId: string,
  reason: string,
): Promise<ServiceResult<WfmCorrectionExportFinalizeResult>> {
  const denied = permissionDenied<WfmCorrectionExportFinalizeResult>(
    canCreateReviewedTimeCorrectionExport(actorRoleKey),
  );
  if (denied) return denied;
  const reasonError = validateCorrectionReason(reason);
  if (reasonError) return { ok: false, error: reasonError };
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const validation = await validateCorrectionExportDraft(tenantId, actorRoleKey, jobId, reason);
  if (!validation.ok) return validation;
  if (!validation.data.valid) {
    return { ok: false, error: validation.data.reasonError ?? 'Korrekturexport ungültig.' };
  }

  if (!useDemoStore()) {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase-Client nicht verfügbar.' };
    await fromUnknownTable(supabase, EXPORT_JOBS_TABLE)
      .update({
        status: 'validated',
        correction_reason: reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', jobId);
  }

  const finalized = await finalizeCorrectionExport(tenantId, userId, actorRoleKey, jobId);
  if (!finalized.ok) return finalized;

  return { ok: true, data: { jobId, finalized: true } };
}

export function exportJobTypeLabel(exportType: WfmTimeExportJob['exportType']): string {
  switch (exportType) {
    case 'reviewed_time':
      return 'Reviewed Time';
    case 'reviewed_time_correction':
      return 'Korrekturexport';
    case 'session_legacy':
      return 'Legacy Session';
    default:
      return exportType;
  }
}

export function reviewExportBadgeLabel(review: WfmTimeExportReviewRow): string {
  if (review.pendingReexportJobId) return 'Korrekturentwurf';
  if (review.exportStatus === 'changed_after_export' || review.changedAfterExport) {
    return 'Nach Export geändert';
  }
  if (review.exportStatus === 'exported') return 'Exportiert';
  if (review.exportStatus === 'export_ready') return 'Exportbereit';
  return 'Nicht exportiert';
}

export type { WfmTimeExportPeriod };
