import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import type { CareAdmission, CareTariff, CareTask } from './ambulatoryOperationsDomain';

type Row = Record<string, unknown>;
const text = (v: unknown) => v == null ? '' : String(v);
type OperationsSnapshot = { admissions: CareAdmission[]; tariffs: CareTariff[]; tasks: CareTask[] };
function guard<T>(tenant: string): ServiceResult<T> | null {
  const invalid = guardServiceTenant(tenant); if (invalid) return invalid as ServiceResult<T>;
  if (getServiceMode() !== 'supabase' || !getSupabaseClient()) return { ok: false, error: 'Ambulante Betriebsabläufe benötigen die Live-Datenbank.' };
  return null;
}
export async function readCareRows(table: string, tenant: string): Promise<ServiceResult<Row[]>> {
  const blocked = guard<Row[]>(tenant); if (blocked) return blocked;
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await fromUnknownTable(getSupabaseClient()!, table).select('*').eq('tenant_id', tenant).order('id').range(offset, offset + 499);
    if (result.error) return { ok: false, error: toGermanSupabaseError(result.error) };
    const page = (result.data ?? []) as Row[]; rows.push(...page);
    if (page.length < 500) return { ok: true, data: rows };
  }
}
export async function callCareOperationsRpc(tenant: string, name: string, params: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
  const blocked = guard<{ id: string }>(tenant); if (blocked) return blocked;
  try {
    const client = getSupabaseClient()! as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: Row | null; error: { code?: string; message?: string } | null }> };
    const result = await client.rpc(name, params);
    if (result.error || !result.data) {
      const message = result.error?.code === 'PGRST202' ? 'Dieser Pflegeablauf ist in der Datenbank noch nicht freigeschaltet.'
        : result.error?.code === '23505' ? 'Ein entsprechender Datensatz besteht bereits. Bitte aktualisieren.'
          : ['P0001', '23514', '40001'].includes(result.error?.code ?? '') ? result.error?.message : toGermanSupabaseError(result.error);
      return { ok: false, error: message || 'Speichern fehlgeschlagen.' };
    }
    return { ok: true, data: { id: text(result.data.id) } };
  } catch { return { ok: false, error: 'Verbindung unterbrochen. Bitte aktualisieren und den Speicherstand prüfen.' }; }
}
export async function fetchCareOperations(tenant: string, role?: RoleKey | null): Promise<ServiceResult<OperationsSnapshot>> {
  const denied = enforcePermission<OperationsSnapshot>(role, 'pflege.plans.view'); if (denied) return denied;
  const blocked = guard<OperationsSnapshot>(tenant); if (blocked) return blocked;
  const [admissions, tariffs, tasks] = await Promise.all(['care_admissions', 'care_tariffs', 'care_operations_tasks'].map((table) => readCareRows(table, tenant)));
  if (!admissions.ok) return admissions; if (!tariffs.ok) return tariffs; if (!tasks.ok) return tasks;
  return { ok: true, data: {
    admissions: admissions.data.map((r) => ({ id: text(r.id), clientId: text(r.client_id), clientName: '', status: text(r.status) as CareAdmission['status'], startsOn: text(r.starts_on), endsOn: text(r.ends_on), basis: text(r.legal_basis) as CareAdmission['basis'], payerName: text(r.payer_name), payerIk: text(r.payer_ik), contractReference: text(r.contract_reference), costInformationReference: text(r.cost_information_reference), consentReference: text(r.consent_reference), emergencyContact: text(r.emergency_contact), accessNotes: text(r.access_notes), notes: text(r.notes), updatedAt: text(r.updated_at) })),
    tariffs: tariffs.data.map((r) => ({ id: text(r.id), code: text(r.service_code), label: text(r.service_label), basis: text(r.legal_basis) as CareTariff['basis'], unit: text(r.billing_unit) as CareTariff['unit'], unitPriceCents: Number(r.unit_price_cents), validFrom: text(r.valid_from), validUntil: text(r.valid_until), payerIk: text(r.payer_ik), agreementReference: text(r.agreement_reference) })),
    tasks: tasks.data.map((r) => ({ id: text(r.id), clientId: text(r.client_id), title: text(r.title), description: text(r.description), dueOn: text(r.due_on), priority: text(r.priority) as CareTask['priority'], status: text(r.status) as CareTask['status'], assignedEmployeeId: text(r.assigned_employee_id), resolution: text(r.resolution), updatedAt: text(r.updated_at) })),
  } };
}
export async function saveCareAdmission(tenant: string, role: RoleKey | null | undefined, payload: Omit<CareAdmission, 'id' | 'status' | 'updatedAt'>, previous?: CareAdmission) {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.plans.manage'); if (denied) return denied;
  return callCareOperationsRpc(tenant, 'save_ambulatory_care_admission', { p_id: previous?.id ?? null, p_expected_at: previous?.updatedAt ?? null, p_payload: payload });
}
export async function advanceCareAdmission(tenant: string, role: RoleKey | null | undefined, previous: CareAdmission, status: CareAdmission['status'], reason: string) {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.plans.manage'); if (denied) return denied;
  return callCareOperationsRpc(tenant, 'advance_ambulatory_care_admission', { p_id: previous.id, p_expected_at: previous.updatedAt, p_status: status, p_reason: reason });
}
export async function createCareTariff(tenant: string, role: RoleKey | null | undefined, payload: Omit<CareTariff, 'id'>) {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.invoices.manage'); if (denied) return denied;
  return callCareOperationsRpc(tenant, 'create_ambulatory_care_tariff', { p_payload: payload });
}
export async function saveCareTask(tenant: string, role: RoleKey | null | undefined, payload: Record<string, unknown>, previous?: CareTask) {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.plans.manage'); if (denied) return denied;
  return callCareOperationsRpc(tenant, 'save_ambulatory_care_task', { p_id: previous?.id ?? null, p_expected_at: previous?.updatedAt ?? null, p_payload: payload });
}
export async function createCatalogCareProof(tenant: string, role: RoleKey | null | undefined, stopId: string, tariffId: string, quantity: number, orderId: string) {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.proofs.create'); if (denied) return denied;
  return callCareOperationsRpc(tenant, 'create_catalog_care_stop_proof', { p_stop_id: stopId, p_tariff_id: tariffId, p_quantity: quantity, p_order_id: orderId || null });
}
