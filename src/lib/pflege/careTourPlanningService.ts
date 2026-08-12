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
};

export type CareTour = {
  id: string;
  tourDate: string;
  name: string;
  employeeName: string;
  vehicleLabel: string;
  status: string;
  notes: string;
  stops: CareTourStop[];
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

export async function fetchCareTours(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CareTour[]>> {
  const denied = enforcePermission<CareTour[]>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const blocked = liveGuard<CareTour[]>(tenantId);
  if (blocked) return blocked;
  const supabase = getSupabaseClient()!;
  const [toursResult, stopsResult] = await Promise.all([
    fromUnknownTable(supabase, 'care_tours').select('*').eq('tenant_id', tenantId).order('tour_date', { ascending: true }),
    fromUnknownTable(supabase, 'care_tour_stops').select('*').eq('tenant_id', tenantId).order('sequence_no', { ascending: true }),
  ]);
  const error = toursResult.error ?? stopsResult.error;
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  const stopsByTour = new Map<string, CareTourStop[]>();
  for (const row of (stopsResult.data ?? []) as Row[]) {
    const tourId = text(row.tour_id);
    const stop: CareTourStop = {
      id: text(row.id), sequenceNo: Number(row.sequence_no),
      clientId: row.client_id ? text(row.client_id) : null,
      clientName: text(row.client_name_snapshot), address: text(row.address_snapshot),
      plannedStart: text(row.planned_start).slice(0, 5), plannedEnd: text(row.planned_end).slice(0, 5),
      serviceSummary: text(row.service_summary), status: text(row.status),
    };
    stopsByTour.set(tourId, [...(stopsByTour.get(tourId) ?? []), stop]);
  }
  return { ok: true, data: ((toursResult.data ?? []) as Row[]).map((row) => ({
    id: text(row.id), tourDate: text(row.tour_date), name: text(row.name),
    employeeName: text(row.employee_name_snapshot), vehicleLabel: text(row.vehicle_label_snapshot),
    status: text(row.status), notes: text(row.notes), stops: stopsByTour.get(text(row.id)) ?? [],
  })) };
}

export async function createCareTour(
  tenantId: string,
  actorRoleKey: RoleKey | null | undefined,
  input: {
    tourDate: string; name: string; employeeName: string; vehicleLabel: string; notes: string;
    stops: { clientName: string; address: string; plannedStart: string; plannedEnd: string; serviceSummary: string }[];
  },
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const blocked = liveGuard<{ id: string }>(tenantId);
  if (blocked) return blocked;
  if (!input.name.trim() || !input.tourDate || !input.employeeName.trim() || input.stops.length === 0) {
    return { ok: false, error: 'Tourname, Datum, Pflegekraft und mindestens ein Stopp sind erforderlich.' };
  }
  if (input.stops.some((stop) => !stop.clientName.trim() || !stop.plannedStart || !stop.plannedEnd || stop.plannedEnd <= stop.plannedStart)) {
    return { ok: false, error: 'Jeder Stopp benötigt Klient:in und ein gültiges Zeitfenster.' };
  }
  const supabase = getSupabaseClient()!;
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  const { data: tour, error: tourError } = await fromUnknownTable(supabase, 'care_tours').insert({
    tenant_id: tenantId, tour_date: input.tourDate, name: input.name.trim(),
    employee_name_snapshot: input.employeeName.trim(), vehicle_label_snapshot: input.vehicleLabel.trim(),
    notes: input.notes.trim(), status: 'draft', created_by: userId,
  }).select('id').single();
  if (tourError || !tour) return { ok: false, error: toGermanSupabaseError(tourError) };
  const tourId = text((tour as Row).id);
  const { error: stopsError } = await fromUnknownTable(supabase, 'care_tour_stops').insert(
    input.stops.map((stop, index) => ({
      tenant_id: tenantId, tour_id: tourId, sequence_no: index + 1,
      client_name_snapshot: stop.clientName.trim(), address_snapshot: stop.address.trim(),
      planned_start: stop.plannedStart, planned_end: stop.plannedEnd,
      service_summary: stop.serviceSummary.trim(), status: 'planned',
    })),
  );
  if (stopsError) {
    await fromUnknownTable(supabase, 'care_tours').delete().eq('id', tourId).eq('tenant_id', tenantId);
    return { ok: false, error: toGermanSupabaseError(stopsError) };
  }
  return { ok: true, data: { id: tourId } };
}

export async function updateCareTourStatus(
  tenantId: string,
  tourId: string,
  status: 'published' | 'in_progress' | 'completed' | 'cancelled',
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;
  const blocked = liveGuard<{ id: string }>(tenantId);
  if (blocked) return blocked;
  const userId = (await getSupabaseClient()!.auth.getUser()).data.user?.id ?? null;
  const { error } = await fromUnknownTable(getSupabaseClient()!, 'care_tours')
    .update({ status, updated_by: userId, updated_at: new Date().toISOString() })
    .eq('id', tourId).eq('tenant_id', tenantId);
  return error ? { ok: false, error: toGermanSupabaseError(error) } : { ok: true, data: { id: tourId } };
}
