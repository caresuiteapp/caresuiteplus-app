import type { ServiceResult } from '@/types';
import type { ClientConsentRecord } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';

export async function fetchClientConsents(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientConsentRecord[]>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().fetchConsents(tenantId, clientId);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    return { ok: true, data: full.consents };
  }, { delayMs: 200 });
}

export async function updateClientConsent(
  tenantId: string,
  clientId: string,
  consentId: string,
  granted: boolean,
  grantedByProfileId?: string,
): Promise<ServiceResult<ClientConsentRecord>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().updateConsent(
        tenantId,
        clientId,
        consentId,
        granted,
        grantedByProfileId,
      );
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const idx = full.consents.findIndex((c) => c.id === consentId);
    if (idx < 0) return { ok: false, error: 'Einwilligung nicht gefunden.' };

    const now = new Date().toISOString();
    const updated: ClientConsentRecord = {
      ...full.consents[idx],
      granted,
      grantedAt: granted ? now : null,
      grantedByProfileId: granted ? (grantedByProfileId ?? null) : null,
      updatedAt: now,
    };
    const consents = [...full.consents];
    consents[idx] = updated;
    upsertDemoClientFullDetail({ ...full, consents, updatedAt: now });
    return { ok: true, data: updated };
  }, { delayMs: 250 });
}

/** Prüft ob medizinische/Portal-Einwilligungen für Datenfreigabe vorliegen */
export function hasRequiredConsents(consents: ClientConsentRecord[]): {
  datenschutz: boolean;
  portal: boolean;
  medical: boolean;
} {
  const granted = (type: ClientConsentRecord['consentType']) =>
    consents.some((c) => c.consentType === type && c.granted);
  return {
    datenschutz: granted('datenschutz'),
    portal: granted('portal_zugang') || granted('portal_angehoerige'),
    medical: granted('medizinische_daten'),
  };
}
