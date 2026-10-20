import type { ServiceResult } from '@/types';
import type { ClientInternalNote } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';

/** Office-only: Interne Notizen laden */
export async function fetchClientInternalNotes(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientInternalNote[]>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().fetchInternalNotes(tenantId, clientId);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    return { ok: true, data: full.internalNotes };
  }, { delayMs: 200 });
}

/**
 * Portal-Query — liefert IMMER leeres Array.
 * Interne Notizen dürfen niemals im Portal erscheinen.
 */
export async function fetchClientNotesForPortal(
  _tenantId: string,
  _clientId: string,
): Promise<ServiceResult<ClientInternalNote[]>> {
  return runService(async () => {
    return { ok: true, data: [] };
  }, { delayMs: 100 });
}

export async function createClientInternalNote(
  tenantId: string,
  clientId: string,
  content: string,
  createdBy: string,
  category: ClientInternalNote['category'] = 'allgemein',
): Promise<ServiceResult<ClientInternalNote>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().createInternalNote(
        tenantId,
        clientId,
        content,
        createdBy,
        category,
      );
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const now = new Date().toISOString();
    const note: ClientInternalNote = {
      id: `note-${clientId}-${Date.now()}`,
      clientId,
      tenantId,
      content,
      isInternal: true,
      createdBy,
      createdAt: now,
      updatedAt: now,
      category,
    };
    upsertDemoClientFullDetail({
      ...full,
      internalNotes: [note, ...full.internalNotes],
      updatedAt: now,
    });
    return { ok: true, data: note };
  }, { delayMs: 250 });
}
