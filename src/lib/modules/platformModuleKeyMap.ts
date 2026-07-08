import type { ProductKey } from '@/types';
import type { ModuleScopeKey } from '@/types/modules/visibility';

/** App ProductKey → platform_modules.module_key */
export const PRODUCT_TO_PLATFORM_MODULE_KEY: Record<ProductKey, string> = {
  office: 'office',
  assist: 'assist',
  pflege: 'care',
  stationaer: 'stationary',
  beratung: 'consulting',
  akademie: 'academy',
};

/** Erweiterte Scope-Keys (Navigation/Routen) → platform module_key */
export const SCOPE_TO_PLATFORM_MODULE_KEY: Partial<Record<ModuleScopeKey, string>> = {
  office: 'office',
  assist: 'assist',
  pflege: 'care',
  stationaer: 'stationary',
  beratung: 'consulting',
  akademie: 'academy',
  communication: 'messaging',
  templates: 'documents',
};

export function resolvePlatformModuleKeyFromProduct(productKey: ProductKey): string {
  return PRODUCT_TO_PLATFORM_MODULE_KEY[productKey];
}

export function resolvePlatformModuleKeyFromScope(scopeKey: ModuleScopeKey): string | null {
  return SCOPE_TO_PLATFORM_MODULE_KEY[scopeKey] ?? null;
}

export type PlatformTenantModuleStatus =
  | 'enabled'
  | 'disabled'
  | 'trial'
  | 'scheduled'
  | 'expired'
  | 'locked'
  | 'beta_enabled';

export type PlatformTenantModuleRecord = {
  moduleKey: string;
  status: PlatformTenantModuleStatus;
  isTrial: boolean;
  trialEndsAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  manualOverride: boolean;
};

export type PlatformModuleAccessDecision =
  | { source: 'platform'; allowed: boolean; record: PlatformTenantModuleRecord }
  | { source: 'fallback_deprecated'; allowed: boolean };

export function isPlatformModuleAccessAllowed(decision: PlatformModuleAccessDecision): boolean {
  return decision.allowed;
}

const ALLOWED_PLATFORM_STATUSES: PlatformTenantModuleStatus[] = [
  'enabled',
  'beta_enabled',
  'trial',
];

const DENIED_PLATFORM_STATUSES: PlatformTenantModuleStatus[] = [
  'disabled',
  'locked',
  'expired',
];

function parseRecord(raw: unknown): PlatformTenantModuleRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const moduleKey = String(row.moduleKey ?? row.module_key ?? '');
  if (!moduleKey) return null;
  return {
    moduleKey,
    status: String(row.status ?? 'disabled') as PlatformTenantModuleStatus,
    isTrial: Boolean(row.isTrial ?? row.is_trial),
    trialEndsAt: (row.trialEndsAt ?? row.trial_ends_at ?? null) as string | null,
    startsAt: (row.startsAt ?? row.starts_at ?? null) as string | null,
    endsAt: (row.endsAt ?? row.ends_at ?? null) as string | null,
    manualOverride: Boolean(row.manualOverride ?? row.manual_override),
  };
}

function isWithinWindow(record: PlatformTenantModuleRecord, now = Date.now()): boolean {
  if (record.startsAt) {
    const start = Date.parse(record.startsAt);
    if (!Number.isNaN(start) && start > now) return false;
  }
  if (record.endsAt) {
    const end = Date.parse(record.endsAt);
    if (!Number.isNaN(end) && end <= now) return false;
  }
  if (record.isTrial && record.trialEndsAt) {
    const trialEnd = Date.parse(record.trialEndsAt);
    if (!Number.isNaN(trialEnd) && trialEnd <= now) return false;
  }
  return true;
}

/** @deprecated Nur wenn kein platform_tenant_modules-Eintrag existiert */
export function evaluatePlatformModuleAccess(
  record: PlatformTenantModuleRecord | null | undefined,
  fallbackAllowed: boolean,
  now = Date.now(),
): PlatformModuleAccessDecision {
  if (!record) {
    return { source: 'fallback_deprecated', allowed: fallbackAllowed };
  }

  if (DENIED_PLATFORM_STATUSES.includes(record.status)) {
    return { source: 'platform', allowed: false, record };
  }

  if (!ALLOWED_PLATFORM_STATUSES.includes(record.status)) {
    return { source: 'platform', allowed: false, record };
  }

  if (!isWithinWindow(record, now)) {
    return { source: 'platform', allowed: false, record };
  }

  return { source: 'platform', allowed: true, record };
}

export function parsePlatformModuleList(payload: unknown): PlatformTenantModuleRecord[] {
  if (!Array.isArray(payload)) return [];
  return payload.map(parseRecord).filter((r): r is PlatformTenantModuleRecord => r !== null);
}

export { parseRecord as parsePlatformTenantModuleRecord };
