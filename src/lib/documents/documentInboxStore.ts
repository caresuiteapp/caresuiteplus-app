import type {
  DocumentClassificationResult,
  DocumentEntityLink,
  DocumentInboxAuditEvent,
  DocumentInboxItem,
  DocumentInboxOcrJob,
  DocumentReviewTask,
} from '@/types/documents/documentInbox';

export type DocumentInboxStore = {
  items: Map<string, DocumentInboxItem>;
  classifications: Map<string, DocumentClassificationResult>;
  ocrJobs: Map<string, DocumentInboxOcrJob>;
  entityLinks: Map<string, DocumentEntityLink[]>;
  reviewTasks: Map<string, DocumentReviewTask[]>;
  auditEvents: DocumentInboxAuditEvent[];
};

export const DOCUMENT_INBOX_STORE: DocumentInboxStore = {
  items: new Map(),
  classifications: new Map(),
  ocrJobs: new Map(),
  entityLinks: new Map(),
  reviewTasks: new Map(),
  auditEvents: [],
};

let itemCounter = 0;
let classificationCounter = 0;
let ocrCounter = 0;
let linkCounter = 0;
let reviewCounter = 0;
let auditCounter = 0;

export function nextInboxItemId(): string {
  itemCounter += 1;
  return `inbox-item-${itemCounter}`;
}

export function nextClassificationId(): string {
  classificationCounter += 1;
  return `inbox-cls-${classificationCounter}`;
}

export function nextInboxOcrJobId(): string {
  ocrCounter += 1;
  return `inbox-ocr-${ocrCounter}`;
}

export function nextEntityLinkId(): string {
  linkCounter += 1;
  return `inbox-link-${linkCounter}`;
}

export function nextReviewTaskId(): string {
  reviewCounter += 1;
  return `inbox-review-${reviewCounter}`;
}

export function nextInboxAuditId(): string {
  auditCounter += 1;
  return `inbox-audit-${auditCounter}`;
}

export function filterInboxItemsByTenant(tenantId: string): DocumentInboxItem[] {
  return [...DOCUMENT_INBOX_STORE.items.values()]
    .filter((item) => item.tenantId === tenantId && item.status !== 'deleted')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getInboxAuditEventsForItem(
  tenantId: string,
  inboxItemId: string,
): DocumentInboxAuditEvent[] {
  return DOCUMENT_INBOX_STORE.auditEvents
    .filter((e) => e.tenantId === tenantId && e.inboxItemId === inboxItemId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function resetDocumentInboxStore(): void {
  DOCUMENT_INBOX_STORE.items.clear();
  DOCUMENT_INBOX_STORE.classifications.clear();
  DOCUMENT_INBOX_STORE.ocrJobs.clear();
  DOCUMENT_INBOX_STORE.entityLinks.clear();
  DOCUMENT_INBOX_STORE.reviewTasks.clear();
  DOCUMENT_INBOX_STORE.auditEvents.length = 0;
  itemCounter = 0;
  classificationCounter = 0;
  ocrCounter = 0;
  linkCounter = 0;
  reviewCounter = 0;
  auditCounter = 0;
}
