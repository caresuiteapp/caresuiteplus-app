import type { ClientListItem } from '@/types/modules/office';
import type { EmployeeListItem } from '@/types/modules/employeeList';

export type CentralCatalogEntityOption = { id: string; label: string; detail?: string };
export type CentralCatalogEntityGroup = { key: string; label: string; records: CentralCatalogEntityOption[] };

const clean = (value?: string | null) => (value ?? '').trim().replace(/\s+/g, ' ').normalize('NFC');
const name = (first: string, last: string) => [first, last].map(clean).filter((part) => part && !/^[-–—]+$/.test(part)).join(' ') || 'Unbenannte Akte';
const statusNames: Record<string, string> = {
  entwurf: 'Aufnahmeentwurf', aktiv: 'Aktive Akte', geplant: 'Geplant', bestaetigt: 'Bestätigt',
  in_bearbeitung: 'In Bearbeitung', abgeschlossen: 'Abgeschlossen', archiviert: 'Archiviert',
  fehlerhaft: 'Fehlerhaft', gesperrt: 'Gesperrt', krank: 'Krank', urlaub: 'Urlaub',
};
const statusName = (status: string) => statusNames[status] || clean(status);

export function centralCatalogClientOptions(rows: readonly ClientListItem[]): CentralCatalogEntityOption[] {
  return rows.map((row) => {
    const birthdate = row.dateOfBirth?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return { id: row.id, label: name(row.firstName, row.lastName), detail: [
      statusName(row.status), birthdate ? `Geb. ${birthdate[3]}.${birthdate[2]}.${birthdate[1]}` : '',
      clean([row.zip, row.city].filter(Boolean).join(' ')),
    ].filter(Boolean).join(' · ') };
  });
}

export function centralCatalogEmployeeOptions(rows: readonly EmployeeListItem[]): CentralCatalogEntityOption[] {
  return rows.map((row) => ({ id: row.id, label: name(row.firstName, row.lastName), detail: [
    statusName(row.status), clean(row.jobTitle), clean(row.department),
  ].filter(Boolean).join(' · ') }));
}

/** Names identify groups; only an explicitly selected record ID identifies an Akte. */
export function groupCentralCatalogEntities(entities: readonly CentralCatalogEntityOption[]): CentralCatalogEntityGroup[] {
  const unique = new Map<string, CentralCatalogEntityOption>();
  for (const entity of entities) {
    if (entity.id && !unique.has(entity.id)) unique.set(entity.id, { ...entity, label: clean(entity.label) || 'Unbenannte Akte', detail: clean(entity.detail) });
  }
  const groups = new Map<string, CentralCatalogEntityGroup>();
  for (const entity of unique.values()) {
    const key = entity.label.toLocaleLowerCase('de-DE');
    const group = groups.get(key);
    if (group) group.records.push(entity);
    else groups.set(key, { key: entity.id, label: entity.label, records: [entity] });
  }
  for (const group of groups.values()) {
    const details = group.records.map((record) => record.detail || 'Akte');
    group.records = group.records.map((record, index) => {
      const detail = details[index];
      if (details.filter((entry) => entry === detail).length === 1) return { ...record, detail };
      let length = Math.min(8, record.id.length);
      while (length < record.id.length && group.records.some((other) => other.id !== record.id && other.id.slice(0, length) === record.id.slice(0, length))) length++;
      return { ...record, detail: `${detail} · Akte ${record.id.slice(0, length)}` };
    }).sort((a, b) => a.detail!.localeCompare(b.detail!, 'de-DE', { numeric: true }));
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'de-DE'));
}
