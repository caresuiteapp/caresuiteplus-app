import type { ServiceResult } from '@/types';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '../errors';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

const INVOICE_COLUMNS =
  'id, tenant_id, invoice_number, client_id, status, total_amount, due_date, created_at, updated_at' as const;

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
  created_at: string;
  updated_at: string;
};

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
    return { ok: true, data: (data ?? []) as InvoiceRow[] };
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
    return { ok: true, data: (data as InvoiceRow | null) ?? null };
  },

  async create(
    tenantId: string,
    input: { title: string; status?: InvoiceStatus },
  ): Promise<ServiceResult<{ id: string }>> {
    const supabase = getClient();
    if (!supabase) return unavailable();
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        invoice_number: input.title.trim(),
        status: input.status ?? 'draft',
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: { id: data.id } };
  },
};
