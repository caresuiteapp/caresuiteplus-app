import type { ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/core/base';
import type { ResidentListItem } from '@/types/modules/stationaer';

/** Felder, die für vollständige Live-Listen-Mappings erforderlich sind. */
export const RESIDENT_LIVE_REQUIRED_FIELDS = [
  'first_name',
  'last_name',
  'wing',
  'admission_date',
  'care_level',
  'room_name',
] as const;

/** Spalten aus Migration 0007 (Basis). */
export const RESIDENT_BASE_SELECT_COLUMNS =
  'id, tenant_id, title, status, created_at, updated_at';

/** Live-Spalten aus Migration 0023 — SELECT nur wenn Migration angewendet. */
export const RESIDENT_LIVE_SELECT_COLUMNS =
  `${RESIDENT_BASE_SELECT_COLUMNS}, record_type, first_name, last_name, wing, admission_date, care_level, room_name`;

export type ResidentLiveRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  record_type?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  wing?: string | null;
  admission_date?: string | null;
  care_level?: string | null;
  room_name?: string | null;
  created_at: string;
  updated_at: string;
};

function schemaMissingFields(rows: ResidentLiveRow[]): string[] {
  const missing = new Set<string>();
  for (const row of rows) {
    for (const field of RESIDENT_LIVE_REQUIRED_FIELDS) {
      if (row[field] === undefined) {
        missing.add(field);
      }
    }
  }
  return [...missing].sort();
}

export function rowDataMissingFields(row: ResidentLiveRow): string[] {
  const missing: string[] = [];
  if (!row.first_name?.trim()) missing.push('first_name');
  if (!row.last_name?.trim()) missing.push('last_name');
  if (!row.wing?.trim()) missing.push('wing');
  if (!row.admission_date?.trim()) missing.push('admission_date');
  if (!row.care_level?.trim()) missing.push('care_level');
  if (!row.room_name?.trim()) missing.push('room_name');
  return missing;
}

export function mapCompleteResidentRow(row: ResidentLiveRow): ResidentListItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    firstName: row.first_name!.trim(),
    lastName: row.last_name!.trim(),
    wing: row.wing!.trim(),
    admissionDate: row.admission_date!,
    careLevel: row.care_level!.trim(),
    status: row.status as WorkflowStatus,
    updatedAt: row.updated_at,
    roomName: row.room_name!.trim(),
  };
}

export function mapResidentRowsToListItems(
  rows: ResidentLiveRow[],
): ServiceResult<ResidentListItem[]> {
  if (rows.length === 0) {
    return { ok: true, data: [] };
  }

  const schemaMissing = schemaMissingFields(rows);
  if (schemaMissing.length > 0) {
    const fields = schemaMissing.join(', ');
    return {
      ok: false,
      error: `Live-Bewohnerliste: Supabase-Schema unvollständig (${fields} fehlen). Migration für care_records erweitern.`,
    };
  }

  const data = rows
    .filter((row) => rowDataMissingFields(row).length === 0)
    .map(mapCompleteResidentRow);

  return { ok: true, data };
}
