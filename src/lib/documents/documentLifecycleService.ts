import type { RoleKey, ServiceResult } from '@/types';
import type {
  DocumentLifecycleAuditEvent,
  DocumentLifecycleAuditEventType,
  DocumentLifecycleStatus,
  FinalizeDocumentInput,
  LifecycleDocument,
  LifecycleDocumentVersion,
} from '@/types/documents/documentLifecycle';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { buildDocumentPreview } from '@/features/documents/templateEngine/documentPreviewRenderer';
import { buildDocumentContext } from '@/features/documents/templateEngine/documentContext';
import { assertCanActivateTemplateVersion } from '@/features/documents/templateEngine/validateTemplateActivation';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { computeDocumentPackageHash } from './documentHashService';
import {
  assertDocumentActionAllowed,
  buildDocumentActionGateContextForRole,
} from './documentActionGate';
import { executePdfRenderJob, getPdfEngineInfo } from './pdfRenderJobService';
import { fetchTenantDocumentSettings, mergeTenantSettingsIntoContext } from './tenantDocumentSettingsService';

type Store = {
  documents: Map<string, LifecycleDocument>;
  versions: Map<string, LifecycleDocumentVersion[]>;
  auditEvents: DocumentLifecycleAuditEvent[];
  documentNumberSeq: Map<string, number>;
};

const STORE: Store = {
  documents: new Map(),
  versions: new Map(),
  auditEvents: [],
  documentNumberSeq: new Map(),
};

let auditCounter = 0;
let docCounter = 0;

function audit(input: {
  tenantId: string;
  documentId: string;
  eventType: DocumentLifecycleAuditEventType;
  summary: string;
  oldStatus?: DocumentLifecycleStatus | null;
  newStatus?: DocumentLifecycleStatus | null;
  metadata?: Record<string, string>;
}): DocumentLifecycleAuditEvent {
  auditCounter += 1;
  const event: DocumentLifecycleAuditEvent = {
    id: `lc-audit-${auditCounter}`,
    tenantId: input.tenantId,
    documentId: input.documentId,
    eventType: input.eventType,
    summary: input.summary,
    oldStatus: input.oldStatus ?? null,
    newStatus: input.newStatus ?? null,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };
  STORE.auditEvents.push(event);
  return event;
}

function updateDocument(doc: LifecycleDocument): LifecycleDocument {
  const next = { ...doc, updatedAt: new Date().toISOString() };
  STORE.documents.set(doc.id, next);
  return next;
}

function isLocked(doc: LifecycleDocument): boolean {
  return Boolean(doc.lockedAt) || doc.status === 'finalized' || doc.status === 'archived';
}

function nextDocumentNumber(tenantId: string, documentType: string): string {
  const key = `${tenantId}:${documentType}`;
  const n = (STORE.documentNumberSeq.get(key) ?? 0) + 1;
  STORE.documentNumberSeq.set(key, n);
  const prefix = documentType === 'invoice' ? 'RE' : documentType === 'contract' ? 'V' : 'DOC';
  return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
}

export function createLifecycleDocument(input: {
  tenantId: string;
  title: string;
  documentType: LifecycleDocument['documentType'];
  templateVersionId?: string | null;
  relatedEntityTable?: string | null;
  relatedEntityId?: string | null;
}): LifecycleDocument {
  docCounter += 1;
  const now = new Date().toISOString();
  const doc: LifecycleDocument = {
    id: `lc-doc-${docCounter}`,
    tenantId: input.tenantId,
    templateVersionId: input.templateVersionId ?? null,
    documentType: input.documentType,
    title: input.title,
    status: 'draft',
    documentNumber: null,
    htmlOutput: null,
    pdfPath: null,
    contentHash: null,
    previewedAt: null,
    previewConfirmed: false,
    finalizedAt: null,
    lockedAt: null,
    archivedAt: null,
    sentAt: null,
    correctedFromDocumentId: null,
    cancelledFromDocumentId: null,
    currentVersion: 0,
    pdfAPrepared: false,
    relatedEntityTable: input.relatedEntityTable ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  STORE.documents.set(doc.id, doc);
  audit({
    tenantId: input.tenantId,
    documentId: doc.id,
    eventType: 'document_created',
    summary: `Dokument „${input.title}" angelegt.`,
    newStatus: 'draft',
  });
  return doc;
}

export async function confirmDocumentPreview(
  tenantId: string,
  documentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<LifecycleDocument>> {
  const denied = enforcePermission<LifecycleDocument>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const doc = STORE.documents.get(documentId);
  if (!doc || doc.tenantId !== tenantId) return { ok: false, error: 'Dokument nicht gefunden.' };
  if (isLocked(doc)) return { ok: false, error: 'Gesperrtes Dokument — Vorschau nicht änderbar.' };

  const old = doc.status;
  const updated = updateDocument({
    ...doc,
    status: 'preview',
    previewedAt: new Date().toISOString(),
    previewConfirmed: true,
  });

  audit({
    tenantId,
    documentId,
    eventType: 'preview_confirmed',
    summary: 'Live-Vorschau bestätigt.',
    oldStatus: old,
    newStatus: 'preview',
  });

  return { ok: true, data: updated };
}

export async function validateLifecycleDocument(
  input: {
    tenantId: string;
    documentId: string;
    templateVersionId: string;
    htmlTemplate: string;
    cssTemplate?: string;
    documentType: LifecycleDocument['documentType'];
    sampleEntityType: FinalizeDocumentInput['sampleEntityType'];
    sampleEntityId: string;
    prebuiltHtml?: string | null;
  },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ document: LifecycleDocument; html: string; passed: boolean }>> {
  const denied = enforcePermission<{ document: LifecycleDocument; html: string; passed: boolean }>(
    actorRoleKey,
    'office.catalogs.edit',
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Live-Validierung: Repository erweitern — kein Demo-Fallback.' };
  }

  const doc = STORE.documents.get(input.documentId);
  if (!doc || doc.tenantId !== input.tenantId) return { ok: false, error: 'Dokument nicht gefunden.' };

  const contextResult = await buildDocumentContext(
    input.sampleEntityType,
    input.sampleEntityId,
    input.tenantId,
  );
  if (!contextResult.ok) return { ok: false, error: contextResult.error };

  const settingsResult = await fetchTenantDocumentSettings(input.tenantId, actorRoleKey);
  const settings = settingsResult.ok ? settingsResult.data : null;
  const context = settings
    ? mergeTenantSettingsIntoContext(contextResult.context, settings)
    : contextResult.context;

  let html: string;
  if (input.prebuiltHtml?.trim()) {
    html = input.prebuiltHtml.trim();
  } else {
    const preview = buildDocumentPreview({
      templateVersion: {
        htmlTemplate: input.htmlTemplate,
        cssTemplate: input.cssTemplate,
        requiredFields: [],
      },
      context,
      documentType: input.documentType,
      tenantDocumentSettings: settings,
      showDraftWatermark: true,
    });
    html = preview.html;
  }

  const activation = input.prebuiltHtml?.trim()
    ? { validation: { status: 'valid' as const, issues: [] } }
    : assertCanActivateTemplateVersion({
        documentType: input.documentType,
        context,
        templateVersion: { htmlTemplate: input.htmlTemplate, cssTemplate: input.cssTemplate },
        tenantDocumentSettings: settings,
        hasLivePreview: doc.previewConfirmed,
        versionStatus: 'draft',
      });

  const passed = activation.validation.status !== 'error';
  const old = doc.status;
  const updated = updateDocument({
    ...doc,
    htmlOutput: html,
    status: passed ? 'ready_to_finalize' : 'validation_failed',
  });

  audit({
    tenantId: input.tenantId,
    documentId: input.documentId,
    eventType: passed ? 'validation_passed' : 'validation_failed',
    summary: passed ? 'Validierung bestanden.' : 'Validierung fehlgeschlagen.',
    oldStatus: old,
    newStatus: updated.status,
    metadata: passed ? undefined : { errors: String(activation.validation.issues.length) },
  });

  return { ok: true, data: { document: updated, html, passed } };
}

export async function finalizeLifecycleDocument(
  input: FinalizeDocumentInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<LifecycleDocument>> {
  const denied = enforcePermission<LifecycleDocument>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Finalisierung im Live-Modus: Backend-Render-Job erforderlich.' };
  }

  const doc = STORE.documents.get(input.documentId);
  if (!doc || doc.tenantId !== input.tenantId) return { ok: false, error: 'Dokument nicht gefunden.' };

  const gate = assertDocumentActionAllowed(
    'finalize',
    doc,
    { htmlTemplate: input.htmlTemplate },
    buildDocumentActionGateContextForRole(input.tenantId, actorRoleKey ?? null),
  );
  if (!gate.allowed) {
    audit({
      tenantId: input.tenantId,
      documentId: input.documentId,
      eventType: 'edit_blocked',
      summary: gate.message,
      oldStatus: doc.status,
      newStatus: doc.status,
      metadata: { code: gate.code },
    });
    return { ok: false, error: gate.message };
  }

  if (!doc.previewConfirmed) {
    audit({
      tenantId: input.tenantId,
      documentId: input.documentId,
      eventType: 'edit_blocked',
      summary: 'Finalisierung ohne bestätigte Live-Vorschau blockiert.',
      oldStatus: doc.status,
      newStatus: doc.status,
    });
    return { ok: false, error: 'Live-Vorschau muss vor Finalisierung bestätigt werden.' };
  }

  const validation = await validateLifecycleDocument(
    {
      tenantId: input.tenantId,
      documentId: input.documentId,
      templateVersionId: input.templateVersionId,
      htmlTemplate: input.htmlTemplate,
      cssTemplate: input.cssTemplate,
      documentType: input.documentType,
      sampleEntityType: input.sampleEntityType,
      sampleEntityId: input.sampleEntityId,
      prebuiltHtml: input.prebuiltHtml,
    },
    actorRoleKey,
  );

  if (!validation.ok) return validation;
  if (!validation.data.passed) {
    return { ok: false, error: 'Pflichtfeldprüfung fehlgeschlagen — Finalisierung blockiert.' };
  }

  const html = validation.data.html;

  audit({
    tenantId: input.tenantId,
    documentId: input.documentId,
    eventType: 'render_job_queued',
    summary: 'PDF-Render-Job eingereiht.',
    oldStatus: doc.status,
    newStatus: 'ready_to_finalize',
  });

  const pdfResult = executePdfRenderJob({
    tenantId: input.tenantId,
    documentId: input.documentId,
    templateVersionId: input.templateVersionId,
    htmlOutput: html,
    simulateFailure: input.simulatePdfFailure,
  });

  if (!pdfResult.ok) {
    const failed = updateDocument({
      ...doc,
      htmlOutput: html,
      status: 'render_failed',
    });
    audit({
      tenantId: input.tenantId,
      documentId: input.documentId,
      eventType: 'render_job_failed',
      summary: pdfResult.error,
      oldStatus: doc.status,
      newStatus: 'render_failed',
    });
    return { ok: false, error: `PDF-Erzeugung fehlgeschlagen — Dokument nicht finalisiert. ${pdfResult.error}` };
  }

  audit({
    tenantId: input.tenantId,
    documentId: input.documentId,
    eventType: 'render_job_completed',
    summary: getPdfEngineInfo().productionAvailable
      ? 'PDF erzeugt.'
      : 'PDF simuliert (Render-Job vorbereitet, nicht produktiv).',
    oldStatus: doc.status,
    newStatus: 'ready_to_finalize',
    metadata: { pdfPath: pdfResult.pdfPath, simulated: String(pdfResult.isSimulated) },
  });

  const documentNumber = nextDocumentNumber(input.tenantId, input.documentType);
  const contentHash = computeDocumentPackageHash({
    html,
    pdfPath: pdfResult.pdfPath,
    documentNumber,
  });

  const now = new Date().toISOString();
  const versionNumber = doc.currentVersion + 1;
  const version: LifecycleDocumentVersion = {
    id: `lc-ver-${doc.id}-${versionNumber}`,
    tenantId: input.tenantId,
    documentId: doc.id,
    versionNumber,
    htmlOutput: html,
    pdfPath: pdfResult.pdfPath,
    contentHash,
    isCorrection: false,
    changeReason: 'Finalisierung',
    createdAt: now,
  };
  const versions = STORE.versions.get(doc.id) ?? [];
  STORE.versions.set(doc.id, [...versions, version]);

  const finalized = updateDocument({
    ...doc,
    templateVersionId: input.templateVersionId,
    documentNumber,
    htmlOutput: html,
    pdfPath: pdfResult.pdfPath,
    contentHash,
    status: 'finalized',
    finalizedAt: now,
    lockedAt: now,
    archivedAt: now,
    currentVersion: versionNumber,
    pdfAPrepared: false,
  });

  audit({
    tenantId: input.tenantId,
    documentId: input.documentId,
    eventType: 'document_finalized',
    summary: `Dokument ${documentNumber} finalisiert. Hash: ${contentHash.slice(0, 20)}…`,
    oldStatus: doc.status,
    newStatus: 'finalized',
    metadata: { hash: contentHash, documentNumber },
  });

  audit({
    tenantId: input.tenantId,
    documentId: input.documentId,
    eventType: 'document_archived',
    summary: 'Dokument im Archiv abgelegt (Vorbereitung — kein GoBD-Claim).',
    oldStatus: 'finalized',
    newStatus: 'archived',
  });

  audit({
    tenantId: input.tenantId,
    documentId: input.documentId,
    eventType: 'document_locked',
    summary: 'Datensatz gesperrt — direkte Änderung blockiert.',
    oldStatus: 'finalized',
    newStatus: 'finalized',
  });

  return {
    ok: true,
    data: updateDocument({ ...finalized, status: 'archived' }),
  };
}

export async function attemptDirectDocumentEdit(
  tenantId: string,
  documentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<never>> {
  const denied = enforcePermission<never>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const doc = STORE.documents.get(documentId);
  if (!doc || doc.tenantId !== tenantId) return { ok: false, error: 'Dokument nicht gefunden.' };

  const gate = assertDocumentActionAllowed(
    'edit_document',
    doc,
    null,
    buildDocumentActionGateContextForRole(tenantId, actorRoleKey ?? null),
  );
  if (!gate.allowed) {
    audit({
      tenantId,
      documentId,
      eventType: 'edit_blocked',
      summary: gate.message,
      oldStatus: doc.status,
      newStatus: doc.status,
      metadata: { code: gate.code },
    });
    return { ok: false, error: gate.message };
  }

  if (isLocked(doc)) {
    audit({
      tenantId,
      documentId,
      eventType: 'edit_blocked',
      summary: 'Direkte Bearbeitung finalisierter Dokumente blockiert.',
      oldStatus: doc.status,
      newStatus: doc.status,
    });
    return {
      ok: false,
      error: 'Finalisiertes Dokument ist gesperrt — Korrektur oder Storno erforderlich.',
    };
  }

  return { ok: false, error: 'Bearbeitung erlaubt (Entwurf).' };
}

export async function createDocumentCorrection(
  tenantId: string,
  sourceDocumentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<LifecycleDocument>> {
  const denied = enforcePermission<LifecycleDocument>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const source = STORE.documents.get(sourceDocumentId);
  if (!source || source.tenantId !== tenantId) return { ok: false, error: 'Quelldokument nicht gefunden.' };
  if (!isLocked(source)) return { ok: false, error: 'Korrektur nur für finalisierte Dokumente.' };

  const correction = createLifecycleDocument({
    tenantId,
    title: `Korrektur: ${source.title}`,
    documentType: source.documentType,
    templateVersionId: source.templateVersionId,
    relatedEntityTable: source.relatedEntityTable,
    relatedEntityId: source.relatedEntityId,
  });

  const updated = updateDocument({
    ...correction,
    correctedFromDocumentId: sourceDocumentId,
    status: 'corrected',
  });

  audit({
    tenantId,
    documentId: updated.id,
    eventType: 'correction_created',
    summary: `Korrektur erstellt für ${source.documentNumber ?? sourceDocumentId}.`,
    newStatus: 'corrected',
    metadata: { correctedFrom: sourceDocumentId },
  });

  return { ok: true, data: updated };
}

export async function createDocumentCancellation(
  tenantId: string,
  sourceDocumentId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<LifecycleDocument>> {
  const denied = enforcePermission<LifecycleDocument>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const source = STORE.documents.get(sourceDocumentId);
  if (!source || source.tenantId !== tenantId) return { ok: false, error: 'Quelldokument nicht gefunden.' };
  if (!isLocked(source)) return { ok: false, error: 'Storno nur für finalisierte Dokumente.' };

  const cancellation = createLifecycleDocument({
    tenantId,
    title: `Storno: ${source.title}`,
    documentType: source.documentType,
    templateVersionId: source.templateVersionId,
  });

  const updated = updateDocument({
    ...cancellation,
    cancelledFromDocumentId: sourceDocumentId,
    status: 'cancelled',
  });

  audit({
    tenantId,
    documentId: updated.id,
    eventType: 'cancellation_created',
    summary: `Storno erstellt für ${source.documentNumber ?? sourceDocumentId}.`,
    newStatus: 'cancelled',
    metadata: { cancelledFrom: sourceDocumentId },
  });

  return { ok: true, data: updated };
}

export function getLifecycleDocument(
  tenantId: string,
  documentId: string,
): LifecycleDocument | undefined {
  const doc = STORE.documents.get(documentId);
  if (!doc || doc.tenantId !== tenantId) return undefined;
  return doc;
}

export function getLifecycleAuditTrail(
  tenantId: string,
  documentId: string,
): DocumentLifecycleAuditEvent[] {
  return STORE.auditEvents.filter((e) => e.tenantId === tenantId && e.documentId === documentId);
}

export function getLifecycleDocumentVersions(documentId: string): LifecycleDocumentVersion[] {
  return STORE.versions.get(documentId) ?? [];
}

export function resetLifecycleDocumentStore(): void {
  STORE.documents.clear();
  STORE.versions.clear();
  STORE.auditEvents.length = 0;
  STORE.documentNumberSeq.clear();
  docCounter = 0;
  auditCounter = 0;
}

export { getPdfEngineInfo };
