import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { saveOfficeInvoiceDraft } from './invoiceWorkspaceService.web';
import {
  buildInvoiceRunPreview, invoiceRunPeriod,
  type InvoiceRunInput, type InvoiceRunPreview, type InvoiceRunRow,
} from './invoiceRunModel.web';
export * from './invoiceRunModel.web';

const SOURCE_COLUMNS = 'id,tenant_id,client_id,assignment_id,product_key,service_date,record_number,status,actual_minutes,billable_minutes,hourly_rate,total_amount,billed_invoice_id,updated_at,pdf_url,source_receipt';
const CLIENT_COLUMNS = 'id,tenant_id,first_name,last_name,street,house_number,postal_code,city,country,email,billing_party';
const BILLING_COLUMNS = 'id,tenant_id,client_id,billing_type,invoice_recipient,payment_terms_days';
const RECIPIENT_COLUMNS = 'id,tenant_id,client_id,carrier_type,name_snapshot,address_snapshot,insurance_number,policy_number,billing_relevant,is_primary,valid_from,valid_until,archived_at';
const SETTINGS_COLUMNS = 'id,tenant_id,insurance_vat_rate,self_payer_vat_rate,invoice_footer_text,invoice_notes,payment_terms_days';

type ReadFilter = { month?: { start: string; end: string }; productKey?: string; clientId?: string; matchColumn?: string; matchIds?: string[] };
async function readRows(tenantId: string, table: string, columns: string, filters: ReadFilter = {}): Promise<ServiceResult<InvoiceRunRow[]>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Die Datenverbindung ist nicht verfügbar. Bitte erneut versuchen.' };
  const rows: InvoiceRunRow[] = [];
  const chunks = filters.matchIds
    ? Array.from({ length: Math.ceil(filters.matchIds.length / 100) }, (_, i) => filters.matchIds!.slice(i * 100, i * 100 + 100))
    : [undefined];
  for (const ids of chunks) {
    let complete = false;
    for (let page = 0; page < 100; page += 1) {
      let query = fromUnknownTable(client, table).select(columns).eq('tenant_id', tenantId).order('id', { ascending: true });
      if (filters.month) query = query.gte('service_date', filters.month.start).lte('service_date', filters.month.end);
      if (filters.productKey && filters.productKey !== 'all') query = query.eq('product_key', filters.productKey);
      if (filters.clientId) query = query.eq('client_id', filters.clientId);
      if (ids && filters.matchColumn) query = query.in(filters.matchColumn, ids);
      const { data, error } = await query.range(page * 1000, page * 1000 + 999);
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
      const pageRows = (data ?? []) as unknown as InvoiceRunRow[];
      if (pageRows.some(row => row.tenant_id !== tenantId)) return { ok: false, error: 'Die Abrechnungsdaten gehören nicht zum aktuellen Mandanten.' };
      rows.push(...pageRows);
      if (pageRows.length < 1000) { complete = true; break; }
    }
    if (!complete) return { ok: false, error: 'Die Auswahl enthält zu viele Datensätze. Bitte den Rechnungslauf auf eine Klientin oder einen Klienten einschränken.' };
  }
  return { ok: true, data: rows };
}

export async function loadInvoiceRunPreview(tenantId: string, input: InvoiceRunInput, actorRoleKey?: RoleKey | null): Promise<ServiceResult<InvoiceRunPreview>> {
  const denied = enforcePermission<InvoiceRunPreview>(actorRoleKey, 'office.invoices.create');
  if (denied) return denied;
  const tenantError = guardServiceTenant(tenantId);
  if (tenantError) return tenantError;
  const month = invoiceRunPeriod(input.month);
  if (!month) return { ok: false, error: 'Bitte einen gültigen Abrechnungsmonat auswählen.' };
  try {
    const sources = await readRows(tenantId, 'service_records', SOURCE_COLUMNS, { month, productKey: input.productKey, clientId: input.clientId });
    if (!sources.ok) return sources;
    const clientIds = [...new Set(sources.data.map(row => row.client_id).filter((id): id is string => typeof id === 'string' && Boolean(id)))];
    const results = await Promise.all([
      readRows(tenantId, 'clients', CLIENT_COLUMNS, { matchColumn: 'id', matchIds: clientIds }),
      readRows(tenantId, 'client_billing_profiles', BILLING_COLUMNS, { matchColumn: 'client_id', matchIds: clientIds }),
      readRows(tenantId, 'client_cost_carrier_assignments', RECIPIENT_COLUMNS, { matchColumn: 'client_id', matchIds: clientIds }),
      readRows(tenantId, 'tenant_billing_settings', SETTINGS_COLUMNS),
    ]);
    for (const result of results) if (!result.ok) return result;
    const [clients, billingProfiles, recipients, settings] = results.map(result => result.ok ? result.data : []);
    return buildInvoiceRunPreview(tenantId, input, { sources: sources.data, clients, billingProfiles, recipients, settings });
  } catch { return { ok: false, error: 'Der Rechnungslauf konnte nicht vorbereitet werden. Bitte erneut versuchen.' }; }
}

export type InvoiceRunResultItem = {
  groupId: string; clientName: string; status: 'created' | 'failed' | 'skipped'; invoiceId?: string; error?: string;
};
export type InvoiceRunResult = { createdCount: number; failedCount: number; skippedCount: number; results: InvoiceRunResultItem[] };
export type InvoiceRunProgress = { completed: number; total: number; item: InvoiceRunResultItem };
const runningRequests = new Set<string>();

/** Each selected group is saved atomically; stable request IDs make retries safe. Never issues or sends invoices. */
export async function executeInvoiceRun(tenantId: string, preview: InvoiceRunPreview, selectedGroupIds: string[], actorRoleKey?: RoleKey | null,
  options: { onProgress?: (progress: InvoiceRunProgress) => void; isActive?: () => boolean } = {}): Promise<ServiceResult<InvoiceRunResult>> {
  const denied = enforcePermission<InvoiceRunResult>(actorRoleKey, 'office.invoices.create');
  if (denied) return denied;
  const tenantError = guardServiceTenant(tenantId);
  if (tenantError) return tenantError;
  if (preview.tenantId !== tenantId) return { ok: false, error: 'Die Vorschau gehört nicht zum aktuellen Mandanten. Bitte neu vorbereiten.' };
  const ids = [...new Set(selectedGroupIds)];
  if (!ids.length) return { ok: false, error: 'Bitte mindestens eine vorbereitete Rechnung auswählen.' };
  if (new Set(preview.groups.map(group => group.id)).size !== preview.groups.length) return { ok: false, error: 'Die Vorschau enthält eine doppelte Zuordnung. Bitte neu vorbereiten.' };
  const groups = ids.map(id => preview.groups.find(group => group.id === id));
  if (groups.some(group => !group)) return { ok: false, error: 'Die Auswahl gehört nicht mehr zur Vorschau. Bitte erneut vorbereiten.' };
  const lockKeys = groups.map(group => `${tenantId}:${group!.draft.requestId}`);
  if (new Set(lockKeys).size !== lockKeys.length) return { ok: false, error: 'Die Vorschau enthält eine doppelte Speicherkennung. Bitte neu vorbereiten.' };
  if (lockKeys.some(key => runningRequests.has(key))) return { ok: false, error: 'Diese Auswahl wird bereits verarbeitet. Bitte das Ergebnis abwarten.' };
  lockKeys.forEach(key => runningRequests.add(key));
  const results: InvoiceRunResultItem[] = [];
  try {
    for (const group of groups) {
      if (!group) continue;
      let item: InvoiceRunResultItem;
      if (options.isActive && !options.isActive()) {
        item = { groupId: group.id, clientName: group.clientName, status: 'skipped', error: 'Die Ansicht oder Anmeldung wurde gewechselt. Der nächste Entwurf wurde nicht mehr gespeichert.' };
      } else if (!group.eligible || group.blockers.length) {
        item = { groupId: group.id, clientName: group.clientName, status: 'skipped', error: group.blockers.join(' ') || 'Die Rechnung ist noch nicht bereit.' };
      } else {
        try {
          const saved = await saveOfficeInvoiceDraft(tenantId, group.draft, actorRoleKey);
          item = saved.ok ? { groupId: group.id, clientName: group.clientName, status: 'created', invoiceId: saved.data.id }
            : { groupId: group.id, clientName: group.clientName, status: 'failed', error: saved.error };
        } catch { item = { groupId: group.id, clientName: group.clientName, status: 'failed', error: 'Die Speicherung konnte nicht bestätigt werden. Mit derselben Vorschau erneut versuchen.' }; }
      }
      results.push(item);
      // A presentation callback must not turn a committed draft into a failed write.
      try { options.onProgress?.({ completed: results.length, total: groups.length, item }); } catch { /* Continue the confirmed batch. */ }
    }
    return { ok: true, data: { createdCount: results.filter(item => item.status === 'created').length,
      failedCount: results.filter(item => item.status === 'failed').length, skippedCount: results.filter(item => item.status === 'skipped').length, results } };
  } finally { lockKeys.forEach(key => runningRequests.delete(key)); }
}
