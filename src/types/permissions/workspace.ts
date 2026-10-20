import type { RoleKey } from '@/types/core/auth';

/** Operative Hauptbereiche */
export type WorkspaceArea = 'administration' | 'employee_portal' | 'client_portal';

/** Kategorien im Rollenmodell (Prompt 56) */
export type WorkspaceRoleCategory =
  | 'administration'
  | 'employee'
  | 'client_portal'
  | 'system';

/** Kanonische Rollennamen — Mapping auf bestehende RoleKey */
export type CanonicalWorkspaceRoleKey =
  | 'owner'
  | 'admin'
  | 'management'
  | 'office'
  | 'planning'
  | 'dispatch'
  | 'billing'
  | 'quality_management'
  | 'employee'
  | 'caregiver'
  | 'nurse'
  | 'consultant'
  | 'field_worker'
  | 'trainee'
  | 'client'
  | 'representative'
  | 'family_contact'
  | 'legal_guardian'
  | 'system'
  | 'support'
  | 'developer_admin';

export type WorkspaceRoleDefinition = {
  canonicalKey: CanonicalWorkspaceRoleKey;
  label: string;
  category: WorkspaceRoleCategory;
  mapsToRoleKey: RoleKey;
  primaryArea: WorkspaceArea;
};

export type WorkspaceAccessContext = {
  userId: string | null;
  tenantId: string | null;
  roleKey: RoleKey | null;
  resourceTenantId?: string | null;
  employeeId?: string | null;
  clientId?: string | null;
  profileId?: string | null;
  /** Freigegeben für Vertreter:innen / Angehörige */
  sharedClientIds?: string[];
  environment?: 'demo' | 'production';
  isDemoMode?: boolean;
  usesDemoFallback?: boolean;
};

export type WorkspaceAccessCode =
  | 'missing_user'
  | 'missing_tenant'
  | 'missing_role'
  | 'tenant_mismatch'
  | 'production_demo_blocked'
  | 'area_forbidden'
  | 'not_assigned'
  | 'not_own_client'
  | 'not_shared_client'
  | 'permission_denied'
  | 'direct_chat_forbidden'
  | 'no_assignment_context'
  | 'document_not_shared'
  | 'audit_forbidden';

export type WorkspaceAccessDecision =
  | { allowed: true }
  | { allowed: false; code: WorkspaceAccessCode; message: string };

export type WorkspaceAuditEvent = {
  id: string;
  tenantId: string;
  userId: string | null;
  roleKey: RoleKey | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: 'allowed' | 'denied';
  code?: WorkspaceAccessCode;
  summary: string;
  createdAt: string;
};

export const WORKSPACE_DISCLAIMER =
  'Rollen- und Portalmodell prüft technische Zugriffsgrenzen — keine Rechtsberatung zu Schweigepflicht oder AV-Verträgen.';
