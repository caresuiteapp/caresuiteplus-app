import type { ServiceResult } from '@/types';
import type {
  DocumentExecutionContext,
  DocumentTemplateType,
  GeneratedDocument,
  GeneratedDocumentType,
} from '@/types/documents/connect';
import { assertPdfManipulationAllowed } from '@/lib/documents/connectDocumentGuard';
import {
  createGeneratedDocument,
  createInMemoryDocumentStore,
  markDocumentGenerated,
  seedDocumentTemplate,
  type InMemoryDocumentStore,
} from '@/lib/documents/connectDocumentVersionService';
import { runService } from '@/lib/services/serviceRunner';

const demoStore = createInMemoryDocumentStore();

function seedDemoTemplates(tenantId: string): void {
  if (demoStore.templates.size > 0) return;
  seedDocumentTemplate(demoStore, {
    tenantId,
    templateKey: 'contract_standard',
    templateType: 'contract',
    label: 'Standard-Pflegevertrag',
    version: 1,
    isActive: true,
  });
  seedDocumentTemplate(demoStore, {
    tenantId,
    templateKey: 'invoice_standard',
    templateType: 'invoice',
    label: 'Standard-Rechnung',
    version: 1,
    isActive: true,
  });
  seedDocumentTemplate(demoStore, {
    tenantId,
    templateKey: 'leistungsnachweis_standard',
    templateType: 'leistungsnachweis',
    label: 'Standard-Leistungsnachweis',
    version: 1,
    isActive: true,
  });
}

export type GenerateDocumentInput = {
  tenantId: string;
  title: string;
  clientId?: string | null;
  invoiceId?: string | null;
  containsHealthData?: boolean;
};

function buildStorageRef(tenantId: string, docId: string, suffix: string): string {
  return `tenants/${tenantId}/connect-documents/${docId}/${suffix}.pdf`;
}

function hashPlaceholder(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i += 1) {
    hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
  }
  return `sha256:prep-${hash.toString(16)}`;
}

async function prepareGenerate(
  documentType: GeneratedDocumentType,
  input: GenerateDocumentInput,
): Promise<ServiceResult<GeneratedDocument>> {
  return runService(async () => {
    if (!input.tenantId?.trim()) {
      return { ok: false, error: 'Mandant fehlt.' };
    }
    seedDemoTemplates(input.tenantId);

    const doc = createGeneratedDocument(demoStore, {
      tenantId: input.tenantId,
      documentType,
      title: input.title,
      containsHealthData: input.containsHealthData,
      clientId: input.clientId,
      invoiceId: input.invoiceId,
    });

    const storageReference = buildStorageRef(input.tenantId, doc.id, documentType);
    const contentHash = hashPlaceholder(`${documentType}:${input.title}:${doc.id}`);
    const generated = markDocumentGenerated(demoStore, input.tenantId, doc.id, storageReference, contentHash);
    if (!generated) return { ok: false, error: 'Dokument konnte nicht erzeugt werden.' };

    return { ok: true, data: generated };
  }, { delayMs: 280 });
}

/** Vertrag auto-generieren — vorbereitet, kein externer Versand. */
export async function prepareGenerateContract(
  input: GenerateDocumentInput,
): Promise<ServiceResult<GeneratedDocument>> {
  return prepareGenerate('contract', input);
}

/** Rechnung generieren — vorbereitet. */
export async function prepareGenerateInvoice(
  input: GenerateDocumentInput,
): Promise<ServiceResult<GeneratedDocument>> {
  return prepareGenerate('invoice', input);
}

/** Leistungsnachweis generieren — vorbereitet. */
export async function prepareGenerateLeistungsnachweis(
  input: GenerateDocumentInput,
): Promise<ServiceResult<GeneratedDocument>> {
  return prepareGenerate('leistungsnachweis', input);
}

/** PDF/A-Konvertierung vorbereiten — erzeugt neue Version. */
export async function preparePdfAConversion(
  tenantId: string,
  documentId: string,
  context: DocumentExecutionContext,
): Promise<ServiceResult<GeneratedDocument>> {
  return runService(async () => {
    const pdfCheck = assertPdfManipulationAllowed(context, true);
    if (!pdfCheck.allowed) return { ok: false, error: pdfCheck.message };

    const doc = demoStore.documents.get(documentId);
    if (!doc || doc.tenantId !== tenantId) {
      return { ok: false, error: 'Dokument nicht gefunden.' };
    }

    const updated: GeneratedDocument = {
      ...doc,
      pdfAPrepared: true,
      updatedAt: new Date().toISOString(),
    };
    demoStore.documents.set(documentId, updated);
    return { ok: true, data: updated };
  }, { delayMs: 200 });
}

/** Dokument-Klassifikation vorbereiten (intern, kein externer OCR). */
export async function prepareDocumentClassification(
  tenantId: string,
  documentId: string,
): Promise<ServiceResult<{ documentId: string; classification: Record<string, string> }>> {
  return runService(async () => {
    const doc = demoStore.documents.get(documentId);
    if (!doc || doc.tenantId !== tenantId) {
      return { ok: false, error: 'Dokument nicht gefunden.' };
    }
    return {
      ok: true,
      data: {
        documentId,
        classification: {
          documentType: doc.documentType,
          suggestedCategory: doc.documentType,
          confidence: 'prepared',
        },
      },
    };
  }, { delayMs: 150 });
}

/** Demo-Store für Tests. */
export function getConnectDocumentDemoStore(): InMemoryDocumentStore {
  return demoStore;
}

export function resetConnectDocumentDemoStore(): void {
  demoStore.documents.clear();
  demoStore.versions.clear();
  demoStore.auditEvents.length = 0;
  demoStore.templates.clear();
}

export type { DocumentTemplateType };
