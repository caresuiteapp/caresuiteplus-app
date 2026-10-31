import { currentCompanyWorkflows } from './currentCompanyWorkflows';
import { guardLegacyCompanyWebAccess } from './companyLegacyWebAccess';
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
import { isUnreleasedCatalogModuleKey } from '@/lib/modules/constants';
import {
  DEFAULT_TRAVEL_COMPENSATION_POLICY,
  normalizeTravelCompensationPolicy,
} from '@/lib/travel/travelCompensationPolicy';
import type { TravelCompensationPolicy } from '@/types/modules/travelCompensation';

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
    travelPolicy: DEFAULT_TRAVEL_COMPENSATION_POLICY,
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
    travelPolicy: DEFAULT_TRAVEL_COMPENSATION_POLICY,
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
    travelPolicy: row.category === 'travel'
      ? normalizeTravelCompensationPolicy(row.travel_policy_json)
      : null,
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

/** Every released company editor needs the complete inventory and exact prices. */
async function readCatalogPages(
  load: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown; count: number | null }>,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let expected: number | null = null;
  for (let offset = 0; offset < 20000; offset += 250) {
    const page = await load(offset, offset + 249);
    if (page.error) throw page.error;
    if (!Array.isArray(page.data) || !Number.isSafeInteger(page.count) || Number(page.count) < 0
        || expected !== null && page.count !== expected || page.data.length > 250) {
      throw new Error('Unvollständige Katalogdaten.');
    }
    expected = page.count;
    for (const value of page.data) {
      if (!value || typeof value !== 'object' || Array.isArray(value)
          || typeof value.id !== 'string' || !value.id.trim() || seen.has(value.id)) {
        throw new Error('Der Katalog wurde während des Ladens geändert.');
      }
      seen.add(value.id);
      rows.push(value as Record<string, unknown>);
    }
    if (rows.length === expected) return rows;
    if (rows.length > Number(expected) || page.data.length < 250) throw new Error('Unvollständige Katalogdaten.');
  }
  throw new Error('Der Katalog ist für diese Ansicht zu umfangreich.');
}

export async function fetchTenantServiceCatalog(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  moduleKey?: TenantModuleKey,
): Promise<ServiceResult<TenantServiceCatalogSnapshot>> {
  const webDenied = await guardLegacyCompanyWebAccess<TenantServiceCatalogSnapshot>(tenantId);
  if (webDenied) return webDenied;
  const denied = currentCompanyWorkflows ? null : enforcePermission<TenantServiceCatalogSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!isLiveServiceMode()) {
    return { ok: true, data: ensureDemoCatalog(tenantId) };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  let catalogRows: Record<string, unknown>[] = [];
  let priceRows: Record<string, unknown>[] = [];
  if (currentCompanyWorkflows) {
    try {
      catalogRows = await readCatalogPages((from, to) => {
        let query = fromUnknownTable(client, 'tenant_service_catalog')
          .select('*', { count: 'exact' }).eq('tenant_id', tenantId);
        if (moduleKey) query = query.eq('module_key', moduleKey);
        return query.order('id').range(from, to);
      });
      if (catalogRows.some((row) => row.tenant_id !== tenantId || moduleKey && row.module_key !== moduleKey)) {
        throw new Error('Die Katalogpositionen gehören nicht zum ausgewählten Katalog.');
      }
      const priceIds = new Set<string>();
      for (let offset = 0; offset < catalogRows.length; offset += 150) {
        const ids = catalogRows.slice(offset, offset + 150).map((row) => String(row.id));
        const idSet = new Set(ids);
        const batch = await readCatalogPages((from, to) => fromUnknownTable(client, 'tenant_service_prices')
          .select('*', { count: 'exact' }).eq('tenant_id', tenantId).in('catalog_id', ids)
          .eq('is_default', true).order('id').range(from, to));
        for (const row of batch) {
          const id = String(row.id);
          if (row.tenant_id !== tenantId || !idSet.has(String(row.catalog_id)) || row.is_default !== true || priceIds.has(id)) {
            throw new Error('Die Preise gehören nicht eindeutig zum ausgewählten Katalog.');
          }
          priceIds.add(id);
          priceRows.push(row);
        }
      }
      catalogRows.sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || String(a.id).localeCompare(String(b.id)));
    } catch {
      return { ok: false, error: 'Die Katalogpositionen und Preise konnten nicht vollständig geladen werden. Bitte erneut versuchen.' };
    }
  } else {
    const { data, error } = await fromUnknownTable(client, 'tenant_service_catalog')
      .select('*').eq('tenant_id', tenantId).order('sort_order');
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    catalogRows = (data ?? []) as Record<string, unknown>[];
    const catalogIds = catalogRows.map((row) => String(row.id));
    if (catalogIds.length) {
      const priceRes = await fromUnknownTable(client, 'tenant_service_prices')
        .select('*').eq('tenant_id', tenantId).in('catalog_id', catalogIds).eq('is_default', true);
      if (currentCompanyWorkflows && priceRes.error) return { ok: false, error: toGermanSupabaseError(priceRes.error) };
      priceRows = (priceRes.data ?? []) as Record<string, unknown>[];
    }
  }

  const priceByCatalog = new Map(priceRows.map((row) => [String(row.catalog_id), row]));
  if (currentCompanyWorkflows && priceByCatalog.size !== priceRows.length) {
    return { ok: false, error: 'Für eine Position sind mehrere Standardpreise hinterlegt. Bitte die Preiszuordnung prüfen, bevor Sie den Katalog bearbeiten.' };
  }
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
  validTo?: string | null;
  travelPolicy?: TravelCompensationPolicy | null;
};

export async function saveTenantServiceCatalogItem(
  tenantId: string,
  input: SaveCatalogItemInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantServiceCatalogSnapshot>> {
  const effectiveFrom = input.validFrom ?? (currentCompanyWorkflows ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) : new Date().toISOString().slice(0, 10));
  const webDenied = await guardLegacyCompanyWebAccess<TenantServiceCatalogSnapshot>(tenantId);
  if (webDenied) return webDenied;
  const denied = currentCompanyWorkflows ? null : enforcePermission<TenantServiceCatalogSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;

  if (currentCompanyWorkflows) {
    const tenantBlock = guardServiceTenant(tenantId);
    if (tenantBlock) return tenantBlock;
    if (!input.name.trim()) return { ok: false, error: 'Bitte eine Bezeichnung eingeben.' };
    if (isUnreleasedCatalogModuleKey(input.moduleKey)) return { ok: false, error: 'Dieser Katalog ist noch nicht freigegeben.' };
    if (!['assist', 'pflege', 'stationaer', 'beratung'].includes(input.moduleKey) || !['service', 'travel', 'surcharge'].includes(input.category) || !['hour', 'visit', 'day', 'flat', 'km', 'percent'].includes(input.unit)) {
      return { ok: false, error: 'Bitte einen gültigen Katalog, eine Kategorie und eine Abrechnungseinheit auswählen.' };
    }
    const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
    if (input.priceNet != null && (!validDate(effectiveFrom) || input.validTo != null && (!validDate(input.validTo) || input.validTo < effectiveFrom))) {
      return { ok: false, error: 'Bitte einen gültigen Preiszeitraum eingeben. Das Enddatum darf nicht vor dem Startdatum liegen.' };
    }
    if (input.priceNet != null && (!Number.isFinite(input.priceNet) || input.priceNet < 0 || input.priceNet > 99999999.99)) {
      return { ok: false, error: 'Bitte einen gültigen, nicht negativen Preis eingeben.' };
    }
  }

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
      defaultPriceNet: input.priceNet ?? (currentCompanyWorkflows && existingIndex >= 0 ? catalog.items[existingIndex]?.defaultPriceNet : null) ?? null,
      defaultTaxMode: input.taxMode ?? 'exempt_4_16',
      travelPolicy: input.category === 'travel'
        ? normalizeTravelCompensationPolicy(input.travelPolicy)
        : null,
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
    travel_policy_json: input.category === 'travel'
      ? normalizeTravelCompensationPolicy(input.travelPolicy)
      : null,
  };

  let catalogId = input.id;
  if (catalogId) {
    const query = fromUnknownTable(client, 'tenant_service_catalog')
      .update(catalogPayload)
      .eq('tenant_id', tenantId)
      .eq('id', catalogId);
    const { error } = currentCompanyWorkflows ? await query.select('id').single() : await query;
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  } else {
    const table = fromUnknownTable(client, 'tenant_service_catalog');
    // A retry after a price failure must reuse the same position.
    const query = currentCompanyWorkflows
      ? table.upsert(catalogPayload, { onConflict: 'tenant_id,service_key' })
      : table.insert(catalogPayload);
    const { data, error } = await query.select('id').single();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    catalogId = String((data as Record<string, unknown>).id);
  }

  if (input.priceNet != null && catalogId) {
    const pricePayload = {
      tenant_id: tenantId,
      catalog_id: catalogId,
      price_net: input.priceNet,
      tax_rate: input.taxRate ?? (currentCompanyWorkflows && input.taxMode === 'standard_19' ? 19 : 0),
      tax_mode: input.taxMode ?? 'exempt_4_16',
      valid_from: effectiveFrom,
      ...(currentCompanyWorkflows && input.validTo !== undefined ? { valid_to: input.validTo } : {}),
      is_default: true,
      updated_at: new Date().toISOString(),
    };
    const { data: existingPrice, error: priceReadError } = await fromUnknownTable(client, 'tenant_service_prices')
      .select('id, price_net, tax_rate, tax_mode, valid_from, valid_to')
      .eq('tenant_id', tenantId)
      .eq('catalog_id', catalogId)
      .eq('is_default', true)
      .maybeSingle();

    const priceFailure = (error: unknown): ServiceResult<TenantServiceCatalogSnapshot> => ({
      ok: false,
      error: `Die Katalogposition wurde gespeichert, der Preis jedoch nicht. Bitte den Preis prüfen und erneut speichern. ${toGermanSupabaseError(error)}`,
    });
    if (currentCompanyWorkflows && priceReadError) return priceFailure(priceReadError);

    if (existingPrice) {
      const old = existingPrice as Record<string, unknown>;
      if (currentCompanyWorkflows && Number(old.price_net) === pricePayload.price_net &&
          Number(old.tax_rate) === pricePayload.tax_rate && old.tax_mode === pricePayload.tax_mode &&
          (!input.validFrom || old.valid_from === input.validFrom) &&
          (input.validTo === undefined || (old.valid_to ?? null) === input.validTo)) {
        return fetchTenantServiceCatalog(tenantId, actorRoleKey, currentCompanyWorkflows ? input.moduleKey : undefined);
      }
      const versionResult = await fromUnknownTable(client, 'tenant_service_price_versions').insert({
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
      if (currentCompanyWorkflows && versionResult.error) return priceFailure(versionResult.error);
      const query = fromUnknownTable(client, 'tenant_service_prices')
        .update(pricePayload)
        .eq('id', old.id);
      const priceResult = currentCompanyWorkflows
        ? await query.eq('tenant_id', tenantId).select('id').single()
        : await query;
      if (currentCompanyWorkflows && priceResult.error) return priceFailure(priceResult.error);
    } else {
      const priceResult = await fromUnknownTable(client, 'tenant_service_prices').insert(pricePayload);
      if (currentCompanyWorkflows && priceResult.error) return priceFailure(priceResult.error);
    }
  }

  return fetchTenantServiceCatalog(tenantId, actorRoleKey, currentCompanyWorkflows ? input.moduleKey : undefined);
}

export function resetTenantServiceCatalogStore(): void {
  DEMO_CATALOG.clear();
}

export type TenantServicePriceVersion = {
  id: string;
  priceNet: number;
  taxMode: ServiceTaxMode;
  validFrom: string;
  changedAt: string;
};

/** Read-only detail for the company catalogue; opening the editor never seeds rows. */
export async function fetchTenantServicePriceHistory(
  tenantId: string,
  catalogId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantServicePriceVersion[]>> {
  const webDenied = await guardLegacyCompanyWebAccess<TenantServicePriceVersion[]>(tenantId);
  if (webDenied) return webDenied;
  const denied = currentCompanyWorkflows ? null : enforcePermission<TenantServicePriceVersion[]>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!isLiveServiceMode()) return { ok: true, data: [] };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  const price = await fromUnknownTable(client, 'tenant_service_prices').select('id')
    .eq('tenant_id', tenantId).eq('catalog_id', catalogId).eq('is_default', true).maybeSingle();
  if (price.error) return { ok: false, error: toGermanSupabaseError(price.error) };
  if (!price.data) return { ok: true, data: [] };
  const result = await fromUnknownTable(client, 'tenant_service_price_versions').select('*')
    .eq('tenant_id', tenantId).eq('price_id', price.data.id).order('changed_at', { ascending: false });
  if (result.error) return { ok: false, error: toGermanSupabaseError(result.error) };
  return { ok: true, data: (result.data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id), priceNet: Number(row.price_net), taxMode: row.tax_mode as ServiceTaxMode,
    validFrom: String(row.valid_from), changedAt: String(row.changed_at),
  })) };
}
