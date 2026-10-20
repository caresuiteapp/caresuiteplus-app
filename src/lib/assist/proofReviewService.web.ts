import type { ServiceResult } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import type { ReviewDataset, ReviewVisit, ReviewDocument, ReviewSignature } from './proofReviewModel.web';

type DbProof = {
  id: string; tenant_id: string; visit_id: string; signature_id: string | null;
  proof_number: string | null; status: AssistVisitProofRow['status']; storage_path: string | null;
  payload_snapshot: Record<string, unknown>; payload_hash: string | null;
  generated_at: string | null; generated_by: string | null; approved_at: string | null; approved_by: string | null;
  billing_released: boolean; portal_visible: boolean; released_to_portal_at: string | null;
  portal_release_status: AssistVisitProofRow['portalReleaseStatus']; approval_note: string | null;
  rejection_reason: string | null; pdf_storage_path: string | null; pdf_hash: string | null;
  created_at: string; updated_at: string;
};
function mapProof(p: DbProof): AssistVisitProofRow {
  return {
    id: p.id, tenantId: p.tenant_id, visitId: p.visit_id, signatureId: p.signature_id,
    proofNumber: p.proof_number, status: p.status, storagePath: p.storage_path,
    payloadSnapshot: p.payload_snapshot ?? {}, payloadHash: p.payload_hash, generatedAt: p.generated_at,
    generatedBy: p.generated_by, approvedAt: p.approved_at, approvedBy: p.approved_by,
    billingReleased: p.billing_released, portalVisible: p.portal_visible ?? false,
    releasedToPortalAt: p.released_to_portal_at, portalReleaseStatus: p.portal_release_status ?? 'none',
    approvalNote: p.approval_note, rejectionReason: p.rejection_reason, pdfStoragePath: p.pdf_storage_path,
    pdfHash: p.pdf_hash, createdAt: p.created_at, updatedAt: p.updated_at,
  };
}

/** Page every source completely. A failed source must never turn an existing proof into a missing one. */
export async function loadProofReviewDataset(tenantId: string): Promise<ServiceResult<ReviewDataset>> {
  if (!tenantId) return { ok: false, error: 'Kein Unternehmen ausgewählt.' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Die Datenverbindung ist nicht verfügbar.' };
  async function allRows<T>(table: string, columns: string, ids?: string[]): Promise<T[]> {
    const rows: T[] = [];
    let total: number | null = null;
    do {
      let query = fromUnknownTable(client!, table).select(columns, { count: 'exact' })
        .eq('tenant_id', tenantId).order('id', { ascending: true }).range(rows.length, rows.length + 499);
      if (ids) query = query.in('id', ids);
      const { data, error, count } = await query;
      if (error) throw new Error(toGermanSupabaseError(error));
      const page = (data ?? []) as unknown as T[];
      if (typeof count !== 'number') throw new Error('Die Vollständigkeit der Nachweisdaten konnte nicht bestätigt werden. Bitte erneut laden.');
      if (total !== null && count !== total) throw new Error('Die Nachweisdaten wurden während des Ladens geändert. Bitte aktualisieren.');
      total = count;
      if (!page.length && rows.length < total) throw new Error('Die Nachweisdaten wurden unvollständig übertragen. Bitte erneut laden.');
      rows.push(...page);
    } while (rows.length < total!);
    return rows;
  }
  try {
    const [proofs, visits, signatures] = await Promise.all([
      allRows<DbProof>('assist_visit_proofs', '*'),
      allRows<ReviewVisit>('assist_visits', 'id,client_id,legacy_assignment_id,planned_start_at,planned_end_at,actual_start_at,actual_end_at,execution_status,planning_status,canonical_status,title,service_name,clients(first_name,last_name),employees(first_name,last_name)'),
      allRows<ReviewSignature>('assist_visit_signatures', 'id,visit_id,signed_at,signer_name,is_valid,metadata'),
    ]);
    const documents: ReviewDocument[] = [];
    for (let offset = 0; offset < proofs.length; offset += 100) {
      documents.push(...await allRows<ReviewDocument>('client_documents', 'id,client_id,portal_visible,status,created_at,signed_at,signature_required', proofs.slice(offset, offset + 100).map(p => p.id)));
    }
    return { ok: true, data: { proofs: proofs.map(mapProof), visits, documents, signatures, loadedAt: new Date().toISOString() } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Nachweise konnten nicht vollständig geladen werden.' };
  }
}
