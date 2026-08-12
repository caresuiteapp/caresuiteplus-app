import type { ServiceResult } from '@/types';
import type { VitalReadingListItem, VitalReadingType } from '@/types/modules/pflege';
import { getVitalDefinition } from '@/lib/pflege/vitalCatalog';

/** Legacy-View-Mapper für bereits vorhandene Werte; neue Erfassungen nutzen v_vital_measurement_overview. */
export const VITAL_SIGN_OVERVIEW_SELECT_COLUMNS =
  'id, tenant_id, client_id, client_name, measured_at, blood_pressure_systolic, blood_pressure_diastolic, pulse, temperature, oxygen_saturation, weight, is_critical, created_at';
export type VitalSignOverviewRow = {
  id: string; tenant_id: string; client_id: string | null; client_name?: string | null; measured_at: string;
  blood_pressure_systolic?: number | null; blood_pressure_diastolic?: number | null; pulse?: number | null;
  temperature?: number | null; oxygen_saturation?: number | null; weight?: number | null;
  is_critical?: boolean | null; created_at: string;
};
export function parseVitalReadingId(readingId: string): { baseId: string; type: VitalReadingType } | null {
  const separator = readingId.indexOf(':');
  if (separator <= 0) return null;
  const baseId = readingId.slice(0, separator); const type = readingId.slice(separator + 1);
  return baseId && getVitalDefinition(type) ? { baseId, type: type as VitalReadingType } : null;
}
export function buildVitalReadingId(baseId: string, type: VitalReadingType): string { return `${baseId}:${type}`; }
function push(items: VitalReadingListItem[], row: VitalSignOverviewRow, type: VitalReadingType, value: string, unit: string) {
  const alert = Boolean(row.is_critical);
  items.push({ id: buildVitalReadingId(row.id,type), tenantId: row.tenant_id, clientId: row.client_id ?? '', carePlanId: null,
    type,value,unit,measuredAt: row.measured_at,status: alert ? 'fehlerhaft':'aktiv',sensitivity:'health',createdAt:row.created_at,
    updatedAt:row.created_at,visibility:'team',clientName:row.client_name?.trim()||'—',typeLabel:getVitalDefinition(type)?.label??type,
    isDue:false,isAlert:alert,flagStatus:alert?'outside_configured_range':'unrated' });
}
export function mapVitalSignOverviewRow(row: VitalSignOverviewRow): VitalReadingListItem[] {
  const items: VitalReadingListItem[]=[];
  if(row.blood_pressure_systolic!=null&&row.blood_pressure_diastolic!=null) push(items,row,'blood_pressure',`${row.blood_pressure_systolic}/${row.blood_pressure_diastolic}`,'mmHg');
  if(row.pulse!=null) push(items,row,'pulse',String(row.pulse),'/min');
  if(row.temperature!=null) push(items,row,'temperature',String(row.temperature),'°C');
  if(row.oxygen_saturation!=null) push(items,row,'oxygen',String(row.oxygen_saturation),'%');
  if(row.weight!=null) push(items,row,'weight',String(row.weight),'kg');
  return items;
}
export function mapVitalSignOverviewRows(rows: VitalSignOverviewRow[]): ServiceResult<VitalReadingListItem[]> {
  return {ok:true,data:rows.flatMap(mapVitalSignOverviewRow).sort((a,b)=>new Date(b.measuredAt).getTime()-new Date(a.measuredAt).getTime())};
}
export function mapVitalSignOverviewRowToDetail(row: VitalSignOverviewRow,type:VitalReadingType):VitalReadingListItem|null {
  return mapVitalSignOverviewRow(row).find((item)=>item.type===type)??null;
}
