import type { ServiceResult } from '@/types';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { getServiceMode } from '@/lib/services/mode';
import { resolveIntakeTemplateKey } from '@/lib/office/officeDocumentDisplay';
import { isHtmlDocumentMimeType } from '@/lib/documents/documentPdfFileName';
import { enrichClientDocumentWithIntakeRows } from './clientDocumentMerge';
export { MISSING_DOCUMENT_CONTENT_MESSAGE } from '@/lib/documents/documentPdfLogic';

/** Read the persisted snapshot, never reconstruct a signed contract from a current template. */
export async function loadClientDocumentContent(input: {
  doc: ClientDocumentRecord;
  tenantId: string;
  clientId: string;
}): Promise<ServiceResult<ClientDocumentRecord>> {
  const { doc, tenantId, clientId } = input;
  if (!tenantId || !clientId || doc.tenantId !== tenantId || doc.clientId !== clientId) {
    return { ok: false, error: 'Das Dokument gehört nicht zu dieser Klientenakte.' };
  }
  if (doc.previewHtml?.trim() || !isHtmlDocumentMimeType(doc.mimeType)
    || doc.storagePath || getServiceMode() !== 'supabase') return { ok: true, data: doc };

  const templateKey = resolveIntakeTemplateKey(doc);
  if (!doc.intakeDocumentId && !templateKey) return { ok: true, data: doc };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Dokumentinhalt konnte nicht geladen werden.' };
  let query = fromUnknownTable(supabase, 'client_intake_documents')
    .select('id, tenant_id, client_id, template_key, document_type, title, status, finalized_html, preview_html, rendered_pdf_path')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId);
  query = doc.intakeDocumentId
    ? query.eq('id', doc.intakeDocumentId)
    : query.eq('template_key', templateKey);
  const { data, error } = await query.maybeSingle();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (!data) return { ok: false, error: 'Das gespeicherte Dokument konnte nicht geladen werden.' };
  return { ok: true, data: enrichClientDocumentWithIntakeRows(doc, [data]) };
}
