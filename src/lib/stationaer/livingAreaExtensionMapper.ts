import type { LivingAreaListItem, LivingAreaDetail } from '@/types/modules/stationaer';
import type { WorkflowStatus } from '@/types/core/base';

export type LivingAreaLiveRow = {
  id: string;
  tenant_id: string;
  name: string;
  wing: string | null;
  capacity: number;
  occupied_beds: number;
  status: string;
  updated_at: string;
};

export type HandoverLiveRow = {
  id: string;
  tenant_id: string;
  shift_label: string;
  author_profile_id: string | null;
  wing: string | null;
  content: string;
  handover_at: string;
  status: string;
  updated_at: string;
};

export const LIVING_AREA_LIVE_SELECT_COLUMNS =
  'id, tenant_id, name, wing, capacity, occupied_beds, status, updated_at';

export const HANDOVER_LIVE_SELECT_COLUMNS =
  'id, tenant_id, shift_label, author_profile_id, wing, content, handover_at, status, updated_at';

function mapWorkflowStatus(raw: string): WorkflowStatus {
  if (raw === 'aktiv' || raw === 'abgeschlossen' || raw === 'in_bearbeitung') {
    return raw;
  }
  return 'in_bearbeitung';
}

export function mapLivingAreaRowToListItem(row: LivingAreaLiveRow): LivingAreaListItem {
  const freeBeds = Math.max(0, row.capacity - row.occupied_beds);
  return {
    id: row.id,
    name: row.name,
    wing: row.wing,
    capacity: row.capacity,
    status: mapWorkflowStatus(row.status),
    occupiedBeds: row.occupied_beds,
    freeBeds,
  };
}

export function mapLivingAreaRowToDetail(row: LivingAreaLiveRow): LivingAreaDetail {
  const listItem = mapLivingAreaRowToListItem(row);
  return {
    ...listItem,
    residentNames: [],
    lastCleaningLabel: 'Noch nicht synchronisiert',
    nextActionHint:
      listItem.freeBeds > 0
        ? `${listItem.freeBeds} freie Betten — Live-Backfill nach Migration 0036`
        : 'Voll belegt — Warteliste prüfen',
  };
}

export function mapHandoverRowToListItem(row: HandoverLiveRow): {
  id: string;
  tenantId: string;
  shiftLabel: string;
  authorProfileId: string;
  authorName: string;
  wing: string | null;
  content: string;
  handoverAt: string;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    shiftLabel: row.shift_label,
    authorProfileId: row.author_profile_id ?? 'unknown',
    authorName: row.author_profile_id ? 'Mitarbeiter' : 'Unbekannt',
    wing: row.wing,
    content: row.content,
    handoverAt: row.handover_at,
    status: mapWorkflowStatus(row.status),
    createdAt: row.handover_at,
    updatedAt: row.updated_at,
  };
}

export function mapHandoverRowToDetail(row: HandoverLiveRow) {
  const listItem = mapHandoverRowToListItem(row);
  return {
    ...listItem,
    recipientNames: [],
    priorityLabel: 'Normal',
    nextActionHint: 'Live-Übergabe — Profil-Backfill nach Migration 0036',
  };
}

export function mapLivingAreaRowsToListItems(rows: LivingAreaLiveRow[]): LivingAreaListItem[] {
  return rows.map(mapLivingAreaRowToListItem);
}
