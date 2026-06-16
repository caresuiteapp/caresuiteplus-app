import type { RoleKey } from '@/types/core/auth';
import type {
  CanonicalWorkspaceRoleKey,
  WorkspaceArea,
  WorkspaceRoleCategory,
  WorkspaceRoleDefinition,
} from '@/types/permissions/workspace';

export const WORKSPACE_ROLE_DEFINITIONS: WorkspaceRoleDefinition[] = [
  { canonicalKey: 'owner', label: 'Inhaber:in', category: 'administration', mapsToRoleKey: 'business_admin', primaryArea: 'administration' },
  { canonicalKey: 'admin', label: 'Administrator:in', category: 'administration', mapsToRoleKey: 'business_admin', primaryArea: 'administration' },
  { canonicalKey: 'management', label: 'Management', category: 'administration', mapsToRoleKey: 'business_manager', primaryArea: 'administration' },
  { canonicalKey: 'office', label: 'Office / Verwaltung', category: 'administration', mapsToRoleKey: 'business_manager', primaryArea: 'administration' },
  { canonicalKey: 'dispatch', label: 'Einsatzplanung', category: 'administration', mapsToRoleKey: 'dispatch', primaryArea: 'administration' },
  { canonicalKey: 'billing', label: 'Abrechnung', category: 'administration', mapsToRoleKey: 'billing', primaryArea: 'administration' },
  { canonicalKey: 'quality_management', label: 'Qualitätsmanagement', category: 'administration', mapsToRoleKey: 'business_manager', primaryArea: 'administration' },
  { canonicalKey: 'employee', label: 'Mitarbeitende:r', category: 'employee', mapsToRoleKey: 'employee_portal', primaryArea: 'employee_portal' },
  { canonicalKey: 'caregiver', label: 'Pflegekraft', category: 'employee', mapsToRoleKey: 'caregiver', primaryArea: 'administration' },
  { canonicalKey: 'nurse', label: 'Pflegefachkraft', category: 'employee', mapsToRoleKey: 'nurse', primaryArea: 'administration' },
  { canonicalKey: 'consultant', label: 'Berater:in', category: 'employee', mapsToRoleKey: 'counselor', primaryArea: 'administration' },
  { canonicalKey: 'field_worker', label: 'Außendienst', category: 'employee', mapsToRoleKey: 'caregiver', primaryArea: 'employee_portal' },
  { canonicalKey: 'trainee', label: 'Auszubildende:r', category: 'employee', mapsToRoleKey: 'employee_portal', primaryArea: 'employee_portal' },
  { canonicalKey: 'client', label: 'Klient:in', category: 'client_portal', mapsToRoleKey: 'client_portal', primaryArea: 'client_portal' },
  { canonicalKey: 'representative', label: 'Vertretung', category: 'client_portal', mapsToRoleKey: 'family_portal', primaryArea: 'client_portal' },
  { canonicalKey: 'family_contact', label: 'Angehörige:r', category: 'client_portal', mapsToRoleKey: 'family_portal', primaryArea: 'client_portal' },
  { canonicalKey: 'legal_guardian', label: 'Gesetzliche Vertretung', category: 'client_portal', mapsToRoleKey: 'family_portal', primaryArea: 'client_portal' },
  { canonicalKey: 'system', label: 'System', category: 'system', mapsToRoleKey: 'business_admin', primaryArea: 'administration' },
  { canonicalKey: 'support', label: 'Support', category: 'system', mapsToRoleKey: 'business_admin', primaryArea: 'administration' },
  { canonicalKey: 'developer_admin', label: 'Developer Admin', category: 'system', mapsToRoleKey: 'business_admin', primaryArea: 'administration' },
];

const PORTAL_ONLY_ROLES = new Set<RoleKey>(['employee_portal', 'client_portal', 'family_portal']);

const EMPLOYEE_PORTAL_ROLES = new Set<RoleKey>(['employee_portal', 'caregiver', 'nurse']);

const CLIENT_PORTAL_ROLES = new Set<RoleKey>(['client_portal', 'family_portal']);

const ADMINISTRATION_ROLES = new Set<RoleKey>([
  'business_admin',
  'business_manager',
  'billing',
  'dispatch',
  'counselor',
  'akademie_admin',
  'nurse',
  'caregiver',
]);

export function getWorkspaceRoleDefinition(
  canonicalKey: CanonicalWorkspaceRoleKey,
): WorkspaceRoleDefinition | undefined {
  return WORKSPACE_ROLE_DEFINITIONS.find((r) => r.canonicalKey === canonicalKey);
}

export function resolveWorkspaceArea(roleKey: RoleKey | null): WorkspaceArea | null {
  if (!roleKey) return null;
  if (PORTAL_ONLY_ROLES.has(roleKey)) {
    return roleKey === 'employee_portal' ? 'employee_portal' : 'client_portal';
  }
  if (ADMINISTRATION_ROLES.has(roleKey)) return 'administration';
  return null;
}

export function resolveWorkspaceCategory(roleKey: RoleKey | null): WorkspaceRoleCategory | null {
  if (!roleKey) return null;
  if (PORTAL_ONLY_ROLES.has(roleKey)) {
    return roleKey === 'employee_portal' ? 'employee' : 'client_portal';
  }
  if (roleKey === 'business_admin' || roleKey === 'business_manager' || roleKey === 'billing' || roleKey === 'dispatch') {
    return 'administration';
  }
  if (roleKey === 'counselor' || roleKey === 'nurse' || roleKey === 'caregiver') return 'employee';
  if (roleKey === 'akademie_admin') return 'administration';
  return 'administration';
}

export function isPortalOnlyRole(roleKey: RoleKey | null): boolean {
  return roleKey != null && PORTAL_ONLY_ROLES.has(roleKey);
}

export function isEmployeePortalRole(roleKey: RoleKey | null): boolean {
  return roleKey != null && EMPLOYEE_PORTAL_ROLES.has(roleKey);
}

export function isClientPortalRole(roleKey: RoleKey | null): boolean {
  return roleKey != null && CLIENT_PORTAL_ROLES.has(roleKey);
}

export function isAdministrationRole(roleKey: RoleKey | null): boolean {
  return roleKey != null && ADMINISTRATION_ROLES.has(roleKey) && !PORTAL_ONLY_ROLES.has(roleKey);
}

export function hasFullTenantDataAccess(roleKey: RoleKey | null): boolean {
  return roleKey === 'business_admin' || roleKey === 'business_manager' || roleKey === 'dispatch';
}

export function mapCanonicalRoleToRoleKey(canonicalKey: CanonicalWorkspaceRoleKey): RoleKey {
  return getWorkspaceRoleDefinition(canonicalKey)?.mapsToRoleKey ?? 'business_admin';
}

export { PORTAL_ONLY_ROLES, EMPLOYEE_PORTAL_ROLES, CLIENT_PORTAL_ROLES, ADMINISTRATION_ROLES };
