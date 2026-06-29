/**
 * LT.GMAPS.4 — Employee portal map/route via resolveEmployeeLiveContext (no demo workflow store).
 */
import type { RoleKey, ServiceResult } from '@/types';
import type { EmployeePortalRouteAction } from '@/types/modules/employeePortalExecution';
import { enforcePermission } from '@/lib/permissions';
import { canCaptureGps } from '@/lib/portal/employeePortalModuleAccess';
import { resolveEmployeeLiveContext } from './resolveEmployeeLiveContext';

export type BuildEmployeePortalLiveRouteInput = {
  tenantId: string;
  employeeId: string;
  routeParamId: string;
  roleKey: RoleKey | null;
  portalAccountId?: string | null;
};

function buildMapUrls(address: string): { mapUrl: string; directionsUrl: string } {
  const encoded = encodeURIComponent(address.trim());
  return {
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`,
  };
}

/** Resolve route/map URLs from the same live context as execution detail. */
export async function buildEmployeePortalLiveRoute(
  input: BuildEmployeePortalLiveRouteInput,
): Promise<ServiceResult<EmployeePortalRouteAction & { directionsUrl?: string; clientAddress?: string }>> {
  const denied = enforcePermission<EmployeePortalRouteAction>(input.roleKey, 'portal.employee.appointments.view');
  if (denied && input.roleKey === 'employee_portal') return denied;

  const ctxResult = await resolveEmployeeLiveContext({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    routeParamId: input.routeParamId,
    portalAccountId: input.portalAccountId,
  });

  if (!ctxResult.ok) return ctxResult;

  const address = ctxResult.data.clientAddress?.trim();
  if (!address || address === '—') {
    return { ok: false, error: 'Keine Zieladresse für diesen Einsatz hinterlegt.' };
  }

  const urls = buildMapUrls(address);
  return {
    ok: true,
    data: {
      mapUrl: urls.directionsUrl,
      directionsUrl: urls.directionsUrl,
      clientAddress: address,
      internalMapAvailable: canCaptureGps(input.roleKey),
    },
  };
}
