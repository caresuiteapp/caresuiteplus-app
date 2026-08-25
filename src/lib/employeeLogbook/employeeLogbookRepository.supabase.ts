import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { CreateManualLogbookTripInput, EmployeeLogbookBundle, LogbookDailyConfirmation, LogbookPoint, LogbookProfile, LogbookTrip, LogbookVehicle, StartLogbookTripInput } from '@/types/modules/employeeLogbook';

type Row = Record<string, unknown>;
const s = (value: unknown) => typeof value === 'string' ? value : '';
const n = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
const nullable = (value: unknown) => s(value) || null;

function mapProfile(row: Row | null, tenantId: string, employeeId: string): LogbookProfile {
  return { tenantId, employeeId, defaultVehicleId: nullable(row?.default_vehicle_id), mileageRateCents: n(row?.mileage_rate_cents) || 30, gpsConsent: Boolean(row?.gps_consent), licenseFrontPath: nullable(row?.license_front_path), licenseBackPath: nullable(row?.license_back_path) };
}
function mapVehicle(row: Row): LogbookVehicle { return { id: s(row.id), tenantId: s(row.tenant_id), employeeId: s(row.employee_id), ownership: row.ownership === 'company' ? 'company' : 'private', plate: s(row.plate), make: nullable(row.make), model: nullable(row.model), active: row.active !== false }; }
function mapTrip(row: Row): LogbookTrip { return { id: s(row.id), tenantId: s(row.tenant_id), employeeId: s(row.employee_id), assignmentId: nullable(row.assignment_id), clientId: nullable(row.client_id), vehicleId: nullable(row.vehicle_id), routeType: s(row.route_type) as LogbookTrip['routeType'], purpose: s(row.purpose), manualReason: nullable(row.manual_reason), status: s(row.status) as LogbookTrip['status'], startedAt: s(row.started_at), endedAt: nullable(row.ended_at), startAddress: nullable(row.start_address), endAddress: nullable(row.end_address), distanceGpsKm: n(row.distance_gps_km), distanceFinalKm: n(row.distance_final_km), durationSeconds: n(row.duration_seconds), countsAsWorkTime: Boolean(row.counts_as_work_time), worktimeDeductionMinutes: n(row.worktime_deduction_minutes), mileageRateCents: n(row.mileage_rate_cents), mileageAmountCents: n(row.mileage_amount_cents), gpsCaptured: Boolean(row.gps_captured), correctedAt: nullable(row.corrected_at), notes: nullable(row.notes) }; }
function mapConfirmation(row: Row): LogbookDailyConfirmation { return { id: s(row.id), workDate: s(row.work_date), tripCount: n(row.trip_count), distanceKm: n(row.distance_km), signatureData: s(row.signature_data), signerName: s(row.signer_name), confirmedAt: s(row.confirmed_at) }; }

function db() { const client = getSupabaseClient(); if (!client) throw new Error('Keine sichere Datenbankverbindung.'); return client; }

async function loadAllEmployeeTripRows(tenantId: string, employeeId: string): Promise<Row[]> {
  const pageSize = 500;
  const rows: Row[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = await fromUnknownTable(db(), 'employee_logbook_trips')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('started_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    const page = (result.data ?? []) as Row[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function loadEmployeeLogbook(tenantId: string, employeeId: string): Promise<EmployeeLogbookBundle> {
  const client = db();
  const [profile, vehicles, trips, confirmations] = await Promise.all([
    fromUnknownTable(client, 'employee_logbook_profiles').select('*').eq('tenant_id', tenantId).eq('employee_id', employeeId).maybeSingle(),
    fromUnknownTable(client, 'employee_logbook_vehicles').select('*').eq('tenant_id', tenantId).eq('employee_id', employeeId).order('active', { ascending: false }),
    loadAllEmployeeTripRows(tenantId, employeeId),
    fromUnknownTable(client, 'employee_logbook_daily_confirmations').select('*').eq('tenant_id', tenantId).eq('employee_id', employeeId).order('work_date', { ascending: false }).limit(90),
  ]);
  const error = profile.error || vehicles.error || confirmations.error;
  if (error) throw new Error(error.message);
  return { profile: mapProfile(profile.data as Row | null, tenantId, employeeId), vehicles: ((vehicles.data ?? []) as Row[]).map(mapVehicle), trips: trips.map(mapTrip), confirmations: ((confirmations.data ?? []) as Row[]).map(mapConfirmation) };
}

export async function saveLogbookProfile(profile: LogbookProfile) {
  const { error } = await fromUnknownTable(db(), 'employee_logbook_profiles').upsert({ tenant_id: profile.tenantId, employee_id: profile.employeeId, default_vehicle_id: profile.defaultVehicleId, mileage_rate_cents: profile.mileageRateCents, gps_consent: profile.gpsConsent, gps_consent_at: profile.gpsConsent ? new Date().toISOString() : null, license_front_path: profile.licenseFrontPath, license_back_path: profile.licenseBackPath, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,employee_id' });
  if (error) throw new Error(error.message);
}

export async function saveLogbookVehicle(vehicle: Omit<LogbookVehicle, 'id'> & { id?: string }) {
  const payload = { tenant_id: vehicle.tenantId, employee_id: vehicle.employeeId, ownership: vehicle.ownership, plate: vehicle.plate.trim().toUpperCase(), make: vehicle.make, model: vehicle.model, active: vehicle.active, updated_at: new Date().toISOString() };
  const query = vehicle.id ? fromUnknownTable(db(), 'employee_logbook_vehicles').update(payload).eq('id', vehicle.id) : fromUnknownTable(db(), 'employee_logbook_vehicles').insert(payload);
  const { error } = await query; if (error) throw new Error(error.message);
}

export async function createLogbookTrip(input: StartLogbookTripInput): Promise<LogbookTrip> {
  if (!input.assignmentId && !input.clientId && !input.manualReason?.trim()) throw new Error('Ohne Einsatz- oder Klient:innenzuordnung ist eine Begründung erforderlich.');
  const { data, error } = await fromUnknownTable(db(), 'employee_logbook_trips').insert({ tenant_id: input.tenantId, employee_id: input.employeeId, vehicle_id: input.vehicleId, assignment_id: input.assignmentId ?? null, client_id: input.clientId ?? null, route_type: input.routeType, purpose: input.purpose.trim(), manual_reason: input.manualReason?.trim() || null, start_address: input.startAddress?.trim() || null, status: 'recording', started_at: new Date().toISOString(), source: 'employee_portal', gps_captured: true }).select('*').single();
  if (error) throw new Error(error.message); return mapTrip(data as Row);
}

export async function createManualLogbookTrip(input: CreateManualLogbookTripInput): Promise<LogbookTrip> {
  if (input.purpose.trim().length < 3) throw new Error('Bitte einen aussagekräftigen Fahrtzweck eintragen.');
  if (input.manualReason.trim().length < 3) throw new Error('Für die manuelle Erfassung ist eine Begründung erforderlich.');
  if (!Number.isFinite(input.distanceKm) || input.distanceKm < 0) throw new Error('Bitte gültige Kilometer eintragen.');
  const startedAt = new Date(input.startedAt);
  const endedAt = new Date(input.endedAt);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime()) || endedAt <= startedAt) {
    throw new Error('Start- und Endzeit sind ungültig. Das Ende muss nach dem Start liegen.');
  }
  const { data, error } = await fromUnknownTable(db(), 'employee_logbook_trips').insert({
    tenant_id: input.tenantId,
    employee_id: input.employeeId,
    vehicle_id: input.vehicleId,
    assignment_id: null,
    client_id: null,
    route_type: input.routeType,
    purpose: input.purpose.trim(),
    manual_reason: input.manualReason.trim(),
    status: 'completed',
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    start_address: input.startAddress.trim() || null,
    end_address: input.endAddress.trim() || null,
    distance_gps_km: 0,
    distance_final_km: input.distanceKm,
    gps_captured: false,
    source: 'office_manual',
    notes: input.notes?.trim() || null,
  }).select('*').single();
  if (error) throw new Error(error.message);
  return mapTrip(data as Row);
}

export async function appendLogbookPoints(tripId: string, tenantId: string, employeeId: string, points: LogbookPoint[]) {
  if (!points.length) return;
  const { error } = await fromUnknownTable(db(), 'employee_logbook_points').insert(points.map((point) => ({ trip_id: tripId, tenant_id: tenantId, employee_id: employeeId, latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy ?? null, altitude: point.altitude ?? null, speed: point.speed ?? null, heading: point.heading ?? null, recorded_at: point.recordedAt, source: 'device_gps' })));
  if (error) throw new Error(error.message);
}

export async function finishLogbookTrip(tripId: string, input: { tenantId: string; employeeId: string; endAddress?: string; notes?: string; points: LogbookPoint[] }) {
  await appendLogbookPoints(tripId, input.tenantId, input.employeeId, input.points);
  const { calculateTrackDistanceKm } = await import('./employeeLogbookMath');
  const { data: stored, error: pointsError } = await fromUnknownTable(db(), 'employee_logbook_points').select('latitude,longitude,accuracy,altitude,speed,heading,recorded_at').eq('trip_id', tripId).order('recorded_at', { ascending: true });
  if (pointsError) throw new Error(pointsError.message);
  const allPoints = ((stored ?? []) as Row[]).map((row): LogbookPoint => ({ latitude: n(row.latitude), longitude: n(row.longitude), accuracy: row.accuracy == null ? null : n(row.accuracy), altitude: row.altitude == null ? null : n(row.altitude), speed: row.speed == null ? null : n(row.speed), heading: row.heading == null ? null : n(row.heading), recordedAt: s(row.recorded_at) }));
  const distanceKm = calculateTrackDistanceKm(allPoints);
  const { error } = await fromUnknownTable(db(), 'employee_logbook_trips').update({ ended_at: new Date().toISOString(), end_address: input.endAddress?.trim() || null, notes: input.notes?.trim() || null, distance_gps_km: distanceKm, distance_final_km: distanceKm, status: 'completed', gps_captured: allPoints.length > 1, updated_at: new Date().toISOString() }).eq('id', tripId);
  if (error) throw new Error(error.message);
}

export async function correctLogbookTrip(trip: LogbookTrip, distanceKm: number, reason: string) {
  if (!reason.trim()) throw new Error('Für jede Korrektur ist eine Begründung erforderlich.');
  const { error } = await fromUnknownTable(db(), 'employee_logbook_trips').update({ distance_final_km: distanceKm, status: 'corrected', corrected_at: new Date().toISOString(), correction_reason: reason.trim(), previous_values: { distance_final_km: trip.distanceFinalKm, status: trip.status }, updated_at: new Date().toISOString() }).eq('id', trip.id);
  if (error) throw new Error(error.message);
}

export async function confirmLogbookDay(input: { tenantId: string; employeeId: string; workDate: string; signerName: string; signatureData: string; trips: LogbookTrip[] }) {
  const dayTrips = input.trips.filter((trip) => trip.startedAt.slice(0, 10) === input.workDate && ['completed', 'corrected'].includes(trip.status));
  if (!dayTrips.length) throw new Error('Für diesen Tag sind keine abgeschlossenen Fahrten vorhanden.');
  const { error } = await fromUnknownTable(db(), 'employee_logbook_daily_confirmations').insert({ tenant_id: input.tenantId, employee_id: input.employeeId, work_date: input.workDate, signer_name: input.signerName.trim(), signature_data: input.signatureData, trip_count: dayTrips.length, distance_km: dayTrips.reduce((sum, trip) => sum + trip.distanceFinalKm, 0), confirmed_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function uploadLogbookFile(input: { tenantId: string; employeeId: string; area: string; uri: string; fileName: string; mimeType?: string | null }) {
  const response = await fetch(input.uri); const blob = await response.blob();
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${input.tenantId}/${input.employeeId}/${input.area}/${Date.now()}-${safeName}`;
  const { error } = await db().storage.from('employee-logbook').upload(path, blob, { contentType: input.mimeType ?? blob.type, upsert: false });
  if (error) throw new Error(error.message); return path;
}

export async function createLogbookReceipt(input: { tenantId: string; employeeId: string; tripId: string | null; category: string; amountCents: number; expenseDate: string; storagePath: string; fileName: string; mimeType?: string | null; notes?: string }) {
  const { error } = await fromUnknownTable(db(), 'employee_logbook_receipts').insert({ tenant_id: input.tenantId, employee_id: input.employeeId, trip_id: input.tripId, category: input.category, amount_cents: input.amountCents, expense_date: input.expenseDate, storage_path: input.storagePath, file_name: input.fileName, mime_type: input.mimeType ?? null, notes: input.notes?.trim() || null });
  if (error) throw new Error(error.message);
}

export async function addLogbookStop(input: { tenantId: string; employeeId: string; tripId: string; stopKind: 'client' | 'doctor' | 'pharmacy' | 'shopping' | 'office' | 'home' | 'other'; label: string }) {
  if (!input.label.trim()) throw new Error('Bitte einen Namen oder Zweck für den Stopp eintragen.');
  const { count, error: countError } = await fromUnknownTable(db(), 'employee_logbook_segments').select('id', { count: 'exact', head: true }).eq('trip_id', input.tripId);
  if (countError) throw new Error(countError.message);
  const { error } = await fromUnknownTable(db(), 'employee_logbook_segments').insert({ tenant_id: input.tenantId, employee_id: input.employeeId, trip_id: input.tripId, sequence_no: (count ?? 0) + 1, stop_kind: input.stopKind, label: input.label.trim(), started_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
