import type { CanonicalWorkspaceRoleKey } from './workspace';

/** Aktionen pro Rechtebereich (Prompt 68) */
export type PermissionAction = 'view' | 'edit' | 'approve' | 'export' | 'administer';

/** 12 Rechtebereiche */
export type PermissionAreaKey =
  | 'administration'
  | 'clients'
  | 'employees'
  | 'assignments_schedule'
  | 'employee_portal'
  | 'client_portal'
  | 'documentation'
  | 'service_records'
  | 'billing'
  | 'templates_documents'
  | 'connect'
  | 'qm_cockpit';

export type AreaPermissionSet = Record<PermissionAction, boolean>;

export type RoleAreaMatrix = Record<PermissionAreaKey, AreaPermissionSet>;

export type TenantRoleMatrixEntry = {
  tenantId: string;
  roleKey: CanonicalWorkspaceRoleKey;
  areaPermissions: RoleAreaMatrix;
  isCustomRole: boolean;
  isSystemRole: boolean;
  label: string;
  copiedFromRoleKey?: CanonicalWorkspaceRoleKey | null;
  updatedAt: string;
};

export type PermissionMatrixPreview = {
  roleKey: CanonicalWorkspaceRoleKey;
  grantedAreas: PermissionAreaKey[];
  revokedAreas: PermissionAreaKey[];
  warnings: string[];
  requiresHealthDataConfirm: boolean;
  requiresBillingConfirm: boolean;
};

export type PermissionAuditEvent = {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  actorRoleKey: string | null;
  targetRoleKey: CanonicalWorkspaceRoleKey;
  action: 'update' | 'restore_defaults' | 'copy' | 'create_custom' | 'preview';
  areaKey?: PermissionAreaKey;
  permissionAction?: PermissionAction;
  previousValue?: boolean;
  newValue?: boolean;
  summary: string;
  createdAt: string;
};

export type SaveRoleMatrixInput = {
  tenantId: string;
  roleKey: CanonicalWorkspaceRoleKey;
  areaPermissions: RoleAreaMatrix;
  actorUserId?: string | null;
  actorRoleKey?: CanonicalWorkspaceRoleKey | null;
  confirmHealthData?: boolean;
  confirmBillingOverride?: boolean;
};

export type RoleMatrixValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  requiresHealthDataConfirm?: boolean;
  requiresBillingConfirm?: boolean;
};

export const PERMISSION_AREAS: readonly {
  key: PermissionAreaKey;
  label: string;
  description: string;
}[] = [
  { key: 'administration', label: 'Administration', description: 'Mandant, Benutzer, Rollen' },
  { key: 'clients', label: 'Klient:innen', description: 'Akten, Kontakte, Gesundheitsdaten' },
  { key: 'employees', label: 'Mitarbeitende', description: 'Personal, Qualifikationen' },
  { key: 'assignments_schedule', label: 'Einsätze / Planung', description: 'Disposition, Kalender' },
  { key: 'employee_portal', label: 'Mitarbeiterportal', description: 'Portal-Zugänge MA' },
  { key: 'client_portal', label: 'Klient:innenportal', description: 'Portal-Zugänge Klient:innen' },
  { key: 'documentation', label: 'Dokumentation', description: 'Pflegedoku, Notizen' },
  { key: 'service_records', label: 'Leistungsnachweise', description: 'Nachweise, Signaturen' },
  { key: 'billing', label: 'Abrechnung', description: 'Rechnungen, Budgets' },
  { key: 'templates_documents', label: 'Vorlagen & Dokumente', description: 'Freigabe, Export' },
  { key: 'connect', label: 'Connect', description: 'API, Credentials' },
  { key: 'qm_cockpit', label: 'QM / Cockpit', description: 'Qualität, Reporting' },
] as const;

export const PERMISSION_ACTIONS: readonly { key: PermissionAction; label: string }[] = [
  { key: 'view', label: 'Ansehen' },
  { key: 'edit', label: 'Bearbeiten' },
  { key: 'approve', label: 'Freigeben' },
  { key: 'export', label: 'Exportieren' },
  { key: 'administer', label: 'Verwalten' },
] as const;

export const SYSTEM_PROTECTED_ROLES = new Set<CanonicalWorkspaceRoleKey>([
  'system',
  'developer_admin',
  'support',
]);

export const CLIENT_PORTAL_ROLES = new Set<CanonicalWorkspaceRoleKey>([
  'client',
  'representative',
  'family_contact',
  'legal_guardian',
]);

export const EMPLOYEE_ROLES = new Set<CanonicalWorkspaceRoleKey>([
  'employee',
  'caregiver',
  'nurse',
  'consultant',
  'field_worker',
  'trainee',
]);
