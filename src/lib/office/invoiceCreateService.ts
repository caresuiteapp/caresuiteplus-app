import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { invoiceSupabaseRepository } from '@/lib/services/repositories/invoiceRepository.supabase';
import type { InvoiceSourceRecord } from '@/lib/services/repositories/invoiceRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { formatServicePriceUnit } from '@/lib/tenant/serviceCatalogLabels';
import type { ServicePriceUnit, ServiceTaxMode, TenantModuleKey } from '@/types/tenant/tenantCenter';
import { getClientBudgetAccounts, listClientCareEntitlements } from '@/lib/assist/clientBudgetAccountService';
import { normalizeCareLevelKey } from '@/lib/formatters/unitFormatters';

export type InvoiceCreateInput = {
  title: string;
  clientId?: string;
  clientName?: string;
  totalCents?: number;
  dueDate?: string;
  invoiceDate?: string;
  servicePeriodStart?: string;
  servicePeriodEnd?: string;
  catalogItemId?: string;
  catalogQuantity?: number;
  catalogQuantityMode?: 'preset' | 'manual';
  billingModule?: TenantModuleKey;
};

export type InvoicePositionPreview = {
  clientId: string;
  billingModule: TenantModuleKey;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  count: number;
  totalCents: number;
};

export type InvoiceCatalogOption = {
  id: string;
  name: string;
  description: string;
  moduleKey: TenantModuleKey;
  unit: ServicePriceUnit;
  unitLabel: string;
  priceCents: number;
  taxRate: number;
  taxMode: ServiceTaxMode;
};

export type InvoiceBudgetCapacity = {
  clientId: string;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  coveredMonths: number;
  careLevel: string;
  conversionEnabled: boolean;
  baseBudgetCents: number;
  conversionBudgetCents: number;
  statutoryMaximumCents: number;
  availableBudgetCents: number | null;
  effectiveMaximumCents: number;
};

const CONVERSION_BUDGET_CENTS: Record<string, number> = {
  pg2: 31840,
  pg3: 59880,
  pg4: 74360,
  pg5: 91960,
};

const DEMO_CATALOG_OPTIONS: InvoiceCatalogOption[] = [
  {
    id: 'demo-assist-alltagsbegleitung',
    name: 'Alltagsbegleitung',
    description: 'Individuelle Alltagsbegleitung und Betreuung',
    moduleKey: 'assist',
    unit: 'hour',
    unitLabel: 'Stunde',
    priceCents: 3800,
    taxRate: 0,
    taxMode: 'exempt_4_16',
  },
  {
    id: 'demo-assist-haushaltshilfe',
    name: 'Haushaltshilfe',
    description: 'Unterstützung im Haushalt',
    moduleKey: 'assist',
    unit: 'hour',
    unitLabel: 'Stunde',
    priceCents: 3800,
    taxRate: 0,
    taxMode: 'exempt_4_16',
  },
  {
    id: 'demo-pflege-grundpflege',
    name: 'Grundpflege nach Leistungskomplex',
    description: 'Kontrollierte Pflegeleistung aus dem Leistungskatalog',
    moduleKey: 'pflege',
    unit: 'visit',
    unitLabel: 'Leistung',
    priceCents: 5200,
    taxRate: 0,
    taxMode: 'exempt_4_16',
  },
  {
    id: 'demo-stationaer-pflegetag',
    name: 'Stationärer Pflegetag',
    description: 'Tagesbezogene stationäre Leistung',
    moduleKey: 'stationaer',
    unit: 'day',
    unitLabel: 'Tag',
    priceCents: 14800,
    taxRate: 0,
    taxMode: 'exempt_4_16',
  },
  {
    id: 'demo-beratung-beratungseinheit',
    name: 'Beratungseinheit',
    description: 'Dokumentierte Beratungs- oder Schulungsleistung',
    moduleKey: 'beratung',
    unit: 'hour',
    unitLabel: 'Stunde',
    priceCents: 7200,
    taxRate: 0,
    taxMode: 'none',
  },
];

export function getInvoiceCatalogQuantities(unit: ServicePriceUnit): number[] {
  if (unit === 'hour') return [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
  if (unit === 'km') return [1, 5, 10, 15, 20, 25, 30, 50];
  return [1, 2, 3, 4, 5, 6, 8, 10];
}

export function parseInvoiceQuantity(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validDateRange(start: string, end: string): boolean {
  return isValidIsoDate(start) && isValidIsoDate(end) && start <= end;
}

export function countInvoiceCoveredMonths(start: string, end: string): number {
  if (!validDateRange(start, end)) return 0;
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  return ((endYear - startYear) * 12) + endMonth - startMonth + 1;
}

async function loadInvoiceSourceRecords(
  tenantId: string,
  clientId: string,
  servicePeriodStart: string,
  servicePeriodEnd: string,
  billingModule: TenantModuleKey,
): Promise<ServiceResult<InvoiceSourceRecord[]>> {
  if (!validDateRange(servicePeriodStart, servicePeriodEnd)) {
    return { ok: false, error: 'Der Leistungszeitraum ist ungültig.' };
  }
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht verfügbar.' };
  const { data, error } = await client
    .from('service_records')
    .select('id, record_number, service_date, product_key, billable_minutes, hourly_rate, total_amount')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('product_key', billingModule)
    .is('billed_invoice_id', null)
    .in('status', ['approved', 'billable'])
    .gte('service_date', servicePeriodStart)
    .lte('service_date', servicePeriodEnd)
    .order('service_date', { ascending: true });
  if (error) return { ok: false, error: 'Abrechenbare Leistungsnachweise konnten nicht geladen werden.' };
  return { ok: true, data: (data ?? []) as InvoiceSourceRecord[] };
}

export async function fetchInvoiceCatalogOptions(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoiceCatalogOption[]>> {
  const denied = enforcePermission<InvoiceCatalogOption[]>(actorRoleKey, 'office.invoices.create');
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() !== 'supabase') return { ok: true, data: DEMO_CATALOG_OPTIONS };

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht verfügbar.' };
  const { data: catalogRows, error } = await fromUnknownTable(client, 'tenant_service_catalog')
    .select('id, module_key, name, description, unit, category, is_active, sort_order')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('category', ['service', 'travel'])
    .order('sort_order');
  if (error) return { ok: false, error: 'Leistungskatalog konnte nicht geladen werden.' };
  const ids = (catalogRows ?? []).map((row: Record<string, unknown>) => String(row.id));
  if (ids.length === 0) return { ok: true, data: [] };
  const { data: priceRows, error: priceError } = await fromUnknownTable(client, 'tenant_service_prices')
    .select('catalog_id, price_net, tax_rate, tax_mode')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .in('catalog_id', ids);
  if (priceError) return { ok: false, error: 'Katalogpreise konnten nicht geladen werden.' };
  const priceByCatalog = new Map(
    ((priceRows ?? []) as Record<string, unknown>[]).map((row) => [String(row.catalog_id), row]),
  );
  const options = ((catalogRows ?? []) as Record<string, unknown>[]).flatMap((row) => {
    const price = priceByCatalog.get(String(row.id));
    const priceNet = Number(price?.price_net ?? 0);
    const unit = row.unit as ServicePriceUnit;
    if (!price || !Number.isFinite(priceNet) || priceNet <= 0 || unit === 'percent') return [];
    return [{
      id: String(row.id),
      name: String(row.name),
      description: String(row.description ?? ''),
      moduleKey: row.module_key as TenantModuleKey,
      unit,
      unitLabel: formatServicePriceUnit(unit),
      priceCents: Math.round(priceNet * 100),
      taxRate: Number(price.tax_rate ?? 0),
      taxMode: (price.tax_mode as ServiceTaxMode | undefined) ?? (Number(price.tax_rate ?? 0) > 0 ? 'standard_19' : 'none'),
    }];
  });
  return { ok: true, data: options };
}

export async function fetchInvoiceBudgetCapacity(
  tenantId: string,
  clientId: string,
  servicePeriodStart: string,
  servicePeriodEnd: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoiceBudgetCapacity>> {
  const denied = enforcePermission<InvoiceBudgetCapacity>(actorRoleKey, 'office.invoices.create');
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (!validDateRange(servicePeriodStart, servicePeriodEnd)) {
    return { ok: false, error: 'Der Leistungszeitraum ist ungültig.' };
  }
  const months = countInvoiceCoveredMonths(servicePeriodStart, servicePeriodEnd);
  if (getServiceMode() !== 'supabase') {
    return {
      ok: true,
      data: {
        clientId,
        servicePeriodStart,
        servicePeriodEnd,
        coveredMonths: months,
        careLevel: 'pg2',
        conversionEnabled: true,
        baseBudgetCents: 13100 * months,
        conversionBudgetCents: CONVERSION_BUDGET_CENTS.pg2 * months,
        statutoryMaximumCents: 44940 * months,
        availableBudgetCents: 44940 * months,
        effectiveMaximumCents: 44940 * months,
      },
    };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht verfügbar.' };
  const startYear = Number(servicePeriodStart.slice(0, 4));
  const endYear = Number(servicePeriodEnd.slice(0, 4));
  const years = Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
  const [{ data: clientRow, error: clientError }, entitlements, accountResults] = await Promise.all([
    client
      .from('clients')
      .select('care_level')
      .eq('tenant_id', tenantId)
      .eq('id', clientId)
      .single(),
    listClientCareEntitlements(tenantId, clientId, servicePeriodStart),
    Promise.all(years.map((year) => getClientBudgetAccounts(tenantId, clientId, year))),
  ]);
  if (clientError || !clientRow) return { ok: false, error: 'Pflegegrad der Klient:in konnte nicht geladen werden.' };
  if (!entitlements.ok) return { ok: false, error: entitlements.error };
  const failedAccounts = accountResults.find((result) => !result.ok);
  if (failedAccounts && !failedAccounts.ok) return { ok: false, error: failedAccounts.error };
  const accounts = accountResults.flatMap((result) => result.ok ? result.data : []);

  const entitlement = entitlements.data[0];
  const careLevel = normalizeCareLevelKey(entitlement?.careGrade ?? clientRow.care_level);
  const conversionPotential = Boolean(CONVERSION_BUDGET_CENTS[careLevel]);
  const conversionEnabled = conversionPotential && (entitlement?.conversionEnabled ?? true);
  const baseBudgetCents = /^pg[1-5]$/.test(careLevel) ? 13100 * months : 0;
  const conversionBudgetCents = conversionEnabled ? (CONVERSION_BUDGET_CENTS[careLevel] ?? 0) * months : 0;
  const statutoryMaximumCents = baseBudgetCents + conversionBudgetCents;
  const eligibleKeys = new Set(['paragraph_45b']);
  if (conversionEnabled) eligibleKeys.add(`umwandlung_${careLevel}`);
  const matchingAccounts = accounts.filter((account) =>
    account.status === 'active'
    && account.isEnabled
    && !account.locked
    && eligibleKeys.has(account.catalogKey)
    && account.periodStart <= servicePeriodEnd
    && account.periodEnd >= servicePeriodStart,
  );
  const remainingByKey = new Map<string, number>();
  matchingAccounts.forEach((account) => {
    const remaining = Math.max(0, account.remainingCents ?? (account.allocatedCents - account.usedCents - account.reservedCents));
    const periodKey = `${account.catalogKey}:${account.periodStart}:${account.periodEnd}`;
    remainingByKey.set(periodKey, Math.max(remainingByKey.get(periodKey) ?? 0, remaining));
  });
  const availableBudgetCents = remainingByKey.size > 0
    ? [...remainingByKey.values()].reduce((sum, amount) => sum + amount, 0)
    : null;
  return {
    ok: true,
    data: {
      clientId,
      servicePeriodStart,
      servicePeriodEnd,
      coveredMonths: months,
      careLevel,
      conversionEnabled,
      baseBudgetCents,
      conversionBudgetCents,
      statutoryMaximumCents,
      availableBudgetCents,
      effectiveMaximumCents: availableBudgetCents ?? statutoryMaximumCents,
    },
  };
}

export async function fetchInvoicePositionPreview(
  tenantId: string,
  clientId: string,
  servicePeriodStart: string,
  servicePeriodEnd: string,
  billingModule: TenantModuleKey,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoicePositionPreview>> {
  const denied = enforcePermission<InvoicePositionPreview>(actorRoleKey, 'office.invoices.create');
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: { clientId, billingModule, servicePeriodStart, servicePeriodEnd, count: 1, totalCents: 0 } };
  }
  const records = await loadInvoiceSourceRecords(
    tenantId,
    clientId,
    servicePeriodStart,
    servicePeriodEnd,
    billingModule,
  );
  if (!records.ok) return records;
  const totalCents = records.data.reduce((sum, record) => {
    const minutes = Number(record.billable_minutes ?? 0);
    const rate = Number(record.hourly_rate ?? 0);
    const amount = Number(record.total_amount ?? ((minutes / 60) * rate));
    return sum + Math.round(amount * 100);
  }, 0);
  return {
    ok: true,
    data: { clientId, billingModule, servicePeriodStart, servicePeriodEnd, count: records.data.length, totalCents },
  };
}

/** WP226 — Rechnung anlegen (Demo + Supabase-ready) */
export async function createInvoice(
  tenantId: string,
  input: InvoiceCreateInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const billingModule = input.billingModule ?? 'assist';
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'office.invoices.create');
  if (denied) return denied;
  if (!input.title.trim()) return { ok: false, error: 'Titel ist Pflicht.' };
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    return { ok: false, error: 'Fälligkeitsdatum muss im Format JJJJ-MM-TT eingegeben werden.' };
  }
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    if (!['assist', 'pflege', 'stationaer', 'beratung'].includes(billingModule)) {
      return { ok: false, error: 'Bitte ein gültiges Abrechnungsmodul auswählen.' };
    }
    if (!input.clientId) return { ok: false, error: 'Klient:in muss aus dem System ausgewählt werden.' };
    if (!input.invoiceDate || !isValidIsoDate(input.invoiceDate)) {
      return { ok: false, error: 'Rechnungsdatum ist Pflicht.' };
    }
    if (!input.servicePeriodStart || !input.servicePeriodEnd || !validDateRange(input.servicePeriodStart, input.servicePeriodEnd)) {
      return { ok: false, error: 'Bitte einen gültigen Leistungszeitraum auswählen.' };
    }
    if (!input.dueDate) return { ok: false, error: 'Zahlungsziel konnte nicht berechnet werden.' };
    const records = await loadInvoiceSourceRecords(
      tenantId,
      input.clientId,
      input.servicePeriodStart,
      input.servicePeriodEnd,
      billingModule,
    );
    if (!records.ok) return records;
    if (records.data.length === 0) {
      if (!input.catalogItemId || !input.catalogQuantity || input.catalogQuantity <= 0) {
        return { ok: false, error: 'Bitte eine Leistung und Menge aus dem Systemkatalog auswählen.' };
      }
      const catalog = await fetchInvoiceCatalogOptions(tenantId, actorRoleKey);
      if (!catalog.ok) return catalog;
      const selected = catalog.data.find((item) => item.id === input.catalogItemId);
      if (!selected) return { ok: false, error: 'Die gewählte Katalogleistung ist nicht mehr verfügbar.' };
      if (selected.moduleKey !== billingModule) {
        return { ok: false, error: 'Die gewählte Leistung gehört nicht zum ausgewählten Abrechnungsmodul.' };
      }
      if (input.catalogQuantityMode === 'manual') {
        if (selected.unit !== 'hour') {
          return { ok: false, error: 'Die genaue Dezimaleingabe ist nur für Stundenleistungen zulässig.' };
        }
        if (Math.abs(Math.round(input.catalogQuantity * 100) - (input.catalogQuantity * 100)) > 0.000001) {
          return { ok: false, error: 'Die Stundenmenge darf höchstens zwei Nachkommastellen haben.' };
        }
      } else if (!getInvoiceCatalogQuantities(selected.unit).includes(input.catalogQuantity)) {
        return { ok: false, error: 'Die gewählte Menge ist für diese Leistung nicht zulässig.' };
      }
      const totalCents = Math.round(selected.priceCents * input.catalogQuantity * (1 + selected.taxRate / 100));
      if (billingModule === 'assist') {
        const capacity = await fetchInvoiceBudgetCapacity(
          tenantId,
          input.clientId,
          input.servicePeriodStart,
          input.servicePeriodEnd,
          actorRoleKey,
        );
        if (!capacity.ok) return capacity;
        if (capacity.data.effectiveMaximumCents > 0 && totalCents > capacity.data.effectiveMaximumCents) {
          return {
            ok: false,
            error: `Die Position überschreitet das verfügbare Budget von ${(capacity.data.effectiveMaximumCents / 100).toFixed(2).replace('.', ',')} €.` ,
          };
        }
      }
      return invoiceSupabaseRepository.createFromCatalogPosition(tenantId, {
        title: input.title,
        clientId: input.clientId,
        dueDate: input.dueDate,
        invoiceDate: input.invoiceDate,
        servicePeriodStart: input.servicePeriodStart,
        servicePeriodEnd: input.servicePeriodEnd,
        position: {
          moduleKey: selected.moduleKey,
          name: selected.name,
          unit: selected.unitLabel,
          quantity: input.catalogQuantity,
          unitPrice: selected.priceCents / 100,
          taxRate: selected.taxRate,
          taxMode: selected.taxMode,
        },
      });
    }
    return invoiceSupabaseRepository.createFromServiceRecords(tenantId, {
      title: input.title,
      clientId: input.clientId,
      dueDate: input.dueDate,
      invoiceDate: input.invoiceDate,
      servicePeriodStart: input.servicePeriodStart,
      servicePeriodEnd: input.servicePeriodEnd,
      records: records.data,
    });
  }

  await new Promise((r) => setTimeout(r, 220));
  return { ok: true, data: { id: `inv-${Date.now()}` } };
}
