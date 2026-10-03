import { validateCareTour, type CareTourInput, type CareTourStatus, type CareStopStatus } from './careTourWorkflow';
import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type CareTourStop = {
  id: string;
  sequenceNo: number;
  clientId: string | null;
  clientName: string;
  address: string;
  plannedStart: string;
  plannedEnd: string;
  serviceSummary: string;
  status: string;
  notes: string;
  actualStartedAt: string;
  actualEndedAt: string;
  serviceProofId: string;
  documentationEntryId: string;
};

export type CareTour = {
  id: string;
  tourDate: string;
  name: string;
  employeeId: string | null;
  employeeName: string;
  vehicleLabel: string;
  status: string;
  notes: string;
  stops: CareTourStop[];
  events: { id: string; action: string; actorName: string; note: string; occurredAt: string }[];
};

type Row = Record<string, unknown>;
const text = (value: unknown): string => value == null ? '' : String(value);

function liveGuard<T>(tenantId: string): ServiceResult<T> | null {
  const tenant = guardServiceTenant(tenantId);
  if (tenant) return tenant as ServiceResult<T>;
  if (getServiceMode() !== 'supabase' || !getSupabaseClient()) {
    return { ok: false, error: 'Die Pflege-Tourenplanung ist ausschließlich live verfügbar.' };
  }
  return null;
}

/** Read all pages so the API row limit cannot truncate a tour or its counters. */
async function readTourRows(client: NonNullable<ReturnType<typeof getSupabaseClient>>, table: string, tenantId: string, orderColumn: string) {
  const data: Row[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const result = await fromUnknownTable(client, table).select('*').eq('tenant_id', tenantId)
      .order(orderColumn, { ascending: true }).order('id', { ascending: true }).range(offset, offset + pageSize - 1);
    if (result.error) return { data, error: result.error };
    const rows = (result.data ?? []) as Row[];
    data.push(...rows);
    if (rows.length < pageSize) return { data, error: null };
  }
}

export async function fetchCareTours(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareTour[]>> {
  const denied = enforcePermission<CareTour[]>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const blocked = liveGuard<CareTour[]>(tenantId);
  if (blocked) return blocked;
  const supabase = getSupabaseClient()!;
  const [toursResult, stopsResult, eventsResult] = await Promise.all([
    readTourRows(supabase, 'care_tours', tenantId, 'tour_date'),
    readTourRows(supabase, 'care_tour_stops', tenantId, 'sequence_no'),
    readTourRows(supabase, 'care_tour_events', tenantId, 'occurred_at'),
  ]);
  const error = toursResult.error ?? stopsResult.error ?? eventsResult.error;
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const stopsByTour = new Map<string, CareTourStop[]>();
  for (const row of (stopsResult.data ?? []) as Row[]) {
    const tourId = text(row.tour_id);
    const stop: CareTourStop = {
      id: text(row.id), sequenceNo: Number(row.sequence_no),
      clientId: row.client_id ? text(row.client_id) : null,
      clientName: text(row.client_name_snapshot), address: text(row.address_snapshot),
      plannedStart: text(row.planned_start).slice(0, 5), plannedEnd: text(row.planned_end).slice(0, 5),
      serviceSummary: text(row.service_summary), status: text(row.status), notes: text(row.notes),
      actualStartedAt: text(row.actual_started_at), actualEndedAt: text(row.actual_ended_at), serviceProofId: text(row.service_proof_id), documentationEntryId: text(row.documentation_entry_id),
    };
    stopsByTour.set(tourId, [...(stopsByTour.get(tourId) ?? []), stop]);
  }
  const eventsByTour = new Map<string, CareTour['events']>();
  for (const event of (eventsResult.data ?? []) as Row[]) {
    const tourId = text(event.tour_id);
    const events = eventsByTour.get(tourId) ?? [];
    events.push({ id: text(event.id), action: text(event.action), actorName: text(event.actor_name), note: text(event.note), occurredAt: text(event.occurred_at) });
    eventsByTour.set(tourId, events);
  }
  return { ok: true, data: ((toursResult.data ?? []) as Row[]).map((row) => ({
    id: text(row.id), tourDate: text(row.tour_date), name: text(row.name),
    employeeId: row.employee_id ? text(row.employee_id) : null, employeeName: text(row.employee_name_snapshot), vehicleLabel: text(row.vehicle_label_snapshot),
    status: text(row.status), notes: text(row.notes), stops: stopsByTour.get(text(row.id)) ?? [],
    events: (eventsByTour.get(text(row.id)) ?? []).slice().reverse(),
  })) };
}

/** A single database transaction creates the tour and all linked client stops. */
export async function createCareTour(
  tenantId: string, actorRoleKey: RoleKey | null | undefined, input: CareTourInput,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'pflege.plans.manage');
  if (denied) return denied;
  const invalid = validateCareTour(input);
  if (invalid) return { ok: false, error: invalid };
  return callTourRpc(tenantId, 'create_ambulatory_care_tour', { p_payload: input });
}

export async function updateCareTourStatus(
  tenantId: string, tourId: string, status: CareTourStatus, actorRoleKey?: RoleKey | null,
  expectedStatus?: string, reason = '',
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'pflege.plans.manage');
  if (denied) return denied;
  return callTourRpc(tenantId, 'advance_ambulatory_care_tour', {
    p_tour_id: tourId, p_status: status, p_expected_status: expectedStatus ?? '', p_reason: reason,
  });
}

export async function updateCareTourStopStatus(
  tenantId: string, stopId: string, status: CareStopStatus, expectedStatus: string,
  note: string, actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'pflege.plans.manage');
  if (denied) return denied;
  if ((status === 'completed' || status === 'cancelled') && !note.trim()) return { ok: false, error: 'Durchführungsnachweis bzw. Ausfallgrund ist erforderlich.' };
  return callTourRpc(tenantId, 'advance_ambulatory_care_stop', {
    p_stop_id: stopId, p_status: status, p_expected_status: expectedStatus, p_note: note.trim(),
  });
}

async function callTourRpc(tenantId: string, name: string, params: Record<string, unknown>): Promise<ServiceResult<{ id: string }>> {
  const blocked = liveGuard<{ id: string }>(tenantId);
  if (blocked) return blocked;
  try {
    const client = getSupabaseClient()! as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: Parameters<typeof toGermanSupabaseError>[0] }> };
    const { data, error } = await client.rpc(name, params);
    if (error) return { ok: false, error: tourErrorMessage(error) };
    const row = data as Row | null;
    return row?.id ? { ok: true, data: { id: text(row.id) } } : { ok: false, error: 'Die Änderung wurde nicht bestätigt. Bitte Touren neu laden.' };
  } catch {
    return { ok: false, error: 'Verbindung unterbrochen. Bitte aktualisieren und prüfen, ob die Änderung gespeichert wurde.' };
  }
}

export type CareTourResources = {
  employees: { id: string; name: string; qualification: string }[];
  clients: { id: string; name: string; address: string }[];
};

export async function fetchCareTourResources(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<CareTourResources>> {
  const denied = enforcePermission<CareTourResources>(role, 'pflege.plans.manage');
  if (denied) return denied;
  const blocked = liveGuard<CareTourResources>(tenantId);
  if (blocked) return blocked;
  const client = getSupabaseClient()! as unknown as { rpc: (name: string) => Promise<{ data: unknown; error: Parameters<typeof toGermanSupabaseError>[0] }> };
  const { data, error } = await client.rpc('get_ambulatory_care_tour_resources');
  if (error || !data) return { ok: false, error: tourErrorMessage(error) };
  return { ok: true, data: data as CareTourResources };
}

function tourErrorMessage(error: Parameters<typeof toGermanSupabaseError>[0]): string {
  const detail = error as { code?: string; message?: string } | null;
  if (detail?.code === '40001') return 'Der Datensatz wurde zwischenzeitlich geändert. Bitte aktualisieren.';
  if (detail?.code === 'PGRST202') return 'Der ambulante Tourenworkflow ist in der Datenbank noch nicht freigeschaltet.';
  if ((detail?.code === 'P0001' || detail?.code === '23514') && detail.message) return detail.message;
  return toGermanSupabaseError(error);
}

export async function createCareTourStopProof(tenantId: string, stopId: string, payload: Record<string, unknown>, role?: RoleKey | null): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.proofs.create');
  if (denied) return denied;
  return callTourRpc(tenantId, 'create_ambulatory_care_stop_proof', { p_stop_id: stopId, p_payload: payload });
}

export async function capturePflegeProofSignature(tenantId: string, proofId: string, signerName: string, dataUrl: string, role?: RoleKey | null): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(role, 'pflege.proofs.sign');
  if (denied) return denied;
  return callTourRpc(tenantId, 'capture_pfleger_proof_signature', { p_proof_id: proofId, p_signer_name: signerName.trim(), p_png_data_url: dataUrl });
}

export async function fetchPflegeProofSignature(tenantId: string, proofId: string, role?: RoleKey | null): Promise<ServiceResult<{ dataUrl: string; signerName: string; capturedAt: string } | null>> {
  const denied = enforcePermission<{ dataUrl: string; signerName: string; capturedAt: string } | null>(role, 'pflege.proofs.view');
  if (denied) return denied;
  const blocked = liveGuard<{ dataUrl: string; signerName: string; capturedAt: string } | null>(tenantId);
  if (blocked) return blocked;
  const { data, error } = await fromUnknownTable(getSupabaseClient()!, 'pfleger_signature_evidence')
    .select('png_data_url,signer_name,captured_at').eq('tenant_id', tenantId).eq('proof_id', proofId).maybeSingle();
  if (error) return { ok: false, error: tourErrorMessage(error) };
  const row = data as Row | null;
  return { ok: true, data: row ? { dataUrl: text(row.png_data_url), signerName: text(row.signer_name), capturedAt: text(row.captured_at) } : null };
}
