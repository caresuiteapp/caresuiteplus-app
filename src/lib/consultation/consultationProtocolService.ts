import type { RoleKey, ServiceResult } from '@/types';
import type { ConsultationDocument, ConsultationDocumentVersion } from '@/types/modules/consultation';
import { enforcePermission } from '@/lib/permissions';
import { getConsultationCaseById } from './consultationCaseService';
import {
  appendConsultationAuditEvent,
  getConsultationAuditTrail,
  getConsultationStore,
  nextConsultationId,
} from './consultationStore';

function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i += 1) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return `hash-${Math.abs(hash).toString(16)}`;
}

export function createConsultationProtocol(input: {
  tenantId: string;
  caseId: string;
  sessionId?: string | null;
  title: string;
  content: string;
  containsHealthData?: boolean;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<ConsultationDocument> {
  const denied = enforcePermission<ConsultationDocument>(input.actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;

  const caseResult = getConsultationCaseById(input.tenantId, input.caseId, input.actorRoleKey);
  if (!caseResult.ok) return caseResult;

  const now = new Date().toISOString();
  const contentHash = simpleHash(input.content);
  const storageReference = `consultation/${input.tenantId}/${input.caseId}/v1.html`;

  const document: ConsultationDocument = {
    id: nextConsultationId('con-doc'),
    tenantId: input.tenantId,
    caseId: input.caseId,
    sessionId: input.sessionId ?? null,
    documentType: 'protocol',
    title: input.title.trim(),
    status: 'draft',
    currentVersion: 1,
    contentHash,
    storageReference,
    signedAt: null,
    signedByProfileId: null,
    containsHealthData: input.containsHealthData ?? false,
    createdAt: now,
    updatedAt: now,
  };

  const version: ConsultationDocumentVersion = {
    id: nextConsultationId('con-docv'),
    tenantId: input.tenantId,
    documentId: document.id,
    versionNumber: 1,
    contentHash,
    storageReference,
    changeReason: 'Erstanlage',
    isCorrection: false,
    createdByProfileId: null,
    createdAt: now,
    updatedAt: now,
  };

  const store = getConsultationStore(input.tenantId);
  store.documents.push(document);
  store.documentVersions.push(version);

  appendConsultationAuditEvent(input.tenantId, {
    caseId: input.caseId,
    eventType: 'protocol_version_created',
    summary: `Protokoll Version 1 erstellt: ${document.title}`,
    actorProfileId: null,
    oldStatus: 'draft',
    newStatus: 'draft',
    metadata: { documentId: document.id, version: '1' },
  });

  return { ok: true, data: document };
}

export function createConsultationProtocolVersion(input: {
  tenantId: string;
  documentId: string;
  content: string;
  changeReason?: string;
  isCorrection?: boolean;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<{ document: ConsultationDocument; version: ConsultationDocumentVersion }> {
  const denied = enforcePermission<{ document: ConsultationDocument; version: ConsultationDocumentVersion }>(
    input.actorRoleKey,
    'beratung.cases.view',
  );
  if (denied) return denied;

  const store = getConsultationStore(input.tenantId);
  const document = store.documents.find((d) => d.id === input.documentId);
  if (!document) return { ok: false, error: 'Dokument nicht gefunden.' };
  if (document.tenantId !== input.tenantId) {
    return { ok: false, error: 'Mandant stimmt nicht überein.' };
  }
  if (document.status === 'signed' || document.status === 'archived') {
    return { ok: false, error: 'Signiertes/archiviertes Protokoll — neue Version als Korrektur erforderlich.' };
  }

  const nextVersion = document.currentVersion + 1;
  const contentHash = simpleHash(input.content);
  const storageReference = `consultation/${input.tenantId}/${document.caseId}/v${nextVersion}.html`;
  const now = new Date().toISOString();

  const version: ConsultationDocumentVersion = {
    id: nextConsultationId('con-docv'),
    tenantId: input.tenantId,
    documentId: document.id,
    versionNumber: nextVersion,
    contentHash,
    storageReference,
    changeReason: input.changeReason ?? null,
    isCorrection: input.isCorrection ?? false,
    createdByProfileId: null,
    createdAt: now,
    updatedAt: now,
  };

  const updated: ConsultationDocument = {
    ...document,
    currentVersion: nextVersion,
    contentHash,
    storageReference,
    updatedAt: now,
  };

  store.documentVersions.push(version);
  const docIdx = store.documents.findIndex((d) => d.id === document.id);
  store.documents[docIdx] = updated;

  appendConsultationAuditEvent(input.tenantId, {
    caseId: document.caseId,
    eventType: 'protocol_version_created',
    summary: `Protokoll Version ${nextVersion} erstellt${input.isCorrection ? ' (Korrektur)' : ''}.`,
    actorProfileId: null,
    oldStatus: String(document.currentVersion),
    newStatus: String(nextVersion),
    metadata: { documentId: document.id, hash: contentHash },
  });

  return { ok: true, data: { document: updated, version } };
}

export function finalizeConsultationProtocol(input: {
  tenantId: string;
  documentId: string;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<ConsultationDocument> {
  const denied = enforcePermission<ConsultationDocument>(input.actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;

  const store = getConsultationStore(input.tenantId);
  const docIdx = store.documents.findIndex((d) => d.id === input.documentId);
  if (docIdx < 0) return { ok: false, error: 'Dokument nicht gefunden.' };

  const document = store.documents[docIdx];
  if (document.status !== 'draft') {
    return { ok: false, error: 'Nur Entwürfe können finalisiert werden.' };
  }

  const updated: ConsultationDocument = {
    ...document,
    status: 'finalized',
    updatedAt: new Date().toISOString(),
  };
  store.documents[docIdx] = updated;

  appendConsultationAuditEvent(input.tenantId, {
    caseId: document.caseId,
    eventType: 'protocol_version_created',
    summary: `Protokoll finalisiert (Version ${document.currentVersion}).`,
    actorProfileId: null,
    oldStatus: 'draft',
    newStatus: 'finalized',
    metadata: { documentId: document.id },
  });

  return { ok: true, data: updated };
}

export function signConsultationDocument(input: {
  tenantId: string;
  documentId: string;
  signedByProfileId: string;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<ConsultationDocument> {
  const denied = enforcePermission<ConsultationDocument>(input.actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;

  const store = getConsultationStore(input.tenantId);
  const docIdx = store.documents.findIndex((d) => d.id === input.documentId);
  if (docIdx < 0) return { ok: false, error: 'Dokument nicht gefunden.' };

  const document = store.documents[docIdx];
  if (document.status !== 'finalized') {
    return { ok: false, error: 'Unterschrift nur für finalisierte Dokumente.' };
  }

  const now = new Date().toISOString();
  const updated: ConsultationDocument = {
    ...document,
    status: 'signed',
    signedAt: now,
    signedByProfileId: input.signedByProfileId,
    updatedAt: now,
  };
  store.documents[docIdx] = updated;

  appendConsultationAuditEvent(input.tenantId, {
    caseId: document.caseId,
    eventType: 'document_signed',
    summary: `Dokument unterschrieben: ${document.title}`,
    actorProfileId: input.signedByProfileId,
    oldStatus: 'finalized',
    newStatus: 'signed',
    metadata: { documentId: document.id },
  });

  return { ok: true, data: updated };
}

export function listConsultationProtocolVersions(
  tenantId: string,
  documentId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ConsultationDocumentVersion[]> {
  const denied = enforcePermission<ConsultationDocumentVersion[]>(actorRoleKey, 'beratung.cases.view');
  if (denied) return denied;

  const versions = getConsultationStore(tenantId).documentVersions
    .filter((v) => v.documentId === documentId)
    .sort((a, b) => a.versionNumber - b.versionNumber);

  return { ok: true, data: versions };
}

export function getConsultationAuditEventsForCase(
  tenantId: string,
  caseId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<ReturnType<typeof getConsultationAuditTrail>> {
  const denied = enforcePermission<ReturnType<typeof getConsultationAuditTrail>>(
    actorRoleKey,
    'beratung.cases.view',
  );
  if (denied) return denied;

  return { ok: true, data: getConsultationAuditTrail(tenantId, caseId) };
}

export function hasFinalizedProtocolForCase(tenantId: string, caseId: string): boolean {
  return getConsultationStore(tenantId).documents.some(
    (d) => d.caseId === caseId && d.documentType === 'protocol' && (d.status === 'finalized' || d.status === 'signed'),
  );
}

export function hasSignedProtocolForCase(tenantId: string, caseId: string): boolean {
  return getConsultationStore(tenantId).documents.some(
    (d) => d.caseId === caseId && d.documentType === 'protocol' && d.status === 'signed',
  );
}
