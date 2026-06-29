/**
 * ASSIST.PERMISSIONS.1 — Central employee permission/consent center.
 * Separates: internal consent (DB) vs browser permission vs workflow vs GPS proof.
 */
import type { ServiceResult } from '@/types';
import type { EmployeePortalGpsPermissionStatus } from '@/types/modules/employeePortalTracking';
import {
  getEmployeePortalGpsPermissionStatus,
  requestEmployeePortalForegroundLocationPermission,
} from '@/lib/portal/employeePortalVisitTrackingService';
import {
  fetchEmployeeConsentBundle,
  fetchEmployeePermissionStates,
  upsertEmployeeConsentBundle,
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
};

export const EMPLOYEE_PERMISSION_BUNDLE_VERSION = 1;

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

const PERMISSION_KINDS: EmployeePermissionKind[] = [
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

/** Load permission overview — merges DB state with live browser checks. */
export async function getEmployeePermissionOverview(
  tenantId: string,
  employeeId: string,
  options?: { locationInternalConsentGranted?: boolean },
): Promise<ServiceResult<EmployeePermissionOverview>> {
  const [statesResult, bundleResult, liveLocation] = await Promise.all([
    fetchEmployeePermissionStates(tenantId, employeeId),
    fetchEmployeeConsentBundle(tenantId, employeeId),
    getEmployeePortalGpsPermissionStatus(),
  ]);

  if (!statesResult.ok) return statesResult as ServiceResult<never>;
  if (!bundleResult.ok) return bundleResult as ServiceResult<never>;

  const stateMap = new Map(statesResult.data.map((s) => [s.permissionKind, s]));

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
      onboardingCompleted: Boolean(bundleResult.data?.completedAt),
      onboardingCompletedAt: bundleResult.data?.completedAt ?? null,
      locationInternalConsentGranted: options?.locationInternalConsentGranted ?? false,
    },
  };
}

/** True when employee has not completed central permission onboarding. */
export async function needsPermissionOnboarding(
  tenantId: string,
  employeeId: string,
): Promise<boolean> {
  const bundle = await fetchEmployeeConsentBundle(tenantId, employeeId);
  if (!bundle.ok) return true;
  return !bundle.data?.completedAt;
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

/** Mark all permissions as explained and complete onboarding bundle. */
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

  for (const kind of kinds) {
    const stored = await fetchEmployeePermissionStates(tenantId, employeeId);
    const existing = stored.ok ? stored.data.find((s) => s.permissionKind === kind) : null;
    await upsertEmployeePermissionState(tenantId, employeeId, {
      permissionKind: kind,
      browserStatus: existing?.browserStatus ?? 'undetermined',
      explainedAt: now,
    });
  }

  return upsertEmployeeConsentBundle(tenantId, employeeId, {
    bundleVersion: EMPLOYEE_PERMISSION_BUNDLE_VERSION,
    completedAt: now,
    explainedPermissions: kinds,
    locationInternalAt: options?.locationInternalConsentAt ?? null,
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

export { PERMISSION_KINDS };
