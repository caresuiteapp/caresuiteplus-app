import type { ServiceResult } from '@/types';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '../errors';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

const INVOICE_COLUMNS =
  'id, tenant_id, invoice_number, client_id, status, total_amount, due_date, notes, created_at, updated_at' as const;

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
  notes: string | null;
  created_at: string;
  updated_at: string;
  client_name: string;
  line_items?: InvoiceItemRow[];
};

export type InvoiceItemRow = {
  id: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
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

async function enrichInvoiceRows(tenantId: string, rows: Omit<InvoiceRow, 'client_name'>[]): Promise<InvoiceRow[]> {
  const supabase = getClient();
  if (!supabase || rows.length === 0) return rows.map((row) => ({ ...row, client_name: 'Nicht zugeordnet' }));
  const clientIds = [...new Set(rows.map((row) => row.client_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data } = await supabase
      .from('clients')
      .select('id, first_name, last_name')
      .eq('tenant_id', tenantId)
      .in('id', clientIds);
    (data ?? []).forEach((client) => {
      names.set(client.id, `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim());
    });
  }
  return rows.map((row) => ({
    ...row,
    client_name: row.client_id ? (names.get(row.client_id) ?? 'Unbekannte Klient:in') : 'Nicht zugeordnet',
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
    const enriched = await enrichInvoiceRows(tenantId, (data ?? []) as Omit<InvoiceRow, 'client_name'>[]);
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
    const [enriched] = await enrichInvoiceRows(tenantId, [data as Omit<InvoiceRow, 'client_name'>]);
    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('id, description, quantity, unit_price, gross_amount')
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
      serviceMonth: string;
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
        service_month: input.serviceMonth,
        total_amount: totalAmount,
        open_amount: totalAmount,
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
};
