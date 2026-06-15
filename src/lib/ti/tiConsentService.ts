import type { RoleKey, ServiceResult } from '@/types';
import type { TIConsent, TIConsentCheckResult, TIConsentStatus } from '@/types/modules/ti';
import {
  TI_DEMO_TENANT,
  appendTIAuditEvent,
  getTIConsents,
  grantTIConsent,
  revokeTIConsent,
} from '@/data/demo/ti';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { tiConsentsSupabaseRepository } from './repositories';
import { appendTIAudit } from './tiAuditService';

function isConsentValid(consent: TIConsent): boolean {
  if (consent.status !== 'granted') return false;
  if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) return false;
  return true;
}

export async function fetchTIConsents(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TIConsent[]>> {
  const denied = enforcePermission<TIConsent[]>(actorRoleKey, 'ti.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    return tiConsentsSupabaseRepository.list(tenantId);
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
  await new Promise((r) => setTimeout(r, 120));
  return { ok: true, data: getTIConsents() };
}

export async function checkTIConsent(
  tenantId: string,
  scopes: TIConsent['scope'][],
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TIConsentCheckResult>> {
  const denied = enforcePermission<TIConsentCheckResult>(actorRoleKey, 'ti.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  let consents: TIConsent[];
  if (getServiceMode() === 'supabase') {
    const result = await tiConsentsSupabaseRepository.list(tenantId);
    if (!result.ok) return result;
    consents = result.data;
  } else {
    if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };
    consents = getTIConsents();
  }

  const missingScopes = scopes.filter(
    (scope) => !consents.some((c) => c.scope === scope && isConsentValid(c)),
  );

  const generalOk = consents.some((c) => c.scope === 'ti_general' && isConsentValid(c));
  if (!generalOk && missingScopes.length === 0) {
    missingScopes.push('ti_general');
  }

  return {
    ok: true,
    data: {
      hasConsent: missingScopes.length === 0 && generalOk,
      missingScopes,
      blockedReason:
        missingScopes.length > 0
          ? `Fehlende Einwilligung für: ${missingScopes.join(', ')}`
          : null,
    },
  };
}

export async function grantTIConsentService(
  tenantId: string,
  consentId: string,
  grantedBy: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TIConsent>> {
  const denied = enforcePermission<TIConsent>(actorRoleKey, 'ti.consent.manage');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const updated = await tiConsentsSupabaseRepository.updateStatus(tenantId, consentId, {
      status: 'granted',
      grantedAt: new Date().toISOString(),
      grantedBy,
    });
    if (!updated.ok) return updated;
    await appendTIAudit(
      tenantId,
      'consent_granted',
      grantedBy,
      'ti_consent',
      consentId,
      `Einwilligung erteilt (Version ${updated.data.version})`,
      actorRoleKey,
    );
    return updated;
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };

  const updated = grantTIConsent(consentId, grantedBy);
  if (!updated) return { ok: false, error: 'Einwilligung nicht gefunden.' };

  appendTIAuditEvent({
    tenantId,
    action: 'consent_granted',
    actorId: null,
    actorName: grantedBy,
    resourceType: 'ti_consent',
    resourceId: consentId,
    details: `Einwilligung erteilt (Version ${updated.version})`,
    ipAddress: null,
  });

  return { ok: true, data: updated };
}

export async function revokeTIConsentService(
  tenantId: string,
  consentId: string,
  actorName: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TIConsent>> {
  const denied = enforcePermission<TIConsent>(actorRoleKey, 'ti.consent.manage');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const updated = await tiConsentsSupabaseRepository.updateStatus(tenantId, consentId, {
      status: 'revoked',
      grantedAt: null,
      grantedBy: null,
    });
    if (!updated.ok) return updated;
    await appendTIAudit(
      tenantId,
      'consent_revoked',
      actorName,
      'ti_consent',
      consentId,
      'Einwilligung widerrufen',
      actorRoleKey,
    );
    return updated;
  }

  if (tenantId !== TI_DEMO_TENANT) return { ok: false, error: 'Mandant nicht gefunden.' };

  const updated = revokeTIConsent(consentId);
  if (!updated) return { ok: false, error: 'Einwilligung nicht gefunden.' };

  appendTIAuditEvent({
    tenantId,
    action: 'consent_revoked',
    actorId: null,
    actorName,
    resourceType: 'ti_consent',
    resourceId: consentId,
    details: 'Einwilligung widerrufen',
    ipAddress: null,
  });

  return { ok: true, data: updated };
}

export function getConsentStatusLabel(status: TIConsentStatus): string {
  const labels: Record<TIConsentStatus, string> = {
    pending: 'Ausstehend',
    granted: 'Erteilt',
    revoked: 'Widerrufen',
    expired: 'Abgelaufen',
  };
  return labels[status];
}
