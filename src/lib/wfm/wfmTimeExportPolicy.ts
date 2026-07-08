import type { RoleKey } from '@/types';
import { enforcePermission, hasAnyPermission } from '@/lib/permissions';
import type { WfmTimeReviewStatus } from './wfmTimeReviewService';

export type WfmTimeExportStatus =
  | 'not_exported'
  | 'export_ready'
  | 'exported'
  | 'changed_after_export'
  | 'export_blocked';

export type WfmTimeExportJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'draft'
  | 'validated'
  | 'finalized'
  | 'canceled';

export type WfmTimeExportType = 'reviewed_time' | 'reviewed_time_correction' | 'session_legacy';

export type WfmTimeExportScope = 'delta_correction' | 'full_replacement';

export type WfmTimeExportItemStatus = 'active' | 'superseded' | 'voided';

export type WfmTimeExportBlockReason =
  | 'not_approved'
  | 'export_blocking'
  | 'review_status_open'
  | 'review_status_pending_review'
  | 'review_status_needs_clarification'
  | 'review_status_rejected'
  | 'review_status_corrected'
  | 'review_status_locked'
  | 'review_status_superseded'
  | 'already_exported'
  | 'changed_after_export'
  | 'duplicate_reference_key';

export type WfmTimeCorrectionExportBlockReason =
  | WfmTimeExportBlockReason
  | 'not_exported_yet'
  | 'no_drift_detected'
  | 'missing_last_export_job'
  | 'missing_original_item'
  | 'missing_employee_context'
  | 'missing_correction_reason'
  | 'pending_reexport_exists';

export interface WfmTimeExportPeriod {
  startDate: string;
  endDate: string;
}

export interface WfmTimeExportReviewInput {
  reviewStatus: WfmTimeReviewStatus;
  exportBlocking: boolean;
  exportStatus?: WfmTimeExportStatus;
  changedAfterExport?: boolean;
  referenceKey: string;
  hasFinalizedExportItem?: boolean;
}

export interface WfmTimeCorrectionReviewInput extends WfmTimeExportReviewInput {
  hasActiveExportItem?: boolean;
  pendingReexportJobId?: string | null;
  lastExportJobId?: string | null;
  latestExportItemId?: string | null;
  employeeId?: string | null;
  correctionReason?: string | null;
  driftDetected?: boolean;
  currentCorrectionJobId?: string | null;
}

export interface WfmTimeCorrectionExportReviewInput extends WfmTimeCorrectionReviewInput {
  reviewId: string;
}

const BLOCKED_REVIEW_STATUS_REASON: Partial<
  Record<WfmTimeReviewStatus, WfmTimeExportBlockReason>
> = {
  open: 'review_status_open',
  pending_review: 'review_status_pending_review',
  needs_clarification: 'review_status_needs_clarification',
  rejected: 'review_status_rejected',
  corrected: 'review_status_corrected',
  locked: 'review_status_locked',
  superseded: 'review_status_superseded',
};

const CORRECTION_BLOCKED_REVIEW_STATUS_REASON: Partial<
  Record<WfmTimeReviewStatus, WfmTimeCorrectionExportBlockReason>
> = BLOCKED_REVIEW_STATUS_REASON;

export const WFM_CORRECTION_REASON_MIN_LENGTH = 10;

const DRIFT_MARK_PERMISSIONS = [
  'time.tracking.admin.correct',
  'time.tracking.admin.export',
  'business.tenant.manage',
] as const;

const CORRECTION_FINALIZE_PERMISSIONS = ['time.tracking.admin.export', 'business.tenant.manage'] as const;

export function normalizeExportPeriod(input: {
  startDate: string;
  endDate: string;
}): WfmTimeExportPeriod | null {
  const startDate = input.startDate?.trim();
  const endDate = input.endDate?.trim();
  if (!startDate || !endDate) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return null;
  }
  if (startDate > endDate) return null;
  return { startDate, endDate };
}

export function isFinalizedExportJobStatus(status: string): boolean {
  return status === 'finalized' || status === 'completed';
}

export function canCreateReviewedTimeExport(actorRoleKey: RoleKey | null): ReturnType<
  typeof enforcePermission
> {
  return enforcePermission(actorRoleKey, 'time.tracking.admin.export');
}

export function canCreateReviewedTimeCorrectionExport(
  actorRoleKey: RoleKey | null,
): ReturnType<typeof enforcePermission> {
  return canFinalizeCorrectionExport(actorRoleKey);
}

export function canMarkExportDrift(actorRoleKey: RoleKey | null): ReturnType<typeof enforcePermission> | null {
  if (!actorRoleKey) {
    return { ok: false, error: 'Sie sind nicht angemeldet. Bitte melden Sie sich an.' };
  }
  if (hasAnyPermission(actorRoleKey, [...DRIFT_MARK_PERMISSIONS])) {
    return null;
  }
  return { ok: false, error: 'Keine Berechtigung für Drift-Markierung.' };
}

export function canFinalizeCorrectionExport(actorRoleKey: RoleKey | null): ReturnType<
  typeof enforcePermission
> {
  if (!actorRoleKey) {
    return { ok: false, error: 'Sie sind nicht angemeldet. Bitte melden Sie sich an.' };
  }
  if (hasAnyPermission(actorRoleKey, [...CORRECTION_FINALIZE_PERMISSIONS])) {
    return null;
  }
  return enforcePermission(actorRoleKey, 'time.tracking.admin.export');
}

export function validateCorrectionReason(reason: string | null | undefined): string | null {
  const trimmed = reason?.trim() ?? '';
  if (trimmed.length < WFM_CORRECTION_REASON_MIN_LENGTH) {
    return `Korrekturgrund erforderlich (mindestens ${WFM_CORRECTION_REASON_MIN_LENGTH} Zeichen).`;
  }
  return null;
}

export function getReviewExportBlockReason(
  review: WfmTimeExportReviewInput,
): WfmTimeExportBlockReason | null {
  if (review.exportStatus === 'exported' || review.hasFinalizedExportItem) {
    return 'already_exported';
  }
  if (review.exportStatus === 'changed_after_export' || review.changedAfterExport) {
    return 'changed_after_export';
  }
  if (review.reviewStatus !== 'approved') {
    return BLOCKED_REVIEW_STATUS_REASON[review.reviewStatus] ?? 'not_approved';
  }
  if (review.exportBlocking) {
    return 'export_blocking';
  }
  return null;
}

export function isReviewExportable(review: WfmTimeExportReviewInput): boolean {
  return getReviewExportBlockReason(review) === null;
}

export function isReviewCorrectionCandidate(review: WfmTimeCorrectionReviewInput): boolean {
  const wasExported =
    review.exportStatus === 'exported' ||
    review.exportStatus === 'changed_after_export' ||
    review.changedAfterExport === true ||
    Boolean(review.lastExportJobId);
  if (!wasExported) return false;
  if (!review.lastExportJobId && !review.hasActiveExportItem && !review.latestExportItemId) {
    return false;
  }
  return review.exportStatus === 'changed_after_export' || review.changedAfterExport === true;
}

export function getReviewCorrectionExportBlockReason(
  review: WfmTimeCorrectionReviewInput,
): WfmTimeCorrectionExportBlockReason | null {
  if (review.employeeId !== undefined && !review.employeeId?.trim()) {
    return 'missing_employee_context';
  }
  if (!review.lastExportJobId && !review.hasActiveExportItem && !review.latestExportItemId) {
    return 'missing_original_item';
  }
  if (review.pendingReexportJobId) {
    if (
      !review.currentCorrectionJobId ||
      review.pendingReexportJobId !== review.currentCorrectionJobId
    ) {
      return 'pending_reexport_exists';
    }
  }
  if (review.reviewStatus !== 'approved') {
    return CORRECTION_BLOCKED_REVIEW_STATUS_REASON[review.reviewStatus] ?? 'not_approved';
  }
  if (review.exportBlocking) {
    return 'export_blocking';
  }
  if (
    review.exportStatus !== 'changed_after_export' &&
    !review.changedAfterExport &&
    !('driftDetected' in review && (review as WfmTimeCorrectionExportReviewInput).driftDetected)
  ) {
    if (review.exportStatus === 'exported') {
      return 'no_drift_detected';
    }
    return 'not_exported_yet';
  }
  if (review.correctionReason !== undefined) {
    const reason = review.correctionReason?.trim() ?? '';
    if (reason.length < WFM_CORRECTION_REASON_MIN_LENGTH) {
      return 'missing_correction_reason';
    }
  }
  return null;
}

export function isReviewCorrectionExportable(review: WfmTimeCorrectionReviewInput): boolean {
  return isReviewCorrectionCandidate(review) && getReviewCorrectionExportBlockReason(review) === null;
}

export function deriveReviewExportStatus(
  review: WfmTimeExportReviewInput,
): WfmTimeExportStatus {
  if (review.exportStatus === 'exported' || review.hasFinalizedExportItem) {
    return 'exported';
  }
  if (review.exportStatus === 'changed_after_export' || review.changedAfterExport) {
    return 'changed_after_export';
  }
  if (review.exportStatus === 'export_blocked') {
    return 'export_blocked';
  }
  if (isReviewExportable(review)) {
    return 'export_ready';
  }
  if (review.reviewStatus === 'approved' && review.exportBlocking) {
    return 'export_blocked';
  }
  return review.exportStatus ?? 'not_exported';
}

export function exportBlockReasonLabel(reason: WfmTimeExportBlockReason): string {
  const labels: Record<WfmTimeExportBlockReason, string> = {
    not_approved: 'Nicht freigegeben',
    export_blocking: 'Export blockiert',
    review_status_open: 'Status offen',
    review_status_pending_review: 'Prüfung ausstehend',
    review_status_needs_clarification: 'Rückfrage offen',
    review_status_rejected: 'Abgelehnt',
    review_status_corrected: 'Korrektur — erneute Freigabe nötig',
    review_status_locked: 'Gesperrt',
    review_status_superseded: 'Ersetzt',
    already_exported: 'Bereits exportiert',
    changed_after_export: 'Nach Export geändert',
    duplicate_reference_key: 'Bereits final exportiert',
  };
  return labels[reason];
}

export function correctionExportBlockReasonLabel(
  reason: WfmTimeCorrectionExportBlockReason,
): string {
  const correctionLabels: Partial<Record<WfmTimeCorrectionExportBlockReason, string>> = {
    not_exported_yet: 'Noch nicht exportiert',
    no_drift_detected: 'Keine Drift erkannt',
    missing_last_export_job: 'Ursprungs-Export fehlt',
    missing_original_item: 'Ursprungs-Export-Item fehlt',
    missing_employee_context: 'Mitarbeiterkontext fehlt',
    missing_correction_reason: 'Korrekturgrund fehlt (min. 10 Zeichen)',
    pending_reexport_exists: 'Offener Korrektur-Entwurf vorhanden',
  };
  return correctionLabels[reason] ?? exportBlockReasonLabel(reason as WfmTimeExportBlockReason);
}
