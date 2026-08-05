import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant, isLiveServiceMode } from '@/lib/services/liveServiceGuard';

type CatalogRow = {
  id: string;
  service_key: string;
  sort_order: number | null;
};

const SERVICE_PRIORITY = [
  'assist.entlastung_45b',
  'assist.alltagsbegleitung',
  'assist.verhinderungspflege_39',
];

function priorityFor(row: CatalogRow): number {
  const preferred = SERVICE_PRIORITY.indexOf(row.service_key);
  return preferred >= 0 ? preferred : SERVICE_PRIORITY.length + Number(row.sort_order ?? 0);
}

/**
 * Returns the tenant-wide Assist hourly rate from the same catalog used for
 * invoices. A missing catalog is a valid null result; it must not block the
 * client's billing profile.
 */
export async function getTenantAssistHourlyRateCents(
  tenantId: string,
): Promise<ServiceResult<number | null>> {
  const denied = guardServiceTenant(tenantId);
  if (denied) return denied;
  if (!isLiveServiceMode()) return { ok: true, data: null };

  const client = getSupabaseClient();
  if (!client) return { ok: true, data: null };

  const { data: catalogData, error: catalogError } = await fromUnknownTable(client, 'tenant_service_catalog')
    .select('id, service_key, sort_order')
    .eq('tenant_id', tenantId)
    .eq('module_key', 'assist')
    .eq('category', 'service')
    .eq('unit', 'hour')
    .eq('is_active', true);
  if (catalogError) return { ok: true, data: null };

  const catalogRows = ((catalogData ?? []) as Record<string, unknown>[])
    .map((row) => ({
      id: String(row.id),
      service_key: String(row.service_key),
      sort_order: row.sort_order == null ? null : Number(row.sort_order),
    } satisfies CatalogRow))
    .sort((a, b) => priorityFor(a) - priorityFor(b));
  if (catalogRows.length === 0) return { ok: true, data: null };

  const { data: priceData, error: priceError } = await fromUnknownTable(client, 'tenant_service_prices')
    .select('catalog_id, price_net, valid_from')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .in('catalog_id', catalogRows.map((row) => row.id));
  if (priceError) return { ok: true, data: null };

  const validPrices = ((priceData ?? []) as Record<string, unknown>[])
    .map((row) => ({
      catalogId: String(row.catalog_id),
      cents: Math.round(Number(row.price_net) * 100),
      validFrom: String(row.valid_from ?? ''),
    }))
    .filter((row) => Number.isFinite(row.cents) && row.cents > 0);

  for (const catalog of catalogRows) {
    const price = validPrices
      .filter((row) => row.catalogId === catalog.id)
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
    if (price) return { ok: true, data: price.cents };
  }
  return { ok: true, data: null };
}
