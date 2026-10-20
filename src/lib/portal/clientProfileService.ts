import type { RoleKey, ServiceResult } from '@/types';
import type {
  PortalClientCarePlanSummary,
  PortalClientProfile,
} from '@/types/portal/client';
import {
  getDemoClientCarePlanSummaries,
  getDemoClientPortalProfile,
} from '@/data/demo/portalClient';
import { enforcePermission } from '@/lib/permissions';
import { runService } from '@/lib/services/serviceRunner';
import { getServiceMode } from '@/lib/services/mode';
import {
  fetchLiveClientCarePlanSummaries,
  fetchLiveClientPortalProfile,
  type ClientPortalAccessSummary,
} from './clientProfileLiveService';
import { getPortalProfileLink } from './portalVisibility';

const SIMULATED_DELAY_MS = 350;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isClientPortalRole(roleKey: RoleKey | null): boolean {
  return roleKey === 'client_portal' || roleKey === 'family_portal';
}

function enforceClientPortalProfileAccess(
  roleKey: RoleKey | null,
): ServiceResult<never> | null {
  if (!roleKey) {
    return { ok: false, error: 'Sie sind nicht angemeldet. Bitte melden Sie sich an.' };
  }
  if (isClientPortalRole(roleKey)) {
    return enforcePermission(roleKey, 'portal.client.profile.view');
  }
  return enforcePermission(roleKey, 'office.clients.view');
}

function enforceClientCarePlanAccess(
  roleKey: RoleKey | null,
): ServiceResult<never> | null {
  if (!roleKey) {
    return { ok: false, error: 'Sie sind nicht angemeldet. Bitte melden Sie sich an.' };
  }
  if (isClientPortalRole(roleKey)) {
    return enforcePermission(roleKey, 'portal.client.careplan.view');
  }
  return enforcePermission(roleKey, 'office.clients.view');
}

export type FetchClientPortalProfileParams = {
  profileId: string;
  tenantId?: string | null;
  clientId?: string | null;
  roleKey: RoleKey | null;
};

export type ClientPortalProfileResult = {
  profile: PortalClientProfile;
  portalAccess: ClientPortalAccessSummary | null;
};

export async function fetchClientPortalProfile(
  params: FetchClientPortalProfileParams,
): Promise<ServiceResult<ClientPortalProfileResult>> {
  const { profileId, tenantId, clientId, roleKey } = params;
  const denied = enforceClientPortalProfileAccess(roleKey);
  if (denied) return denied;

  if (getServiceMode() === 'supabase' && tenantId?.trim() && clientId?.trim()) {
    const live = await fetchLiveClientPortalProfile(tenantId, clientId);
    if (!live.ok) return live;
    return { ok: true, data: live.data };
  }

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    const resolvedClientId = clientId ?? getPortalProfileLink(profileId).clientId;
    if (!resolvedClientId) {
      return { ok: false, error: 'Kein Klient:innenprofil mit diesem Portal verknüpft.' };
    }

    const profile = getDemoClientPortalProfile(resolvedClientId, profileId);
    if (!profile) {
      return { ok: false, error: 'Klient:innenprofil nicht gefunden.' };
    }

    return { ok: true, data: { profile, portalAccess: null } };
  });
}

export async function fetchClientCarePlanSummaries(
  params: FetchClientPortalProfileParams,
): Promise<ServiceResult<PortalClientCarePlanSummary[]>> {
  const { profileId, tenantId, clientId, roleKey } = params;
  const denied = enforceClientCarePlanAccess(roleKey);
  if (denied) return denied;

  if (getServiceMode() === 'supabase' && tenantId?.trim() && clientId?.trim()) {
    return fetchLiveClientCarePlanSummaries(tenantId, clientId);
  }

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    const resolvedClientId = clientId ?? getPortalProfileLink(profileId).clientId;
    if (!resolvedClientId) {
      return { ok: true, data: [] };
    }

    return { ok: true, data: getDemoClientCarePlanSummaries(resolvedClientId) };
  });
}
