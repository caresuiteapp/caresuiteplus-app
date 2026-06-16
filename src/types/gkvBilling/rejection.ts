import type { TenantScopedEntity } from '../core/base';

export type GkvRejectionCaseType = 'ruecklaeufer' | 'absetzung' | 'chargeback';

export const GKV_REJECTION_CASE_TYPE_LABELS: Record<GkvRejectionCaseType, string> = {
  ruecklaeufer: 'Rückläufer',
  absetzung: 'Absetzung',
  chargeback: 'Rückforderung',
};

export type GkvRejectionCaseStatus = 'open' | 'in_review' | 'resolved' | 'closed';

export const GKV_REJECTION_CASE_STATUS_LABELS: Record<GkvRejectionCaseStatus, string> = {
  open: 'Offen',
  in_review: 'In Prüfung',
  resolved: 'Erledigt',
  closed: 'Geschlossen',
};

/** Rückläufer/Absetzung — gkv_rejection_cases */
export type GkvRejectionCase = TenantScopedEntity & {
  exportBatchId: string | null;
  exportItemId: string | null;
  caseType: GkvRejectionCaseType;
  status: GkvRejectionCaseStatus;
  reasonCode: string | null;
  reasonText: string;
  resolvedAt: string | null;
};
