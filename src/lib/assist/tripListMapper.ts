import type { ServiceResult } from '@/types';
import type { TripLogListItem, TripPurpose } from '@/types/modules/assist';
import type { WorkflowStatus } from '@/types';

/** Felder, die für vollständige Live-Listen-Mappings erforderlich sind. */
export const TRIP_LIVE_REQUIRED_FIELDS = [
  'employee_name',
  'vehicle_label',
  'purpose',
  'started_at',
] as const;

/** Spalten aus Migration 0007 (Basis). */
export const TRIP_BASE_SELECT_COLUMNS =
  'id, tenant_id, title, status, distance_km, created_at, updated_at';

/** Live-Spalten aus Migration 0021 — SELECT nur wenn Migration angewendet. */
export const TRIP_LIVE_SELECT_COLUMNS =
  `${TRIP_BASE_SELECT_COLUMNS}, employee_name, vehicle_label, purpose, started_at, ended_at`;

export type TripLiveRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  employee_name?: string | null;
  vehicle_label?: string | null;
  purpose?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  distance_km?: number | null;
  created_at: string;
  updated_at: string;
};

const TRIP_PURPOSES: TripPurpose[] = ['einsatz', 'dienstfahrt', 'material', 'sonstiges'];

function schemaMissingFields(rows: TripLiveRow[]): string[] {
  const missing = new Set<string>();
  for (const row of rows) {
    for (const field of TRIP_LIVE_REQUIRED_FIELDS) {
      if (row[field] === undefined) {
        missing.add(field);
      }
    }
  }
  return [...missing].sort();
}

export function rowDataMissingFields(row: TripLiveRow): string[] {
  const missing: string[] = [];
  if (!row.employee_name?.trim()) missing.push('employee_name');
  if (!row.vehicle_label?.trim()) missing.push('vehicle_label');
  if (
    !row.purpose?.trim() ||
    !TRIP_PURPOSES.includes(row.purpose as TripPurpose)
  ) {
    missing.push('purpose');
  }
  if (!row.started_at?.trim()) missing.push('started_at');
  return missing;
}

export function mapCompleteTripRow(row: TripLiveRow): TripLogListItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: '',
    assignmentId: null,
    vehicleLabel: row.vehicle_label!.trim(),
    purpose: row.purpose as TripPurpose,
    startedAt: row.started_at!,
    endedAt: row.ended_at ?? null,
    distanceKm: row.distance_km != null ? Number(row.distance_km) : null,
    status: row.status as WorkflowStatus,
    updatedAt: row.updated_at,
    employeeName: row.employee_name!.trim(),
    routeSummary: row.title.trim(),
  };
}

export function mapTripRowsToListItems(
  rows: TripLiveRow[],
): ServiceResult<TripLogListItem[]> {
  if (rows.length === 0) {
    return { ok: true, data: [] };
  }

  const schemaMissing = schemaMissingFields(rows);
  if (schemaMissing.length > 0) {
    const fields = schemaMissing.join(', ');
    return {
      ok: false,
      error: `Live-Fahrtenliste: Supabase-Schema unvollständig (${fields} fehlen). Migration für trips erweitern.`,
    };
  }

  const data = rows
    .filter((row) => rowDataMissingFields(row).length === 0)
    .map(mapCompleteTripRow);

  return { ok: true, data };
}
