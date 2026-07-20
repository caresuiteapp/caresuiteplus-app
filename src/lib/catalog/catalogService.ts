import type { RoleKey, ServiceResult } from '@/types';
import type { CatalogListItem, CatalogDetail, CatalogItemListItem } from '@/types/modules/catalog';
import {
  getDemoCatalogDetail,
  getDemoCatalogItems,
  getDemoCatalogListItems,
} from '@/data/demo/catalogs';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { catalogSupabaseRepository } from '@/lib/services/repositories/catalogRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { runService } from '@/lib/services/serviceRunner';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { INVOICE_MODULES, getInvoiceModule, isInvoiceModuleKey } from '@/lib/office/invoiceModules';
import { formatServicePriceUnit } from '@/lib/tenant/serviceCatalogLabels';
import type { ServicePriceUnit, TenantModuleKey } from '@/types/tenant/tenantCenter';

const DELAY = 300;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const TENANT_SERVICE_CATALOG_PREFIX = 'tenant-service:';

type TenantServiceCatalogRow = {
  id: string;
  module_key: TenantModuleKey;
  service_key: string;
  name: string;
  description: string | null;
  unit: ServicePriceUnit;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type TenantServicePriceRow = {
  catalog_id: string;
  price_net: number | string;
  valid_from: string | null;
};

export function tenantServiceCatalogId(moduleKey: TenantModuleKey): string {
  return `${TENANT_SERVICE_CATALOG_PREFIX}${moduleKey}`;
}

export function parseTenantServiceCatalogId(catalogId: string): TenantModuleKey | null {
  if (!catalogId.startsWith(TENANT_SERVICE_CATALOG_PREFIX)) return null;
  const moduleKey = catalogId.slice(TENANT_SERVICE_CATALOG_PREFIX.length);
  return isInvoiceModuleKey(moduleKey) ? moduleKey : null;
}

async function loadTenantServiceRows(
  tenantId: string,
  moduleKey?: TenantModuleKey,
): Promise<ServiceResult<TenantServiceCatalogRow[]>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

  let query = fromUnknownTable(client, 'tenant_service_catalog')
    .select('id, module_key, service_key, name, description, unit, is_active, sort_order, created_at, updated_at')
    .eq('tenant_id', tenantId);
  if (moduleKey) query = query.eq('module_key', moduleKey);
  const { data, error } = await query.order('sort_order', { ascending: true });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  const rows = ((data ?? []) as Record<string, unknown>[]).flatMap((row) => {
    if (!isInvoiceModuleKey(row.module_key)) return [];
    return [{
      id: String(row.id),
      module_key: row.module_key,
      service_key: String(row.service_key),
      name: String(row.name),
      description: row.description == null ? null : String(row.description),
      unit: row.unit as ServicePriceUnit,
      is_active: Boolean(row.is_active),
      sort_order: Number(row.sort_order ?? 0),
      created_at: String(row.created_at ?? row.updated_at ?? new Date(0).toISOString()),
      updated_at: String(row.updated_at ?? row.created_at ?? new Date(0).toISOString()),
    } satisfies TenantServiceCatalogRow];
  });
  return { ok: true, data: rows };
}

function toCatalogListItem(moduleKey: TenantModuleKey, rows: TenantServiceCatalogRow[]): CatalogListItem {
  const moduleDefinition = getInvoiceModule(moduleKey);
  const latestUpdate = rows.reduce(
    (latest, row) => row.updated_at > latest ? row.updated_at : latest,
    rows[0]?.updated_at ?? new Date(0).toISOString(),
  );
  return {
    id: tenantServiceCatalogId(moduleKey),
    name: `${moduleDefinition.label}-Leistungskatalog`,
    catalogType: 'service',
    description: `${moduleDefinition.basis} · ${moduleDefinition.description}`,
    itemCount: rows.length,
    status: rows.some((row) => row.is_active) ? 'aktiv' : 'entwurf',
    updatedAt: latestUpdate,
  };
}

export async function fetchCatalogList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogListItem[]>> {
  const denied = enforcePermission<CatalogListItem[]>(actorRoleKey, 'office.catalogs.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const result = await loadTenantServiceRows(tenantId);
    if (!result.ok) return result;
    const data = INVOICE_MODULES.flatMap((moduleDefinition) => {
      const rows = result.data.filter((row) => row.module_key === moduleDefinition.key);
      return rows.length > 0 ? [toCatalogListItem(moduleDefinition.key, rows)] : [];
    });
    return { ok: true, data };
  }

  return runService(async () => {
    await delay(DELAY);
    return { ok: true, data: getDemoCatalogListItems() };
  });
}

export async function fetchCatalogDetail(
  catalogId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogDetail>> {
  const denied = enforcePermission<CatalogDetail>(actorRoleKey, 'office.catalogs.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const moduleKey = parseTenantServiceCatalogId(catalogId);
    if (moduleKey) {
      const result = await loadTenantServiceRows(tenantId, moduleKey);
      if (!result.ok) return result;
      if (result.data.length === 0) return { ok: false, error: 'Katalog nicht gefunden.' };
      const listItem = toCatalogListItem(moduleKey, result.data);
      return {
        ok: true,
        data: {
          ...listItem,
          createdAt: result.data.reduce(
            (earliest, row) => row.created_at < earliest ? row.created_at : earliest,
            result.data[0].created_at,
          ),
          usageCount: 0,
        },
      };
    }
    const result = await catalogSupabaseRepository.getById(tenantId, catalogId);
    if (!result.ok) return result;
    if (!result.data) return { ok: false, error: 'Katalog nicht gefunden.' };
    return {
      ok: true,
      data: {
        id: result.data.id,
        name: result.data.title,
        catalogType: 'service',
        description: null,
        itemCount: 0,
        status: result.data.status as CatalogDetail['status'],
        updatedAt: result.data.updated_at,
        createdAt: result.data.created_at ?? result.data.updated_at,
        usageCount: 0,
      },
    };
  }

  return runService(async () => {
    await delay(DELAY);
    const detail = getDemoCatalogDetail(catalogId);
    if (!detail) return { ok: false, error: 'Katalog nicht gefunden.' };
    return { ok: true, data: detail };
  });
}

export async function fetchCatalogItems(
  catalogId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogItemListItem[]>> {
  const denied = enforcePermission<CatalogItemListItem[]>(actorRoleKey, 'office.catalogs.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const moduleKey = parseTenantServiceCatalogId(catalogId);
    if (!moduleKey) return { ok: true, data: [] };
    const rowsResult = await loadTenantServiceRows(tenantId, moduleKey);
    if (!rowsResult.ok) return rowsResult;
    if (rowsResult.data.length === 0) return { ok: true, data: [] };

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: 'Supabase ist nicht verfügbar.' };
    const ids = rowsResult.data.map((row) => row.id);
    const { data: priceData, error: priceError } = await fromUnknownTable(client, 'tenant_service_prices')
      .select('catalog_id, price_net, valid_from')
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .in('catalog_id', ids)
      .order('valid_from', { ascending: false });
    if (priceError) return { ok: false, error: toGermanSupabaseError(priceError) };

    const latestPriceByCatalog = new Map<string, TenantServicePriceRow>();
    ((priceData ?? []) as Record<string, unknown>[]).forEach((row) => {
      const catalogItemId = String(row.catalog_id);
      if (latestPriceByCatalog.has(catalogItemId)) return;
      latestPriceByCatalog.set(catalogItemId, {
        catalog_id: catalogItemId,
        price_net: Number(row.price_net ?? 0),
        valid_from: row.valid_from == null ? null : String(row.valid_from),
      });
    });

    return {
      ok: true,
      data: rowsResult.data.map((row) => {
        const price = latestPriceByCatalog.get(row.id);
        const priceNet = price ? Number(price.price_net) : Number.NaN;
        return {
          id: row.id,
          catalogId,
          code: row.service_key,
          label: row.name,
          unit: formatServicePriceUnit(row.unit),
          priceCents: Number.isFinite(priceNet) ? Math.round(priceNet * 100) : null,
          status: row.is_active ? 'aktiv' : 'archiviert',
          updatedAt: row.updated_at,
        };
      }),
    };
  }

  return runService(async () => {
    await delay(DELAY);
    return { ok: true, data: getDemoCatalogItems(catalogId) };
  });
}

export function formatCatalogPrice(cents: number | null): string {
  if (cents == null) return '—';
  return `${(cents / 100).toFixed(2)} €`;
}

