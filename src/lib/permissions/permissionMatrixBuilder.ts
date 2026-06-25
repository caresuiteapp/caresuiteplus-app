import type { PermissionKey } from '@/types';
import type {
  PermissionCatalogEntry,
  PermissionMatrixAction,
  PermissionMatrixRow,
} from '@/types/permissions/rbac';
import { PERMISSION_MODULE_LABELS } from './permissionCatalogSeedData';

export const ACTION_SUFFIXES: Record<PermissionMatrixAction, string[]> = {
  read: ['view', 'access', 'preview', 'audit'],
  create: ['create'],
  edit: ['edit', 'update', 'manage', 'configure', 'correct', 'switch', 'pause', 'resume', 'start', 'close'],
  delete: ['delete', 'archive', 'deactivate', 'revoke'],
  approve: ['approve', 'finalize', 'sign', 'publish', 'activate'],
  export: ['export', 'download'],
};

function deriveAreaKey(key: PermissionKey): string {
  const parts = key.split('.');
  if (parts.length <= 2) return parts.join('.');
  return parts.slice(0, -1).join('.');
}

function deriveAreaLabel(areaKey: string, catalog?: PermissionCatalogEntry[]): string {
  const prefix = catalog?.find((e) => e.key.startsWith(`${areaKey}.`));
  if (prefix) {
    const base = prefix.label.replace(/\s*(ansehen|öffnen|einsehen|nutzen)$/i, '').trim();
    if (base) return base;
  }
  const module = areaKey.split('.')[0];
  const rest = areaKey.split('.').slice(1).join(' ');
  const moduleLabel = PERMISSION_MODULE_LABELS[module] ?? module;
  return rest ? `${moduleLabel}: ${rest}` : moduleLabel;
}

function permissionMatchesAction(key: PermissionKey, action: PermissionMatrixAction): boolean {
  const suffix = key.split('.').pop() ?? '';
  const suffixes = ACTION_SUFFIXES[action];
  if (suffixes.includes(suffix)) return true;
  if (action === 'read' && suffix === 'view') return true;
  if (action === 'edit' && key.includes('.manage')) return true;
  return false;
}

export function buildPermissionMatrix(
  permissions: PermissionKey[],
  catalog?: PermissionCatalogEntry[],
): PermissionMatrixRow[] {
  const areas = new Map<string, PermissionMatrixRow>();

  for (const key of permissions) {
    const areaKey = deriveAreaKey(key);
    const row =
      areas.get(areaKey) ??
      {
        area: areaKey,
        areaLabel: deriveAreaLabel(areaKey, catalog),
        read: false,
        create: false,
        edit: false,
        delete: false,
        approve: false,
        export: false,
      };

    for (const action of Object.keys(ACTION_SUFFIXES) as PermissionMatrixAction[]) {
      if (permissionMatchesAction(key, action)) {
        row[action] = true;
      }
    }

    if (key.endsWith('.access')) row.read = true;
    areas.set(areaKey, row);
  }

  return [...areas.values()].sort((a, b) => a.areaLabel.localeCompare(b.areaLabel, 'de'));
}

export function filterPermissionsForTab(
  permissions: PermissionKey[],
  modulePrefixes: string[],
): PermissionKey[] {
  if (!modulePrefixes.length) return permissions;
  return permissions.filter((key) =>
    modulePrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}.`)),
  );
}

export const RBAC_TAB_MODULE_PREFIXES: Record<string, string[]> = {
  verwaltung: ['business', 'tenant', 'release', 'security', 'qa', 'roadmap', 'platform', 'dashboard'],
  assist: ['assist', 'geo'],
  pflege: ['pflege'],
  beratung: ['beratung'],
  stationaer: ['stationaer'],
  akademie: ['akademie'],
  office: ['office', 'qm', 'connect', 'inventory', 'settings'],
  billing: ['office.invoices', 'office.budgets', 'office.employee_time', 'business.subscription'],
  personal: ['office.employees', 'office.recruiting', 'office.employees.compliance', 'office.employees.absences', 'office.employees.hr'],
  documents: ['documents', 'office.documents', 'office.templates', 'settings.templates'],
  messages: ['communication', 'messages', 'office.messages'],
  time: ['time', 'office.employee_time'],
  tracking: ['geo', 'assist.tracking', 'assist.trips'],
  integrations: ['integrations', 'ti', 'connect'],
  privacy_audit: ['security', 'time.audit', 'ti.audit', 'qm.view_md_access_logs'],
  special: [],
};

export const RBAC_TAB_PRODUCT_KEYS: Partial<Record<string, string>> = {
  assist: 'assist',
  pflege: 'pflege',
  beratung: 'beratung',
  stationaer: 'stationaer',
  akademie: 'akademie',
};
