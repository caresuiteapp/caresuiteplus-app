import type { CanonicalWorkspaceRoleKey } from '@/types/permissions/workspace';
import type {
  AreaPermissionSet,
  PermissionAction,
  PermissionAreaKey,
  RoleAreaMatrix,
} from '@/types/permissions/roleMatrix';

export function emptyAreaPermissions(): AreaPermissionSet {
  return { view: false, edit: false, approve: false, export: false, administer: false };
}

export function viewOnlyArea(): AreaPermissionSet {
  return { view: true, edit: false, approve: false, export: false, administer: false };
}

export function editArea(): AreaPermissionSet {
  return { view: true, edit: true, approve: false, export: false, administer: false };
}

export function fullArea(): AreaPermissionSet {
  return { view: true, edit: true, approve: true, export: true, administer: true };
}

export function adminArea(): AreaPermissionSet {
  return { view: true, edit: true, approve: true, export: true, administer: true };
}

export function buildEmptyMatrix(): RoleAreaMatrix {
  const matrix = {} as RoleAreaMatrix;
  const areas: PermissionAreaKey[] = [
    'administration',
    'clients',
    'employees',
    'assignments_schedule',
    'employee_portal',
    'client_portal',
    'documentation',
    'service_records',
    'billing',
    'templates_documents',
    'connect',
    'qm_cockpit',
  ];
  for (const area of areas) {
    matrix[area] = emptyAreaPermissions();
  }
  return matrix;
}

function withAreas(
  base: RoleAreaMatrix,
  overrides: Partial<Record<PermissionAreaKey, AreaPermissionSet>>,
): RoleAreaMatrix {
  const next = { ...base };
  for (const [key, value] of Object.entries(overrides) as [PermissionAreaKey, AreaPermissionSet][]) {
    next[key] = { ...value };
  }
  return next;
}

/** Konservative Standardmatrix — keine Rolle erhält zu viele Rechte automatisch */
export function buildDefaultRoleMatrix(roleKey: CanonicalWorkspaceRoleKey): RoleAreaMatrix {
  const empty = buildEmptyMatrix();

  switch (roleKey) {
    case 'owner':
    case 'admin':
      return withAreas(empty, {
        administration: adminArea(),
        clients: fullArea(),
        employees: fullArea(),
        assignments_schedule: fullArea(),
        employee_portal: adminArea(),
        client_portal: adminArea(),
        documentation: fullArea(),
        service_records: fullArea(),
        billing: fullArea(),
        templates_documents: fullArea(),
        connect: adminArea(),
        qm_cockpit: fullArea(),
      });

    case 'management':
      return withAreas(empty, {
        administration: editArea(),
        clients: editArea(),
        employees: editArea(),
        assignments_schedule: editArea(),
        employee_portal: viewOnlyArea(),
        client_portal: viewOnlyArea(),
        documentation: editArea(),
        service_records: editArea(),
        billing: viewOnlyArea(),
        templates_documents: editArea(),
        connect: viewOnlyArea(),
        qm_cockpit: editArea(),
      });

    case 'office':
      return withAreas(empty, {
        administration: viewOnlyArea(),
        clients: editArea(),
        employees: editArea(),
        assignments_schedule: viewOnlyArea(),
        employee_portal: viewOnlyArea(),
        client_portal: viewOnlyArea(),
        documentation: viewOnlyArea(),
        service_records: viewOnlyArea(),
        billing: viewOnlyArea(),
        templates_documents: viewOnlyArea(),
        qm_cockpit: viewOnlyArea(),
      });

    case 'dispatch':
      return withAreas(empty, {
        clients: viewOnlyArea(),
        employees: viewOnlyArea(),
        assignments_schedule: fullArea(),
        employee_portal: viewOnlyArea(),
        documentation: viewOnlyArea(),
        service_records: viewOnlyArea(),
        qm_cockpit: viewOnlyArea(),
      });

    case 'billing':
      return withAreas(empty, {
        clients: viewOnlyArea(),
        billing: fullArea(),
        service_records: viewOnlyArea(),
        templates_documents: viewOnlyArea(),
        qm_cockpit: viewOnlyArea(),
      });

    case 'quality_management':
      return withAreas(empty, {
        clients: viewOnlyArea(),
        documentation: viewOnlyArea(),
        service_records: viewOnlyArea(),
        qm_cockpit: fullArea(),
      });

    case 'employee':
    case 'trainee':
      return withAreas(empty, {
        employee_portal: viewOnlyArea(),
        assignments_schedule: viewOnlyArea(),
      });

    case 'caregiver':
    case 'field_worker':
      return withAreas(empty, {
        employee_portal: viewOnlyArea(),
        assignments_schedule: viewOnlyArea(),
        documentation: viewOnlyArea(),
        service_records: viewOnlyArea(),
      });

    case 'nurse':
      return withAreas(empty, {
        employee_portal: viewOnlyArea(),
        assignments_schedule: viewOnlyArea(),
        clients: viewOnlyArea(),
        documentation: editArea(),
        service_records: editArea(),
      });

    case 'consultant':
      return withAreas(empty, {
        employee_portal: viewOnlyArea(),
        clients: viewOnlyArea(),
        documentation: viewOnlyArea(),
        assignments_schedule: viewOnlyArea(),
      });

    case 'client':
    case 'representative':
    case 'family_contact':
    case 'legal_guardian':
      return withAreas(empty, {
        client_portal: viewOnlyArea(),
      });

    case 'support':
      return withAreas(empty, {
        administration: viewOnlyArea(),
        clients: viewOnlyArea(),
        employees: viewOnlyArea(),
        assignments_schedule: viewOnlyArea(),
        employee_portal: viewOnlyArea(),
        client_portal: viewOnlyArea(),
        documentation: viewOnlyArea(),
        service_records: viewOnlyArea(),
        qm_cockpit: viewOnlyArea(),
      });

    case 'developer_admin':
    case 'system':
      return withAreas(empty, {
        administration: adminArea(),
        connect: adminArea(),
        qm_cockpit: viewOnlyArea(),
      });

    default:
      return empty;
  }
}

export function buildAllDefaultRoleMatrices(): Record<CanonicalWorkspaceRoleKey, RoleAreaMatrix> {
  const roles: CanonicalWorkspaceRoleKey[] = [
    'owner',
    'admin',
    'management',
    'office',
    'dispatch',
    'billing',
    'quality_management',
    'employee',
    'caregiver',
    'nurse',
    'consultant',
    'field_worker',
    'trainee',
    'client',
    'representative',
    'family_contact',
    'legal_guardian',
    'support',
    'developer_admin',
    'system',
  ];
  return Object.fromEntries(roles.map((role) => [role, buildDefaultRoleMatrix(role)])) as Record<
    CanonicalWorkspaceRoleKey,
    RoleAreaMatrix
  >;
}

export function countGrantedActions(matrix: RoleAreaMatrix): number {
  let count = 0;
  for (const area of Object.values(matrix)) {
    for (const action of Object.values(area) as boolean[]) {
      if (action) count += 1;
    }
  }
  return count;
}

export function hasHealthDataAccess(matrix: RoleAreaMatrix): boolean {
  const clients = matrix.clients;
  return clients.edit || clients.approve || clients.export || clients.administer;
}

export function hasBillingAdminAccess(matrix: RoleAreaMatrix): boolean {
  const billing = matrix.billing;
  return billing.administer || billing.approve;
}

export function hasConnectAdminAccess(matrix: RoleAreaMatrix): boolean {
  return matrix.connect.administer;
}

export function diffMatrices(
  before: RoleAreaMatrix,
  after: RoleAreaMatrix,
): { area: PermissionAreaKey; action: PermissionAction; from: boolean; to: boolean }[] {
  const changes: { area: PermissionAreaKey; action: PermissionAction; from: boolean; to: boolean }[] = [];
  for (const area of Object.keys(before) as PermissionAreaKey[]) {
    for (const action of Object.keys(before[area]) as PermissionAction[]) {
      if (before[area][action] !== after[area][action]) {
        changes.push({ area, action, from: before[area][action], to: after[area][action] });
      }
    }
  }
  return changes;
}
