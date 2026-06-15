import type { RoleKey, ServiceResult } from '@/types';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { demoPortalDocuments } from '@/data/demo/documents';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { buildTenantStoragePath } from '@/lib/storage/storagePaths';

export type OfficeDocumentItem = {
  id: string;
  title: string;
  category: string;
  status: string;
};

const BUCKET = 'office-documents';

const SIMULATED_DELAY_MS = 280;

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

function mapSupabaseRow(row: Record<string, unknown>): PortalDocumentListItem {
  return {
    id: String(row.id),
    title: String(row.title ?? 'Dokument'),
    fileName: String(row.file_name ?? row.title ?? 'dokument'),
    mimeType: String(row.mime_type ?? 'application/octet-stream'),
    category: (row.category as PortalDocumentListItem['category']) ?? 'other',
    fileSizeBytes: Number(row.size_bytes ?? 0),
    status: (row.status as PortalDocumentListItem['status']) ?? 'entwurf',
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
    visibility: (row.visibility as PortalDocumentListItem['visibility']) ?? 'team',
    sensitivity: (row.sensitivity as PortalDocumentListItem['sensitivity']) ?? 'internal',
  };
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
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    const { data, error } = await fromUnknownTable(supabase, 'client_documents')
      .select(
        'id, title, file_name, mime_type, category, size_bytes, status, updated_at, visibility, sensitivity',
      )
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []).map((row) => mapSupabaseRow(row as Record<string, unknown>)) };
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
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
    const { data, error } = await fromUnknownTable(supabase, 'client_documents')
      .select('id, title, category, status')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const items: OfficeDocumentItem[] = (data ?? []).map((row) => ({
      id: String((row as { id: string }).id),
      title: String((row as { title: string }).title ?? 'Dokument'),
      category: String((row as { category?: string }).category ?? 'Allgemein'),
      status: String((row as { status?: string }).status ?? 'entwurf'),
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

  if (getServiceMode() === 'supabase' && input.sizeBytes <= 0) {
    return { ok: false, error: 'Datei ist leer oder wurde nicht ausgewählt.' };
  }

  if (getServiceMode() === 'supabase' && !input.contentBase64) {
    return { ok: false, error: 'Dateiinhalt fehlt — bitte Dokument erneut auswählen.' };
  }

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const docId = `doc-${Date.now()}`;
    const storagePath = buildTenantStoragePath(tenantId, 'office', 'documents', docId, input.filename);
    const payload = input.contentBase64
      ? Uint8Array.from(atob(input.contentBase64), (c) => c.charCodeAt(0))
      : new Uint8Array();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, payload, {
        contentType: input.mimeType,
        upsert: false,
      });
    if (uploadError) return { ok: false, error: uploadError.message || 'Storage-Upload fehlgeschlagen.' };

    const { data, error } = await fromUnknownTable(supabase, 'client_documents')
      .insert({
        id: docId,
        tenant_id: tenantId,
        title: input.filename,
        category: input.category ?? 'Allgemein',
        status: 'entwurf',
        storage_path: storagePath,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
      })
      .select('id')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: String((data as { id: string }).id), storagePath } };
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
