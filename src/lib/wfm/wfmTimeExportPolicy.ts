import type { RoleKey } from '@/types';
import { enforcePermission } from '@/lib/permissions';
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

export type WfmTimeExportType = 'reviewed_time' | 'session_legacy';

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
