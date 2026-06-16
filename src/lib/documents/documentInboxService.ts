import type { RoleKey, ServiceResult } from '@/types';
import type { OcrProviderKey } from '@/types/documents/connect';
import type {
  ClassificationConfidence,
  DocumentClassificationResult,
  DocumentEntityLink,
  DocumentEntityLinkType,
  DocumentInboxAuditEvent,
  DocumentInboxAuditEventType,
  DocumentInboxCategory,
  DocumentInboxExecutionContext,
  DocumentInboxItem,
  DocumentInboxOcrJob,
  DocumentInboxSource,
  DocumentInboxStatus,
  DocumentReviewTask,
} from '@/types/documents/documentInbox';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { runService } from '@/lib/services/serviceRunner';
import {
  assertInboxItemMutable,
  assertInboxTenantScope,
  resolveStatusAfterClassification,
  shouldRequireReviewForClassification,
  validateInboxOcrReady,
} from './documentInboxGuard';
import {
  DOCUMENT_INBOX_STORE,
  filterInboxItemsByTenant,
  getInboxAuditEventsForItem,
  nextClassificationId,
  nextEntityLinkId,
  nextInboxAuditId,
  nextInboxItemId,
  nextInboxOcrJobId,
  nextReviewTaskId,
} from './documentInboxStore';

function nowIso(): string {
  return new Date().toISOString();
}

function appendInboxAudit(input: {
  tenantId: string;
  inboxItemId: string;
  eventType: DocumentInboxAuditEventType;
  summary: string;
  oldStatus?: DocumentInboxStatus | null;
  newStatus?: DocumentInboxStatus | null;
  actorUserId?: string | null;
  metadata?: Record<string, string>;
}): DocumentInboxAuditEvent {
  const timestamp = nowIso();
  const event: DocumentInboxAuditEvent = {
    id: nextInboxAuditId(),
    tenantId: input.tenantId,
    inboxItemId: input.inboxItemId,
    eventType: input.eventType,
    summary: input.summary,
    oldStatus: input.oldStatus ?? null,
    newStatus: input.newStatus ?? null,
    actorUserId: input.actorUserId ?? null,
    metadata: input.metadata ?? {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  DOCUMENT_INBOX_STORE.auditEvents.push(event);
  return event;
}

function updateInboxItem(item: DocumentInboxItem): DocumentInboxItem {
  const next = { ...item, updatedAt: nowIso() };
  DOCUMENT_INBOX_STORE.items.set(item.id, next);
  return next;
}

function getInboxItemOrError(
  tenantId: string,
  inboxItemId: string,
): ServiceResult<DocumentInboxItem> {
  const item = DOCUMENT_INBOX_STORE.items.get(inboxItemId);
  if (!item || item.tenantId !== tenantId) {
    return { ok: false, error: 'Dokumenteneingang-Eintrag nicht gefunden.' };
  }
  return { ok: true, data: item };
}

function assertLiveInboxAvailable<T>(tenantId: string): ServiceResult<T> | null {
  if (getServiceMode() === 'supabase') {
    return guardLiveDemoFeature<T>(tenantId, 'Dokumenteneingang');
  }
  return null;
}

export type UploadInboxDocumentInput = {
  tenantId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  source: DocumentInboxSource;
  containsHealthData?: boolean;
  uploadedByUserId?: string | null;
  title?: string | null;
  storageReference?: string | null;
};

export async function uploadInboxDocument(
  input: UploadInboxDocumentInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentInboxItem>> {
  const denied = enforcePermission<DocumentInboxItem>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = assertLiveInboxAvailable<DocumentInboxItem>(input.tenantId);
  if (liveBlock) return liveBlock;

  return runService(async () => {
    const timestamp = nowIso();
    const item: DocumentInboxItem = {
      id: nextInboxItemId(),
      tenantId: input.tenantId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      storageReference: input.storageReference ?? null,
      source: input.source,
      status: 'uploaded',
      category: null,
      containsHealthData: input.containsHealthData ?? false,
      uploadedByUserId: input.uploadedByUserId ?? null,
      title: input.title ?? input.fileName,
      notes: null,
      archivedAt: null,
      rejectedAt: null,
      deletedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    DOCUMENT_INBOX_STORE.items.set(item.id, item);
    appendInboxAudit({
      tenantId: input.tenantId,
      inboxItemId: item.id,
      eventType: 'item_uploaded',
      summary: `Datei „${input.fileName}" hochgeladen (${input.source}).`,
      newStatus: 'uploaded',
      actorUserId: input.uploadedByUserId,
      metadata: { source: input.source },
    });

    return { ok: true, data: item };
  }, { delayMs: 150 });
}

export async function setInboxDocumentCategory(
  tenantId: string,
  inboxItemId: string,
  category: DocumentInboxCategory,
  actorRoleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<DocumentInboxItem>> {
  const denied = enforcePermission<DocumentInboxItem>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = assertLiveInboxAvailable<DocumentInboxItem>(tenantId);
  if (liveBlock) return liveBlock;

  return runService(async () => {
    const found = getInboxItemOrError(tenantId, inboxItemId);
    if (!found.ok) return found;

    const mutable = assertInboxItemMutable(found.data);
    if (!mutable.allowed) return { ok: false, error: mutable.message };

    const oldStatus = found.data.status;
    const updated = updateInboxItem({
      ...found.data,
      category,
      status: oldStatus === 'uploaded' ? 'classification_pending' : found.data.status,
    });

    appendInboxAudit({
      tenantId,
      inboxItemId,
      eventType: 'category_set',
      summary: `Kategorie gesetzt: ${category}.`,
      oldStatus,
      newStatus: updated.status,
      actorUserId,
      metadata: { category },
    });

    return { ok: true, data: updated };
  }, { delayMs: 100 });
}

export type ClassifyInboxDocumentInput = {
  tenantId: string;
  inboxItemId: string;
  suggestedCategory: DocumentInboxCategory | null;
  suggestedEntityType: DocumentEntityLinkType | null;
  suggestedEntityId: string | null;
  confidence: ClassificationConfidence;
  rawHints?: Record<string, string>;
};

export async function classifyInboxDocument(
  input: ClassifyInboxDocumentInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ item: DocumentInboxItem; classification: DocumentClassificationResult; reviewTask?: DocumentReviewTask }>> {
  const denied = enforcePermission<{ item: DocumentInboxItem; classification: DocumentClassificationResult; reviewTask?: DocumentReviewTask }>(
    actorRoleKey,
    'office.documents.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = assertLiveInboxAvailable<{ item: DocumentInboxItem; classification: DocumentClassificationResult; reviewTask?: DocumentReviewTask }>(
    input.tenantId,
  );
  if (liveBlock) return liveBlock;

  return runService(async () => {
    const found = getInboxItemOrError(input.tenantId, input.inboxItemId);
    if (!found.ok) return found;

    const requiresReview = shouldRequireReviewForClassification({
      confidence: input.confidence,
      suggestedEntityId: input.suggestedEntityId,
    });

    const timestamp = nowIso();
    const classification: DocumentClassificationResult = {
      id: nextClassificationId(),
      tenantId: input.tenantId,
      inboxItemId: input.inboxItemId,
      suggestedCategory: input.suggestedCategory,
      suggestedEntityType: input.suggestedEntityType,
      suggestedEntityId: input.suggestedEntityId,
      confidence: input.confidence,
      requiresReview,
      modelVersion: 'inbox-classifier-v1',
      rawHints: input.rawHints ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    DOCUMENT_INBOX_STORE.classifications.set(classification.id, classification);

    const oldStatus = found.data.status;
    const nextStatus = resolveStatusAfterClassification({
      confidence: input.confidence,
      suggestedEntityId: input.suggestedEntityId,
    });

    const updated = updateInboxItem({
      ...found.data,
      category: input.suggestedCategory ?? found.data.category,
      status: nextStatus,
    });

    appendInboxAudit({
      tenantId: input.tenantId,
      inboxItemId: input.inboxItemId,
      eventType: 'classification_completed',
      summary: requiresReview
        ? `Klassifizierung unsicher (${input.confidence}) — Prüfung erforderlich.`
        : `Klassifizierung abgeschlossen (${input.confidence}).`,
      oldStatus,
      newStatus: nextStatus,
      metadata: {
        confidence: input.confidence,
        requiresReview: String(requiresReview),
      },
    });

    let reviewTask: DocumentReviewTask | undefined;
    if (requiresReview) {
      const reviewResult = await createInboxReviewTask(
        {
          tenantId: input.tenantId,
          inboxItemId: input.inboxItemId,
          title: 'Dokumentenzuordnung prüfen',
          description: `Unsichere Zuordnung (${input.confidence}) — manuelle Prüfung erforderlich.`,
        },
        actorRoleKey,
      );
      if (reviewResult.ok) reviewTask = reviewResult.data;

      appendInboxAudit({
        tenantId: input.tenantId,
        inboxItemId: input.inboxItemId,
        eventType: 'auto_link_skipped',
        summary: 'Automatische Zuordnung übersprungen — Prüfauftrag erstellt.',
        oldStatus: nextStatus,
        newStatus: nextStatus,
      });
    }

    return { ok: true, data: { item: updated, classification, reviewTask } };
  }, { delayMs: 180 });
}

export type PrepareInboxOcrInput = {
  tenantId: string;
  inboxItemId: string;
  providerKey: OcrProviderKey;
  context: DocumentInboxExecutionContext;
};

export async function prepareInboxOcr(
  input: PrepareInboxOcrInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentInboxOcrJob>> {
  const denied = enforcePermission<DocumentInboxOcrJob>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = assertLiveInboxAvailable<DocumentInboxOcrJob>(input.tenantId);
  if (liveBlock) return liveBlock;

  return runService(async () => {
    const found = getInboxItemOrError(input.tenantId, input.inboxItemId);
    if (!found.ok) return found;

    const ocrReady = validateInboxOcrReady(input.context, found.data);
    if (!ocrReady.allowed) {
      appendInboxAudit({
        tenantId: input.tenantId,
        inboxItemId: input.inboxItemId,
        eventType: 'ocr_blocked',
        summary: ocrReady.message,
        oldStatus: found.data.status,
        newStatus: found.data.status,
        metadata: { code: ocrReady.code },
      });
      return { ok: false, error: ocrReady.message };
    }

    const timestamp = nowIso();
    const job: DocumentInboxOcrJob = {
      id: nextInboxOcrJobId(),
      tenantId: input.tenantId,
      inboxItemId: input.inboxItemId,
      providerKey: input.providerKey,
      status: 'prepared',
      containsHealthData: found.data.containsHealthData,
      externalTransfer: false,
      approvalRequired: input.providerKey !== 'internal',
      errorSummary: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    DOCUMENT_INBOX_STORE.ocrJobs.set(job.id, job);

    const oldStatus = found.data.status;
    const updated = updateInboxItem({ ...found.data, status: 'ocr_pending' });

    appendInboxAudit({
      tenantId: input.tenantId,
      inboxItemId: input.inboxItemId,
      eventType: 'ocr_prepared',
      summary: `OCR vorbereitet (${input.providerKey}) — kein externer Transfer.`,
      oldStatus,
      newStatus: 'ocr_pending',
      metadata: { providerKey: input.providerKey },
    });

    return { ok: true, data: job };
  }, { delayMs: 200 });
}

export type LinkInboxDocumentInput = {
  tenantId: string;
  inboxItemId: string;
  entityType: DocumentEntityLinkType;
  entityId: string;
  linkedByUserId?: string | null;
  isConfirmed?: boolean;
};

export async function linkInboxDocument(
  input: LinkInboxDocumentInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ item: DocumentInboxItem; link: DocumentEntityLink }>> {
  const denied = enforcePermission<{ item: DocumentInboxItem; link: DocumentEntityLink }>(
    actorRoleKey,
    'office.documents.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = assertLiveInboxAvailable<{ item: DocumentInboxItem; link: DocumentEntityLink }>(
    input.tenantId,
  );
  if (liveBlock) return liveBlock;

  return runService(async () => {
    const found = getInboxItemOrError(input.tenantId, input.inboxItemId);
    if (!found.ok) return found;

    const mutable = assertInboxItemMutable(found.data);
    if (!mutable.allowed) return { ok: false, error: mutable.message };

    const timestamp = nowIso();
    const link: DocumentEntityLink = {
      id: nextEntityLinkId(),
      tenantId: input.tenantId,
      inboxItemId: input.inboxItemId,
      entityType: input.entityType,
      entityId: input.entityId,
      linkedByUserId: input.linkedByUserId ?? null,
      isConfirmed: input.isConfirmed ?? true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const links = DOCUMENT_INBOX_STORE.entityLinks.get(input.inboxItemId) ?? [];
    DOCUMENT_INBOX_STORE.entityLinks.set(input.inboxItemId, [...links, link]);

    const oldStatus = found.data.status;
    const updated = updateInboxItem({ ...found.data, status: 'linked' });

    appendInboxAudit({
      tenantId: input.tenantId,
      inboxItemId: input.inboxItemId,
      eventType: 'entity_linked',
      summary: `Verknüpft mit ${input.entityType} ${input.entityId}.`,
      oldStatus,
      newStatus: 'linked',
      actorUserId: input.linkedByUserId,
      metadata: { entityType: input.entityType, entityId: input.entityId },
    });

    return { ok: true, data: { item: updated, link } };
  }, { delayMs: 120 });
}

export type CreateInboxReviewTaskInput = {
  tenantId: string;
  inboxItemId: string;
  title: string;
  description: string;
  assignedToUserId?: string | null;
};

export async function createInboxReviewTask(
  input: CreateInboxReviewTaskInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentReviewTask>> {
  const denied = enforcePermission<DocumentReviewTask>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = assertLiveInboxAvailable<DocumentReviewTask>(input.tenantId);
  if (liveBlock) return liveBlock;

  return runService(async () => {
    const found = getInboxItemOrError(input.tenantId, input.inboxItemId);
    if (!found.ok) return found;

    const timestamp = nowIso();
    const task: DocumentReviewTask = {
      id: nextReviewTaskId(),
      tenantId: input.tenantId,
      inboxItemId: input.inboxItemId,
      status: 'open',
      title: input.title,
      description: input.description,
      assignedToUserId: input.assignedToUserId ?? null,
      resolvedAt: null,
      resolutionNote: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const tasks = DOCUMENT_INBOX_STORE.reviewTasks.get(input.inboxItemId) ?? [];
    DOCUMENT_INBOX_STORE.reviewTasks.set(input.inboxItemId, [...tasks, task]);

    const oldStatus = found.data.status;
    const updated = updateInboxItem({
      ...found.data,
      status: found.data.status === 'uploaded' ? 'review_required' : found.data.status,
    });

    appendInboxAudit({
      tenantId: input.tenantId,
      inboxItemId: input.inboxItemId,
      eventType: 'review_task_created',
      summary: `Prüfauftrag erstellt: ${input.title}.`,
      oldStatus,
      newStatus: updated.status,
    });

    return { ok: true, data: task };
  }, { delayMs: 100 });
}

export async function archiveInboxDocument(
  tenantId: string,
  inboxItemId: string,
  actorRoleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<DocumentInboxItem>> {
  const denied = enforcePermission<DocumentInboxItem>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = assertLiveInboxAvailable<DocumentInboxItem>(tenantId);
  if (liveBlock) return liveBlock;

  return runService(async () => {
    const found = getInboxItemOrError(tenantId, inboxItemId);
    if (!found.ok) return found;

    const oldStatus = found.data.status;
    const updated = updateInboxItem({
      ...found.data,
      status: 'archived',
      archivedAt: nowIso(),
    });

    appendInboxAudit({
      tenantId,
      inboxItemId,
      eventType: 'archived',
      summary: 'Dokument im Eingang archiviert.',
      oldStatus,
      newStatus: 'archived',
      actorUserId,
    });

    return { ok: true, data: updated };
  }, { delayMs: 100 });
}

export async function rejectInboxDocument(
  tenantId: string,
  inboxItemId: string,
  reason: string,
  actorRoleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<DocumentInboxItem>> {
  const denied = enforcePermission<DocumentInboxItem>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = assertLiveInboxAvailable<DocumentInboxItem>(tenantId);
  if (liveBlock) return liveBlock;

  return runService(async () => {
    const found = getInboxItemOrError(tenantId, inboxItemId);
    if (!found.ok) return found;

    const oldStatus = found.data.status;
    const updated = updateInboxItem({
      ...found.data,
      status: 'rejected',
      rejectedAt: nowIso(),
      notes: reason,
    });

    appendInboxAudit({
      tenantId,
      inboxItemId,
      eventType: 'rejected',
      summary: `Abgelehnt: ${reason}`,
      oldStatus,
      newStatus: 'rejected',
      actorUserId,
    });

    return { ok: true, data: updated };
  }, { delayMs: 100 });
}

export async function fetchInboxItems(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentInboxItem[]>> {
  const denied = enforcePermission<DocumentInboxItem[]>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const liveBlock = assertLiveInboxAvailable<DocumentInboxItem[]>(tenantId);
  if (liveBlock) return liveBlock;

  return runService(async () => {
    return { ok: true, data: filterInboxItemsByTenant(tenantId) };
  }, { delayMs: 120 });
}

export async function getInboxAuditTrail(
  tenantId: string,
  inboxItemId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentInboxAuditEvent[]>> {
  const denied = enforcePermission<DocumentInboxAuditEvent[]>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;

  const tenantCheck = assertInboxTenantScope(tenantId);
  if (!tenantCheck.allowed) return { ok: false, error: tenantCheck.message };

  const liveBlock = assertLiveInboxAvailable<DocumentInboxAuditEvent[]>(tenantId);
  if (liveBlock) return liveBlock;

  return runService(async () => {
    const found = getInboxItemOrError(tenantId, inboxItemId);
    if (!found.ok) return found;
    return { ok: true, data: getInboxAuditEventsForItem(tenantId, inboxItemId) };
  }, { delayMs: 80 });
}

export function getInboxEntityLinks(inboxItemId: string): DocumentEntityLink[] {
  return DOCUMENT_INBOX_STORE.entityLinks.get(inboxItemId) ?? [];
}

export function getInboxReviewTasks(inboxItemId: string): DocumentReviewTask[] {
  return DOCUMENT_INBOX_STORE.reviewTasks.get(inboxItemId) ?? [];
}

export { resetDocumentInboxStore } from './documentInboxStore';
