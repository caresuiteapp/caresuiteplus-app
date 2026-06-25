import { ROLE_LABELS } from '@/data/constants/roleLabels';
import type { PermissionKey, RoleKey } from '@/types';
import type { PermissionCatalogEntry, PermissionRiskLevel } from '@/types/permissions/rbac';
import { PERMISSION_LABELS, ROLE_PERMISSIONS } from './staticRolePermissions';

function deriveModule(key: string): string {
  return key.split('.')[0];
}

function deriveCategory(key: string): string {
  const parts = key.split('.');
  if (parts.length <= 2) return parts[1] ?? 'general';
  return parts.slice(1, -1).join('_');
}

function deriveRisk(key: string): PermissionRiskLevel {
  if (
    key.includes('.delete') ||
    key === 'business.tenant.manage' ||
    key === 'security.manage' ||
    key.includes('delete_')
  ) {
    return 'critical';
  }
  if (
    key.includes('view_sensitive') ||
    key.includes('.admin') ||
    key.endsWith('.finalize') ||
    key.includes('.approve') ||
    key.includes('ti.admin')
  ) {
    return 'high';
  }
  if (
    key.includes('.create') ||
    key.includes('.edit') ||
    key.includes('.manage') ||
    key.includes('.update')
  ) {
    return 'medium';
  }
  return 'low';
}

export function buildPermissionCatalogEntries(): PermissionCatalogEntry[] {
  return (Object.keys(PERMISSION_LABELS) as PermissionKey[]).map((key) => {
    const riskLevel = deriveRisk(key);
    return {
      key,
      module: deriveModule(key),
      category: deriveCategory(key),
      label: PERMISSION_LABELS[key],
      description: null,
      riskLevel,
      requiresAudit: riskLevel === 'critical' || riskLevel === 'high',
    };
  });
}

export const SYSTEM_ROLE_TEMPLATE_LEVELS: Record<RoleKey, number> = {
  business_admin: 100,
  business_manager: 90,
  billing: 70,
  dispatch: 75,
  nurse: 50,
  caregiver: 40,
  counselor: 45,
  akademie_admin: 60,
  employee_portal: 10,
  client_portal: 5,
  family_portal: 5,
};

export function buildSystemRoleTemplateSeeds(): Array<{
  roleKey: RoleKey;
  name: string;
  level: number;
  permissions: readonly PermissionKey[];
}> {
  return (Object.keys(ROLE_PERMISSIONS) as RoleKey[]).map((roleKey) => ({
    roleKey,
    name: ROLE_LABELS[roleKey],
    level: SYSTEM_ROLE_TEMPLATE_LEVELS[roleKey] ?? 0,
    permissions: ROLE_PERMISSIONS[roleKey],
  }));
}

export const PERMISSION_MODULE_LABELS: Record<string, string> = {
  office: 'Office',
  assist: 'Assist',
  pflege: 'Pflege',
  beratung: 'Beratung',
  stationaer: 'Stationär',
  akademie: 'Akademie',
  business: 'Verwaltung',
  tenant: 'Mandant',
  dashboard: 'Dashboard',
  portal: 'Portal',
  documents: 'Dokumente',
  communication: 'Nachrichten',
  messages: 'Nachrichten',
  time: 'Zeiterfassung',
  geo: 'Tracking',
  integrations: 'Integrationen',
  ti: 'TI',
  security: 'Datenschutz',
  audit: 'Audit',
  qm: 'Qualitätsmanagement',
  connect: 'Connect',
  inventory: 'Inventar',
  platform: 'Plattform',
  release: 'Release',
  qa: 'QA',
  roadmap: 'Roadmap',
  settings: 'Einstellungen',
};
