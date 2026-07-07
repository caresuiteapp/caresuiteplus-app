import type { ServiceResult } from '@/types';
import type { PortalDocumentCategory, PortalDocumentDetail, PortalDocumentListItem } from '@/types/portal/documents';
import type { ClientDocumentRecord } from '@/types/modules/client';
import type { DataVisibilityScope } from '@/types/portal/visibility';
import {
  canClientPortalSeeFeature,
  fetchClientPortalSettingsResolved,
} from '@/lib/client/clientPortalSettingsService';
import { enrichClientDocumentWithIntakeRows } from '@/lib/clients/clientDocumentMerge';
import { syncClientDocumentPortalReleaseIfEnabled } from '@/lib/clients/clientDocumentsService';
import {
  PORTAL_CLIENT_DOCUMENT_STATUSES,
  PORTAL_INTERNAL_SENSITIVITIES,
  PORTAL_PROOFS_CATEGORY,
} from '@/lib/clients/clientDocumentPortalVisibility';
import {
  isIntakeTemplateFileName,
  mapCatalogCategoryToPortalCategory,
  mapClientDocumentToPortalListItem,
  resolveIntakeTemplateKey,
  resolvePortalDocumentCategory,
} from '@/lib/office/officeDocumentDisplay';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { mapClientDocument } from '@/lib/supabase/mappers/clientExtendedMapper';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import {
  fetchAssistProofPortalDocumentDetail,
  getProofPdfForClientPortal,
} from '@/lib/portal/assist/portalAssistVisitProofService';

const STORAGE_BUCKET = 'office-documents';

const LIST_SELECT =
  'id, tenant_id, client_id, title, file_name, mime_type, category, storage_path, status, sensitivity, portal_visible, size_bytes, created_at, updated_at, source, intake_document_id, signature_required, signed_at';

const INTAKE_HTML_SELECT =
  'id, template_key, document_type, title, status, finalized_html, preview_html';

type IntakeHtmlRow = {
  id: string;
  template_key: string;
  document_type: string;
  title: string;
  status: string;
  finalized_html: string | null;
  preview_html: string | null;
};

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapStoredRowToClientDocument(row: Record<string, unknown>): ClientDocumentRecord {
  const doc = mapClientDocument(row as Parameters<typeof mapClientDocument>[0]);
  const source = String(row.source ?? '');
  return {
    ...doc,
    documentSource: source === 'intake' ? 'intake' : source === 'upload' ? 'upload' : doc.documentSource ?? null,
    intakeDocumentId: (row.intake_document_id as string | null | undefined) ?? doc.intakeDocumentId ?? null,
  };
}

function resolvePortalCategory(doc: ClientDocumentRecord, row: Record<string, unknown>): PortalDocumentCategory {
  if (doc.documentSource === 'intake' && doc.intakeDocumentType) {
    return resolvePortalDocumentCategory(doc);
  }

  const rawCategory = String(row.category ?? doc.category);
  if (rawCategory !== doc.category) {
    return mapCatalogCategoryToPortalCategory(rawCategory);
  }

  return resolvePortalDocumentCategory(doc);
}

function resolveVisibility(row: Record<string, unknown>): DataVisibilityScope {
  if (row.portal_visible === true) return 'shared';
  return 'team';
}

function collectIntakeLookupKeys(docs: ClientDocumentRecord[]): {
  intakeDocumentIds: string[];
  templateKeys: string[];
} {
  const intakeDocumentIds = new Set<string>();
  const templateKeys = new Set<string>();

  for (const doc of docs) {
    if (doc.intakeDocumentId) {
      intakeDocumentIds.add(doc.intakeDocumentId);
    }

    const templateKey = resolveIntakeTemplateKey(doc);
    if (templateKey) {
      templateKeys.add(templateKey);
      continue;
    }

    if (isIntakeTemplateFileName(doc.fileName)) {
      templateKeys.add(doc.fileName.replace(/\.html$/i, ''));
    }
  }

  return {
    intakeDocumentIds: [...intakeDocumentIds],
    templateKeys: [...templateKeys],
  };
}

async function fetchIntakeRowsForPortalDocuments(
  tenantId: string,
  clientId: string,
  lookup: { intakeDocumentIds: string[]; templateKeys: string[] },
): Promise<IntakeHtmlRow[]> {
  const uniqueIds = [...new Set(lookup.intakeDocumentIds.filter(Boolean))];
  const uniqueTemplateKeys = [...new Set(lookup.templateKeys.filter(Boolean))];
  if (uniqueIds.length === 0 && uniqueTemplateKeys.length === 0) return [];

  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const table = fromUnknownTable(supabase, 'client_intake_documents');
  const baseQuery = () =>
    table
      .select(INTAKE_HTML_SELECT)
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .in('status', ['finalized', 'signed']);

  const merged = new Map<string, IntakeHtmlRow>();

  if (uniqueIds.length > 0) {
    const { data, error } = await baseQuery().in('id', uniqueIds);
    if (error) {
      if (isMissingTableError(error)) return [];
      console.warn('[portalDocumentsLiveService] client_intake_documents by id:', error.message);
    } else {
      for (const row of (data ?? []) as IntakeHtmlRow[]) {
        merged.set(row.id, row);
      }
    }
  }

  const missingTemplateKeys = uniqueTemplateKeys.filter(
    (templateKey) => ![...merged.values()].some((row) => row.template_key === templateKey),
  );

  if (missingTemplateKeys.length > 0) {
    const { data, error } = await baseQuery().in('template_key', missingTemplateKeys);
    if (error) {
      if (isMissingTableError(error)) return [...merged.values()];
      console.warn('[portalDocumentsLiveService] client_intake_documents by template:', error.message);
    } else {
      for (const row of (data ?? []) as IntakeHtmlRow[]) {
        merged.set(row.id, row);
      }
    }
  }

  return [...merged.values()];
}

function enrichPortalClientDocument(doc: ClientDocumentRecord, intakeRows: IntakeHtmlRow[]): ClientDocumentRecord {
  if (intakeRows.length === 0) return doc;
  return enrichClientDocumentWithIntakeRows(doc, intakeRows);
}

function mapClientDocumentToPortalItem(
  doc: ClientDocumentRecord,
  row?: Record<string, unknown>,
): PortalDocumentListItem {
  const fileSizeBytes = Number(row?.size_bytes ?? 0);
  const item = mapClientDocumentToPortalListItem(doc, {
    fileSizeBytes,
    visibility: row ? resolveVisibility(row) : 'shared',
  });

  if (row) {
    return {
      ...item,
      category: resolvePortalCategory(doc, row),
    };
  }

  return item;
}

function mapDetail(item: PortalDocumentListItem, row: Record<string, unknown>): PortalDocumentDetail {
  const hasStorage = Boolean(row.storage_path);
  const hasHtmlContent = Boolean(item.previewHtml?.trim());
  const signatureRequired = row.signature_required === true;
  const signedAt = row.signed_at ? String(row.signed_at) : null;
  const signaturePending = signatureRequired && !signedAt;
  const isAssistProof = String(row.source ?? '') === 'assist_visit_proof';

  return {
    ...item,
    createdAt: String(row.created_at ?? item.updatedAt),
    description: signaturePending
      ? 'Bitte bestätigen Sie den Einsatz mit Ihrer Unterschrift. Der Leistungsnachweis wird danach erstellt.'
      : signedAt && isAssistProof
        ? 'Klient:in hat unterschrieben — Leistungsnachweis wird geprüft.'
        : null,
    downloadReady: item.status !== 'gesperrt' && hasStorage,
    viewReady: item.status !== 'gesperrt' && (hasStorage || hasHtmlContent || signaturePending),
    signatureRequired,
    signaturePending,
    canSign: signaturePending && isAssistProof,
    signedViaClientPortal: Boolean(signedAt && isAssistProof),
  };
}

async function loadPortalVisibleClientDocuments(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<PortalDocumentListItem[]>> {
  await syncClientDocumentPortalReleaseIfEnabled(tenantId, clientId);

  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await fromUnknownTable(supabase, 'client_documents')
    .select(LIST_SELECT)
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('portal_visible', true)
    .in('status', [...PORTAL_CLIENT_DOCUMENT_STATUSES])
    .not('sensitivity', 'in', `(${PORTAL_INTERNAL_SENSITIVITIES.join(',')})`)
    .neq('category', PORTAL_PROOFS_CATEGORY)
    .order('updated_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return { ok: true, data: [] };
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const baseDocs = rows.map((row) => mapStoredRowToClientDocument(row));
  const intakeRows = await fetchIntakeRowsForPortalDocuments(
    tenantId,
    clientId,
    collectIntakeLookupKeys(baseDocs),
  );

  const items = rows.map((row) => {
    const baseDoc = mapStoredRowToClientDocument(row);
    const enrichedDoc = enrichPortalClientDocument(baseDoc, intakeRows);
    return mapClientDocumentToPortalItem(enrichedDoc, row);
  });

  return { ok: true, data: items };
}

export async function fetchLivePortalDocumentsForClient(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<PortalDocumentListItem[]>> {
  return runService(async () => {
    const settings = await fetchClientPortalSettingsResolved(tenantId, clientId);
    if (!settings.ok) return settings;
    if (!canClientPortalSeeFeature(settings.data, 'documents')) {
      return { ok: true, data: [] };
    }

    return loadPortalVisibleClientDocuments(tenantId, clientId);
  });
}

/** Employee Klientenakten — office-released documents without client-portal feature gate. */
export async function fetchEmployeePortalClientDocuments(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<PortalDocumentListItem[]>> {
  return runService(async () => {
    if (!tenantId.trim() || !clientId.trim()) return { ok: true, data: [] };
    return loadPortalVisibleClientDocuments(tenantId, clientId);
  });
}

async function loadPortalVisibleClientDocumentDetail(
  tenantId: string,
  clientId: string,
  documentId: string,
): Promise<ServiceResult<PortalDocumentDetail>> {
  await syncClientDocumentPortalReleaseIfEnabled(tenantId, clientId);

  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const { data, error } = await fromUnknownTable(supabase, 'client_documents')
    .select(LIST_SELECT)
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('id', documentId)
    .eq('portal_visible', true)
    .in('status', [...PORTAL_CLIENT_DOCUMENT_STATUSES])
    .not('sensitivity', 'in', `(${PORTAL_INTERNAL_SENSITIVITIES.join(',')})`)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return { ok: false, error: 'Dokument nicht gefunden oder nicht freigegeben.' };
    }
    return { ok: false, error: error.message };
  }
  if (!data) {
    const assistProof = await fetchAssistProofPortalDocumentDetail(tenantId, clientId, documentId);
    if (assistProof.ok) return assistProof;
    return { ok: false, error: 'Dokument nicht gefunden oder nicht freigegeben.' };
  }

  const row = data as Record<string, unknown>;
  if (String(row.source ?? '') === 'assist_visit_proof') {
    const assistProof = await fetchAssistProofPortalDocumentDetail(tenantId, clientId, documentId);
    if (assistProof.ok) return assistProof;
  }

  const baseDoc = mapStoredRowToClientDocument(row);
  const intakeRows = await fetchIntakeRowsForPortalDocuments(
    tenantId,
    clientId,
    collectIntakeLookupKeys([baseDoc]),
  );
  const enrichedDoc = enrichPortalClientDocument(baseDoc, intakeRows);
  const item = mapClientDocumentToPortalItem(enrichedDoc, row);

  return { ok: true, data: mapDetail(item, row) };
}

export async function fetchLivePortalDocumentDetail(
  tenantId: string,
  clientId: string,
  documentId: string,
): Promise<ServiceResult<PortalDocumentDetail>> {
  return runService(async () => {
    const settings = await fetchClientPortalSettingsResolved(tenantId, clientId);
    if (!settings.ok) return settings;
    if (!canClientPortalSeeFeature(settings.data, 'documents')) {
      return { ok: false, error: 'Dokument nicht gefunden oder nicht freigegeben.' };
    }

    return loadPortalVisibleClientDocumentDetail(tenantId, clientId, documentId);
  });
}

/** Employee Klientenakten — document detail + HTML preview without client-portal feature gate. */
export async function fetchEmployeePortalClientDocumentDetail(
  tenantId: string,
  clientId: string,
  documentId: string,
): Promise<ServiceResult<PortalDocumentDetail>> {
  return runService(async () => {
    if (!tenantId.trim() || !clientId.trim() || !documentId.trim()) {
      return { ok: false, error: 'Dokument nicht gefunden oder nicht freigegeben.' };
    }
    return loadPortalVisibleClientDocumentDetail(tenantId, clientId, documentId);
  });
}

export async function resolvePortalDocumentDownloadUrl(
  storagePath: string,
): Promise<ServiceResult<string>> {
  return runService(async () => {
    if (!storagePath.trim()) {
      return { ok: false, error: 'Download konnte nicht vorbereitet werden.' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      return { ok: false, error: error?.message ?? 'Download konnte nicht vorbereitet werden.' };
    }

    return { ok: true, data: data.signedUrl };
  });
}

export async function downloadLivePortalDocument(
  tenantId: string,
  clientId: string,
  documentId: string,
): Promise<ServiceResult<{ fileName: string; mimeType: string; downloadUrl: string }>> {
  const detail = await fetchLivePortalDocumentDetail(tenantId, clientId, documentId);
  if (!detail.ok) return detail;
  if (!detail.data.downloadReady) {
    return { ok: false, error: 'Dieses Dokument steht aktuell nicht zum Download bereit.' };
  }

  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'client_documents')
      .select('storage_path')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('id', documentId)
      .maybeSingle();

    if (error || !data) {
      const assistPdf = await getProofPdfForClientPortal(tenantId, clientId, documentId);
      if (assistPdf.ok) {
        const assistDetail = await fetchAssistProofPortalDocumentDetail(tenantId, clientId, documentId);
        if (assistDetail.ok) {
          return {
            ok: true,
            data: {
              fileName: assistDetail.data.fileName,
              mimeType: assistDetail.data.mimeType,
              downloadUrl: assistPdf.data,
            },
          };
        }
      }
      return { ok: false, error: 'Download konnte nicht vorbereitet werden.' };
    }

    const storagePath = String((data as { storage_path?: string | null }).storage_path ?? '');
    const signed = await resolvePortalDocumentDownloadUrl(storagePath);
    if (!signed.ok) return signed;

    return {
      ok: true,
      data: {
        fileName: detail.data.fileName,
        mimeType: detail.data.mimeType,
        downloadUrl: signed.data,
      },
    };
  });
}

export async function countLivePortalDocumentsForClient(
  tenantId: string,
  clientId: string,
): Promise<number> {
  const result = await fetchLivePortalDocumentsForClient(tenantId, clientId);
  return result.ok ? result.data.length : 0;
}
