import type { RoleKey, ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/core/base';
import type { InvoiceDetail } from '@/types/modules/invoiceDetail';
import { demoClients } from '@/data/demo/clients';
import {
  getDemoInvoiceAudit,
  getDemoInvoiceById,
  getDemoInvoiceLineItems,
  getDemoInvoiceNotes,
  updateDemoInvoiceFields,
  updateDemoInvoiceStatus,
} from '@/data/demo/invoiceExtras';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { invoiceSupabaseRepository } from '@/lib/services/repositories/invoiceRepository.supabase';
import {
  CLIENT_STATUS_HINTS,
  getAllowedStatusActions,
  validateTransition,
} from '@/lib/services';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import type { InvoiceRow } from '@/lib/services/repositories/invoiceRepository.supabase';

function resolveClientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function buildDetailFromDemo(
  invoice: NonNullable<ReturnType<typeof getDemoInvoiceById>>,
): InvoiceDetail {
  return {
    id: invoice.id,
    tenantId: invoice.tenantId,
    clientId: invoice.clientId,
    clientName: resolveClientName(invoice.clientId),
    invoiceNumber: invoice.invoiceNumber,
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    status: invoice.status,
    updatedAt: invoice.updatedAt,
    createdAt: invoice.createdAt,
    issuedDate: invoice.createdAt.slice(0, 10),
    notes:
      getDemoInvoiceNotes(invoice.id) ??
      (invoice.status === 'fehlerhaft'
        ? 'Abrechnungsfehler — Kostenträger-Zuordnung prüfen.'
        : invoice.status === 'entwurf'
          ? 'Entwurf — noch nicht versendet.'
          : null),
    lineItems: getDemoInvoiceLineItems(invoice.id),
    auditEntries: getDemoInvoiceAudit(invoice.id),
    allowedStatusActions: getAllowedStatusActions(invoice.status),
    nextActionHint: CLIENT_STATUS_HINTS[invoice.status],
  };
}

function buildDetailFromSupabase(row: InvoiceRow): InvoiceDetail {
  const status = row.status as unknown as WorkflowStatus;
  const amountCents = Math.round((row.total_amount ?? 0) * 100);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id ?? row.id,
    clientName: row.invoice_number,
    invoiceNumber: row.invoice_number,
    amountCents,
    currency: 'EUR',
    dueDate: row.due_date ?? row.updated_at.slice(0, 10),
    status,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    issuedDate: row.created_at.slice(0, 10),
    notes: status === 'entwurf' ? 'Entwurf — noch nicht versendet.' : null,
    lineItems: [],
    auditEntries: [],
    allowedStatusActions: getAllowedStatusActions(status),
    nextActionHint: CLIENT_STATUS_HINTS[status],
  };
}

export async function fetchInvoiceDetail(
  invoiceId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InvoiceDetail>> {
  const denied = enforcePermission<InvoiceDetail>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await invoiceSupabaseRepository.getById(tenantId, invoiceId);
    if (!result.ok) return result;
    if (!result.data) return { ok: false, error: 'Rechnung nicht gefunden.' };
    return { ok: true, data: buildDetailFromSupabase(result.data) };
  }

  await new Promise((r) => setTimeout(r, 300));

  const invoice = getDemoInvoiceById(invoiceId);
  if (!invoice) {
    return { ok: false, error: 'Rechnung nicht gefunden.' };
  }

  return { ok: true, data: buildDetailFromDemo(invoice) };
}

export async function updateInvoiceStatus(
  invoiceId: string,
  tenantId: string,
  newStatus: WorkflowStatus,
  actorRoleKey?: RoleKey | null,
  actorName = 'Büro Demo',
): Promise<ServiceResult<InvoiceDetail>> {
  const denied = enforcePermission<InvoiceDetail>(actorRoleKey, 'office.invoices.status_change');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const current = await invoiceSupabaseRepository.getById(tenantId, invoiceId);
    if (!current.ok) return current;
    if (!current.data) return { ok: false, error: 'Rechnung nicht gefunden.' };

    const validation = validateTransition(current.data.status as WorkflowStatus, newStatus);
    if (!validation.valid) {
      return { ok: false, error: validation.error ?? 'Statuswechsel nicht erlaubt.' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

    const { data, error } = await supabase
      .from('invoices')
      .update({
        status: newStatus as unknown as Database['public']['Enums']['invoice_status'],
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', invoiceId)
      .select('id, tenant_id, invoice_number, client_id, status, total_amount, due_date, created_at, updated_at')
      .single();

    if (error || !data) {
      return { ok: false, error: 'Rechnung konnte nicht aktualisiert werden.' };
    }

    return { ok: true, data: buildDetailFromSupabase(data) };
  }

  const current = getDemoInvoiceById(invoiceId);
  if (!current) {
    return { ok: false, error: 'Rechnung nicht gefunden.' };
  }

  const validation = validateTransition(current.status, newStatus);
  if (!validation.valid) {
    return { ok: false, error: validation.error ?? 'Statuswechsel nicht erlaubt.' };
  }

  await new Promise((r) => setTimeout(r, 300));

  const updated = updateDemoInvoiceStatus(invoiceId, newStatus, actorName);
  if (!updated) {
    return { ok: false, error: 'Rechnung konnte nicht aktualisiert werden.' };
  }

  return { ok: true, data: buildDetailFromDemo(updated) };
}

export type InvoiceEditInput = {
  notes: string;
  dueDate: string;
};

export async function updateInvoice(
  invoiceId: string,
  tenantId: string,
  input: InvoiceEditInput,
  actorRoleKey?: RoleKey | null,
  actorName = 'Büro Demo',
): Promise<ServiceResult<InvoiceDetail>> {
  const denied = enforcePermission<InvoiceDetail>(actorRoleKey, 'office.invoices.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.dueDate.trim()) {
    return { ok: false, error: 'Fälligkeitsdatum ist Pflicht.' };
  }

  if (getServiceMode() === 'supabase') {
    const current = await invoiceSupabaseRepository.getById(tenantId, invoiceId);
    if (!current.ok) return current;
    if (!current.data) return { ok: false, error: 'Rechnung nicht gefunden.' };
    return { ok: true, data: buildDetailFromSupabase(current.data) };
  }

  await new Promise((r) => setTimeout(r, 280));

  const updated = updateDemoInvoiceFields(
    invoiceId,
    { notes: input.notes.trim() || null, dueDate: input.dueDate.trim() },
    actorName,
  );
  if (!updated) {
    return { ok: false, error: 'Rechnung nicht gefunden.' };
  }

  return { ok: true, data: buildDetailFromDemo(updated) };
}
