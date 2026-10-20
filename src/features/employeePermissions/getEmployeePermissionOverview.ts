/**
 * ASSIST.PERMISSIONS.2 — Permission overview merging Supabase consent + browser snapshots.
 */
import type { ServiceResult } from '@/types';
import type { EmployeePortalGpsPermissionStatus } from '@/types/modules/employeePortalTracking';
import { getEmployeePortalGpsPermissionStatus } from '@/lib/portal/employeePortalVisitTrackingService';
import {
  EMPLOYEE_PERMISSION_EXPLANATIONS,
  PERMISSION_KINDS,
  type EmployeeBrowserPermissionStatus,
  type EmployeePermissionKind,
  type EmployeePermissionOverview,
  type EmployeePermissionOverviewItem,
} from './employeePermissionCenter';
import { getEmployeeConsentBundle } from './getEmployeeConsentBundle';
import { fetchEmployeePermissionStates } from './employeePermissionPersistence';

function mapGpsToBrowserStatus(
  status: EmployeePortalGpsPermissionStatus,
): EmployeeBrowserPermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  if (status === 'unavailable') return 'unavailable';
  return 'undetermined';
}

/** Load permission overview — Supabase consent is source of truth; browser status is informational. */
export async function getEmployeePermissionOverview(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeePermissionOverview>> {
  const [statesResult, consentSnapshot, liveLocation] = await Promise.all([
    fetchEmployeePermissionStates(tenantId, employeeId),
    getEmployeeConsentBundle(tenantId, employeeId),
    getEmployeePortalGpsPermissionStatus(),
  ]);

  if (!statesResult.ok) return statesResult as ServiceResult<never>;
  if (!consentSnapshot.ok) return consentSnapshot as ServiceResult<never>;

  const stateMap = new Map(statesResult.data.map((s) => [s.permissionKind, s]));
  const { bundle, locationInternalConsentGranted, onboardingCompleted, locationInternalConsentAt } =
    consentSnapshot.data;

  const items: EmployeePermissionOverviewItem[] = PERMISSION_KINDS.map((kind) => {
    const stored = stateMap.get(kind);
    const explanation = EMPLOYEE_PERMISSION_EXPLANATIONS[kind];
    let browserStatus: EmployeeBrowserPermissionStatus =
      stored?.browserStatus ?? 'undetermined';

    if (kind === 'location') {
      browserStatus = mapGpsToBrowserStatus(liveLocation);
    }

    return {
      kind,
      label: explanation.label,
      description: explanation.description,
      browserStatus,
      explainedAt: stored?.explainedAt ?? null,
      lastRequestedAt: stored?.lastRequestedAt ?? null,
    };
  });

  return {
    ok: true,
    data: {
      items,
      onboardingCompleted,
      onboardingCompletedAt: bundle?.completedAt ?? null,
      locationInternalConsentGranted,
      locationInternalConsentAt,
    },
  };
}

export type { EmployeePermissionOverview, EmployeePermissionOverviewItem, EmployeePermissionKind };
