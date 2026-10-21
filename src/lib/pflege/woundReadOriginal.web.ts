import { woundInstant, woundUuid } from './woundCareDomain.ts';
import { sameMedicationListOriginal } from './medicationListOriginal.web.ts';

type Row = Record<string, unknown>;
export type WoundListOriginal = { row: Row; clientName: string };
const record = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const own = (row: Row, key: string) => Object.hasOwn(row, key);
const metadataTime = (value: unknown) => typeof value === 'string' && woundInstant(value.replace(' ', 'T')) !== null;
export const woundStatusLabels: Record<string, string> = {
  draft: 'Entwurf', active: 'Aktiv', healing: 'Heilend', healed: 'Abgeheilt', deteriorated: 'Verschlechtert', archived: 'Archiviert',
};
export const sameWoundReadOriginal = sameMedicationListOriginal;

/** Validate the entire supplied service list, including rows hidden by filters. It is not an exhaustive roster of inactive care cases. */
export function captureWoundListOriginal(input: unknown, tenantId: string): WoundListOriginal[] {
  if (!woundUuid(tenantId) || !Array.isArray(input)) throw Error('Die Wundliste ist nicht vollständig bestätigt. Bitte neu laden.');
  const ids = new Set<string>();
  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    if (!Object.hasOwn(input, i) || !record(item) || !own(item, 'row') || !record(item.row)
      || !own(item, 'clientName') || typeof item.clientName !== 'string' || !item.clientName.trim()) throw Error('Die Wundliste enthält ungeklärte Fallzuordnungen. Bitte neu laden.');
    const row = item.row;
    if (['id', 'tenant_id', 'client_id', 'created_at', 'updated_at', 'status'].some(key => !own(row, key))
      || !woundUuid(row.id) || ids.has(row.id.toLowerCase()) || row.tenant_id !== tenantId || !woundUuid(row.client_id)
      || !metadataTime(row.created_at) || !metadataTime(row.updated_at)
      || typeof row.status !== 'string' || !Object.hasOwn(woundStatusLabels, row.status)) throw Error('Die Wundliste enthält ungültige, fremde oder doppelte Fälle. Bitte neu laden.');
    ids.add(row.id.toLowerCase());
  }
  return structuredClone(input) as WoundListOriginal[];
}

export function woundListText(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : 'Nicht dokumentiert';
}

export function filterWoundList(items: WoundListOriginal[], search: string, status: string): WoundListOriginal[] {
  const needle = search.trim().toLocaleLowerCase('de-DE');
  return items.filter(({ row, clientName }) => (status === 'all' || row.status === status)
    && (!needle || `${clientName} ${woundListText(row.body_location)} ${row.id}`.toLocaleLowerCase('de-DE').includes(needle)));
}
