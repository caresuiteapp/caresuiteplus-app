import type {
  InventoryAssignment, InventoryAssignmentStatus, InventoryAuditEvent,
  InventoryCondition, InventoryItem, InventoryItemStatus,
} from '@/types/inventory';

export const COMPANY_INVENTORY_VIEWS = [
  { id: 'stock', label: 'Bestand' },
  { id: 'assignments', label: 'Ausgaben & Rückgaben' },
  { id: 'locations', label: 'Lagerorte & Kategorien' },
  { id: 'damage', label: 'Schäden & Verluste' },
  { id: 'offboarding', label: 'Personalrückgaben' },
  { id: 'history', label: 'Verlauf' },
] as const;
export type CompanyInventoryView = typeof COMPANY_INVENTORY_VIEWS[number]['id'];

export const INVENTORY_STATUS_LABELS: Record<InventoryItemStatus, string> = {
  available: 'Verfügbar', assigned: 'Zugewiesen', in_use: 'Im Einsatz', reserved: 'Reserviert',
  maintenance: 'In Wartung', damaged: 'Beschädigt', lost: 'Verloren', returned: 'Zurückgegeben',
  decommissioned: 'Ausgemustert', archived: 'Archiviert',
};
export const ASSIGNMENT_STATUS_LABELS: Record<InventoryAssignmentStatus, string> = {
  planned: 'Geplant', issued: 'Ausgegeben', acknowledged: 'Empfang bestätigt',
  return_requested: 'Rückgabe angefordert', partially_returned: 'Teilweise zurückgegeben',
  returned: 'Zurückgegeben', overdue: 'Überfällig', damaged_returned: 'Beschädigt zurückgegeben',
  lost: 'Verloren', disputed: 'In Klärung', archived: 'Archiviert',
};
export const CONDITION_LABELS: Record<InventoryCondition, string> = {
  new: 'Neu', very_good: 'Sehr gut', good: 'Gut', used: 'Gebraucht', damaged: 'Beschädigt',
  unusable: 'Nicht nutzbar', lost: 'Verloren', unknown: 'Nicht beurteilt',
};
export const OPEN_ASSIGNMENT_STATUSES = new Set<InventoryAssignmentStatus>([
  'planned', 'issued', 'acknowledged', 'return_requested', 'partially_returned', 'overdue', 'disputed', 'lost',
]);
export const EDITABLE_ITEM_STATUSES: InventoryItemStatus[] = [
  'available', 'reserved', 'maintenance', 'damaged', 'lost', 'decommissioned', 'archived',
];
export function isAssignmentOpen(assignment: InventoryAssignment) {
  return OPEN_ASSIGNMENT_STATUSES.has(assignment.status);
}
export function inventoryDate(value?: string | null, withTime = false) {
  if (!value) return 'Nicht hinterlegt';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return 'Datum nicht lesbar';
  return new Intl.DateTimeFormat('de-DE', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date);
}
export function inventoryLocalDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function isAssignmentOverdue(assignment: InventoryAssignment, today = inventoryLocalDate()) {
  if (!isAssignmentOpen(assignment)) return false;
  return assignment.status === 'overdue'
    || Boolean(assignment.expectedReturnAt && assignment.expectedReturnAt.slice(0, 10) < today);
}
export function inventoryMatches(query: string, values: unknown[]) {
  const words = query.toLocaleLowerCase('de-DE').trim().split(/\s+/).filter(Boolean);
  const haystack = values.filter(value => typeof value === 'string').join(' ').toLocaleLowerCase('de-DE');
  return words.every(word => haystack.includes(word));
}
export function inventoryItemDraft(item?: InventoryItem) {
  return {
    name: item?.name ?? '', categoryId: item?.categoryId ?? '', sku: item?.sku ?? '',
    barcode: item?.barcode ?? '', serialNumber: item?.serialNumber ?? '',
    manufacturer: item?.manufacturer ?? '', model: item?.model ?? '',
    purchaseDate: item?.purchaseDate?.slice(0, 10) ?? '',
    warrantyUntil: item?.warrantyUntil?.slice(0, 10) ?? '', locationId: item?.locationId ?? '',
    condition: item?.condition ?? 'unknown' as InventoryCondition,
    status: item?.status ?? 'available' as InventoryItemStatus,
    notes: item?.notes ?? '', requiresReturnOnExit: item?.requiresReturnOnExit ?? true,
    portalVisibleToEmployee: item?.portalVisibleToEmployee ?? true,
  };
}
export function validateInventoryItemDraft(draft: ReturnType<typeof inventoryItemDraft>) {
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = 'Bitte eine Bezeichnung eingeben.';
  if (!draft.categoryId) errors.categoryId = 'Bitte eine Kategorie auswählen.';
  if (draft.status === 'available' && ['unknown', 'damaged', 'unusable', 'lost'].includes(draft.condition)) {
    errors.condition = 'Zustand prüfen oder einen passenden Bestandsstatus wählen. Ein ungeprüfter oder beschädigter Gegenstand ist nicht verfügbar.';
  }
  if (draft.purchaseDate && draft.warrantyUntil && draft.warrantyUntil < draft.purchaseDate) {
    errors.warrantyUntil = 'Das Garantieende liegt vor dem Kaufdatum.';
  }
  return errors;
}
export function inventoryAuditTitle(event: InventoryAuditEvent) {
  const labels: Record<string, string> = {
    create_item: 'Inventar angelegt', update_item: 'Inventar bearbeitet',
    item_created: 'Inventar angelegt', item_updated: 'Inventar bearbeitet',
    issue_item: 'Inventar ausgegeben', issued: 'Inventar ausgegeben',
    request_return: 'Rückgabe angefordert', record_return: 'Rückgabe erfasst',
    return_recorded: 'Rückgabe erfasst', acknowledge_assignment: 'Empfang bestätigt',
    report_damage: 'Schaden gemeldet', report_loss: 'Verlust gemeldet',
    report_missing_return: 'Fehlende Rückgabe gemeldet', damage_reported: 'Schaden gemeldet',
    create_category: 'Kategorie angelegt', update_category: 'Kategorie bearbeitet',
    create_location: 'Lagerort angelegt', update_location: 'Lagerort bearbeitet',
  };
  return labels[event.action] ?? ({
    inventory_item: 'Inventar aktualisiert', inventory_assignment: 'Ausgabe aktualisiert',
    inventory_return: 'Rückgabe dokumentiert', inventory_damage: 'Meldung dokumentiert',
    return_protocol: 'Rückgabeprotokoll dokumentiert',
  })[event.entityType] ?? 'Änderung im Inventar';
}
