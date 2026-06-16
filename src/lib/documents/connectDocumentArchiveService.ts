import type { ServiceResult } from '@/types';
import type {
  ArchiveStatus,
  DocumentArchiveEntry,
  DocumentExecutionContext,
  GeneratedDocument,
} from '@/types/documents/connect';
import {
  assertDocumentWritable,
  assertGobdArchiveClaimAllowed,
} from '@/lib/documents/connectDocumentGuard';
import {
  appendDocumentAuditEvent,
} from '@/lib/documents/connectDocumentVersionService';
import { getConnectDocumentDemoStore } from '@/lib/documents/connectDocumentGenerationService';
import { runService } from '@/lib/services/serviceRunner';

let archiveCounter = 0;

export type ArchiveStatusSnapshot = {
  documentId: string;
  isArchived: boolean;
  archiveStatus: ArchiveStatus;
  gobdProtectionActive: boolean;
  gobdCompliant: boolean;
  version: number;
  disclaimer: string | null;
};

/** Archivstatus abfragen — kein GoBD-Claim ohne Schutzlogik. */
export async function getArchiveStatus(
  tenantId: string,
  documentId: string,
): Promise<ServiceResult<ArchiveStatusSnapshot>> {
  return runService(async () => {
    const store = getConnectDocumentDemoStore();
    const doc = store.documents.get(documentId);
    if (!doc || doc.tenantId !== tenantId) {
      return { ok: false, error: 'Dokument nicht gefunden.' };
    }

    const entry = [...archiveEntries.values()].find(
      (e) => e.tenantId === tenantId && e.generatedDocumentId === documentId,
    );

    return {
      ok: true,
      data: {
        documentId,
        isArchived: doc.isArchived,
        archiveStatus: entry?.archiveStatus ?? 'prepared',
        gobdProtectionActive: entry?.gobdProtectionActive ?? false,
        gobdCompliant: !!(entry?.gobdProtectionActive && entry.isImmutable),
        version: doc.currentVersion,
        disclaimer: entry?.gobdProtectionActive
          ? null
          : 'Revisionssichere GoBD-Archivierung ist erst nach Freischaltung der Schutzlogik verfügbar.',
      },
    };
  }, { delayMs: 120 });
}

const archiveEntries = new Map<string, DocumentArchiveEntry>();

export function getConnectArchiveDemoEntries(): Map<string, DocumentArchiveEntry> {
  return archiveEntries;
}

export function resetConnectArchiveDemoEntries(): void {
  archiveEntries.clear();
  archiveCounter = 0;
}

/** Archivierung vorbereiten — immutable nach Archivierung. */
export async function prepareArchiveDocument(
  tenantId: string,
  documentId: string,
  context: DocumentExecutionContext,
): Promise<ServiceResult<DocumentArchiveEntry>> {
  return runService(async () => {
    const store = getConnectDocumentDemoStore();
    const doc = store.documents.get(documentId);
    if (!doc || doc.tenantId !== tenantId) {
      return { ok: false, error: 'Dokument nicht gefunden.' };
    }

    const gobdCheck = assertGobdArchiveClaimAllowed(context);
    const archiveStatus: ArchiveStatus = gobdCheck.allowed ? 'archived' : 'gobd_pending';

    archiveCounter += 1;
    const entry: DocumentArchiveEntry = {
      id: `arch-${archiveCounter}`,
      tenantId,
      generatedDocumentId: documentId,
      invoiceId: doc.invoiceId,
      documentType: doc.documentType,
      version: doc.currentVersion,
      contentHash: doc.contentHash ?? `hash:${documentId}`,
      storageReference: doc.storageReference ?? `archive://${documentId}`,
      isImmutable: true,
      archiveStatus,
      gobdProtectionActive: context.gobdProtectionActive,
      archivedAt: new Date().toISOString(),
    };
    archiveEntries.set(entry.id, entry);

    const updated: GeneratedDocument = {
      ...doc,
      isArchived: true,
      status: 'archived',
      archivedAt: entry.archivedAt,
      updatedAt: new Date().toISOString(),
    };
    store.documents.set(documentId, updated);

    appendDocumentAuditEvent(store, {
      tenantId,
      documentId,
      eventType: gobdCheck.allowed ? 'archive_created' : 'archive_prepared',
      summary: gobdCheck.allowed
        ? 'Dokument archiviert (Schutzlogik aktiv).'
        : 'Archiv vorbereitet — GoBD-Schutzlogik noch nicht aktiv.',
      oldStatus: doc.status,
      newStatus: 'archived',
    });

    return { ok: true, data: entry };
  }, { delayMs: 220 });
}

/** Überschreiben archivierter Dokumente blockieren. */
export async function attemptOverwriteArchivedDocument(
  tenantId: string,
  documentId: string,
  context: DocumentExecutionContext,
): Promise<ServiceResult<never>> {
  return runService(async () => {
    const store = getConnectDocumentDemoStore();
    const doc = store.documents.get(documentId);
    if (!doc || doc.tenantId !== tenantId) {
      return { ok: false, error: 'Dokument nicht gefunden.' };
    }

    const writable = assertDocumentWritable({
      ...context,
      documentTenantId: doc.tenantId,
      isArchived: doc.isArchived,
    });

    if (!writable.allowed) {
      appendDocumentAuditEvent(store, {
        tenantId,
        documentId,
        eventType: 'edit_blocked',
        summary: writable.message,
      });
      return { ok: false, error: writable.message };
    }

    return { ok: false, error: 'Unbekannter Fehler.' };
  }, { delayMs: 100 });
}

/** Korrektur als neue Version (nicht Überschreiben). */
export async function prepareDocumentCorrection(
  tenantId: string,
  documentId: string,
  storageReference: string,
  contentHash: string,
  _context: DocumentExecutionContext,
): Promise<ServiceResult<GeneratedDocument>> {
  return runService(async () => {
    const store = getConnectDocumentDemoStore();
    const doc = store.documents.get(documentId);
    if (!doc || doc.tenantId !== tenantId) {
      return { ok: false, error: 'Dokument nicht gefunden.' };
    }

    if (!doc.isArchived) {
      return { ok: false, error: 'Korrektur-Flow nur für archivierte Dokumente vorgesehen.' };
    }

    appendDocumentAuditEvent(store, {
      tenantId,
      documentId,
      eventType: 'correction_started',
      summary: 'Korrektur als neues Dokument vorbereitet.',
    });

    const correctionId = `gen-doc-corr-${Date.now()}`;
    const now = new Date().toISOString();
    const correction: GeneratedDocument = {
      id: correctionId,
      tenantId,
      documentType: doc.documentType,
      title: `${doc.title} (Korrektur)`,
      status: 'corrected',
      currentVersion: 1,
      containsHealthData: doc.containsHealthData,
      isArchived: false,
      pdfAPrepared: false,
      storageReference,
      contentHash,
      clientId: doc.clientId,
      invoiceId: doc.invoiceId,
      correctionOfId: documentId,
      createdAt: now,
      updatedAt: now,
    };
    store.documents.set(correctionId, correction);

    appendDocumentAuditEvent(store, {
      tenantId,
      documentId: correctionId,
      eventType: 'version_created',
      summary: 'Korrekturversion 1 erstellt.',
      newStatus: 'corrected',
    });

    return { ok: true, data: correction };
  }, { delayMs: 200 });
}
