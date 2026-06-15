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
import { getPortalProfileLink } from './portalVisibility';

const SIMULATED_DELAY_MS = 350;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isClientPortalRole(roleKey: RoleKey | null): boolean {
  return roleKey === 'client_portal' || roleKey === 'family_portal';
}

export async function fetchClientPortalProfile(
  profileId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<PortalClientProfile>> {
  const denied = enforcePermission<PortalClientProfile>(roleKey, 'portal.client.profile.view');
  if (denied && isClientPortalRole(roleKey)) return denied;

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    const link = getPortalProfileLink(profileId);
    if (!link.clientId) {
      return { ok: false, error: 'Kein Klient:innenprofil mit diesem Portal verknüpft.' };
    }

    const profile = getDemoClientPortalProfile(link.clientId, profileId);
    if (!profile) {
      return { ok: false, error: 'Klient:innenprofil nicht gefunden.' };
    }

    return { ok: true, data: profile };
  });
}

export async function fetchClientCarePlanSummaries(
  profileId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<PortalClientCarePlanSummary[]>> {
  const denied = enforcePermission<PortalClientCarePlanSummary[]>(
    roleKey,
    'portal.client.careplan.view',
  );
  if (denied && isClientPortalRole(roleKey)) return denied;

  return runService(async () => {
    await delay(SIMULATED_DELAY_MS);

    const link = getPortalProfileLink(profileId);
    if (!link.clientId) {
      return { ok: true, data: [] };
    }

    return { ok: true, data: getDemoClientCarePlanSummaries(link.clientId) };
  });
}
