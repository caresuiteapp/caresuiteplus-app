import type { ServiceResult } from '@/types';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '../errors';
import type { ServiceTaxMode } from '@/types/tenant/tenantCenter';
import type { InvoiceBillingModule } from '@/types/modules/billing';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

const INVOICE_COLUMNS =
  'id, tenant_id, invoice_number, client_id, status, total_amount, due_date, invoice_date, service_month, service_period_from, service_period_to, footer_text, notes, created_at, updated_at' as const;

function getClient() {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

export type InvoiceRow = {
  id: string;
  tenant_id: string;
  invoice_number: string;
  client_id: string | null;
  status: InvoiceStatus;
  total_amount: number | null;
  due_date: string | null;
  invoice_date: string;
  service_month: string | null;
  service_period_from: string | null;
  service_period_to: string | null;
  footer_text: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client_name: string;
  client_street: string;
  client_house_number: string;
  client_postal_code: string;
  client_city: string;
  client_country: string;
  client_number: string;
  billing_module: InvoiceBillingModule;
  line_items?: InvoiceItemRow[];
};

export type InvoiceItemRow = {
  id: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  unit: string | null;
  net_amount: number | null;
  vat_amount: number | null;
  vat_rate: number | null;
  gross_amount: number | null;
};

export type InvoiceSourceRecord = {
  id: string;
  record_number: string | null;
  service_date: string;
  product_key: string;
  billable_minutes: number | null;
  hourly_rate: number | null;
  total_amount: number | null;
};

export type InvoiceCatalogPosition = {
  moduleKey: Database['public']['Enums']['product_key'];
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxMode: ServiceTaxMode;
};

function buildTaxNotice(taxMode: ServiceTaxMode, taxRate: number): string | null {
  if (taxMode === 'exempt_4_16') return 'Umsatzsteuerfreie Leistung gemäß § 4 Nr. 16 UStG.';
  if (taxMode === 'kleinunternehmer_19') return 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.';
  if (taxMode === 'none' && taxRate === 0) return 'Umsatzsteuerfreie Leistung.';
  return null;
}

type RawInvoiceRow = Omit<
  InvoiceRow,
  | 'client_name'
  | 'client_street'
  | 'client_house_number'
  | 'client_postal_code'
  | 'client_city'
  | 'client_country'
  | 'client_number'
  | 'billing_module'
>;

async function enrichInvoiceRows(tenantId: string, rows: RawInvoiceRow[]): Promise<InvoiceRow[]> {
  const supabase = getClient();
  const emptyRecipient = {
    client_street: '',
    client_house_number: '',
    client_postal_code: '',
    client_city: '',
    client_country: '',
    client_number: '',
  };
  if (!supabase || rows.length === 0) {
    return rows.map((row) => ({
      ...row,
      client_name: 'Nicht zugeordnet',
      ...emptyRecipient,
      billing_module: null,
    }));
  }
  const clientIds = [...new Set(rows.map((row) => row.client_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  const recipients = new Map<string, typeof emptyRecipient>();
  const invoiceModules = new Map<string, Set<string>>();
  const invoiceIds = rows.map((row) => row.id);
  if (invoiceIds.length > 0) {
    const { data: itemModules } = await supabase
      .from('invoice_items')
      .select('invoice_id, product_key')
      .eq('tenant_id', tenantId)
      .in('invoice_id', invoiceIds);
    (itemModules ?? []).forEach((item) => {
      if (!item.product_key) return;
      const modules = invoiceModules.get(item.invoice_id) ?? new Set<string>();
      modules.add(item.product_key);
      invoiceModules.set(item.invoice_id, modules);
    });
  }
  if (clientIds.length > 0) {
    const { data } = await supabase
      .from('clients')
      .select('id, first_name, last_name, street, house_number, postal_code, city, country, client_number')
      .eq('tenant_id', tenantId)
      .in('id', clientIds);
    (data ?? []).forEach((client) => {
      names.set(client.id, `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim());
      recipients.set(client.id, {
        client_street: client.street ?? '',
        client_house_number: client.house_number ?? '',
        client_postal_code: client.postal_code ?? '',
        client_city: client.city ?? '',
        client_country: client.country ?? 'Deutschland',
        client_number: client.client_number ?? '',
      });
    });
  }
  return rows.map((row) => ({
    ...row,
    client_name: row.client_id ? (names.get(row.client_id) ?? 'Unbekannte Klient:in') : 'Nicht zugeordnet',
    ...(row.client_id ? (recipients.get(row.client_id) ?? emptyRecipient) : emptyRecipient),
    billing_module: (() => {
      const modules = invoiceModules.get(row.id);
      if (!modules || modules.size === 0) return null;
      if (modules.size > 1) return 'mixed';
      const [moduleKey] = [...modules];
      return ['assist', 'pflege', 'stationaer', 'beratung'].includes(moduleKey)
        ? (moduleKey as InvoiceBillingModule)
        : null;
    })(),
  }));
}

/** WP230 — Live Supabase Repository (billing) */
export const invoiceSupabaseRepository = {
  wpNumber: 230 as const,
  table: 'invoices' as const,

  async list(tenantId: string): Promise<ServiceResult<InvoiceRow[]>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase
      .from('invoices')
      .select(INVOICE_COLUMNS)
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    const enriched = await enrichInvoiceRows(tenantId, (data ?? []) as RawInvoiceRow[]);
    return { ok: true, data: enriched };
  },

  async getById(tenantId: string, id: string): Promise<ServiceResult<InvoiceRow | null>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase
      .from('invoices')
      .select(INVOICE_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    if (!data) return { ok: true, data: null };
    const [enriched] = await enrichInvoiceRows(tenantId, [data as RawInvoiceRow]);
    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('id, description, quantity, unit, unit_price, net_amount, vat_amount, vat_rate, gross_amount')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', id)
      .order('sort_order', { ascending: true });
    if (itemsError) return { ok: false, error: toGermanSupabaseError(itemsError) };
    return {
      ok: true,
      data: {
        ...enriched,
        line_items: (items ?? []) as InvoiceItemRow[],
      },
    };
  },

  async create(
    tenantId: string,
    input: { title: string; status?: InvoiceStatus; clientId?: string | null; dueDate?: string | null },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        invoice_number: input.title.trim(),
        status: input.status ?? 'draft',
        client_id: input.clientId ?? null,
        due_date: input.dueDate ?? null,
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: data.id } };
  },

  async createFromServiceRecords(
    tenantId: string,
    input: {
      title: string;
      clientId: string;
      dueDate: string;
      invoiceDate: string;
      servicePeriodStart: string;
      servicePeriodEnd: string;
      records: InvoiceSourceRecord[];
    },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    if (input.records.length === 0) {
      return { ok: false, error: 'Keine abrechenbaren Leistungsnachweise vorhanden.' };
    }

    const totalAmount = input.records.reduce((sum, record) => {
      const minutes = Number(record.billable_minutes ?? 0);
      const rate = Number(record.hourly_rate ?? 0);
      const calculated = minutes > 0 && rate > 0 ? (minutes / 60) * rate : 0;
      return sum + Number(record.total_amount ?? calculated);
    }, 0);

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        invoice_number: input.title.trim(),
        status: 'draft',
        client_id: input.clientId,
        due_date: input.dueDate,
        invoice_date: input.invoiceDate,
        service_month: input.servicePeriodStart,
        service_period_from: input.servicePeriodStart,
        service_period_to: input.servicePeriodEnd,
        total_amount: totalAmount,
        open_amount: totalAmount,
        footer_text: 'Umsatzsteuerfreie Leistung.',
      })
      .select('id')
      .single();
    if (invoiceError || !invoice) return { ok: false, error: toGermanSupabaseError(invoiceError) };

    const itemRows = input.records.map((record, index) => {
      const minutes = Number(record.billable_minutes ?? 0);
      const rate = Number(record.hourly_rate ?? 0);
      const quantity = minutes > 0 ? minutes / 60 : 1;
      const grossAmount = Number(record.total_amount ?? (quantity * rate));
      return {
        tenant_id: tenantId,
        invoice_id: invoice.id,
        service_record_id: record.id,
        description: record.record_number
          ? `Leistungsnachweis ${record.record_number}`
          : `Leistung vom ${new Date(record.service_date).toLocaleDateString('de-DE')}`,
        product_key: record.product_key as Database['public']['Enums']['product_key'],
        quantity,
        unit: 'Stunde',
        unit_price: rate || grossAmount,
        net_amount: grossAmount,
        gross_amount: grossAmount,
        vat_amount: 0,
        vat_rate: 0,
        sort_order: index + 1,
      };
    });
    const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows);
    if (itemsError) {
      await supabase.from('invoices').delete().eq('tenant_id', tenantId).eq('id', invoice.id);
      return { ok: false, error: toGermanSupabaseError(itemsError) };
    }

    const sourceIds = input.records.map((record) => record.id);
    const { error: sourceError } = await supabase
      .from('service_records')
      .update({ billed_invoice_id: invoice.id, status: 'billed' })
      .eq('tenant_id', tenantId)
      .in('id', sourceIds);
    if (sourceError) {
      await supabase.from('invoice_items').delete().eq('tenant_id', tenantId).eq('invoice_id', invoice.id);
      await supabase.from('invoices').delete().eq('tenant_id', tenantId).eq('id', invoice.id);
      return { ok: false, error: toGermanSupabaseError(sourceError) };
    }

    return { ok: true, data: { id: invoice.id } };
  },

  async createFromCatalogPosition(
    tenantId: string,
    input: {
      title: string;
      clientId: string;
      dueDate: string;
      invoiceDate: string;
      servicePeriodStart: string;
      servicePeriodEnd: string;
      position: InvoiceCatalogPosition;
    },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const netAmount = Math.round(input.position.quantity * input.position.unitPrice * 100) / 100;
    const vatAmount = Math.round(netAmount * input.position.taxRate) / 100;
    const grossAmount = netAmount + vatAmount;

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        invoice_number: input.title.trim(),
        status: 'draft',
        client_id: input.clientId,
        due_date: input.dueDate,
        invoice_date: input.invoiceDate,
        service_month: input.servicePeriodStart,
        service_period_from: input.servicePeriodStart,
        service_period_to: input.servicePeriodEnd,
        total_amount: grossAmount,
        open_amount: grossAmount,
        footer_text: buildTaxNotice(input.position.taxMode, input.position.taxRate),
      })
      .select('id')
      .single();
    if (invoiceError || !invoice) return { ok: false, error: toGermanSupabaseError(invoiceError) };

    const { error: itemError } = await supabase.from('invoice_items').insert({
      tenant_id: tenantId,
      invoice_id: invoice.id,
      description: input.position.name,
      product_key: input.position.moduleKey,
      quantity: input.position.quantity,
      unit: input.position.unit,
      unit_price: input.position.unitPrice,
      net_amount: netAmount,
      gross_amount: grossAmount,
      vat_amount: vatAmount,
      vat_rate: input.position.taxRate,
      sort_order: 1,
    });
    if (itemError) {
      await supabase.from('invoices').delete().eq('tenant_id', tenantId).eq('id', invoice.id);
      return { ok: false, error: toGermanSupabaseError(itemError) };
    }
    return { ok: true, data: { id: invoice.id } };
  },
};
