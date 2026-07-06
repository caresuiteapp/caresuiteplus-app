import type {
  ModuleAccessSource,
  ModuleBillingStatus,
  ProductKey,
  ServiceResult,
  TenantProduct,
} from '@/types';
import { demoProducts } from '@/data/demo/products';
import { ALL_PRODUCT_KEYS } from '@/lib/modules/constants';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';

export const TENANT_PRODUCT_SELECT_LEGACY =
  'id, tenant_id, product_id, is_active, activated_at, access_source, included_by_module_key, is_base_included, billing_status, access_type, price_cents, premium_ready, products(product_key)';

/** Production schema uses status + product_key instead of is_active module-access columns. */
export const TENANT_PRODUCT_SELECT_STATUS =
  'id, tenant_id, product_id, product_key, status, created_at, updated_at, products(product_key)';

export type TenantProductLiveRow = {
  id: string;
  tenant_id: string;
  product_id: string;
  is_active?: boolean | null;
  activated_at?: string | null;
  access_source?: ModuleAccessSource | null;
  included_by_module_key?: ProductKey | null;
  is_base_included?: boolean | null;
  billing_status?: ModuleBillingStatus | null;
  access_type?: TenantProduct['accessType'] | null;
  price_cents?: number | null;
  premium_ready?: boolean | null;
  product_key?: ProductKey | string | null;
  status?: string | null;
  created_at?: string | null;
  products?: { product_key: ProductKey; key?: ProductKey } | null;
};

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function isProductKey(value: string | null | undefined): value is ProductKey {
  return !!value && (ALL_PRODUCT_KEYS as string[]).includes(value);
}

function buildInactiveModule(tenantId: string, productKey: ProductKey): TenantProduct {
  const product = demoProducts.find((entry) => entry.key === productKey);
  return {
    id: `tp-${productKey}-pending`,
    tenantId,
    productId: product?.id ?? `prod-${productKey}`,
    productKey,
    isActive: false,
    activatedAt: '2025-02-01T00:00:00.000Z',
    accessSource: 'free_available',
    includedByModuleKey: null,
    isBaseIncluded: false,
    billingStatus: 'free_available',
    accessType: 'free',
    priceCents: 0,
    premiumReady: false,
  };
}

function resolveProductKey(row: TenantProductLiveRow): ProductKey | null {
  const candidates = [row.products?.product_key, row.products?.key, row.product_key];
  for (const candidate of candidates) {
    if (isProductKey(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveIsActive(row: TenantProductLiveRow): boolean {
  if (typeof row.is_active === 'boolean') {
    return row.is_active;
  }
  const status = row.status?.trim().toLowerCase();
  return status === 'active' || status === 'trial';
}

export function mapTenantProductRow(row: TenantProductLiveRow): TenantProduct | null {
  const productKey = resolveProductKey(row);
  if (!productKey) {
    return null;
  }

  const isActive = resolveIsActive(row);

  return {
    id: row.id,
    tenantId: row.tenant_id,
    productId: row.product_id,
    productKey,
    isActive,
    activatedAt: row.activated_at ?? row.created_at ?? new Date().toISOString(),
    accessSource: row.access_source ?? (isActive ? 'free_active' : 'free_available'),
    includedByModuleKey: row.included_by_module_key ?? null,
    isBaseIncluded: row.is_base_included ?? false,
    billingStatus: row.billing_status ?? (isActive ? 'free_active' : 'free_available'),
    accessType: row.access_type ?? 'free',
    priceCents: row.price_cents ?? 0,
    premiumReady: row.premium_ready ?? false,
  };
}

export function mapTenantProductRows(
  tenantId: string,
  rows: TenantProductLiveRow[],
): TenantProduct[] {
  const byKey = new Map<ProductKey, TenantProduct>();

  for (const key of ALL_PRODUCT_KEYS) {
    byKey.set(key, buildInactiveModule(tenantId, key));
  }

  for (const row of rows) {
    const mapped = mapTenantProductRow(row);
    if (mapped) {
      byKey.set(mapped.productKey, mapped);
    }
  }

  return ALL_PRODUCT_KEYS.map((key) => byKey.get(key)!);
}

/** Live Supabase — Mandanten-Module aus tenant_products + products.product_key */
export async function fetchTenantModulesFromSupabase(
  tenantId: string,
): Promise<ServiceResult<TenantProduct[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return unavailable();

  const legacy = await fromUnknownTable(supabase, 'tenant_products')
    .select(TENANT_PRODUCT_SELECT_LEGACY)
    .eq('tenant_id', tenantId);

  if (!legacy.error) {
    return {
      ok: true,
      data: mapTenantProductRows(tenantId, (legacy.data ?? []) as unknown as TenantProductLiveRow[]),
    };
  }

  const isMissingLegacyColumn =
    legacy.error.code === '42703' ||
    /is_active|access_source|billing_status|price_cents/.test(legacy.error.message ?? '');

  if (!isMissingLegacyColumn) {
    return { ok: false, error: toGermanSupabaseError(legacy.error) };
  }

  const statusRows = await fromUnknownTable(supabase, 'tenant_products')
    .select(TENANT_PRODUCT_SELECT_STATUS)
    .eq('tenant_id', tenantId);

  if (statusRows.error) {
    return { ok: false, error: toGermanSupabaseError(statusRows.error) };
  }

  return {
    ok: true,
    data: mapTenantProductRows(tenantId, (statusRows.data ?? []) as unknown as TenantProductLiveRow[]),
  };
}
