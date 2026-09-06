import { getActivePortalSession, loadPortalSession } from '@/lib/auth/portalSessionStore';
import { isPortalSupabaseSessionAligned } from '@/lib/auth/portalSupabaseAuth';
import { getSupabaseClient } from '@/lib/supabase/client';
import { loadPortalAppointmentsWithCache } from './assignmentCacheService';
import { offlineCacheEpoch } from './idb';
import {
  prefetchAssignmentDetailCaches,
  selectPrefetchAssignmentCandidates,
} from './assignmentDetailPrefetch';
import { fetchPortalClientAppointmentDetail } from '@/lib/portal/appointmentService';
import { writeClientAppointmentCache } from './clientAppointmentCache';

/** Reads only. Does not replay drafts, change visits, prompt for credentials or send messages. */
export async function refreshPortalDeviceCache(): Promise<boolean> {
  const epoch = offlineCacheEpoch();
  const portal = await loadPortalSession();
  if (
    !portal ||
    portal.mustChangePassword ||
    !['employee_portal', 'client_portal'].includes(portal.roleKey)
  )
    return true;
  const employeeId = portal.roleKey === 'employee_portal' ? portal.employeeId : null;
  const clientId = portal.roleKey === 'client_portal' ? portal.clientId : null;
  if (!employeeId && !clientId) return true;
  const stillCurrent = () =>
    epoch === offlineCacheEpoch() &&
    getActivePortalSession()?.accountId === portal.accountId &&
    getActivePortalSession()?.tenantId === portal.tenantId;
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  const auth = await supabase.auth.getSession();
  if (auth.error || !isPortalSupabaseSessionAligned(auth.data.session, portal) || !stillCurrent())
    return false;
  const list = await loadPortalAppointmentsWithCache(
    portal.accountId,
    portal.roleKey,
    portal.tenantId,
    employeeId,
    clientId,
    { skipDetailPrefetch: true },
  );
  if (!stillCurrent()) return true;
  if (!list.ok || list.fromCache) return false;
  if (employeeId) {
    await prefetchAssignmentDetailCaches(
      portal.accountId,
      portal.roleKey,
      portal.tenantId,
      employeeId,
      list.data,
      { limit: 2 },
    );
  } else if (clientId) {
    for (const item of selectPrefetchAssignmentCandidates(list.data).slice(0, 2)) {
      if (!stillCurrent()) return true;
      const result = await fetchPortalClientAppointmentDetail(
        item.id,
        portal.accountId,
        portal.roleKey,
        { tenantId: portal.tenantId, clientId },
      );
      if (result.ok && stillCurrent())
        await writeClientAppointmentCache(
          {
            tenantId: portal.tenantId,
            accountId: portal.accountId,
            clientId,
            roleKey: portal.roleKey,
          },
          result.data,
          epoch,
        );
    }
  }
  return true;
}
