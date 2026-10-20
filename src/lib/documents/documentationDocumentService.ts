import type { RoleKey, ServiceResult } from '@/types';
import type {
  DocumentationAuditEvent,
  DocumentationAuditEventType,
  DocumentationRecord,
  DocumentationTypeKey,
} from '@/types/documents/documentation';
import { DOCUMENTATION_TYPE_LABELS } from '@/types/documents/documentation';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  attemptDirectDocumentEdit,
  confirmDocumentPreview,
  createDocumentCorrection,
  createLifecycleDocument,
  finalizeLifecycleDocument,
} from './documentLifecycleService';
import {
  getDocumentationTemplateVersionId,
  validateDocumentationRecord,
  FINALIZE_DOCUMENTATION_HTML_TEMPLATE,
} from './documentationValidation';

type Store = {
  documents: Map<string, DocumentationRecord>;
  auditEvents: DocumentationAuditEvent[];
  numberSeq: Map<string, number>;
};

const STORE: Store = {
  documents: new Map(),
  auditEvents: [],
  numberSeq: new Map(),
};

let docCounter = 0;
let auditCounter = 0;

function audit(input: {
  tenantId: string;
  documentationId: string;
  eventType: DocumentationAuditEventType;
  summary: string;
  metadata?: Record<string, string>;
}): DocumentationAuditEvent {
  auditCounter += 1;
  const event: DocumentationAuditEvent = {
    id: `doc-audit-${auditCounter}`,
    tenantId: input.tenantId,
    documentationId: input.documentationId,
    eventType: input.eventType,
    summary: input.summary,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };
  STORE.auditEvents.push(event);
  return event;
}

function updateDocumentation(doc: DocumentationRecord): DocumentationRecord {
  const next = { ...doc, updatedAt: new Date().toISOString() };
  STORE.documents.set(doc.id, next);
  return next;
}

function isLocked(doc: DocumentationRecord): boolean {
  return Boolean(doc.lockedAt) || doc.status === 'finalized';
}

function allocateDocumentNumber(tenantId: string): string {
  const n = (STORE.numberSeq.get(tenantId) ?? 0) + 1;
  STORE.numberSeq.set(tenantId, n);
  return `DOC-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}

export function createDocumentationDraft(input: {
  tenantId: string;
  documentationType: DocumentationTypeKey;
}): DocumentationRecord {
  docCounter += 1;
  const now = new Date().toISOString();

  const record: DocumentationRecord = {
    id: `care-doc-${docCounter}`,
    tenantId: input.tenantId,
    documentationType: input.documentationType,
    documentNumber: null,
    status: 'draft',
    documentDate: now.slice(0, 10),
    documentTime: '10:00',
    clientName: 'Helga Schneider',
    clientId: 'client-demo-1',
    employeeName: 'Anna Pflege',
    occasion: input.documentationType === 'notfallprotokoll' ? 'Sturz im Bad' : 'Regulärer Einsatz',
    observation: 'Klient:in wach und orientiert.',
    measure: 'Körperpflege durchgeführt.',
    result: 'Leistung abgeschlossen.',
    specialNotes: '',
    risks: '',
    referralRequired: false,
    referralRecipient: '',
    contentText: 'Grundpflege durchgeführt, Vitalzeichen unauffällig.',
    digitalSignature: null,
    signedAt: null,
    auditStatus: 'pending',
    lockedAt: null,
    contentHash: null,
    lifecycleDocumentId: null,
    previewConfirmed: false,
    version: 1,
    correctedFromDocumentationId: null,
    createdAt: now,
    updatedAt: now,
  };

  STORE.documents.set(record.id, record);
  audit({
    tenantId: input.tenantId,
    documentationId: record.id,
    eventType: 'documentation_created',
    summary: `${DOCUMENTATION_TYPE_LABELS[input.documentationType]}-Entwurf angelegt.`,
    metadata: { documentationType: input.documentationType },
  });
  return record;
}

export function getDocumentation(tenantId: string, documentationId: string): DocumentationRecord | undefined {
  const d = STORE.documents.get(documentationId);
  if (!d || d.tenantId !== tenantId) return undefined;
  return d;
}

export function getDocumentationAuditTrail(tenantId: string, documentationId: string): DocumentationAuditEvent[] {
  return STORE.auditEvents.filter((e) => e.tenantId === tenantId && e.documentationId === documentationId);
}

export function validateDocumentationForFinalization(
  tenantId: string,
  documentationId: string,
): ServiceResult<{ documentation: DocumentationRecord; validation: ReturnType<typeof validateDocumentationRecord> }> {
  const doc = getDocumentation(tenantId, documentationId);
  if (!doc) return { ok: false, error: 'Dokumentation nicht gefunden.' };

  const validation = validateDocumentationRecord(doc);
  audit({
    tenantId,
    documentationId,
    eventType: validation.status === 'error' ? 'documentation_validation_failed' : 'documentation_validated',
    summary: validation.status === 'error' ? 'Validierung fehlgeschlagen.' : 'Validierung bestanden.',
  });

  return { ok: true, data: { documentation: doc, validation } };
}

export async function confirmDocumentationPreview(
  tenantId: string,
  documentationId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentationRecord>> {
  const denied = enforcePermission<DocumentationRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const doc = getDocumentation(tenantId, documentationId);
  if (!doc) return { ok: false, error: 'Dokumentation nicht gefunden.' };
  if (isLocked(doc)) return { ok: false, error: 'Finalisierte Dokumentation gesperrt.' };

  let lifecycleId = doc.lifecycleDocumentId;
  if (!lifecycleId) {
    const lifecycle = createLifecycleDocument({
      tenantId,
      title: `Dokumentation Entwurf ${documentationId}`,
      documentType: 'care_documentation',
    });
    lifecycleId = lifecycle.id;
  }

  await confirmDocumentPreview(tenantId, lifecycleId, actorRoleKey);

  return {
    ok: true,
    data: updateDocumentation({ ...doc, lifecycleDocumentId: lifecycleId, previewConfirmed: true }),
  };
}

export async function finalizeDocumentation(
  tenantId: string,
  documentationId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentationRecord>> {
  const denied = enforcePermission<DocumentationRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const doc = getDocumentation(tenantId, documentationId);
  if (!doc) return { ok: false, error: 'Dokumentation nicht gefunden.' };
  if (isLocked(doc)) return { ok: false, error: 'Dokumentation bereits finalisiert.' };

  const documentNumber = doc.documentNumber ?? allocateDocumentNumber(tenantId);
  const withNumber = updateDocumentation({ ...doc, documentNumber });

  const check = validateDocumentationForFinalization(tenantId, documentationId);
  if (!check.ok) return check;
  if (check.data.validation.status === 'error') {
    return { ok: false, error: check.data.validation.issues[0]?.message ?? 'Pflichtfeldprüfung fehlgeschlagen.' };
  }

  if (!withNumber.previewConfirmed) {
    return { ok: false, error: 'Live-Vorschau muss vor Finalisierung bestätigt werden.' };
  }

  const lifecycleId =
    withNumber.lifecycleDocumentId ??
    createLifecycleDocument({
      tenantId,
      title: `Dokumentation ${withNumber.documentNumber}`,
      documentType: 'care_documentation',
    }).id;

  if (!withNumber.lifecycleDocumentId) {
    updateDocumentation({ ...withNumber, lifecycleDocumentId: lifecycleId });
  }

  await confirmDocumentPreview(tenantId, lifecycleId, actorRoleKey);

  const finalized = await finalizeLifecycleDocument(
    {
      tenantId,
      documentId: lifecycleId,
      templateVersionId: getDocumentationTemplateVersionId(withNumber.documentationType),
      htmlTemplate: FINALIZE_DOCUMENTATION_HTML_TEMPLATE,
      documentType: 'care_documentation',
      sampleEntityType: 'care_documentation',
      sampleEntityId: 'care-doc-demo-1',
    },
    actorRoleKey,
  );

  if (!finalized.ok) {
    updateDocumentation({ ...withNumber, status: 'render_failed' });
    return { ok: false, error: finalized.error };
  }

  const now = new Date().toISOString();
  const locked = updateDocumentation({
    ...withNumber,
    status: 'finalized',
    lockedAt: now,
    lifecycleDocumentId: lifecycleId,
    contentHash: finalized.data.contentHash,
    digitalSignature: withNumber.employeeName,
    signedAt: now,
    auditStatus: 'reviewed',
    version: withNumber.version + 1,
  });

  audit({
    tenantId,
    documentationId,
    eventType: 'documentation_finalized',
    summary: 'Dokumentation finalisiert und archiviert.',
  });
  audit({
    tenantId,
    documentationId,
    eventType: 'documentation_locked',
    summary: 'Dokumentation gesperrt — direkte Änderung blockiert.',
  });

  return { ok: true, data: locked };
}

export async function attemptEditDocumentation(
  tenantId: string,
  documentationId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<never>> {
  const doc = getDocumentation(tenantId, documentationId);
  if (!doc) return { ok: false, error: 'Dokumentation nicht gefunden.' };

  if (isLocked(doc)) {
    audit({
      tenantId,
      documentationId,
      eventType: 'documentation_edit_blocked',
      summary: 'Direkte Bearbeitung finalisierter Dokumentation blockiert.',
    });
    return { ok: false, error: 'Finalisierte Dokumentation ist gesperrt — Korrektur erforderlich.' };
  }

  if (doc.lifecycleDocumentId) {
    return attemptDirectDocumentEdit(tenantId, doc.lifecycleDocumentId, actorRoleKey);
  }

  return { ok: false, error: 'Bearbeitung im Entwurf erlaubt.' };
}

export async function createDocumentationCorrection(
  tenantId: string,
  sourceDocumentationId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DocumentationRecord>> {
  const denied = enforcePermission<DocumentationRecord>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const source = getDocumentation(tenantId, sourceDocumentationId);
  if (!source || !isLocked(source)) {
    return { ok: false, error: 'Korrektur nur für finalisierte Dokumentation.' };
  }

  const correction = createDocumentationDraft({ tenantId, documentationType: source.documentationType });
  const updated = updateDocumentation({
    ...correction,
    correctedFromDocumentationId: sourceDocumentationId,
    documentNumber: null,
  });

  if (source.lifecycleDocumentId) {
    await createDocumentCorrection(tenantId, source.lifecycleDocumentId, actorRoleKey);
  }

  audit({
    tenantId,
    documentationId: updated.id,
    eventType: 'documentation_correction_created',
    summary: `Korrektur für ${source.documentNumber ?? sourceDocumentationId}.`,
    metadata: { correctedFrom: sourceDocumentationId },
  });

  return { ok: true, data: updated };
}

/** Nur für Tests — Dokumentation mutieren. */
export function patchDocumentationForTest(doc: DocumentationRecord): DocumentationRecord {
  return updateDocumentation(doc);
}

export function resetDocumentationDocumentStore(): void {
  STORE.documents.clear();
  STORE.auditEvents.length = 0;
  STORE.numberSeq.clear();
  docCounter = 0;
  auditCounter = 0;
}

export { DOCUMENTATION_TYPE_LABELS };
