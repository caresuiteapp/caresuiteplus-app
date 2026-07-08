import type { ProductKey } from '@/types';
import type { ModuleScopeKey } from '@/types/modules/visibility';
import { getServiceMode } from '@/lib/services/mode';
import { platformRpc } from '@/lib/platformConsole/platformSupabaseClient';
import {
  evaluatePlatformModuleAccess,
  parsePlatformModuleList,
  resolvePlatformModuleKeyFromProduct,
  resolvePlatformModuleKeyFromScope,
  type PlatformModuleAccessDecision,
  type PlatformTenantModuleRecord,
} from './platformModuleKeyMap';

type TenantPlatformModuleStore = Map<string, PlatformTenantModuleRecord>;

const platformModuleStore: Map<string, TenantPlatformModuleStore> = new Map();
const hydrationFlags: Map<string, boolean> = new Map();

export function resetPlatformTenantModuleStore(tenantId?: string): void {
  if (tenantId) {
    platformModuleStore.delete(tenantId);
    hydrationFlags.delete(tenantId);
    return;
  }
  platformModuleStore.clear();
  hydrationFlags.clear();
}

export function seedPlatformTenantModulesForDemo(
  tenantId: string,
  records: PlatformTenantModuleRecord[],
): void {
  const store: TenantPlatformModuleStore = new Map();
  for (const record of records) {
    store.set(record.moduleKey, record);
  }
  platformModuleStore.set(tenantId, store);
  hydrationFlags.set(tenantId, true);
}

export function hasPlatformModuleHydration(tenantId: string): boolean {
  return hydrationFlags.get(tenantId) === true;
}

export function getPlatformTenantModuleRecord(
  tenantId: string,
  platformModuleKey: string,
): PlatformTenantModuleRecord | null {
  return platformModuleStore.get(tenantId)?.get(platformModuleKey) ?? null;
}

export function listEnabledPlatformTenantModuleKeys(tenantId: string): string[] {
  const store = platformModuleStore.get(tenantId);
  if (!store) return [];
  const keys: string[] = [];
  for (const record of store.values()) {
    const decision = evaluatePlatformModuleAccess(record, false);
    if (decision.source === 'platform' && decision.allowed) {
      keys.push(record.moduleKey);
    }
  }
  return keys;
}

export async function hydratePlatformTenantModulesFromSupabase(
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (getServiceMode() !== 'supabase') {
    hydrationFlags.set(tenantId, true);
    return { ok: true };
  }

  const { data, error } = await platformRpc<unknown>('tenant_list_platform_modules', {
    p_tenant_id: tenantId,
  });

  if (error) {
    if (/does not exist|42883|PGRST202/.test(error.message ?? '')) {
      hydrationFlags.set(tenantId, false);
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }

  const records = parsePlatformModuleList(data);
  const store: TenantPlatformModuleStore = new Map();
  for (const record of records) {
    store.set(record.moduleKey, record);
  }
  platformModuleStore.set(tenantId, store);
  hydrationFlags.set(tenantId, true);
  return { ok: true };
}

export function resolveProductModuleAccessDecision(
  tenantId: string,
  productKey: ProductKey,
  fallbackAllowed: boolean,
): PlatformModuleAccessDecision {
  const platformKey = resolvePlatformModuleKeyFromProduct(productKey);
  const record = getPlatformTenantModuleRecord(tenantId, platformKey);
  if (!hasPlatformModuleHydration(tenantId)) {
    return { source: 'fallback_deprecated', allowed: fallbackAllowed };
  }
  return evaluatePlatformModuleAccess(record, fallbackAllowed);
}

export function resolveScopeModuleAccessDecision(
  tenantId: string,
  scopeKey: ModuleScopeKey,
  fallbackAllowed: boolean,
): PlatformModuleAccessDecision | null {
  const platformKey = resolvePlatformModuleKeyFromScope(scopeKey);
  if (!platformKey) return null;
  const record = getPlatformTenantModuleRecord(tenantId, platformKey);
  if (!hasPlatformModuleHydration(tenantId)) {
    return { source: 'fallback_deprecated', allowed: fallbackAllowed };
  }
  return evaluatePlatformModuleAccess(record, fallbackAllowed);
}

export function isProductAllowedByPlatform(
  tenantId: string,
  productKey: ProductKey,
  fallbackAllowed: boolean,
): boolean {
  const decision = resolveProductModuleAccessDecision(tenantId, productKey, fallbackAllowed);
  if (decision.source === 'platform') {
    return decision.allowed;
  }
  return decision.allowed;
}

export function isPlatformExplicitDeny(decision: PlatformModuleAccessDecision): boolean {
  return decision.source === 'platform' && !decision.allowed;
}
