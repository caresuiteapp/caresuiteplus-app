import type { ServiceResult } from '@/types';
import type { VitalReadingListItem, VitalReadingType } from '@/types/modules/pflege';
import {
  isVitalAlert,
  isVitalDue,
  VITAL_TYPE_LABELS,
} from '@/data/demo/vitalReadings';

/** Spalten aus v_vital_sign_overview (FlutterFlow-Basis). */
export const VITAL_SIGN_OVERVIEW_SELECT_COLUMNS =
  'id, tenant_id, client_id, client_name, measured_at, blood_pressure_systolic, blood_pressure_diastolic, pulse, temperature, oxygen_saturation, weight, is_critical, created_at';

export type VitalSignOverviewRow = {
  id: string;
  tenant_id: string;
  client_id: string | null;
  client_name?: string | null;
  measured_at: string;
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
  pulse?: number | null;
  temperature?: number | null;
  oxygen_saturation?: number | null;
  weight?: number | null;
  is_critical?: boolean | null;
  created_at: string;
};

export function parseVitalReadingId(readingId: string): { baseId: string; type: VitalReadingType } | null {
  const separator = readingId.indexOf(':');
  if (separator <= 0) return null;
  const baseId = readingId.slice(0, separator);
  const type = readingId.slice(separator + 1) as VitalReadingType;
  if (!baseId || !(type in VITAL_TYPE_LABELS)) return null;
  return { baseId, type };
}

export function buildVitalReadingId(baseId: string, type: VitalReadingType): string {
  return `${baseId}:${type}`;
}

function mapStatus(isCritical: boolean | null | undefined): VitalReadingListItem['status'] {
  return isCritical ? 'fehlerhaft' : 'aktiv';
}

function pushReading(
  items: VitalReadingListItem[],
  row: VitalSignOverviewRow,
  type: VitalReadingType,
  value: string,
  unit: string,
): void {
  if (!row.id || !row.tenant_id || !row.measured_at) return;
  const status = mapStatus(row.is_critical);
  items.push({
    id: buildVitalReadingId(row.id, type),
    tenantId: row.tenant_id,
    clientId: row.client_id ?? '',
    carePlanId: null,
    type,
    value,
    unit,
    measuredAt: row.measured_at,
    status,
    sensitivity: 'health',
    createdAt: row.created_at,
    updatedAt: row.created_at,
    visibility: 'team',
    clientName: row.client_name?.trim() || '—',
    typeLabel: VITAL_TYPE_LABELS[type],
    isDue: isVitalDue(row.measured_at),
    isAlert: isVitalAlert(status) || Boolean(row.is_critical),
  });
}

export function mapVitalSignOverviewRow(row: VitalSignOverviewRow): VitalReadingListItem[] {
  const items: VitalReadingListItem[] = [];

  if (row.blood_pressure_systolic != null && row.blood_pressure_diastolic != null) {
    pushReading(
      items,
      row,
      'blood_pressure',
      `${row.blood_pressure_systolic}/${row.blood_pressure_diastolic}`,
      'mmHg',
    );
  }
  if (row.pulse != null) {
    pushReading(items, row, 'pulse', String(row.pulse), 'bpm');
  }
  if (row.temperature != null) {
    pushReading(items, row, 'temperature', String(row.temperature), '°C');
  }
  if (row.oxygen_saturation != null) {
    pushReading(items, row, 'oxygen', String(row.oxygen_saturation), '%');
  }
  if (row.weight != null) {
    pushReading(items, row, 'weight', String(row.weight), 'kg');
  }

  return items;
}

export function mapVitalSignOverviewRows(
  rows: VitalSignOverviewRow[],
): ServiceResult<VitalReadingListItem[]> {
  const data = rows.flatMap(mapVitalSignOverviewRow).sort(
    (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
  );
  return { ok: true, data };
}

export function mapVitalSignOverviewRowToDetail(
  row: VitalSignOverviewRow,
  type: VitalReadingType,
): VitalReadingListItem | null {
  const items = mapVitalSignOverviewRow(row);
  return items.find((item) => item.type === type) ?? null;
}
