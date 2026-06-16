import type {
  EffectiveModuleAccess,
  ModuleAccessSource,
  ModuleBillingStatus,
  ProductKey,
  ServiceResult,
  TenantProduct,
} from '@/types';
import { demoProducts } from '@/data/demo/products';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { isFreePlatformEnabled } from '@/lib/billing/freePlatformService';
import { fetchTenantModulesFromSupabase } from '@/lib/modules/moduleAccessRepository.supabase';
import { getServiceMode } from '@/lib/services/mode';
import {
  ALL_PRODUCT_KEYS,
  isPurchasedAccessSource,
  isSpecialtyModuleKey,
  OFFICE_MODULE_KEY,
  SPECIALTY_MODULE_KEYS,
} from './constants';

const ACCESS_SOURCE_LABELS: Record<ModuleAccessSource, string> = {
  purchased: 'Gebucht',
  included_base: 'Inklusive',
  trial: 'Testphase',
  admin_granted: 'Admin-Freigabe',
  demo: 'Demo',
  expired: 'Abgelaufen',
  disabled: 'Deaktiviert',
  free_active: 'Aktiv',
  free_available: 'Verfügbar',
};

type ModuleStore = Map<string, TenantProduct[]>;

const tenantModuleStore: ModuleStore = new Map();

function nowIso(): string {
  return new Date().toISOString();
}

function cloneModules(modules: TenantProduct[]): TenantProduct[] {
  return modules.map((module) => ({ ...module }));
}

function createDefaultModule(productKey: ProductKey, tenantId: string, isActive: boolean): TenantProduct {
  const product = demoProducts.find((entry) => entry.key === productKey);
  const freePlatform = isFreePlatformEnabled();
  const accessSource: ModuleAccessSource = isActive
    ? freePlatform
      ? 'free_active'
      : 'purchased'
    : freePlatform
      ? 'free_available'
      : 'disabled';
  const billingStatus: ModuleBillingStatus = isActive
    ? freePlatform
      ? 'free_active'
      : 'billable'
    : freePlatform
      ? 'free_available'
      : 'not_billed';

  return {
    id: `tp-${productKey}`,
    tenantId,
    productId: product?.id ?? `prod-${productKey}`,
    productKey,
    isActive,
    activatedAt: '2025-02-01T00:00:00.000Z',
    accessSource,
    includedByModuleKey: null,
    isBaseIncluded: false,
    billingStatus,
    accessType: 'free',
    priceCents: 0,
    premiumReady: false,
  };
}

function getOfficeModule(modules: TenantProduct[]): TenantProduct | undefined {
  return modules.find((module) => module.productKey === OFFICE_MODULE_KEY);
}

function getActiveSpecialtyModules(modules: TenantProduct[]): TenantProduct[] {
  return modules.filter(
    (module) =>
      isSpecialtyModuleKey(module.productKey) &&
      module.isActive &&
      module.accessSource !== 'disabled',
  );
}

/** Stellt sicher, dass Office als Basis enthalten ist oder bei fehlenden Fachmodulen entfernt wird. */
export function resolveIncludedModules(activeModules: ProductKey[]): ProductKey[] {
  const effective = new Set<ProductKey>(activeModules);
  const hasSpecialty = activeModules.some((key) => isSpecialtyModuleKey(key));
  if (hasSpecialty) {
    effective.add(OFFICE_MODULE_KEY);
  }
  return ALL_PRODUCT_KEYS.filter((key) => effective.has(key));
}

function syncOfficeInclusion(modules: TenantProduct[]): void {
  const office = getOfficeModule(modules);
  if (!office) return;

  const activeSpecialties = getActiveSpecialtyModules(modules);
  const hasActiveSpecialty = activeSpecialties.length > 0;
  const officeIsPurchased = isPurchasedAccessSource(office.accessSource);

  if (hasActiveSpecialty) {
    if (officeIsPurchased || office.accessSource === 'free_active') {
      office.isActive = true;
      office.isBaseIncluded = isFreePlatformEnabled() ? false : !officeIsPurchased;
      office.includedByModuleKey = isFreePlatformEnabled() ? null : activeSpecialties[0]?.productKey ?? null;
      office.billingStatus = isFreePlatformEnabled() ? 'free_active' : officeIsPurchased ? 'billable' : 'included';
      if (isFreePlatformEnabled()) {
        office.accessSource = 'free_active';
      }
      return;
    }

    office.isActive = true;
    office.accessSource = 'included_base';
    office.isBaseIncluded = true;
    office.includedByModuleKey = activeSpecialties[0]?.productKey ?? null;
    office.billingStatus = isFreePlatformEnabled() ? 'free_active' : 'included';
    return;
  }

  if (office.accessSource === 'included_base') {
    office.isActive = false;
    office.accessSource = 'disabled';
    office.isBaseIncluded = false;
    office.includedByModuleKey = null;
    office.billingStatus = 'not_billed';
  }
}

function toEffectiveAccess(module: TenantProduct): EffectiveModuleAccess {
  return {
    ...module,
    isEffective: module.isActive,
    accessSourceLabel: ACCESS_SOURCE_LABELS[module.accessSource],
  };
}

function ensureTenantStore(tenantId: string): TenantProduct[] {
  if (!tenantModuleStore.has(tenantId)) {
    tenantModuleStore.set(tenantId, cloneModules(buildInitialDemoModules(tenantId)));
  }
  return tenantModuleStore.get(tenantId)!;
}

function buildInitialDemoModules(tenantId: string): TenantProduct[] {
  const freePlatform = isFreePlatformEnabled();
  return demoProducts.map((product) => ({
    id: `tp-${product.key}`,
    tenantId,
    productId: product.id,
    productKey: product.key,
    isActive: product.isActive,
    activatedAt: '2025-02-01T00:00:00.000Z',
    accessSource: product.isActive
      ? freePlatform
        ? 'free_active'
        : 'purchased'
      : freePlatform
        ? 'free_available'
        : 'disabled',
    includedByModuleKey: null,
    isBaseIncluded: false,
    billingStatus: product.isActive
      ? freePlatform
        ? 'free_active'
        : 'billable'
      : freePlatform
        ? 'free_available'
        : 'not_billed',
    accessType: 'free' as const,
    priceCents: 0,
    premiumReady: false,
  }));
}

/** Demo-Store aus products.ts initialisieren (Tests). */
export function initializeModuleAccessStore(
  tenantId: string,
  modules?: TenantProduct[],
): void {
  const seed = modules ?? buildInitialDemoModules(tenantId);
  tenantModuleStore.set(tenantId, cloneModules(seed));
  syncOfficeInclusion(tenantModuleStore.get(tenantId)!);
}

/** Nur für Tests — Store zurücksetzen. */
export function resetModuleAccessStore(tenantId?: string): void {
  if (tenantId) {
    tenantModuleStore.delete(tenantId);
    return;
  }
  tenantModuleStore.clear();
}

/** Live-Mandant: tenant_products aus Supabase in den In-Memory-Store laden. */
export async function hydrateTenantModulesFromSupabase(
  tenantId: string,
): Promise<ServiceResult<TenantProduct[]>> {
  if (!tenantId || tenantId === DEMO_TENANT_ID || getServiceMode() !== 'supabase') {
    return { ok: true, data: getTenantModules(tenantId) };
  }

  const result = await fetchTenantModulesFromSupabase(tenantId);
  if (!result.ok) {
    return result;
  }

  initializeModuleAccessStore(tenantId, result.data);
  return { ok: true, data: getTenantModules(tenantId) };
}

initializeModuleAccessStore(DEMO_TENANT_ID);

export function getTenantModules(tenantId: string): TenantProduct[] {
  const modules = ensureTenantStore(tenantId);
  syncOfficeInclusion(modules);
  return cloneModules(modules);
}

export function getEffectiveModuleAccess(tenantId: string): EffectiveModuleAccess[] {
  return getTenantModules(tenantId).map(toEffectiveAccess);
}

export function hasModuleAccess(
  moduleKey: ProductKey,
  tenantId: string = DEMO_TENANT_ID,
): boolean {
  const modules = getTenantModules(tenantId);
  const module = modules.find((entry) => entry.productKey === moduleKey);
  if (module?.billingStatus === 'admin_disabled') {
    return false;
  }
  return module?.isActive ?? false;
}

/** Free Platform Gate — kein Payment-Check für Hauptmodule. */
export function canAccessModule(
  moduleKey: ProductKey,
  tenantId: string = DEMO_TENANT_ID,
): boolean {
  if (isFreePlatformEnabled()) {
    return hasModuleAccess(moduleKey, tenantId);
  }
  return hasEffectiveModuleGateAccess(moduleKey, tenantId);
}

export function hasOfficeBaseAccess(tenantId: string = DEMO_TENANT_ID): boolean {
  return hasModuleAccess(OFFICE_MODULE_KEY, tenantId);
}

export function getModuleAccessSource(
  moduleKey: ProductKey,
  tenantId: string = DEMO_TENANT_ID,
): ModuleAccessSource {
  const modules = getTenantModules(tenantId);
  const module = modules.find((entry) => entry.productKey === moduleKey);
  return module?.accessSource ?? 'disabled';
}

export function activatePurchasedModule(
  tenantId: string,
  moduleKey: ProductKey,
): ServiceResult<TenantProduct[]> {
  if (isFreePlatformEnabled()) {
    return activateFreeModule(tenantId, moduleKey);
  }

  const modules = ensureTenantStore(tenantId);
  let target = modules.find((entry) => entry.productKey === moduleKey);

  if (!target) {
    target = createDefaultModule(moduleKey, tenantId, true);
    modules.push(target);
  }

  target.isActive = true;
  target.accessSource = 'purchased';
  target.includedByModuleKey = null;
  target.isBaseIncluded = false;
  target.billingStatus = 'billable';
  target.activatedAt = nowIso();

  syncOfficeInclusion(modules);
  return { ok: true, data: cloneModules(modules) };
}

/** Free Platform: Modul kostenlos aktivieren — kein Checkout. */
export function activateFreeModule(
  tenantId: string,
  moduleKey: ProductKey,
): ServiceResult<TenantProduct[]> {
  const modules = ensureTenantStore(tenantId);
  let target = modules.find((entry) => entry.productKey === moduleKey);

  if (!target) {
    target = createDefaultModule(moduleKey, tenantId, true);
    modules.push(target);
  }

  if (target.billingStatus === 'admin_disabled') {
    return { ok: false, error: `Modul „${moduleKey}" wurde durch Admin deaktiviert.` };
  }

  target.isActive = true;
  target.accessSource = 'free_active';
  target.includedByModuleKey = null;
  target.isBaseIncluded = false;
  target.billingStatus = 'free_active';
  target.accessType = 'free';
  target.priceCents = 0;
  target.activatedAt = nowIso();

  syncOfficeInclusion(modules);
  return { ok: true, data: cloneModules(modules) };
}

export function deactivateModule(
  tenantId: string,
  moduleKey: ProductKey,
): ServiceResult<TenantProduct[]> {
  const modules = ensureTenantStore(tenantId);
  const target = modules.find((entry) => entry.productKey === moduleKey);

  if (!target) {
    return { ok: false, error: `Modul „${moduleKey}" ist nicht vorhanden.` };
  }

  if (moduleKey === OFFICE_MODULE_KEY && target.accessSource === 'included_base') {
    return {
      ok: false,
      error: 'CareSuite+ Office ist als Basis-Modul automatisch enthalten und kann nicht einzeln deaktiviert werden.',
    };
  }

  target.isActive = false;
  target.accessSource = 'disabled';
  target.includedByModuleKey = null;
  target.isBaseIncluded = false;
  target.billingStatus = 'not_billed';

  syncOfficeInclusion(modules);
  return { ok: true, data: cloneModules(modules) };
}

/** Modul-Gate: Fachmodul impliziert Office-Zugriff, Rollen bleiben getrennt. */
export function hasEffectiveModuleGateAccess(
  moduleKey: ProductKey,
  tenantId: string = DEMO_TENANT_ID,
): boolean {
  if (hasModuleAccess(moduleKey, tenantId)) {
    return true;
  }
  if (moduleKey === OFFICE_MODULE_KEY) {
    return SPECIALTY_MODULE_KEYS.some((key) => hasModuleAccess(key, tenantId));
  }
  return false;
}

export { ACCESS_SOURCE_LABELS, SPECIALTY_MODULE_KEYS, OFFICE_MODULE_KEY };
