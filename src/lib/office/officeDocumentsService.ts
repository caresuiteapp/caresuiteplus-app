import type { RoleKey, ServiceResult } from '@/types';
import type { PortalDocumentCategory, PortalDocumentListItem } from '@/types/portal/documents';
import type { DataVisibilityScope } from '@/types/portal/visibility';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { demoPortalDocuments } from '@/data/demo/documents';
import { mergeClientRecordDocuments } from '@/lib/clients/clientDocumentMerge';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { mapClientDocument } from '@/lib/supabase/mappers/clientExtendedMapper';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  buildStorageObjectFileName,
  buildTenantStoragePath,
  toStorageUploadError,
} from '@/lib/storage/storagePaths';

const OFFICE_DOCUMENTS_BUCKET = 'office-documents';

export type OfficeDocumentItem = {
  id: string;
  title: string;
  category: string;
  status: string;
};

const SIMULATED_DELAY_MS = 280;
const LIST_LIMIT = 100;

const CLIENT_DOCUMENTS_SELECT =
  'id, tenant_id, client_id, title, file_name, mime_type, category, storage_path, status, sensitivity, uploaded_by, valid_until, created_at, updated_at';

const INTAKE_DOCUMENTS_SELECT =
  'id, tenant_id, client_id, template_key, document_type, title, status, finalized_html, preview_html, finalized_at, created_at, updated_at';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapDemoDocument(
  doc: (typeof demoPortalDocuments)[number],
): PortalDocumentListItem {
  return {
    id: doc.id,
    title: doc.title,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    category: doc.category,
    fileSizeBytes: doc.fileSizeBytes,
    status: doc.status,
    updatedAt: doc.updatedAt,
    visibility: doc.visibility,
    sensitivity: doc.sensitivity,
  };
}

function mapClientCategoryToPortal(category: ClientDocumentRecord['category']): PortalDocumentCategory {
  switch (category) {
    case 'pflegeplan':
      return 'care_plan';
    case 'einwilligung':
      return 'consent';
    case 'arztbrief':
    case 'md_gutachten':
      return 'report';
    default:
      return 'other';
  }
}

function resolveVisibility(row: Record<string, unknown>): DataVisibilityScope {
  if (row.portal_visible === true) return 'shared';
  return 'team';
}

function mapClientDocumentToPortalItem(doc: ClientDocumentRecord, row?: Record<string, unknown>): PortalDocumentListItem {
  return {
    id: doc.id,
    title: doc.title,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    category: mapClientCategoryToPortal(doc.category),
    fileSizeBytes: Number(row?.size_bytes ?? 0),
    status: doc.status,
    updatedAt: doc.updatedAt,
    visibility: row ? resolveVisibility(row) : 'team',
    sensitivity: doc.sensitivity,
  };
}

async function fetchTenantOfficeDocumentsFromSupabase(
  tenantId: string,
): Promise<ServiceResult<PortalDocumentListItem[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const [documents, intakeDocuments] = await Promise.all([
    fromUnknownTable(supabase, 'client_documents')
      .select(CLIENT_DOCUMENTS_SELECT)
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(LIST_LIMIT),
    fromUnknownTable(supabase, 'client_intake_documents')
      .select(INTAKE_DOCUMENTS_SELECT)
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(LIST_LIMIT),
  ]);

  if (documents.error) return { ok: false, error: toGermanSupabaseError(documents.error) };
  if (intakeDocuments.error) return { ok: false, error: toGermanSupabaseError(intakeDocuments.error) };

  const storedRows = (documents.data ?? []) as Record<string, unknown>[];
  const storedDocs = storedRows.map((row) =>
    mapClientDocumentToPortalItem(mapClientDocument(row as Parameters<typeof mapClientDocument>[0]), row),
  );

  const merged = mergeClientRecordDocuments(
    storedRows.map((row) => mapClientDocument(row as Parameters<typeof mapClientDocument>[0])),
    (intakeDocuments.data ?? []) as Parameters<typeof mergeClientRecordDocuments>[1],
  );

  const storedIds = new Set(storedDocs.map((doc) => doc.id));
  const intakeItems = merged
    .filter((doc) => !storedIds.has(doc.id))
    .map((doc) => mapClientDocumentToPortalItem(doc));

  return { ok: true, data: [...storedDocs, ...intakeItems].slice(0, LIST_LIMIT) };
}

export async function fetchOfficeDocumentList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PortalDocumentListItem[]>> {
  const denied = enforcePermission<PortalDocumentListItem[]>(
    actorRoleKey,
    'office.documents.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return fetchTenantOfficeDocumentsFromSupabase(tenantId);
  }

  await delay(SIMULATED_DELAY_MS);
  const data = demoPortalDocuments
    .filter((doc) => doc.audienceScope === 'office')
    .map(mapDemoDocument);
  return { ok: true, data };
}

const DEMO_DOCUMENTS: OfficeDocumentItem[] = [
  { id: 'doc-001', title: 'Pflegevertrag Müller', category: 'Vertrag', status: 'aktiv' },
  { id: 'doc-002', title: 'Leistungsnachweis April', category: 'Nachweis', status: 'in_bearbeitung' },
  { id: 'doc-003', title: 'Rechnungsanhang #1042', category: 'Abrechnung', status: 'entwurf' },
];

export type OfficeDocumentUploadInput = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  category?: string;
  /** Base64 oder URI-Inhalt — in Live-Modus als Blob hochladen */
  contentBase64?: string;
};

export async function fetchOfficeDocumentsDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ total: number; byCategory: Record<string, number>; items: OfficeDocumentItem[] }>> {
  const denied = enforcePermission<{ total: number; byCategory: Record<string, number>; items: OfficeDocumentItem[] }>(
    actorRoleKey,
    'office.documents.view' as never,
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const list = await fetchTenantOfficeDocumentsFromSupabase(tenantId);
    if (!list.ok) return list;
    const items: OfficeDocumentItem[] = list.data.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      status: row.status,
    }));
    const byCategory = items.reduce<Record<string, number>>((acc, d) => {
      acc[d.category] = (acc[d.category] ?? 0) + 1;
      return acc;
    }, {});
    return { ok: true, data: { total: items.length, byCategory, items } };
  }

  await new Promise((r) => setTimeout(r, 150));
  const byCategory = DEMO_DOCUMENTS.reduce<Record<string, number>>((acc, d) => {
    acc[d.category] = (acc[d.category] ?? 0) + 1;
    return acc;
  }, {});
  return { ok: true, data: { total: DEMO_DOCUMENTS.length, byCategory, items: DEMO_DOCUMENTS } };
}

export function buildOfficeDocumentStoragePath(
  tenantId: string,
  documentId: string,
  fileName: string,
): string {
  const storageFileName = buildStorageObjectFileName(documentId, fileName);
  return buildTenantStoragePath(tenantId, 'office', 'documents', documentId, storageFileName);
}

export async function uploadOfficeDocument(
  tenantId: string,
  input: OfficeDocumentUploadInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string; storagePath: string }>> {
  const denied = enforcePermission<{ id: string; storagePath: string }>(
    actorRoleKey,
    'office.documents.upload' as never,
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.filename.trim()) {
    return { ok: false, error: 'Dateiname ist Pflicht.' };
  }

  if (getServiceMode() === 'supabase') {
    if (!input.contentBase64 || input.sizeBytes <= 0) {
      return { ok: false, error: 'Bitte zuerst eine Datei auswählen.' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const docId = crypto.randomUUID?.() ?? `doc-${Date.now()}`;
    const storagePath = buildOfficeDocumentStoragePath(tenantId, docId, input.filename.trim());
    const payload = Uint8Array.from(atob(input.contentBase64), (c) => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from(OFFICE_DOCUMENTS_BUCKET)
      .upload(storagePath, payload, {
        contentType: input.mimeType,
        upsert: false,
      });
    if (uploadError) {
      return { ok: false, error: toStorageUploadError(uploadError.message) };
    }

    return { ok: true, data: { id: docId, storagePath } };
  }

  await new Promise((r) => setTimeout(r, 300));
  const demoId = `doc-demo-${Date.now()}`;
  return {
    ok: true,
    data: {
      id: demoId,
      storagePath: buildOfficeDocumentStoragePath(tenantId, demoId, input.filename.trim()),
    },
  };
}
