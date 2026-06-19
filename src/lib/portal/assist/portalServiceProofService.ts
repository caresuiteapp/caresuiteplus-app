import type { ServiceResult } from '@/types';
import type { PortalServiceProof, PortalServiceProofStatus } from '@/types/portal/serviceProofs';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';

const STORAGE_BUCKET = 'office-documents';
const PROOF_CATEGORY = 'leistungsnachweis';
const BILLED_STATUSES = new Set(['billable', 'billed', 'approved']);

const STATUS_LABELS: Record<PortalServiceProofStatus, string> = {
  offen: 'Offen',
  unterschrieben: 'Unterschrieben',
  abgerechnet: 'Abgerechnet',
};

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function formatPeriodLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

function resolveProofStatus(row: Record<string, unknown>): PortalServiceProofStatus {
  const billingStatus = String(row.service_record_status ?? row.billing_status ?? '').toLowerCase();
  if (BILLED_STATUSES.has(billingStatus) || row.billed_at || row.billed_invoice_id) {
    return 'abgerechnet';
  }

  const signedAt = row.signed_at ? String(row.signed_at) : null;
  if (signedAt) return 'unterschrieben';

  const signatureRequired = row.signature_required === true;
  const docStatus = String(row.status ?? '').toLowerCase();
  if (signatureRequired || docStatus === 'unterschrift_offen' || docStatus === 'in_bearbeitung') {
    return 'offen';
  }

  return 'unterschrieben';
}

function mapProofRow(row: Record<string, unknown>): PortalServiceProof {
  const createdAt = String(row.created_at ?? new Date().toISOString());
  const serviceMonth = row.service_month ? String(row.service_month) : null;
  const periodSource = serviceMonth ?? createdAt;

  return {
    id: String(row.id ?? ''),
    tenantId: String(row.tenant_id ?? ''),
    clientId: String(row.client_id ?? ''),
    title: String(row.title ?? 'Leistungsnachweis'),
    periodLabel: formatPeriodLabel(periodSource),
    status: resolveProofStatus(row),
    fileName: String(row.file_name ?? 'nachweis.pdf'),
    mimeType: String(row.mime_type ?? 'application/pdf'),
    storagePath: row.storage_path ? String(row.storage_path) : null,
    signatureRequired: row.signature_required === true,
    signedAt: row.signed_at ? String(row.signed_at) : null,
    createdAt,
    serviceRecordId: row.service_record_id ? String(row.service_record_id) : null,
  };
}

export function resolvePortalServiceProofStatusLabel(status: PortalServiceProofStatus): string {
  return STATUS_LABELS[status] ?? status;
}

/** Released Leistungsnachweise for portal client — client_documents with portal_visible. */
export async function listPortalServiceProofs(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<PortalServiceProof[]>> {
  return runService(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const documentResult = await fromUnknownTable(supabase, 'client_documents')
      .select(
        'id, tenant_id, client_id, title, file_name, mime_type, storage_path, category, status, portal_visible, signature_required, signed_at, service_record_id, service_month, created_at',
      )
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('portal_visible', true)
      .eq('category', PROOF_CATEGORY)
      .eq('status', 'aktiv')
      .order('created_at', { ascending: false });

    if (!documentResult.error && (documentResult.data?.length ?? 0) > 0) {
      const proofs = (documentResult.data ?? []).map((row) =>
        mapProofRow(row as Record<string, unknown>),
      );
      return { ok: true, data: proofs };
    }

    if (documentResult.error && !isMissingTableError(documentResult.error)) {
      console.warn('[portalServiceProofs] client_documents:', documentResult.error.message);
    }

    const serviceRecordResult = await supabase
      .from('service_records')
      .select(
        'id, tenant_id, client_id, record_number, service_date, service_month, status, pdf_url, created_at',
      )
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .in('status', ['signature_required', 'signed', 'approved', 'billable', 'billed'])
      .order('service_date', { ascending: false });

    if (serviceRecordResult.error) {
      if (isMissingTableError(serviceRecordResult.error)) {
        return { ok: true, data: [] };
      }
      return { ok: false, error: serviceRecordResult.error.message };
    }

    const proofs = (serviceRecordResult.data ?? []).map((row) => {
      const record = row as Record<string, unknown>;
      const serviceDate = String(record.service_date ?? record.created_at ?? '');
      return mapProofRow({
        id: record.id,
        tenant_id: record.tenant_id,
        client_id: record.client_id,
        title: record.record_number
          ? `Leistungsnachweis ${record.record_number}`
          : 'Leistungsnachweis',
        file_name: record.pdf_url ? `${record.id}.pdf` : 'nachweis.pdf',
        mime_type: 'application/pdf',
        storage_path: record.pdf_url,
        category: PROOF_CATEGORY,
        status: 'aktiv',
        portal_visible: true,
        service_record_status: record.status,
        service_month: record.service_month ?? serviceDate,
        service_record_id: record.id,
        created_at: record.created_at ?? serviceDate,
      });
    });

    return { ok: true, data: proofs };
  });
}

export async function countOpenPortalServiceProofs(
  tenantId: string,
  clientId: string,
): Promise<number> {
  const result = await listPortalServiceProofs(tenantId, clientId);
  if (!result.ok) return 0;
  return result.data.filter((proof) => proof.status === 'offen').length;
}

/** Signed download URL for a released proof PDF (live Supabase Storage). */
export async function resolvePortalServiceProofDownloadUrl(
  proof: Pick<PortalServiceProof, 'storagePath' | 'mimeType'>,
): Promise<ServiceResult<string>> {
  return runService(async () => {
    if (!proof.storagePath?.trim()) {
      return { ok: false, error: 'PDF ist noch nicht verfügbar.' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(proof.storagePath, 3600);

    if (error || !data?.signedUrl) {
      return { ok: false, error: error?.message ?? 'Download konnte nicht vorbereitet werden.' };
    }

    return { ok: true, data: data.signedUrl };
  });
}
