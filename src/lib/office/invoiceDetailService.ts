import type { RoleKey, ServiceResult } from '@/types';
import type { InvoiceDetail } from '@/types/modules/invoiceDetail';
import type { InvoiceStatus } from '@/types/modules/billing';
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
import { getSupabaseClient } from '@/lib/supabase/client';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import type { InvoiceRow } from '@/lib/services/repositories/invoiceRepository.supabase';
import {
  canTransitionInvoiceStatus,
  getAllowedInvoiceStatusActions,
  INVOICE_STATUS_HINTS,
  mapLegacyWorkflowToInvoiceStatus,
} from './invoiceStatus';

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
    status: mapLegacyWorkflowToInvoiceStatus(invoice.status),
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
    allowedStatusActions: getAllowedInvoiceStatusActions(mapLegacyWorkflowToInvoiceStatus(invoice.status)),
    nextActionHint: INVOICE_STATUS_HINTS[mapLegacyWorkflowToInvoiceStatus(invoice.status)],
  };
}

function buildDetailFromSupabase(row: InvoiceRow): InvoiceDetail {
  const status = row.status;
  const amountCents = Math.round((row.total_amount ?? 0) * 100);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id ?? row.id,
    clientName: row.client_name,
    invoiceNumber: row.invoice_number,
    amountCents,
    currency: 'EUR',
    dueDate: row.due_date ?? row.updated_at.slice(0, 10),
    status,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    issuedDate: row.created_at.slice(0, 10),
    notes: row.notes ?? (status === 'draft' ? 'Entwurf — noch nicht versendet.' : null),
    lineItems: (row.line_items ?? []).map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity ?? 0),
      unitPriceCents: Math.round(Number(item.unit_price ?? 0) * 100),
      totalCents: Math.round(Number(item.gross_amount ?? 0) * 100),
    })),
    auditEntries: [],
    allowedStatusActions: getAllowedInvoiceStatusActions(status),
    nextActionHint: INVOICE_STATUS_HINTS[status],
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
  newStatus: InvoiceStatus,
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

    if (!canTransitionInvoiceStatus(current.data.status, newStatus)) {
      return { ok: false, error: 'Dieser Rechnungsstatus darf nicht gewählt werden.' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

    const { data, error } = await supabase
      .from('invoices')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', invoiceId)
      .select('id, tenant_id, invoice_number, client_id, status, total_amount, due_date, created_at, updated_at')
      .single();

    if (error || !data) {
      return { ok: false, error: 'Rechnung konnte nicht aktualisiert werden.' };
    }

    const refreshed = await invoiceSupabaseRepository.getById(tenantId, data.id);
    if (!refreshed.ok || !refreshed.data) {
      return { ok: false, error: 'Rechnung wurde aktualisiert, konnte aber nicht neu geladen werden.' };
    }
    return { ok: true, data: buildDetailFromSupabase(refreshed.data) };
  }

  const current = getDemoInvoiceById(invoiceId);
  if (!current) {
    return { ok: false, error: 'Rechnung nicht gefunden.' };
  }

  const currentInvoiceStatus = mapLegacyWorkflowToInvoiceStatus(current.status);
  if (!canTransitionInvoiceStatus(currentInvoiceStatus, newStatus)) {
    return { ok: false, error: 'Dieser Rechnungsstatus darf nicht gewählt werden.' };
  }

  const targetLegacyStatus =
    newStatus === 'draft' ? 'entwurf'
      : newStatus === 'ready' ? 'in_bearbeitung'
        : newStatus === 'sent' ? 'aktiv'
          : newStatus === 'paid' ? 'abgeschlossen'
            : newStatus === 'overdue' ? 'fehlerhaft'
              : newStatus === 'cancelled' ? 'gesperrt'
                : newStatus === 'written_off' ? 'archiviert'
                  : 'in_bearbeitung';
  await new Promise((r) => setTimeout(r, 300));

  const updated = updateDemoInvoiceStatus(invoiceId, targetLegacyStatus, actorName);
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
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };
    const { error } = await supabase
      .from('invoices')
      .update({
        due_date: input.dueDate.trim(),
        notes: input.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', invoiceId);
    if (error) return { ok: false, error: 'Rechnung konnte nicht gespeichert werden.' };
    const refreshed = await invoiceSupabaseRepository.getById(tenantId, invoiceId);
    if (!refreshed.ok || !refreshed.data) {
      return { ok: false, error: 'Rechnung wurde gespeichert, konnte aber nicht neu geladen werden.' };
    }
    return { ok: true, data: buildDetailFromSupabase(refreshed.data) };
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

export async function deleteDraftInvoice(
  invoiceId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<void>> {
  const denied = enforcePermission<void>(actorRoleKey, 'office.invoices.status_change');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() !== 'supabase') return { ok: true, data: undefined };

  const current = await invoiceSupabaseRepository.getById(tenantId, invoiceId);
  if (!current.ok) return current;
  if (!current.data) return { ok: false, error: 'Rechnung nicht gefunden.' };
  if (current.data.status !== 'draft') {
    return { ok: false, error: 'Nur Rechnungsentwürfe dürfen gelöscht werden.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };
  const { error: releaseError } = await supabase
    .from('service_records')
    .update({ billed_invoice_id: null, status: 'billable' })
    .eq('tenant_id', tenantId)
    .eq('billed_invoice_id', invoiceId);
  if (releaseError) return { ok: false, error: 'Leistungsnachweise konnten nicht freigegeben werden.' };

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId);
  if (error) return { ok: false, error: 'Rechnungsentwurf konnte nicht gelöscht werden.' };
  return { ok: true, data: undefined };
}
