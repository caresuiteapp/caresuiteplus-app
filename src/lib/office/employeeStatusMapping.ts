/** Live Supabase enum `employee_status` (English). UI catalogs use German value_keys. */
export type EmployeeDbStatus =
  | 'draft'
  | 'active'
  | 'inactive'
  | 'sick'
  | 'vacation'
  | 'terminated'
  | 'blocked';

const DB_STATUSES = new Set<string>([
  'draft',
  'active',
  'inactive',
  'sick',
  'vacation',
  'terminated',
  'blocked',
]);

/** Catalog value_key (0073) → live DB enum. */
const CATALOG_TO_DB: Record<string, EmployeeDbStatus> = {
  aktiv: 'active',
  entwurf: 'draft',
  in_bearbeitung: 'draft',
  abgeschlossen: 'inactive',
  archiviert: 'inactive',
  fehlerhaft: 'blocked',
  gesperrt: 'blocked',
  probezeit: 'active',
  einarbeitung: 'active',
  urlaub: 'vacation',
  krank: 'sick',
  elternzeit: 'vacation',
  fortbildung: 'vacation',
  teilzeit: 'active',
  freigestellt: 'inactive',
  kuendigung_laeuft: 'terminated',
  ausgeschieden: 'terminated',
};

/** Live DB enum → primary catalog value_key for UI chips. */
const DB_TO_CATALOG: Record<EmployeeDbStatus, string> = {
  draft: 'entwurf',
  active: 'aktiv',
  inactive: 'archiviert',
  sick: 'krank',
  vacation: 'urlaub',
  terminated: 'ausgeschieden',
  blocked: 'gesperrt',
};

export function isEmployeeDbStatus(value: string): value is EmployeeDbStatus {
  return DB_STATUSES.has(value);
}

export function mapCatalogStatusToDbStatus(
  catalogKey: string | null | undefined,
): EmployeeDbStatus {
  const normalized = catalogKey?.trim().toLowerCase();
  if (!normalized) return 'active';
  if (isEmployeeDbStatus(normalized)) return normalized;
  return CATALOG_TO_DB[normalized] ?? 'active';
}

export function mapDbStatusToCatalogStatus(dbStatus: string | null | undefined): string {
  const normalized = dbStatus?.trim().toLowerCase();
  if (!normalized) return 'aktiv';
  if (!isEmployeeDbStatus(normalized)) return normalized;
  return DB_TO_CATALOG[normalized];
}
