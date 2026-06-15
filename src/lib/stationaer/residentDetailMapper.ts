import type { ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/core/base';
import type { ResidentDetail } from '@/types/modules/stationaer';
import { CLIENT_STATUS_HINTS } from '@/lib/services';
import {
  mapCompleteResidentRow,
  rowDataMissingFields,
  RESIDENT_LIVE_REQUIRED_FIELDS,
  RESIDENT_LIVE_SELECT_COLUMNS,
  type ResidentLiveRow,
} from './residentListMapper';

/** Detail-Spalten aus Migration 0024 — SELECT nur wenn Migration angewendet. */
export const RESIDENT_DETAIL_SELECT_COLUMNS =
  `${RESIDENT_LIVE_SELECT_COLUMNS}, room_id, notes`;

/** Für Detail zusätzlich erforderliche Schema-Spalte. */
export const RESIDENT_DETAIL_REQUIRED_FIELDS = ['notes'] as const;

export type ResidentDetailLiveRow = ResidentLiveRow & {
  room_id?: string | null;
  notes?: string | null;
};

function schemaMissingDetailFields(row: ResidentDetailLiveRow): string[] {
  const missing: string[] = [];
  for (const field of RESIDENT_DETAIL_REQUIRED_FIELDS) {
    if (row[field] === undefined) {
      missing.push(field);
    }
  }
  return missing;
}

function mapCompleteResidentDetailRow(row: ResidentDetailLiveRow): ResidentDetail {
  const listItem = mapCompleteResidentRow(row);

  return {
    ...listItem,
    roomId: row.room_id?.trim() || null,
    notes: row.notes?.trim() || null,
    roomName: listItem.roomName,
    visibility: 'team',
    sensitivity: 'health',
    createdAt: row.created_at,
    nextActionHint: CLIENT_STATUS_HINTS[row.status as WorkflowStatus],
  };
}

export function mapResidentRowToDetail(
  row: ResidentDetailLiveRow,
): ServiceResult<ResidentDetail> {
  const schemaMissing = schemaMissingDetailFields(row);
  if (schemaMissing.length > 0) {
    const fields = schemaMissing.join(', ');
    return {
      ok: false,
      error: `Live-Bewohnerdetail: Supabase-Schema unvollständig (${fields} fehlen). Migration für care_records erweitern.`,
    };
  }

  for (const field of RESIDENT_LIVE_REQUIRED_FIELDS) {
    if (row[field] === undefined) {
      return {
        ok: false,
        error: `Live-Bewohnerdetail: Supabase-Schema unvollständig (${field} fehlen). Migration für care_records erweitern.`,
      };
    }
  }

  const listMissing = rowDataMissingFields(row);
  if (listMissing.length > 0) {
    const fields = listMissing.join(', ');
    return {
      ok: false,
      error: `Live-Bewohnerdetail: Pflichtfelder fehlen (${fields}).`,
    };
  }

  return { ok: true, data: mapCompleteResidentDetailRow(row) };
}
