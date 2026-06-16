import type { RoleKey, ServiceResult } from '@/types';
import type { ClientPortalDashboard } from '@/types/portal/clientPortalDomain';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import {
  fetchClientPortalDashboard as fetchDomainDashboard,
  resolveClientPortalContext,
} from './clientPortalDomainService';

/** WP343 / Prompt 59 — Klient:innenportal Dashboard-Service */
export async function fetchClientPortalDashboard(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  options?: {
    profileId?: string;
    clientId?: string;
    usesDemoFallback?: boolean;
  },
): Promise<ServiceResult<ClientPortalDashboard>> {
  const denied = enforcePermission<ClientPortalDashboard>(
    actorRoleKey,
    'portal.client.profile.view' as never,
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (options?.usesDemoFallback && getServiceMode() === 'supabase') {
    return { ok: false, error: 'Demo-Fallback im Production Mode blockiert.' };
  }

  const liveBlock = guardLiveDemoFeature(tenantId, 'Klient:innenportal-Dashboard');
  if (liveBlock && !liveBlock.ok && options?.usesDemoFallback) return liveBlock;

  const ctxResult = resolveClientPortalContext({
    tenantId,
    profileId: options?.profileId ?? 'profile-client-001',
    roleKey: actorRoleKey ?? 'client_portal',
    clientId: options?.clientId,
  });
  if (!ctxResult.ok) return ctxResult;

  return fetchDomainDashboard(ctxResult.data);
}
