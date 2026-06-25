import type { PermissionKey, RoleKey } from '@/types';

export type PermissionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type PermissionCatalogEntry = {
  key: PermissionKey;
  module: string;
  category: string;
  label: string;
  description: string | null;
  riskLevel: PermissionRiskLevel;
  requiresAudit: boolean;
};

export type RoleTemplate = {
  id: string;
  tenantId: string | null;
  roleKey: string;
  name: string;
  description: string | null;
  level: number;
  isSystemRole: boolean;
  isEditable: boolean;
};

export type EmployeeRoleAssignment = {
  id: string;
  tenantId: string;
  employeeId: string;
  roleTemplateId: string | null;
  roleKey: RoleKey | null;
  isPrimary: boolean;
  assignedBy: string | null;
  assignedAt: string;
};

export type EmployeePermissionOverride = {
  id: string;
  tenantId: string;
  employeeId: string;
  permissionKey: PermissionKey;
  allowed: boolean;
  reason: string | null;
  validFrom: string | null;
  validUntil: string | null;
  createdBy: string | null;
};

export type EmployeeDataScope = {
  id: string;
  tenantId: string;
  employeeId: string;
  module: string;
  scopeType: string;
  scopeValue: string | null;
};

export type PermissionAuditLogEntry = {
  id: string;
  tenantId: string;
  actorId: string | null;
  actorRole: string | null;
  targetEmployeeId: string | null;
  targetRoleTemplateId: string | null;
  action: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export type EffectivePermissionSet = {
  employeeId: string;
  tenantId: string;
  primaryRoleKey: RoleKey | null;
  roleKeys: RoleKey[];
  roleTemplateIds: string[];
  permissions: PermissionKey[];
  overrides: EmployeePermissionOverride[];
  scopes: EmployeeDataScope[];
  sources: Record<PermissionKey, 'role' | 'override_grant' | 'override_deny'>;
};

export type PermissionMatrixAction = 'read' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

export type PermissionMatrixRow = {
  area: string;
  areaLabel: string;
  read: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
};

export type RbacHubTabKey =
  | 'overview'
  | 'system_role'
  | 'module'
  | 'verwaltung'
  | 'assist'
  | 'pflege'
  | 'beratung'
  | 'stationaer'
  | 'akademie'
  | 'office'
  | 'billing'
  | 'personal'
  | 'documents'
  | 'messages'
  | 'time'
  | 'tracking'
  | 'integrations'
  | 'privacy_audit'
  | 'special'
  | 'preview';
