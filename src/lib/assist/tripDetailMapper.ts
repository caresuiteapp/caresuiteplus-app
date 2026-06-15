import type { ServiceResult } from '@/types';
import type { TripLogDetail } from '@/types/modules/assist';
import {
  mapCompleteTripRow,
  rowDataMissingFields,
  TRIP_LIVE_REQUIRED_FIELDS,
  TRIP_LIVE_SELECT_COLUMNS,
  type TripLiveRow,
} from './tripListMapper';

/** Detail-Spalten aus Migration 0022 — SELECT nur wenn Migration angewendet. */
export const TRIP_DETAIL_SELECT_COLUMNS =
  `${TRIP_LIVE_SELECT_COLUMNS}, start_address, end_address, notes`;

/** Für Detail zusätzlich erforderliche Schema-Spalte (Adresse). */
export const TRIP_DETAIL_REQUIRED_FIELDS = ['start_address'] as const;

export type TripDetailLiveRow = TripLiveRow & {
  start_address?: string | null;
  end_address?: string | null;
  notes?: string | null;
};

function schemaMissingDetailFields(row: TripDetailLiveRow): string[] {
  const missing: string[] = [];
  for (const field of TRIP_DETAIL_REQUIRED_FIELDS) {
    if (row[field] === undefined) {
      missing.push(field);
    }
  }
  return missing;
}

function buildRouteSummary(startAddress: string, endAddress: string | null): string {
  return `${startAddress}${endAddress ? ` → ${endAddress}` : ' (läuft)'}`;
}

function mapCompleteTripDetailRow(row: TripDetailLiveRow): TripLogDetail {
  const listItem = mapCompleteTripRow(row);
  const startAddress = row.start_address!.trim();
  const endAddress = row.end_address?.trim() || null;

  return {
    ...listItem,
    routeSummary: buildRouteSummary(startAddress, endAddress),
    startAddress,
    endAddress,
    notes: row.notes?.trim() || null,
    geofenceEvents: [],
  };
}

export function mapTripRowToDetail(
  row: TripDetailLiveRow,
): ServiceResult<TripLogDetail> {
  const schemaMissing = schemaMissingDetailFields(row);
  if (schemaMissing.length > 0) {
    const fields = schemaMissing.join(', ');
    return {
      ok: false,
      error: `Live-Fahrtdetail: Supabase-Schema unvollständig (${fields} fehlen). Migration für trips erweitern.`,
    };
  }

  for (const field of TRIP_LIVE_REQUIRED_FIELDS) {
    if (row[field] === undefined) {
      return {
        ok: false,
        error: `Live-Fahrtdetail: Supabase-Schema unvollständig (${field} fehlen). Migration für trips erweitern.`,
      };
    }
  }

  const listMissing = rowDataMissingFields(row);
  if (listMissing.length > 0) {
    const fields = listMissing.join(', ');
    return {
      ok: false,
      error: `Live-Fahrtdetail: Pflichtfelder fehlen (${fields}).`,
    };
  }

  if (!row.start_address?.trim()) {
    return {
      ok: false,
      error: 'Live-Fahrtdetail: Startadresse fehlt (start_address).',
    };
  }

  return { ok: true, data: mapCompleteTripDetailRow(row) };
}
