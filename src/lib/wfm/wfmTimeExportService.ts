import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  buildExportPayloadForReview,
  calculateExportPayloadHash,
  normalizeExportMinutes,
  type WfmTimeExportPayload,
} from './wfmTimeExportPayloadBuilder';
import {
  canCreateReviewedTimeExport,
  exportBlockReasonLabel,
  getReviewExportBlockReason,
  isFinalizedExportJobStatus,
  isReviewExportable,
  normalizeExportPeriod,
  type WfmTimeExportBlockReason,
  type WfmTimeExportJobStatus,
  type WfmTimeExportPeriod,
  type WfmTimeExportReviewInput,
  type WfmTimeExportStatus,
  type WfmTimeExportType,
} from './wfmTimeExportPolicy';
import {
  appendReviewAction,
  type WfmTimeReviewEntryKind,
  type WfmTimeReviewStatus,
} from './wfmTimeReviewService';

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
}

export interface WfmTimeExportBlockedReview {
  reviewId: string;
  referenceKey: string;
  reason: WfmTimeExportBlockReason;
  reasonLabel: string;
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
        const state = demoReviewExportState.get(demoReviewKey(tenantId, review.id));
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
      changedAfterExport: false,
      createdAt: now,
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
      demoReviewExportState.set(demoReviewKey(tenantId, item.reviewId), {
        exportStatus: 'exported',
        changedAfterExport: false,
        lastExportJobId: batchId,
        lastExportedAt: now,
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
      changed_after_export: false,
    });
    if (itemError) {
      return { ok: false, error: toGermanSupabaseError(itemError) };
    }

    const { error: reviewError } = await fromUnknownTable(supabase, REVIEWS_TABLE)
      .update({
        export_status: 'exported',
        last_export_job_id: batchId,
        last_exported_at: now,
        changed_after_export: false,
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
  const denied = canCreateReviewedTimeExport(actorRoleKey);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  let items: WfmTimeExportItem[] = [];
  if (filters?.exportJobId) {
    const listed = await listExportItems(tenantId, actorRoleKey, filters.exportJobId);
    if (!listed.ok) return listed;
    items = listed.data;
  } else if (useDemoStore()) {
    items = demoItems.filter((item) => item.tenantId === tenantId);
  } else {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: true, data: [] };
    const { data, error } = await fromUnknownTable(supabase, EXPORT_ITEMS_TABLE)
      .select('*')
      .eq('tenant_id', tenantId);
    if (error) {
      if (isSupabaseMissingTableError(error)) return { ok: true, data: [] };
      return { ok: false, error: toGermanSupabaseError(error) };
    }
    items = (data ?? []).map((row) => mapItemRow(row as Record<string, unknown>));
  }

  if (filters?.reviewId) {
    items = items.filter((item) => item.reviewId === filters.reviewId);
  }

  const results: { reviewId: string; changed: boolean; previousHash: string; currentHash: string }[] = [];

  for (const item of items) {
    const currentPayload = buildExportPayloadForReview({
      reviewId: item.reviewId,
      employeeId: item.employeeId,
      referenceKey: item.referenceKey,
      referenceId: item.referenceId,
      entryKind: item.entryKind,
      periodDate: item.periodDate,
      minutesTotal: item.minutesTotal,
      reviewStatus: 'approved',
      employeeName: item.exportedPayload.display?.employeeName,
      entryLabel: item.exportedPayload.display?.entryLabel,
    });
    const currentHash = calculateExportPayloadHash(currentPayload);
    const changed = currentHash !== item.payloadHash;
    results.push({
      reviewId: item.reviewId,
      changed,
      previousHash: item.payloadHash,
      currentHash,
    });

    if (changed) {
      if (useDemoStore()) {
        demoReviewExportState.set(demoReviewKey(tenantId, item.reviewId), {
          exportStatus: 'changed_after_export',
          changedAfterExport: true,
          lastExportJobId: item.exportJobId,
          lastExportedAt: item.createdAt,
        });
        await appendReviewAction(tenantId, userId, {
          entryReviewId: item.reviewId,
          action: 'changed_after_export_detected',
          prevStatus: 'approved',
          newStatus: 'approved',
          comment: 'Drift nach Export erkannt',
        });
      } else {
        const supabase = getSupabaseClient();
        if (supabase) {
          await fromUnknownTable(supabase, REVIEWS_TABLE)
            .update({
              export_status: 'changed_after_export',
              changed_after_export: true,
            })
            .eq('tenant_id', tenantId)
            .eq('id', item.reviewId);
        }
      }
    }
  }

  return { ok: true, data: results };
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
