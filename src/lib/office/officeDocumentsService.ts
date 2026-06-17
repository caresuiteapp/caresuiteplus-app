import type { RoleKey, ServiceResult } from '@/types';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import type { DataVisibilityScope } from '@/types/portal/visibility';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { demoClients } from '@/data/demo/clients';
import { demoPortalDocuments } from '@/data/demo/documents';
import { mergeClientRecordDocuments } from '@/lib/clients/clientDocumentMerge';
import {
  formatOfficeClientName,
  resolveOfficeDocumentDisplayFileName,
  resolveOfficeDocumentSizeLabel,
  resolveOfficeDocumentTitle,
  resolvePortalDocumentCategory,
} from '@/lib/office/officeDocumentDisplay';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { mapClientDocument } from '@/lib/supabase/mappers/clientExtendedMapper';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type OfficeDocumentItem = {
  id: string;
  title: string;
  category: string;
  status: string;
};

const SIMULATED_DELAY_MS = 280;
const LIST_LIMIT = 100;

const CLIENT_DOCUMENTS_SELECT =
  'id, tenant_id, client_id, title, file_name, mime_type, category, storage_path, status, sensitivity, uploaded_by, valid_until, created_at, updated_at, source, intake_document_id';

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
    displayFileName: doc.fileName,
    sizeLabel: null,
  };
}

function resolveDemoClientName(clientId: string | null | undefined): string | null {
  if (!clientId) return null;
  const client = demoClients.find((entry) => entry.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : null;
}

function resolveVisibility(row: Record<string, unknown>): DataVisibilityScope {
  if (row.portal_visible === true) return 'shared';
  return 'team';
}

function mapClientDocumentToPortalItem(
  doc: ClientDocumentRecord,
  row?: Record<string, unknown>,
  clientName?: string | null,
): PortalDocumentListItem {
  const fileSizeBytes = Number(row?.size_bytes ?? 0);
  return {
    id: doc.id,
    title: resolveOfficeDocumentTitle(doc),
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    category: resolvePortalDocumentCategory(doc),
    fileSizeBytes,
    status: doc.status,
    updatedAt: doc.updatedAt,
    visibility: row ? resolveVisibility(row) : 'team',
    sensitivity: doc.sensitivity,
    clientId: doc.clientId,
    clientName: clientName ?? null,
    previewHtml: doc.previewHtml ?? null,
    documentSource: doc.documentSource,
    displayFileName: resolveOfficeDocumentDisplayFileName(doc),
    sizeLabel: resolveOfficeDocumentSizeLabel(doc, fileSizeBytes),
  };
}

async function fetchClientNameMap(
  tenantId: string,
  clientIds: string[],
): Promise<Map<string, string>> {
  if (clientIds.length === 0) return new Map();

  const supabase = getSupabaseClient();
  if (!supabase) return new Map();

  const { data, error } = await fromUnknownTable(supabase, 'clients')
    .select('id, first_name, last_name')
    .eq('tenant_id', tenantId)
    .in('id', clientIds);

  if (error || !data) return new Map();

  return new Map(
    (data as Array<{ id: string; first_name?: string | null; last_name?: string | null }>).map((row) => [
      row.id,
      formatOfficeClientName(row.first_name, row.last_name) ?? 'Unbekannt',
    ]),
  );
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
  const storedMapped = storedRows.map((row) =>
    mapClientDocument(row as Parameters<typeof mapClientDocument>[0]),
  );

  const merged = mergeClientRecordDocuments(
    storedMapped,
    (intakeDocuments.data ?? []) as Parameters<typeof mergeClientRecordDocuments>[1],
  );

  const mergedById = new Map(merged.map((doc) => [doc.id, doc]));
  const storedIds = new Set(storedMapped.map((doc) => doc.id));
  const intakeOnlyDocs = merged.filter((doc) => !storedIds.has(doc.id));
  const clientIds = [...new Set(merged.map((doc) => doc.clientId).filter(Boolean))];
  const clientNames = await fetchClientNameMap(tenantId, clientIds);

  const storedItems = storedRows.map((row) => {
    const doc = mergedById.get(String(row.id))
      ?? mapClientDocument(row as Parameters<typeof mapClientDocument>[0]);
    return mapClientDocumentToPortalItem(
      doc,
      row,
      clientNames.get(String(row.client_id)) ?? null,
    );
  });

  const intakeItems = intakeOnlyDocs.map((doc) =>
    mapClientDocumentToPortalItem(doc, undefined, clientNames.get(doc.clientId) ?? null),
  );

  return { ok: true, data: [...storedItems, ...intakeItems].slice(0, LIST_LIMIT) };
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
    return {
      ok: false,
      error: 'Office-Uploads sind in Live derzeit über die Klientenakte verfügbar.',
    };
  }

  await new Promise((r) => setTimeout(r, 300));
  return {
    ok: true,
    data: {
      id: `doc-demo-${Date.now()}`,
      storagePath: `demo://${input.filename}`,
    },
  };
}
