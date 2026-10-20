import type {
  PlatformEntitlementInput,
  PlatformModuleAccessState,
  PlatformSubscriptionStatus,
  PlatformTenantEntitlement,
} from '@/types/platformConsole/foundation';

const USABLE_STATES: PlatformModuleAccessState[] = ['active', 'beta'];

export function resolveTenantSubscriptionStatus(
  status: PlatformSubscriptionStatus | null | undefined,
): PlatformSubscriptionStatus | 'none' {
  return status ?? 'none';
}

export function subscriptionBlocksAccess(status: PlatformSubscriptionStatus | null | undefined): boolean {
  return status === 'suspended' || status === 'cancelled' || status === 'expired';
}

function catalogDefaultState(moduleKey: string, catalog: PlatformEntitlementInput['moduleCatalog']): PlatformModuleAccessState {
  const row = catalog.find((m) => m.moduleKey === moduleKey);
  if (!row) return 'disabled';
  if (row.isInternal || row.status === 'internal') return 'internal';
  if (row.status === 'disabled' || row.status === 'deprecated') return 'disabled';
  if (row.status === 'beta' || row.isBeta) return 'beta';
  return 'active';
}

function mergeModuleState(
  current: PlatformModuleAccessState | undefined,
  next: PlatformModuleAccessState,
): PlatformModuleAccessState {
  if (!current) return next;
  const rank: Record<PlatformModuleAccessState, number> = {
    disabled: 0,
    coming_soon: 1,
    internal: 2,
    beta: 3,
    active: 4,
  };
  return rank[next] >= rank[current] ? next : current;
}

export function calculateTenantEntitlements(input: PlatformEntitlementInput): PlatformTenantEntitlement[] {
  if (subscriptionBlocksAccess(input.subscriptionStatus)) {
    return [];
  }

  const map = new Map<string, PlatformTenantEntitlement>();

  for (const mod of input.planModules) {
    map.set(mod.moduleKey, {
      entitlementKey: `module:${mod.moduleKey}`,
      entitlementType: 'module',
      moduleKey: mod.moduleKey,
      accessState: mod.accessState,
      sourceType: 'plan',
    });
  }

  for (const mod of input.addonModules) {
    const existing = map.get(mod.moduleKey);
    map.set(mod.moduleKey, {
      entitlementKey: `module:${mod.moduleKey}`,
      entitlementType: 'module',
      moduleKey: mod.moduleKey,
      accessState: mergeModuleState(existing?.accessState, mod.accessState),
      sourceType: 'addon',
    });
  }

  for (const override of input.manualOverrides) {
    map.set(override.moduleKey, {
      entitlementKey: `module:${override.moduleKey}`,
      entitlementType: 'module',
      moduleKey: override.moduleKey,
      accessState: override.accessState,
      sourceType: 'override',
    });
  }

  for (const moduleKey of input.betaModules) {
    const existing = map.get(moduleKey);
    map.set(moduleKey, {
      entitlementKey: `module:${moduleKey}`,
      entitlementType: 'module',
      moduleKey,
      accessState: mergeModuleState(existing?.accessState, 'beta'),
      sourceType: 'beta',
    });
  }

  for (const catalogRow of input.moduleCatalog) {
    if (!map.has(catalogRow.moduleKey)) {
      map.set(catalogRow.moduleKey, {
        entitlementKey: `module:${catalogRow.moduleKey}`,
        entitlementType: 'module',
        moduleKey: catalogRow.moduleKey,
        accessState: catalogDefaultState(catalogRow.moduleKey, input.moduleCatalog),
        sourceType: 'manual',
      });
    }
  }

  return [...map.values()].sort((a, b) => a.entitlementKey.localeCompare(b.entitlementKey));
}

export function getTenantEntitlements(input: PlatformEntitlementInput): PlatformTenantEntitlement[] {
  return calculateTenantEntitlements(input);
}

export function resolveModuleStateForTenant(
  moduleKey: string,
  entitlements: PlatformTenantEntitlement[],
): PlatformModuleAccessState {
  const row = entitlements.find((e) => e.moduleKey === moduleKey);
  return row?.accessState ?? 'disabled';
}

export function hasTenantModuleAccess(
  moduleKey: string,
  entitlements: PlatformTenantEntitlement[],
): boolean {
  const row = entitlements.find((e) => e.moduleKey === moduleKey);
  if (!row) return false;
  if (row.accessState === 'active') return true;
  if (row.accessState === 'beta') {
    return row.sourceType !== 'manual';
  }
  return false;
}

export function resolveFeatureAvailability(
  featureKey: string,
  entitlements: PlatformTenantEntitlement[],
): 'available' | 'visible_locked' | 'hidden' {
  const row = entitlements.find((e) => e.entitlementKey === featureKey || e.moduleKey === featureKey);
  if (!row) return 'hidden';
  if (USABLE_STATES.includes(row.accessState)) return 'available';
  if (row.accessState === 'coming_soon') return 'visible_locked';
  return 'hidden';
}

export function isModuleUsable(accessState: PlatformModuleAccessState, hasBetaEntitlement: boolean): boolean {
  if (accessState === 'active') return true;
  if (accessState === 'beta' && hasBetaEntitlement) return true;
  return false;
}
