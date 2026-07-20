import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { invoiceSupabaseRepository } from '@/lib/services/repositories/invoiceRepository.supabase';
import type { InvoiceSourceRecord } from '@/lib/services/repositories/invoiceRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { getSupabaseClient } from '@/lib/supabase/client';

export type InvoiceCreateInput = {
  title: string;
  clientId?: string;
  clientName?: string;
  totalCents?: number;
  dueDate?: string;
  billingPeriod?: string;
};

export type InvoicePositionPreview = {
  clientId: string;
  billingPeriod: string;
  count: number;
  totalCents: number;
};

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
      return {
        ok: false,
        error: 'Für diese Klient:in und diesen Monat gibt es keine freigegebenen, abrechenbaren Leistungsnachweise.',
      };
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
