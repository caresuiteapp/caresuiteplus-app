import type { RoleKey, ServiceResult } from '@/types';
import type {
  ServiceCatalogCategory,
  ServicePriceUnit,
  ServiceTaxMode,
  TenantModuleKey,
  TenantServiceCatalogItem,
  TenantServicePrice,
} from '@/types/tenant/tenantCenter';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant, isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { formatHourlyRateDocumentAmount } from '@/lib/formatters/numberFormatters';
import { formatServicePriceUnitShort } from '@/lib/tenant/serviceCatalogLabels';
import { TENANT_SETTINGS_PERMISSION } from './tenantSettingsRoute';

export type TenantServiceCatalogSnapshot = {
  items: TenantServiceCatalogItem[];
  prices: TenantServicePrice[];
};

const DEMO_CATALOG = new Map<string, TenantServiceCatalogSnapshot>();

const DEFAULT_CATALOG_ITEMS: Omit<TenantServiceCatalogItem, 'id'>[] = [
  {
    moduleKey: 'assist',
    serviceKey: 'assist.alltagsbegleitung',
    name: 'Alltagsbegleitung',
    description: 'Individuelle Alltagsbegleitung und Betreuung',
    unit: 'hour',
    category: 'service',
    isActive: true,
    sortOrder: 10,
    defaultPriceNet: 38,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'assist',
    serviceKey: 'assist.entlastung_45b',
    name: 'Entlastungsleistung § 45b SGB XI',
    description: 'Entlastungsleistung nach § 45b SGB XI',
    unit: 'hour',
    category: 'service',
    isActive: true,
    sortOrder: 20,
    defaultPriceNet: 38,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'assist',
    serviceKey: 'assist.verhinderungspflege_39',
    name: 'Verhinderungspflege § 39 SGB XI',
    description: 'Verhinderungspflege nach § 39 SGB XI',
    unit: 'hour',
    category: 'service',
    isActive: true,
    sortOrder: 30,
    defaultPriceNet: 38,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'assist',
    serviceKey: 'assist.haushaltshilfe_38',
    name: 'Haushaltshilfe § 38 SGB V',
    description: 'Haushaltshilfe nach § 38 SGB V',
    unit: 'hour',
    category: 'service',
    isActive: true,
    sortOrder: 40,
    defaultPriceNet: 38,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'assist',
    serviceKey: 'assist.travel.km',
    name: 'Fahrtkosten (Kilometer)',
    description: 'Kilometerpauschale für Assist-Fahrten',
    unit: 'km',
    category: 'travel',
    isActive: true,
    sortOrder: 100,
    defaultPriceNet: 0.3,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'assist',
    serviceKey: 'assist.surcharge.weekend',
    name: 'Wochenend-Zuschlag',
    description: 'Zuschlag für Leistungen am Wochenende',
    unit: 'percent',
    category: 'surcharge',
    isActive: true,
    sortOrder: 110,
    defaultPriceNet: 25,
    defaultTaxMode: 'none',
  },
  {
    moduleKey: 'pflege',
    serviceKey: 'pflege.grundpflege',
    name: 'Grundpflege',
    description: 'Körperpflege, Ernährung und Mobilität im häuslichen Umfeld',
    unit: 'hour',
    category: 'service',
    isActive: true,
    sortOrder: 10,
    defaultPriceNet: null,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'pflege',
    serviceKey: 'pflege.behandlungspflege',
    name: 'Behandlungspflege',
    description: 'Medizinische Behandlungspflege durch examinierte Fachkräfte',
    unit: 'hour',
    category: 'service',
    isActive: true,
    sortOrder: 20,
    defaultPriceNet: null,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'pflege',
    serviceKey: 'pflege.hauswirtschaft',
    name: 'Hauswirtschaftliche Versorgung',
    description: 'Unterstützung im Haushalt und bei der Versorgung',
    unit: 'hour',
    category: 'service',
    isActive: true,
    sortOrder: 30,
    defaultPriceNet: null,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'pflege',
    serviceKey: 'pflege.betreuung',
    name: 'Betreuungsleistungen',
    description: 'Anleitung und Beaufsichtigung im Alltag',
    unit: 'hour',
    category: 'service',
    isActive: true,
    sortOrder: 40,
    defaultPriceNet: null,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'pflege',
    serviceKey: 'pflege.travel.km',
    name: 'Fahrtkosten (Kilometer)',
    description: 'Kilometerpauschale für Pflege-Fahrten',
    unit: 'km',
    category: 'travel',
    isActive: true,
    sortOrder: 100,
    defaultPriceNet: 0.3,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'pflege',
    serviceKey: 'pflege.surcharge.night',
    name: 'Nacht-Zuschlag',
    description: 'Zuschlag für Leistungen in der Nacht',
    unit: 'percent',
    category: 'surcharge',
    isActive: true,
    sortOrder: 110,
    defaultPriceNet: 25,
    defaultTaxMode: 'none',
  },
  {
    moduleKey: 'stationaer',
    serviceKey: 'stationaer.tagespflege',
    name: 'Tagespflege',
    description: 'Teilstationäre Tagespflege in einer Einrichtung',
    unit: 'day',
    category: 'service',
    isActive: true,
    sortOrder: 10,
    defaultPriceNet: null,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'stationaer',
    serviceKey: 'stationaer.kurzzeitpflege',
    name: 'Kurzzeitpflege',
    description: 'Kurzzeitpflege bei vorübergehendem Pflegebedarf',
    unit: 'day',
    category: 'service',
    isActive: true,
    sortOrder: 20,
    defaultPriceNet: null,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'stationaer',
    serviceKey: 'stationaer.verhinderungspflege',
    name: 'Verhinderungspflege stationär',
    description: 'Stationäre Verhinderungspflege nach § 39 SGB XI',
    unit: 'day',
    category: 'service',
    isActive: true,
    sortOrder: 30,
    defaultPriceNet: null,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'stationaer',
    serviceKey: 'stationaer.vollstationaer',
    name: 'Vollstationäre Pflege',
    description: 'Dauerhafte vollstationäre Pflegeleistung',
    unit: 'day',
    category: 'service',
    isActive: true,
    sortOrder: 40,
    defaultPriceNet: null,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'beratung',
    serviceKey: 'beratung.pflegeberatung_7a',
    name: 'Pflegeberatung § 7a SGB XI',
    description: 'Pflichtberatung nach § 7a SGB XI',
    unit: 'visit',
    category: 'service',
    isActive: true,
    sortOrder: 10,
    defaultPriceNet: null,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'beratung',
    serviceKey: 'beratung.beratungsbesuch',
    name: 'Beratungsbesuch',
    description: 'Individueller Beratungsbesuch bei Klienten oder Angehörigen',
    unit: 'visit',
    category: 'service',
    isActive: true,
    sortOrder: 20,
    defaultPriceNet: null,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'beratung',
    serviceKey: 'beratung.case_management',
    name: 'Case Management',
    description: 'Fallsteuerung und Koordination von Hilfeangeboten',
    unit: 'hour',
    category: 'service',
    isActive: true,
    sortOrder: 30,
    defaultPriceNet: null,
    defaultTaxMode: 'exempt_4_16',
  },
  {
    moduleKey: 'beratung',
    serviceKey: 'beratung.widerspruch',
    name: 'Widerspruchsberatung',
    description: 'Beratung bei Widerspruchsverfahren und Leistungsansprüchen',
    unit: 'visit',
    category: 'service',
    isActive: true,
    sortOrder: 40,
    defaultPriceNet: null,
    defaultTaxMode: 'exempt_4_16',
  },
];

function ensureDemoCatalog(tenantId: string): TenantServiceCatalogSnapshot {
  if (!DEMO_CATALOG.has(tenantId)) {
    DEMO_CATALOG.set(tenantId, {
      items: DEFAULT_CATALOG_ITEMS.map((item, index) => ({
        ...item,
        id: `demo-catalog-${index}`,
      })),
      prices: [],
    });
  }
  return DEMO_CATALOG.get(tenantId)!;
}

function mapCatalogRow(row: Record<string, unknown>, price?: Record<string, unknown> | null): TenantServiceCatalogItem {
  return {
    id: String(row.id),
    moduleKey: row.module_key as TenantModuleKey,
    serviceKey: String(row.service_key),
    name: String(row.name),
    description: String(row.description ?? ''),
    unit: row.unit as ServicePriceUnit,
    category: row.category as ServiceCatalogCategory,
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
    defaultPriceNet: price?.price_net != null ? Number(price.price_net) : null,
    defaultTaxMode: (price?.tax_mode as ServiceTaxMode | undefined) ?? null,
  };
}

export function formatCatalogSummary(items: TenantServiceCatalogItem[]): string {
  const assist = items.filter((item) => item.moduleKey === 'assist' && item.category === 'service' && item.isActive);
  if (!assist.length) return 'Kein Assist-Katalog';
  const primary = assist.find((item) => item.serviceKey === 'assist.alltagsbegleitung') ?? assist[0];
  if (!primary?.defaultPriceNet) return `${assist.length} Assist-Leistung(en)`;
  return `Assist: ${primary.name} ${formatHourlyRateDocumentAmount(primary.defaultPriceNet)} €/${formatServicePriceUnitShort(primary.unit)}`;
}

export async function seedTenantServiceCatalogIfEmpty(tenantId: string): Promise<ServiceResult<void>> {
  if (!isLiveServiceMode()) return { ok: true, data: undefined };

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  const { error: rpcError } = await client.rpc('seed_tenant_service_catalog' as never, {
    p_tenant_id: tenantId,
  } as never);

  if (rpcError) return { ok: false, error: toGermanSupabaseError(rpcError) };
  return { ok: true, data: undefined };
}

/** @deprecated Nutze seedTenantServiceCatalogIfEmpty — seedet jetzt alle Module. */
export async function seedAssistCatalogIfEmpty(tenantId: string): Promise<ServiceResult<void>> {
  return seedTenantServiceCatalogIfEmpty(tenantId);
}

export async function fetchTenantServiceCatalog(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantServiceCatalogSnapshot>> {
  const denied = enforcePermission<TenantServiceCatalogSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!isLiveServiceMode()) {
    return { ok: true, data: ensureDemoCatalog(tenantId) };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  const { data: catalogRows, error } = await fromUnknownTable(client, 'tenant_service_catalog')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order');

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  const catalogIds = (catalogRows ?? []).map((row: Record<string, unknown>) => String(row.id));
  let priceRows: Record<string, unknown>[] = [];
  if (catalogIds.length) {
    const priceRes = await fromUnknownTable(client, 'tenant_service_prices')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('catalog_id', catalogIds)
      .eq('is_default', true);
    priceRows = (priceRes.data ?? []) as Record<string, unknown>[];
  }

  const priceByCatalog = new Map(priceRows.map((row) => [String(row.catalog_id), row]));
  const items = ((catalogRows ?? []) as Record<string, unknown>[]).map((row) =>
    mapCatalogRow(row, priceByCatalog.get(String(row.id))),
  );

  const prices: TenantServicePrice[] = priceRows.map((row) => ({
    id: String(row.id),
    catalogId: String(row.catalog_id),
    priceNet: Number(row.price_net),
    taxRate: Number(row.tax_rate ?? 0),
    taxMode: row.tax_mode as ServiceTaxMode,
    validFrom: String(row.valid_from),
    validTo: row.valid_to ? String(row.valid_to) : null,
    isDefault: Boolean(row.is_default),
  }));

  return { ok: true, data: { items, prices } };
}

export type SaveCatalogItemInput = {
  id?: string;
  moduleKey: TenantModuleKey;
  serviceKey: string;
  name: string;
  description?: string;
  unit: ServicePriceUnit;
  category: ServiceCatalogCategory;
  isActive?: boolean;
  sortOrder?: number;
  priceNet?: number;
  taxMode?: ServiceTaxMode;
  taxRate?: number;
  validFrom?: string;
};

export async function saveTenantServiceCatalogItem(
  tenantId: string,
  input: SaveCatalogItemInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantServiceCatalogSnapshot>> {
  const denied = enforcePermission<TenantServiceCatalogSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;

  if (!isLiveServiceMode()) {
    const catalog = ensureDemoCatalog(tenantId);
    const existingIndex = catalog.items.findIndex((item) => item.serviceKey === input.serviceKey);
    const next: TenantServiceCatalogItem = {
      id: input.id ?? `demo-${input.serviceKey}`,
      moduleKey: input.moduleKey,
      serviceKey: input.serviceKey,
      name: input.name,
      description: input.description ?? '',
      unit: input.unit,
      category: input.category,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      defaultPriceNet: input.priceNet ?? null,
      defaultTaxMode: input.taxMode ?? 'exempt_4_16',
    };
    if (existingIndex >= 0) catalog.items[existingIndex] = next;
    else catalog.items.push(next);
    return { ok: true, data: catalog };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  const catalogPayload = {
    tenant_id: tenantId,
    module_key: input.moduleKey,
    service_key: input.serviceKey,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    unit: input.unit,
    category: input.category,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
    updated_at: new Date().toISOString(),
  };

  let catalogId = input.id;
  if (catalogId) {
    const { error } = await fromUnknownTable(client, 'tenant_service_catalog')
      .update(catalogPayload)
      .eq('tenant_id', tenantId)
      .eq('id', catalogId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  } else {
    const { data, error } = await fromUnknownTable(client, 'tenant_service_catalog')
      .insert(catalogPayload)
      .select('id')
      .single();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    catalogId = String((data as Record<string, unknown>).id);
  }

  if (input.priceNet != null && catalogId) {
    const pricePayload = {
      tenant_id: tenantId,
      catalog_id: catalogId,
      price_net: input.priceNet,
      tax_rate: input.taxRate ?? 0,
      tax_mode: input.taxMode ?? 'exempt_4_16',
      valid_from: input.validFrom ?? new Date().toISOString().slice(0, 10),
      is_default: true,
      updated_at: new Date().toISOString(),
    };
    const { data: existingPrice } = await fromUnknownTable(client, 'tenant_service_prices')
      .select('id, price_net, tax_rate, tax_mode, valid_from, valid_to')
      .eq('tenant_id', tenantId)
      .eq('catalog_id', catalogId)
      .eq('is_default', true)
      .maybeSingle();

    if (existingPrice) {
      const old = existingPrice as Record<string, unknown>;
      await fromUnknownTable(client, 'tenant_service_price_versions').insert({
        tenant_id: tenantId,
        price_id: old.id,
        price_net: old.price_net,
        tax_rate: old.tax_rate,
        tax_mode: old.tax_mode,
        valid_from: old.valid_from,
        valid_to: old.valid_to,
        change_reason: 'Katalog-Update',
        snapshot: old,
      });
      await fromUnknownTable(client, 'tenant_service_prices')
        .update(pricePayload)
        .eq('id', old.id);
    } else {
      await fromUnknownTable(client, 'tenant_service_prices').insert(pricePayload);
    }
  }

  return fetchTenantServiceCatalog(tenantId, actorRoleKey);
}

export function resetTenantServiceCatalogStore(): void {
  DEMO_CATALOG.clear();
}
