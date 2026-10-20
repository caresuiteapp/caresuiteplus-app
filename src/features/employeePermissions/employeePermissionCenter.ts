/**
 * ASSIST.PERMISSIONS.2 — Central employee permission/consent center.
 * Separates: internal consent (DB) vs browser permission vs workflow vs GPS proof.
 */
import type { ServiceResult } from '@/types';
import type { EmployeePortalGpsPermissionStatus } from '@/types/modules/employeePortalTracking';
import {
  getEmployeePortalGpsPermissionStatus,
  requestEmployeePortalForegroundLocationPermission,
} from '@/lib/portal/employeePortalVisitTrackingService';
import { upsertEmployeeLocationConsentRecord } from '@/features/liveTracking/employeeLocationConsentPersistence';
import { saveEmployeeConsentBundle } from './saveEmployeeConsentBundle';
import { EMPLOYEE_CONSENT_BUNDLE_VERSION } from './permissionConsentVersion';
import {
  fetchEmployeePermissionStates,
  upsertEmployeePermissionState,
} from './employeePermissionPersistence';

export type EmployeePermissionKind =
  | 'location'
  | 'notifications'
  | 'camera'
  | 'microphone'
  | 'signature';

export type EmployeeBrowserPermissionStatus =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unavailable'
  | 'undetermined';

export type EmployeePermissionOverviewItem = {
  kind: EmployeePermissionKind;
  label: string;
  description: string;
  browserStatus: EmployeeBrowserPermissionStatus;
  explainedAt: string | null;
  lastRequestedAt: string | null;
};

export type EmployeePermissionOverview = {
  items: EmployeePermissionOverviewItem[];
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  locationInternalConsentGranted: boolean;
  locationInternalConsentAt: string | null;
};

export { EMPLOYEE_CONSENT_BUNDLE_VERSION as EMPLOYEE_PERMISSION_BUNDLE_VERSION };

export const EMPLOYEE_PERMISSION_EXPLANATIONS: Record<
  EmployeePermissionKind,
  { label: string; description: string }
> = {
  location: {
    label: 'Standort',
    description:
      'Für Anfahrt und Live-Tracking während des Einsatzes. Kein dauerhaftes Tracking — nur von „Anfahrt starten“ bis Beendigung.',
  },
  notifications: {
    label: 'Benachrichtigungen',
    description:
      'Einsatz-Erinnerungen, Nachrichten vom Büro und wichtige Statusänderungen.',
  },
  camera: {
    label: 'Kamera',
    description: 'Fotos für Dokumentation und Leistungsnachweise am Einsatzort.',
  },
  microphone: {
    label: 'Mikrofon',
    description: 'Sprachnotizen und optionale Diktierfunktion bei der Dokumentation.',
  },
  signature: {
    label: 'Unterschrift',
    description:
      'Digitale Klient:innen-Unterschrift auf dem Gerät — keine Kamera-Berechtigung nötig, aber Touch/Stift erforderlich.',
  },
};

export const PERMISSION_KINDS: EmployeePermissionKind[] = [
  'location',
  'notifications',
  'camera',
  'microphone',
  'signature',
];

/** In-memory guard: location prompt once per app session per employee. */
const locationPromptedKeys = new Set<string>();

function mapGpsToBrowserStatus(
  status: EmployeePortalGpsPermissionStatus,
): EmployeeBrowserPermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  if (status === 'unavailable') return 'unavailable';
  return 'undetermined';
}

function sessionKey(tenantId: string, employeeId: string): string {
  return `${tenantId}:${employeeId}`;
}

/**
 * Request browser location permission at most once per session per employee.
 * Does not block workflow — returns current status after optional prompt.
 */
export async function requestLocationPermissionOnce(
  tenantId: string,
  employeeId: string,
): Promise<EmployeePortalGpsPermissionStatus> {
  const key = sessionKey(tenantId, employeeId);
  const current = await getEmployeePortalGpsPermissionStatus();

  if (current === 'granted' || current === 'denied' || current === 'unavailable') {
    return current;
  }

  if (locationPromptedKeys.has(key)) {
    return current;
  }

  locationPromptedKeys.add(key);
  const requested = await requestEmployeePortalForegroundLocationPermission();
  const now = new Date().toISOString();

  void upsertEmployeePermissionState(tenantId, employeeId, {
    permissionKind: 'location',
    browserStatus: mapGpsToBrowserStatus(requested),
    lastRequestedAt: now,
    explainedAt: now,
  });

  return requested;
}

/** Persist internal location consent to employee_location_consents (tenant scope). */
export async function persistInternalLocationConsent(
  tenantId: string,
  employeeId: string,
  grantedAt: string,
  explainedAt: string | null,
): Promise<ServiceResult<{ grantedAt: string }>> {
  const saved = await upsertEmployeeLocationConsentRecord(
    tenantId,
    employeeId,
    grantedAt,
    explainedAt,
  );
  if (!saved.ok) return saved as ServiceResult<never>;
  return { ok: true, data: { grantedAt: saved.data.grantedAt ?? grantedAt } };
}

/** Mark all permissions as explained and complete onboarding bundle in Supabase. */
export async function completePermissionOnboardingBundle(
  tenantId: string,
  employeeId: string,
  options?: {
    locationInternalConsentAt?: string | null;
    explainedKinds?: EmployeePermissionKind[];
  },
): Promise<ServiceResult<{ completedAt: string }>> {
  const now = new Date().toISOString();
  const kinds = options?.explainedKinds ?? PERMISSION_KINDS;
  const locationAt = options?.locationInternalConsentAt ?? null;

  if (locationAt) {
    const loc = await persistInternalLocationConsent(tenantId, employeeId, locationAt, locationAt);
    if (!loc.ok) return loc as ServiceResult<never>;
  }

  for (const kind of kinds) {
    const stored = await fetchEmployeePermissionStates(tenantId, employeeId);
    const existing = stored.ok ? stored.data.find((s) => s.permissionKind === kind) : null;
    await upsertEmployeePermissionState(tenantId, employeeId, {
      permissionKind: kind,
      browserStatus: existing?.browserStatus ?? 'undetermined',
      explainedAt: now,
    });
  }

  return saveEmployeeConsentBundle(tenantId, employeeId, {
    completedAt: now,
    explainedPermissions: kinds,
    locationInternalAt: locationAt,
  });
}

/** Persist browser permission snapshot after check (non-blocking). */
export async function recordBrowserPermissionCheck(
  tenantId: string,
  employeeId: string,
  kind: EmployeePermissionKind,
  status: EmployeeBrowserPermissionStatus,
): Promise<void> {
  await upsertEmployeePermissionState(tenantId, employeeId, {
    permissionKind: kind,
    browserStatus: status,
    lastCheckedAt: new Date().toISOString(),
  });
}

/** Test helper — reset session prompt guard. */
export function resetLocationPermissionPromptGuardForTests(): void {
  locationPromptedKeys.clear();
}