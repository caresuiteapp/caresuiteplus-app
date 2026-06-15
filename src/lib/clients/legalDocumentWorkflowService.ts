import type { RoleKey, ServiceResult } from '@/types';
import type { ClientConsentRecord, ClientContract } from '@/types/modules/client';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, isDemoClientBackend } from './clientBackend';
import { buildClientDocumentStoragePath } from './clientDocumentsService';

export type LegalDocumentTemplateKey =
  | 'datenschutz'
  | 'kundenvertrag'
  | 'leistungsvereinbarung'
  | 'pflegevertrag'
  | 'einwilligung_foto';

const TEMPLATE_TITLES: Record<LegalDocumentTemplateKey, string> = {
  datenschutz: 'Datenschutzeinwilligung',
  kundenvertrag: 'Kundenvertrag',
  leistungsvereinbarung: 'Leistungsvereinbarung',
  pflegevertrag: 'Pflegevertrag',
  einwilligung_foto: 'Foto-Einwilligung',
};

export async function generateLegalDocumentFromTemplate(
  tenantId: string,
  clientId: string,
  templateKey: LegalDocumentTemplateKey,
): Promise<ServiceResult<ClientDocumentRecord>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return { ok: false, error: 'Live-Vorlagen: Repository erweitern.' };
    }
    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const now = new Date().toISOString();
    const docId = `legal-${clientId}-${Date.now()}`;
    const title = TEMPLATE_TITLES[templateKey];
    const category: ClientDocumentRecord['category'] =
      templateKey === 'datenschutz' || templateKey === 'einwilligung_foto' ? 'einwilligung' : 'vertrag';
    const doc: ClientDocumentRecord = {
      id: docId,
      tenantId,
      clientId,
      title: `${title} — ${full.firstName} ${full.lastName}`,
      fileName: `${templateKey}-${clientId}.pdf`,
      mimeType: 'application/pdf',
      category,
      storagePath: buildClientDocumentStoragePath(tenantId, clientId, docId, `${templateKey}.pdf`),
      status: 'entwurf',
      sensitivity: 'care',
      uploadedBy: null,
      validUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    upsertDemoClientFullDetail({
      ...full,
      documents: [doc, ...full.documents],
      updatedAt: now,
    });

    return { ok: true, data: doc };
  }, { delayMs: 350 });
}

export async function signLegalDocument(
  tenantId: string,
  clientId: string,
  documentId: string,
  signedByName: string,
): Promise<ServiceResult<ClientDocumentRecord>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return { ok: false, error: 'Live-Signatur: Repository erweitern.' };
    }
    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const idx = full.documents.findIndex((d) => d.id === documentId);
    if (idx < 0) return { ok: false, error: 'Dokument nicht gefunden.' };

    const now = new Date().toISOString();
    const signed: ClientDocumentRecord = {
      ...full.documents[idx]!,
      status: 'aktiv',
      title: `${full.documents[idx]!.title} (signiert)`,
      updatedAt: now,
    };
    const documents = [...full.documents];
    documents[idx] = signed;

    upsertDemoClientFullDetail({ ...full, documents, updatedAt: now });

    if (signed.category === 'einwilligung') {
      const consent: ClientConsentRecord = {
        id: `consent-${documentId}`,
        tenantId,
        clientId,
        consentType: 'datenschutz',
        title: signed.title,
        scope: 'team',
        granted: true,
        grantedAt: now,
        expiresAt: null,
        grantedByProfileId: null,
        documentId: signed.id,
        notes: `Signiert von ${signedByName}`,
        createdAt: now,
        updatedAt: now,
      };
      upsertDemoClientFullDetail({
        ...getDemoClientFullDetail(clientId)!,
        consents: [consent, ...(full.consents ?? [])],
      });
    }

    if (signed.category === 'vertrag') {
      const contract: ClientContract = {
        id: `contract-${documentId}`,
        tenantId,
        clientId,
        contractNumber: `V-${Date.now().toString().slice(-6)}`,
        contractStart: now.slice(0, 10),
        contractEnd: null,
        serviceType: 'betreuung',
        hourlyRateCents: full.billingProfile?.hourlyRateCents ?? 3800,
        weeklyHours: null,
        status: 'aktiv',
        signedAt: now,
        documentId: signed.id,
        notes: `Signiert von ${signedByName}`,
        createdAt: now,
        updatedAt: now,
      };
      upsertDemoClientFullDetail({
        ...getDemoClientFullDetail(clientId)!,
        contracts: [contract, ...(full.contracts ?? [])],
      });
    }

    return { ok: true, data: signed };
  }, { delayMs: 400 });
}

export async function saveLegalDocumentToRecord(
  tenantId: string,
  clientId: string,
  documentId: string,
): Promise<ServiceResult<{ documentId: string; savedAt: string }>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return { ok: false, error: 'Live-Akte: Repository erweitern.' };
    }
    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    const doc = full.documents.find((d) => d.id === documentId);
    if (!doc) return { ok: false, error: 'Dokument nicht in Akte.' };
    if (doc.status !== 'aktiv') {
      return { ok: false, error: 'Dokument muss signiert sein (Status aktiv).' };
    }
    const savedAt = new Date().toISOString();
    const documents = full.documents.map((entry) =>
      entry.id === documentId
        ? { ...entry, title: entry.title.includes('(in Akte)') ? entry.title : `${entry.title} (in Akte)`, updatedAt: savedAt }
        : entry,
    );
    const timelineEvent = {
      id: `tl-${documentId}-saved`,
      clientId,
      eventType: 'dokument' as const,
      icon: '📁',
      title: 'Dokument in Akte gespeichert',
      subtitle: doc.title,
      timestamp: savedAt,
      status: 'aktiv' as const,
      actorName: 'Office Demo',
      isInternal: false,
      metadata: { documentId },
    };
    upsertDemoClientFullDetail({
      ...full,
      documents,
      timeline: [timelineEvent, ...(full.timeline ?? [])],
      updatedAt: savedAt,
    });
    return { ok: true, data: { documentId, savedAt } };
  }, { delayMs: 200 });
}
