import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { invoiceSupabaseRepository } from '@/lib/services/repositories/invoiceRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type InvoiceCreateInput = {
  title: string;
  clientId?: string;
  clientName?: string;
  totalCents?: number;
  dueDate?: string;
};

function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

async function resolveClientIdByName(
  tenantId: string,
  clientName: string,
): Promise<ServiceResult<string | null>> {
  const normalized = normalizePersonName(clientName);
  if (!normalized) return { ok: true, data: null };
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

  const { data, error } = await fromUnknownTable(client, 'clients')
    .select('id, first_name, last_name')
    .eq('tenant_id', tenantId)
    .limit(250);
  if (error) return { ok: false, error: 'Klient:innen konnten nicht geladen werden.' };

  const matches = (data ?? []).filter((row) =>
    normalizePersonName(`${String(row.first_name ?? '')} ${String(row.last_name ?? '')}`) === normalized,
  );
  if (matches.length === 0) {
    return { ok: false, error: 'Klient:in nicht gefunden. Bitte den vollständigen Namen aus der Akte verwenden.' };
  }
  if (matches.length > 1) {
    return { ok: false, error: 'Name ist nicht eindeutig. Bitte die Rechnung aus der Klient:innen-Akte anlegen.' };
  }
  return { ok: true, data: String(matches[0].id) };
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
    const clientResult = input.clientId
      ? ({ ok: true, data: input.clientId } as const)
      : await resolveClientIdByName(tenantId, input.clientName ?? '');
    if (!clientResult.ok) return clientResult;
    return invoiceSupabaseRepository.create(tenantId, {
      title: input.title,
      status: 'draft',
      clientId: clientResult.data,
      dueDate: input.dueDate ?? null,
    });
  }

  await new Promise((r) => setTimeout(r, 220));
  return { ok: true, data: { id: `inv-${Date.now()}` } };
}
