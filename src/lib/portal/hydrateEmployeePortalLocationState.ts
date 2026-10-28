import { fetchEmployeeLocationConsentRecord } from '@/features/liveTracking/employeeLocationConsentPersistence';
import { getEmployeeLocationConsent } from '@/features/liveTracking/getEmployeeLocationConsent';
import {
  applyEmployeePortalLocationConsent,
  getEmployeePortalGpsPermissionStatus,
  getEmployeePortalLocationConsent,
} from './employeePortalVisitTrackingService';
import type { EmployeePortalGpsPermissionStatus, EmployeePortalLocationConsent } from '@/types/modules/employeePortalTracking';

export const LOCATION_CONSENT_READ_WARNING =
  'Die Standort-Einwilligung konnte nicht geprüft werden. Bitte den Einsatz erneut laden.';

/** Optional startup reads must neither reject on mount nor update another visit. */
export async function hydrateEmployeePortalLocationState(options: {
  tenantId: string;
  employeeId: string;
  assignmentId: string;
  authProfileId: string | null;
  isCurrent: () => boolean;
  onConsent: (consent: EmployeePortalLocationConsent) => void;
  onPermission: (permission: EmployeePortalGpsPermissionStatus) => void;
  onWarning: (message: string) => void;
}): Promise<void> {
  const { tenantId, employeeId, assignmentId, authProfileId, isCurrent } = options;
  await Promise.all([
    (async () => {
      try {
        const permission = await getEmployeePortalGpsPermissionStatus();
        if (isCurrent()) options.onPermission(permission);
      } catch {
        if (isCurrent()) options.onPermission('unavailable');
      }
    })(),
    (async () => {
      try {
        const employeeRecord = await fetchEmployeeLocationConsentRecord(tenantId, employeeId);
        if (!isCurrent()) return;
        const visitConsent = employeeRecord.ok && employeeRecord.data?.granted
          ? employeeRecord
          : await getEmployeeLocationConsent({
              tenantId, employeeId, routeParamId: assignmentId,
              portalAccountId: authProfileId,
              localConsent: getEmployeePortalLocationConsent(tenantId, assignmentId),
            });
        if (!isCurrent()) return;
        if (!visitConsent.ok) {
          options.onWarning(LOCATION_CONSENT_READ_WARNING);
          return;
        }
        if (!visitConsent.data?.granted) return;
        applyEmployeePortalLocationConsent(tenantId, assignmentId, visitConsent.data);
        options.onConsent(visitConsent.data);
      } catch {
        if (isCurrent()) options.onWarning(LOCATION_CONSENT_READ_WARNING);
      }
    })(),
  ]);
}
