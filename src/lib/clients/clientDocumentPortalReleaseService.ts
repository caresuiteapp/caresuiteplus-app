import type { ServiceResult } from '@/types';
import { promoteFinalizedIntakeDocumentsToClientRecord } from '@/features/intakeDocuments/intakeDocumentRepository';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { runService } from '@/lib/services/serviceRunner';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  PORTAL_CLIENT_DOCUMENT_STATUSES,
  PORTAL_INTERNAL_SENSITIVITIES,
} from './clientDocumentPortalVisibility';

/** Marks client-facing client_documents as portal-visible when Dokumente is enabled. */
export async function releaseClientDocumentsForPortal(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<{ updated: number }>> {
  return runService(async () => {
    const denied = guardServiceTenant(tenantId);
    if (denied) return denied;

    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

    const promote = await promoteFinalizedIntakeDocumentsToClientRecord(tenantId, clientId);
    if (!promote.ok) return promote;

    const { data, error } = await fromUnknownTable(supabase, 'client_documents')
      .update({ portal_visible: true })
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .in('status', [...PORTAL_CLIENT_DOCUMENT_STATUSES])
      .eq('portal_visible', false)
      .not('sensitivity', 'in', `(${PORTAL_INTERNAL_SENSITIVITIES.join(',')})`)
      .select('id');

    if (error) return { ok: false, error: toGermanSupabaseError(error) };

    return { ok: true, data: { updated: data?.length ?? 0 } };
  });
}
