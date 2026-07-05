import type { RoleKey, ServiceResult } from '@/types';
import type {
  OfficeCreateSignatureDocumentInput,
  PortalSignatureAuditEvent,
  PortalSignatureCapture,
  PortalSignatureDashboardCounts,
  PortalSignatureDocument,
  PortalSignatureDocumentDetail,
  PortalSignatureDocumentStatus,
  PortalSignatureFilterTab,
  PortalSignDocumentInput,
} from '@/types/portal/documentSignatures';
import { demoPortalSignatureDocuments } from '@/data/demo/portalSignatureDocuments';
import { computeDocumentContentHash } from '@/lib/documents/documentHashService';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { runService } from '@/lib/services/serviceRunner';
import { fetchLivePortalSignatureDocuments } from './portalDocumentSignatureLiveService';

const DOCUMENTS = new Map<string, PortalSignatureDocument>();
const CAPTURES = new Map<string, PortalSignatureCapture>();
const AUDIT_EVENTS: PortalSignatureAuditEvent[] = [];
let docCounter = 0;
let captureCounter = 0;
let auditCounter = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function seedDemoDocuments(): void {
  if (DOCUMENTS.size > 0) return;
  for (const doc of demoPortalSignatureDocuments) {
    DOCUMENTS.set(doc.id, { ...doc });
  }
}

function audit(input: Omit<PortalSignatureAuditEvent, 'id' | 'createdAt'>): void {
  auditCounter += 1;
  AUDIT_EVENTS.push({
    id: `ps-audit-${auditCounter}`,
    createdAt: nowIso(),
    ...input,
  });
}

function isOpenStatus(status: PortalSignatureDocumentStatus): boolean {
  return ['new', 'open', 'in_progress', 'partially_signed'].includes(status);
}

function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function isOverdue(doc: PortalSignatureDocument, ref: Date): boolean {
  if (!doc.dueDate || !isOpenStatus(doc.status)) return false;
  const due = new Date(doc.dueDate);
  due.setHours(23, 59, 59, 999);
  return due < ref;
}

function isDueToday(doc: PortalSignatureDocument, ref: Date): boolean {
  if (!doc.dueDate || !isOpenStatus(doc.status)) return false;
  return isSameDay(doc.dueDate, ref);
}

function resolveNextSignerRole(
  doc: PortalSignatureDocument,
): PortalSignatureDocument['nextSignerRole'] {
  if (doc.status === 'completed' || doc.status === 'withdrawn') return null;
  if (doc.signatureRequirement === 'employee') {
    return doc.employeeSigned ? null : 'employee';
  }
  if (doc.signatureRequirement === 'client') {
    return doc.clientSigned ? null : 'client';
  }
  if (!doc.employeeSigned) return 'employee';
  if (!doc.clientSigned) return 'client';
  return null;
}

function resolveStatusAfterCapture(doc: PortalSignatureDocument): PortalSignatureDocumentStatus {
  const needsEmployee =
    doc.signatureRequirement === 'employee' || doc.signatureRequirement === 'both_sequential';
  const needsClient =
    doc.signatureRequirement === 'client' || doc.signatureRequirement === 'both_sequential';
  const employeeDone = !needsEmployee || doc.employeeSigned;
  const clientDone = !needsClient || doc.clientSigned;
  if (employeeDone && clientDone) return 'completed';
  if (doc.employeeSigned || doc.clientSigned) return 'partially_signed';
  return 'in_progress';
}

export function filterPortalSignatureDocuments(
  docs: PortalSignatureDocument[],
  tab: PortalSignatureFilterTab,
  ref = new Date(),
): PortalSignatureDocument[] {
  switch (tab) {
    case 'open':
      return docs.filter((d) => isOpenStatus(d.status));
    case 'due_today':
      return docs.filter((d) => isDueToday(d, ref));
    case 'overdue':
      return docs.filter((d) => isOverdue(d, ref));
    case 'completed':
      return docs.filter((d) => d.status === 'completed');
    default:
      return docs;
  }
}

export function countPortalSignatureDashboard(
  docs: PortalSignatureDocument[],
  ref = new Date(),
): PortalSignatureDashboardCounts {
  const open = docs.filter((d) => isOpenStatus(d.status));
  return {
    openCount: open.length,
    overdueCount: open.filter((d) => isOverdue(d, ref)).length,
    dueTodayCount: open.filter((d) => isDueToday(d, ref)).length,
  };
}

export async function fetchPortalSignatureDocuments(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  tab: PortalSignatureFilterTab = 'open',
): Promise<ServiceResult<PortalSignatureDocument[]>> {
  const denied = enforcePermission<PortalSignatureDocument[]>(
    roleKey,
    'portal.employee.signatures.view',
  );
  if (denied) return denied;

  if (getServiceMode() === 'supabase') {
    const live = await fetchLivePortalSignatureDocuments(tenantId, employeeId, tab);
    if (live.ok) return live;
  }

  return runService(async () => {
    seedDemoDocuments();
    const docs = [...DOCUMENTS.values()].filter(
      (d) => d.tenantId === tenantId && d.employeeId === employeeId,
    );
    return { ok: true, data: filterPortalSignatureDocuments(docs, tab) };
  }, { delayMs: 200 });
}

export async function fetchPortalSignatureDocumentDetail(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  documentId: string,
): Promise<ServiceResult<PortalSignatureDocumentDetail>> {
  const denied = enforcePermission<PortalSignatureDocumentDetail>(
    roleKey,
    'portal.employee.signatures.view',
  );
  if (denied) return denied;

  return runService(async () => {
    seedDemoDocuments();
    const doc = DOCUMENTS.get(documentId);
    if (!doc || doc.tenantId !== tenantId || doc.employeeId !== employeeId) {
      return { ok: false, error: 'Dokument nicht gefunden.' };
    }
    const captures = [...CAPTURES.values()].filter((c) => c.documentId === documentId);
    const auditTrail = AUDIT_EVENTS.filter((e) => e.documentId === documentId);
    return {
      ok: true,
      data: { ...doc, captures, auditTrail },
    };
  }, { delayMs: 150 });
}

export async function signPortalDocument(
  input: PortalSignDocumentInput,
  roleKey: RoleKey | null,
): Promise<ServiceResult<PortalSignatureDocumentDetail>> {
  const denied = enforcePermission<PortalSignatureDocumentDetail>(
    roleKey,
    'portal.employee.signatures.sign',
  );
  if (denied) return denied;

  if (!input.signerName.trim()) {
    return { ok: false, error: 'Name für Unterschrift erforderlich.' };
  }

  return runService(async () => {
    seedDemoDocuments();
    const doc = DOCUMENTS.get(input.documentId);
    if (!doc || doc.tenantId !== input.tenantId || doc.employeeId !== input.employeeId) {
      return { ok: false, error: 'Dokument nicht gefunden.' };
    }
    if (!isOpenStatus(doc.status)) {
      return { ok: false, error: 'Dokument ist nicht mehr zur Unterschrift offen.' };
    }
    if (doc.nextSignerRole !== input.signerRole) {
      return { ok: false, error: 'Diese Unterschrift ist aktuell nicht erforderlich.' };
    }

    const signedAt = nowIso();
    const auditId = `audit-${Date.now()}`;
    const hashPayload = [
      input.tenantId,
      input.documentId,
      input.signerRole,
      input.signerName,
      signedAt,
      input.signatureDataUrl.slice(0, 64),
    ].join('|');
    const signatureHash = computeDocumentContentHash(hashPayload);

    captureCounter += 1;
    const capture: PortalSignatureCapture = {
      id: `psc-${captureCounter}`,
      documentId: input.documentId,
      tenantId: input.tenantId,
      signerRole: input.signerRole,
      signerName: input.signerName.trim(),
      signedAt,
      signatureHash,
      auditId,
      deviceInfo: input.deviceInfo ?? null,
      browser: input.browser ?? null,
      capturedIp: input.capturedIp ?? null,
      storagePath: `demo/signatures/${input.documentId}/${input.signerRole}.png`,
    };
    CAPTURES.set(capture.id, capture);

    if (input.signerRole === 'employee') doc.employeeSigned = true;
    if (input.signerRole === 'client') doc.clientSigned = true;

    doc.status = resolveStatusAfterCapture(doc);
    doc.nextSignerRole = resolveNextSignerRole(doc);
    if (doc.status === 'completed') {
      doc.completedAt = signedAt;
    }
    DOCUMENTS.set(doc.id, doc);

    audit({
      tenantId: input.tenantId,
      documentId: input.documentId,
      eventType: 'signature_captured',
      summary: `${input.signerRole === 'employee' ? 'Mitarbeiter' : 'Klient'}-Signatur erfasst.`,
      actorName: input.signerName.trim(),
      metadata: { auditId, signatureHash, signerRole: input.signerRole },
    });

    if (doc.status === 'completed') {
      audit({
        tenantId: input.tenantId,
        documentId: input.documentId,
        eventType: 'document_completed',
        summary: 'Dokument vollständig unterschrieben und archiviert.',
        actorName: input.signerName.trim(),
        metadata: { auditId },
      });
    }

    const captures = [...CAPTURES.values()].filter((c) => c.documentId === input.documentId);
    const auditTrail = AUDIT_EVENTS.filter((e) => e.documentId === input.documentId);
    return { ok: true, data: { ...doc, captures, auditTrail } };
  }, { delayMs: 300 });
}

export async function fetchPortalSignatureDashboardCounts(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<PortalSignatureDashboardCounts>> {
  const result = await fetchPortalSignatureDocuments(tenantId, employeeId, roleKey, 'open');
  if (!result.ok) return result;
  const allOpen = await fetchPortalSignatureDocuments(tenantId, employeeId, roleKey, 'open');
  if (!allOpen.ok) return allOpen;
  return { ok: true, data: countPortalSignatureDashboard(allOpen.data ?? []) };
}

export function resetPortalDocumentSignatureStore(): void {
  DOCUMENTS.clear();
  CAPTURES.clear();
  AUDIT_EVENTS.length = 0;
  docCounter = 0;
  captureCounter = 0;
  auditCounter = 0;
}

export async function createOfficeSignatureDocument(
  input: OfficeCreateSignatureDocumentInput,
  roleKey: RoleKey | null,
): Promise<ServiceResult<PortalSignatureDocument>> {
  const denied = enforcePermission<PortalSignatureDocument>(
    roleKey,
    'office.documents.signatures.manage',
  );
  if (denied) return denied;

  return runService(async () => {
    docCounter += 1;
    const id = `psd-new-${docCounter}`;
    const sentAt = nowIso();
    const needsEmployee =
      input.signatureRequirement === 'employee' ||
      input.signatureRequirement === 'both_sequential';
    const needsClient =
      input.signatureRequirement === 'client' ||
      input.signatureRequirement === 'both_sequential';

    const doc: PortalSignatureDocument = {
      id,
      tenantId: input.tenantId,
      title: input.title.trim(),
      documentType: input.documentType,
      recipientType: input.recipientType,
      employeeId: input.employeeId ?? null,
      clientId: input.clientId ?? null,
      clientName: input.clientName ?? null,
      signatureRequirement: input.signatureRequirement,
      dueDate: input.dueDate ?? null,
      priority: input.priority ?? 'normal',
      requiredBeforeAssignment: input.requiredBeforeAssignment ?? false,
      assignmentId: input.assignmentId ?? null,
      status: 'open',
      creatorName: input.creatorName,
      createdAt: sentAt,
      sentAt,
      completedAt: null,
      allowDownload: input.allowDownload ?? true,
      previewHtml: input.previewHtml ?? null,
      previewPdfUrl: null,
      versionNumber: 1,
      employeeSigned: false,
      clientSigned: false,
      nextSignerRole: needsEmployee ? 'employee' : needsClient ? 'client' : null,
    };

    DOCUMENTS.set(id, doc);
    audit({
      tenantId: input.tenantId,
      documentId: id,
      eventType: 'document_sent',
      summary: `Dokument „${doc.title}" an Portal gesendet.`,
      actorName: input.creatorName,
      metadata: { recipientType: input.recipientType },
    });

    return { ok: true, data: doc };
  }, { delayMs: 250 });
}

export async function fetchOfficeSignatureDocuments(
  tenantId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<PortalSignatureDocument[]>> {
  const denied = enforcePermission<PortalSignatureDocument[]>(
    roleKey,
    'office.documents.signatures.view',
  );
  if (denied) return denied;

  return runService(async () => {
    seedDemoDocuments();
    const docs = [...DOCUMENTS.values()]
      .filter((d) => d.tenantId === tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { ok: true, data: docs };
  }, { delayMs: 200 });
}

export async function withdrawOfficeSignatureDocument(
  tenantId: string,
  documentId: string,
  roleKey: RoleKey | null,
  actorName: string,
): Promise<ServiceResult<PortalSignatureDocument>> {
  const denied = enforcePermission<PortalSignatureDocument>(
    roleKey,
    'office.documents.signatures.manage',
  );
  if (denied) return denied;

  return runService(async () => {
    seedDemoDocuments();
    const doc = DOCUMENTS.get(documentId);
    if (!doc || doc.tenantId !== tenantId) {
      return { ok: false, error: 'Dokument nicht gefunden.' };
    }
    if (doc.status === 'completed') {
      return { ok: false, error: 'Abgeschlossene Dokumente können nicht zurückgezogen werden.' };
    }
    doc.status = 'withdrawn';
    doc.nextSignerRole = null;
    DOCUMENTS.set(documentId, doc);
    audit({
      tenantId,
      documentId,
      eventType: 'document_withdrawn',
      summary: 'Dokument aus Portal zurückgezogen.',
      actorName,
      metadata: {},
    });
    return { ok: true, data: doc };
  }, { delayMs: 200 });
}
