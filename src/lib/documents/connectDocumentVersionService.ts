import type {
  DocumentAuditEvent,
  DocumentAuditEventType,
  DocumentTemplate,
  DocumentVersion,
  GeneratedDocument,
  GeneratedDocumentStatus,
  GeneratedDocumentType,
} from '@/types/documents/connect';

export type InMemoryDocumentStore = {
  documents: Map<string, GeneratedDocument>;
  versions: Map<string, DocumentVersion[]>;
  auditEvents: DocumentAuditEvent[];
  templates: Map<string, DocumentTemplate>;
};

export function createInMemoryDocumentStore(): InMemoryDocumentStore {
  return {
    documents: new Map(),
    versions: new Map(),
    auditEvents: [],
    templates: new Map(),
  };
}

let auditCounter = 0;

export function appendDocumentAuditEvent(
  store: InMemoryDocumentStore,
  input: {
    tenantId: string;
    documentId: string | null;
    eventType: DocumentAuditEventType;
    summary: string;
    oldStatus?: string | null;
    newStatus?: string | null;
  },
): DocumentAuditEvent {
  auditCounter += 1;
  const event: DocumentAuditEvent = {
    id: `doc-audit-${auditCounter}`,
    tenantId: input.tenantId,
    documentId: input.documentId,
    eventType: input.eventType,
    summary: input.summary,
    oldStatus: input.oldStatus ?? null,
    newStatus: input.newStatus ?? null,
    createdAt: new Date().toISOString(),
  };
  store.auditEvents.push(event);
  return event;
}

export function createDocumentVersion(
  store: InMemoryDocumentStore,
  input: {
    tenantId: string;
    documentId: string;
    storageReference: string;
    contentHash: string;
    changeReason?: string;
    isCorrection?: boolean;
    actorUserId?: string;
  },
): { ok: true; version: DocumentVersion; document: GeneratedDocument } | { ok: false; error: string } {
  const document = store.documents.get(input.documentId);
  if (!document) return { ok: false, error: 'Dokument nicht gefunden.' };
  if (document.tenantId !== input.tenantId) {
    return { ok: false, error: 'Mandant stimmt nicht überein.' };
  }
  if (document.isArchived) {
    return { ok: false, error: 'Archiviertes Dokument — Korrektur als neue Version erforderlich.' };
  }

  const nextVersion = document.currentVersion + 1;
  const version: DocumentVersion = {
    id: `doc-ver-${input.documentId}-${nextVersion}`,
    tenantId: input.tenantId,
    documentId: input.documentId,
    versionNumber: nextVersion,
    storageReference: input.storageReference,
    contentHash: input.contentHash,
    isCorrection: input.isCorrection ?? false,
    changeReason: input.changeReason ?? null,
    createdAt: new Date().toISOString(),
  };

  const existing = store.versions.get(input.documentId) ?? [];
  store.versions.set(input.documentId, [...existing, version]);

  const updated: GeneratedDocument = {
    ...document,
    currentVersion: nextVersion,
    storageReference: input.storageReference,
    contentHash: input.contentHash,
    status: input.isCorrection ? 'corrected' : document.status,
    updatedAt: new Date().toISOString(),
  };
  store.documents.set(input.documentId, updated);

  appendDocumentAuditEvent(store, {
    tenantId: input.tenantId,
    documentId: input.documentId,
    eventType: 'version_created',
    summary: `Version ${nextVersion} erstellt${input.isCorrection ? ' (Korrektur)' : ''}.`,
    oldStatus: document.status,
    newStatus: updated.status,
  });

  return { ok: true, version, document: updated };
}

export function seedDocumentTemplate(
  store: InMemoryDocumentStore,
  input: Omit<DocumentTemplate, 'id'> & { id?: string },
): DocumentTemplate {
  const template: DocumentTemplate = {
    id: input.id ?? `tpl-${input.templateKey}-${input.version}`,
    ...input,
  };
  store.templates.set(template.id, template);
  return template;
}

export function createGeneratedDocument(
  store: InMemoryDocumentStore,
  input: {
    tenantId: string;
    documentType: GeneratedDocumentType;
    title: string;
    templateId?: string;
    containsHealthData?: boolean;
    clientId?: string | null;
    invoiceId?: string | null;
  },
): GeneratedDocument {
  const id = `gen-doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const doc: GeneratedDocument = {
    id,
    tenantId: input.tenantId,
    documentType: input.documentType,
    title: input.title,
    status: 'draft',
    currentVersion: 0,
    containsHealthData: input.containsHealthData ?? false,
    isArchived: false,
    pdfAPrepared: false,
    storageReference: null,
    contentHash: null,
    clientId: input.clientId ?? null,
    invoiceId: input.invoiceId ?? null,
    correctionOfId: null,
    createdAt: now,
    updatedAt: now,
  };
  store.documents.set(id, doc);

  appendDocumentAuditEvent(store, {
    tenantId: input.tenantId,
    documentId: id,
    eventType: 'document_created',
    summary: `Dokument „${input.title}" angelegt.`,
    newStatus: 'draft',
  });

  return doc;
}

export function markDocumentGenerated(
  store: InMemoryDocumentStore,
  tenantId: string,
  documentId: string,
  storageReference: string,
  contentHash: string,
): GeneratedDocument | null {
  const doc = store.documents.get(documentId);
  if (!doc || doc.tenantId !== tenantId) return null;

  const versionResult = createDocumentVersion(store, {
    tenantId,
    documentId,
    storageReference,
    contentHash,
    changeReason: 'Erstgenerierung',
  });
  if (!versionResult.ok) return null;

  const updated: GeneratedDocument = {
    ...versionResult.document,
    status: 'generated' as GeneratedDocumentStatus,
    updatedAt: new Date().toISOString(),
  };
  store.documents.set(documentId, updated);

  appendDocumentAuditEvent(store, {
    tenantId,
    documentId,
    eventType: 'document_generated',
    summary: 'Dokument erzeugt (vorbereitet, kein externer Versand).',
    oldStatus: 'draft',
    newStatus: 'generated',
  });

  return updated;
}

export function getDocumentAuditTrail(
  store: InMemoryDocumentStore,
  tenantId: string,
  documentId: string,
): DocumentAuditEvent[] {
  return store.auditEvents.filter(
    (e) => e.tenantId === tenantId && e.documentId === documentId,
  );
}

export function getDocumentsForTenant(
  store: InMemoryDocumentStore,
  tenantId: string,
): GeneratedDocument[] {
  return [...store.documents.values()].filter((d) => d.tenantId === tenantId);
}
