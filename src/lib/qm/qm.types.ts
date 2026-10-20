import type { EntityId, ISODateTime, TenantScopedEntity } from '@/types/core/base';

export type QmDocumentType =
  | 'procedure'
  | 'work_instruction'
  | 'checklist'
  | 'protocol'
  | 'policy'
  | 'form'
  | 'handbook_chapter';

export type QmDocumentStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'archived'
  | 'superseded';

export type QmChangeType = 'correction' | 'improvement' | 'legal_update' | 'audit_finding';

export type QmComplianceStatus = 'open' | 'in_progress' | 'fulfilled' | 'overdue' | 'waived';

export type MdPackageStatus =
  | 'draft'
  | 'in_preparation'
  | 'pending_approval'
  | 'approved'
  | 'exported'
  | 'shared'
  | 'revoked';

export type QmExportJobStatus = 'in_preparation' | 'generated' | 'failed' | 'expired';

export type QmAiDraftStatus = 'pending' | 'accepted' | 'rejected';

export type QmAiDraftAction =
  | 'create_chapter'
  | 'revise_document'
  | 'summarize'
  | 'checklist'
  | 'measure_plan'
  | 'gap_analysis';

export type QmHandbook = TenantScopedEntity & {
  title: string;
  version: string;
  status: 'active' | 'draft' | 'archived';
  approvedAt: ISODateTime | null;
  approvedBy: string | null;
};

export type QmHandbookChapter = TenantScopedEntity & {
  handbookId: EntityId;
  parentId: EntityId | null;
  sortOrder: number;
  title: string;
  content: string;
  version: string;
  status: QmDocumentStatus;
  lastReviewedAt: ISODateTime | null;
};

export type QmDocument = TenantScopedEntity & {
  documentNumber: string;
  title: string;
  documentType: QmDocumentType;
  status: QmDocumentStatus;
  currentVersionId: EntityId | null;
  chapterId: EntityId | null;
  ownerRole: string;
  reviewDueAt: ISODateTime | null;
  tags: string[];
};

export type QmDocumentVersion = TenantScopedEntity & {
  documentId: EntityId;
  versionNumber: string;
  content: string;
  changeSummary: string;
  status: QmDocumentStatus;
  approvedAt: ISODateTime | null;
  approvedBy: string | null;
  publishedAt: ISODateTime | null;
};

export type QmLegalReference = TenantScopedEntity & {
  title: string;
  source: string;
  referenceCode: string;
  summary: string;
  effectiveFrom: ISODateTime | null;
  documentIds: EntityId[];
};

export type QmComplianceRequirement = TenantScopedEntity & {
  title: string;
  legalReferenceId: EntityId | null;
  status: QmComplianceStatus;
  dueAt: ISODateTime | null;
  responsibleRole: string;
  evidenceDocumentIds: EntityId[];
  notes: string;
};

export type QmChange = TenantScopedEntity & {
  title: string;
  changeType: QmChangeType;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  documentId: EntityId | null;
  description: string;
  requestedBy: string;
  completedAt: ISODateTime | null;
};

export type QmAudit = TenantScopedEntity & {
  title: string;
  auditType: 'internal' | 'external' | 'md_inspection';
  status: 'planned' | 'in_progress' | 'completed' | 'follow_up';
  scheduledAt: ISODateTime;
  completedAt: ISODateTime | null;
  auditorName: string;
  findingsCount: number;
  summary: string;
};

export type QmMeasure = TenantScopedEntity & {
  title: string;
  status: 'open' | 'in_progress' | 'completed' | 'overdue';
  auditId: EntityId | null;
  dueAt: ISODateTime;
  assignedTo: string;
  description: string;
  completedAt: ISODateTime | null;
};

export type QmReadConfirmation = TenantScopedEntity & {
  documentId: EntityId;
  documentVersionId: EntityId;
  userId: string;
  userDisplayName: string;
  confirmedAt: ISODateTime;
};

export type QmAiDraft = TenantScopedEntity & {
  action: QmAiDraftAction;
  status: QmAiDraftStatus;
  targetDocumentId: EntityId | null;
  targetChapterId: EntityId | null;
  promptSummary: string;
  suggestedContent: string;
  disclaimer: string;
  reviewedAt: ISODateTime | null;
};

export type MdAuditPackage = TenantScopedEntity & {
  title: string;
  status: MdPackageStatus;
  inspectionYear: number;
  datenschutzConfirmed: boolean;
  approvedAt: ISODateTime | null;
  approvedBy: string | null;
  exportJobId: EntityId | null;
  shareTokenId: EntityId | null;
  notes: string;
};

export type MdAuditPackageItem = TenantScopedEntity & {
  packageId: EntityId;
  documentId: EntityId;
  sortOrder: number;
  includedVersionId: EntityId | null;
  notes: string;
};

export type MdShareToken = TenantScopedEntity & {
  packageId: EntityId;
  token: string;
  expiresAt: ISODateTime;
  revokedAt: ISODateTime | null;
  accessCount: number;
  shareUrl: string;
};

export type MdAccessLogEntry = TenantScopedEntity & {
  tokenId: EntityId;
  packageId: EntityId;
  accessedAt: ISODateTime;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  reason: string | null;
};

export type QmExportJob = TenantScopedEntity & {
  packageId: EntityId | null;
  documentIds: EntityId[];
  status: QmExportJobStatus;
  format: 'pdf' | 'zip';
  preparedOnly: boolean;
  downloadUrl: string | null;
  errorMessage: string | null;
  completedAt: ISODateTime | null;
};

export type QmDashboardSnapshot = {
  chapterCount: number;
  documentCount: number;
  complianceOpenCount: number;
  mdPackageCount: number;
  pendingApprovals: number;
  recentChanges: QmChange[];
  upcomingAudits: QmAudit[];
};

export type QmTemplateSeed = {
  id: EntityId;
  title: string;
  documentType: QmDocumentType;
  content: string;
  tags: string[];
};
