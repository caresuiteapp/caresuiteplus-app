import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { invoiceSupabaseRepository } from '@/lib/services/repositories/invoiceRepository.supabase';
import type { InvoiceSourceRecord } from '@/lib/services/repositories/invoiceRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { formatServicePriceUnit } from '@/lib/tenant/serviceCatalogLabels';
import type { ServicePriceUnit, TenantModuleKey } from '@/types/tenant/tenantCenter';

export type InvoiceCreateInput = {
  title: string;
  clientId?: string;
  clientName?: string;
  totalCents?: number;
  dueDate?: string;
  billingPeriod?: string;
  catalogItemId?: string;
  catalogQuantity?: number;
};

export type InvoicePositionPreview = {
  clientId: string;
  billingPeriod: string;
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
  },
];

export function getInvoiceCatalogQuantities(unit: ServicePriceUnit): number[] {
  if (unit === 'hour') return [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
  if (unit === 'km') return [1, 5, 10, 15, 20, 25, 30, 50];
  return [1, 2, 3, 4, 5, 6, 8, 10];
}

function periodBounds(billingPeriod: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}$/.test(billingPeriod)) return null;
  const [year, month] = billingPeriod.split('-').map(Number);
  const start = `${billingPeriod}-01`;
  const next = new Date(year, month, 1);
  const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
  return { start, end };
}

async function loadInvoiceSourceRecords(
  tenantId: string,
  clientId: string,
  billingPeriod: string,
): Promise<ServiceResult<InvoiceSourceRecord[]>> {
  const bounds = periodBounds(billingPeriod);
  if (!bounds) return { ok: false, error: 'Ungültiger Abrechnungsmonat.' };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht verfügbar.' };
  const { data, error } = await client
    .from('service_records')
    .select('id, record_number, service_date, product_key, billable_minutes, hourly_rate, total_amount')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .is('billed_invoice_id', null)
    .in('status', ['approved', 'billable'])
    .gte('service_date', bounds.start)
    .lt('service_date', bounds.end)
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
    .select('catalog_id, price_net, tax_rate')
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
    }];
  });
  return { ok: true, data: options };
}

export async function fetchInvoicePositionPreview(
  tenantId: string,
  clientId: string,
  billingPeriod: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoicePositionPreview>> {
  const denied = enforcePermission<InvoicePositionPreview>(actorRoleKey, 'office.invoices.create');
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: { clientId, billingPeriod, count: 1, totalCents: 0 } };
  }
  const records = await loadInvoiceSourceRecords(tenantId, clientId, billingPeriod);
  if (!records.ok) return records;
  const totalCents = records.data.reduce((sum, record) => {
    const minutes = Number(record.billable_minutes ?? 0);
    const rate = Number(record.hourly_rate ?? 0);
    const amount = Number(record.total_amount ?? ((minutes / 60) * rate));
    return sum + Math.round(amount * 100);
  }, 0);
  return { ok: true, data: { clientId, billingPeriod, count: records.data.length, totalCents } };
}

/** WP226 — Rechnung anlegen (Demo + Supabase-ready) */
export async function createInvoice(
  tenantId: string,
  input: InvoiceCreateInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'office.invoices.create');
  if (denied) return denied;
  if (!input.title.trim()) return { ok: false, error: 'Titel ist Pflicht.' };
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    return { ok: false, error: 'Fälligkeitsdatum muss im Format JJJJ-MM-TT eingegeben werden.' };
  }
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    if (!input.clientId) return { ok: false, error: 'Klient:in muss aus dem System ausgewählt werden.' };
    if (!input.billingPeriod) return { ok: false, error: 'Abrechnungsmonat ist Pflicht.' };
    if (!input.dueDate) return { ok: false, error: 'Zahlungsziel konnte nicht berechnet werden.' };
    const records = await loadInvoiceSourceRecords(tenantId, input.clientId, input.billingPeriod);
    if (!records.ok) return records;
    if (records.data.length === 0) {
      if (!input.catalogItemId || !input.catalogQuantity || input.catalogQuantity <= 0) {
        return { ok: false, error: 'Bitte eine Leistung und Menge aus dem Systemkatalog auswählen.' };
      }
      const catalog = await fetchInvoiceCatalogOptions(tenantId, actorRoleKey);
      if (!catalog.ok) return catalog;
      const selected = catalog.data.find((item) => item.id === input.catalogItemId);
      if (!selected) return { ok: false, error: 'Die gewählte Katalogleistung ist nicht mehr verfügbar.' };
      if (!getInvoiceCatalogQuantities(selected.unit).includes(input.catalogQuantity)) {
        return { ok: false, error: 'Die gewählte Menge ist für diese Leistung nicht zulässig.' };
      }
      return invoiceSupabaseRepository.createFromCatalogPosition(tenantId, {
        title: input.title,
        clientId: input.clientId,
        dueDate: input.dueDate,
        serviceMonth: input.billingPeriod,
        position: {
          moduleKey: selected.moduleKey,
          name: selected.name,
          unit: selected.unitLabel,
          quantity: input.catalogQuantity,
          unitPrice: selected.priceCents / 100,
          taxRate: selected.taxRate,
        },
      });
    }
    return invoiceSupabaseRepository.createFromServiceRecords(tenantId, {
      title: input.title,
      clientId: input.clientId,
      dueDate: input.dueDate,
      serviceMonth: input.billingPeriod,
      records: records.data,
    });
  }

  await new Promise((r) => setTimeout(r, 220));
  return { ok: true, data: { id: `inv-${Date.now()}` } };
}
