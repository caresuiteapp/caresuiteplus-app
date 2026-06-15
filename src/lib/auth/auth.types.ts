import type { EntityId, ISODateTime } from '@/types/core/base';
import type { ProductKey } from '@/types';

export type AuthLoginType =
  | 'business'
  | 'employee_portal'
  | 'client_portal'
  | 'relative_portal';

export type UserAccessStatus =
  | 'active'
  | 'blocked'
  | 'pending_first_login'
  | 'password_reset_required'
  | 'expired'
  | 'archived';

export type PortalAccessType = 'client' | 'relative';

export type PortalCodeStatus =
  | 'active'
  | 'blocked'
  | 'expired'
  | 'regenerated'
  | 'revoked';

export type InternalRoleKey =
  | 'owner'
  | 'management'
  | 'pdl'
  | 'administration'
  | 'billing'
  | 'quality_management'
  | 'team_lead'
  | 'dispatcher'
  | 'employee'
  | 'readonly';

export type ModulePermissionAction =
  | 'can_view'
  | 'can_create'
  | 'can_edit'
  | 'can_archive'
  | 'can_export'
  | 'can_manage_settings';

export type TenantUser = {
  id: EntityId;
  tenantId: string;
  authUserId: string | null;
  employeeId: string | null;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  roleKey: InternalRoleKey;
  status: UserAccessStatus;
  mustChangePassword: boolean;
  firstLoginCompleted: boolean;
  lastLoginAt: ISODateTime | null;
  lastPasswordChangeAt: ISODateTime | null;
  createdBy: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt: ISODateTime | null;
};

export type EmployeePortalAccount = {
  id: EntityId;
  tenantId: string;
  employeeId: string;
  username: string;
  status: UserAccessStatus;
  mustChangePassword: boolean;
  firstLoginCompleted: boolean;
  temporaryPasswordCreatedAt: ISODateTime | null;
  temporaryPasswordExpiresAt: ISODateTime | null;
  lastLoginAt: ISODateTime | null;
  createdBy: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  blockedAt: ISODateTime | null;
  blockedBy: string | null;
  blockedReason: string | null;
};

export type ClientPortalCode = {
  id: EntityId;
  tenantId: string;
  clientId: string;
  status: PortalCodeStatus;
  expiresAt: ISODateTime | null;
  lastUsedAt: ISODateTime | null;
  createdBy: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  blockedAt: ISODateTime | null;
  blockedBy: string | null;
  blockedReason: string | null;
  regeneratedAt: ISODateTime | null;
};

export type RelativePortalCode = {
  id: EntityId;
  tenantId: string;
  clientId: string;
  relativeContactId: string;
  status: PortalCodeStatus;
  expiresAt: ISODateTime | null;
  lastUsedAt: ISODateTime | null;
  createdBy: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  blockedAt: ISODateTime | null;
  blockedBy: string | null;
  blockedReason: string | null;
  regeneratedAt: ISODateTime | null;
};

export type PortalAccessPermissions = {
  id: EntityId;
  tenantId: string;
  portalType: PortalAccessType;
  portalAccountId: string;
  canViewAppointments: boolean;
  canViewDocuments: boolean;
  canViewMessages: boolean;
  canSendMessages: boolean;
  canViewServiceRecords: boolean;
  canViewInvoices: boolean;
  canDownloadDocuments: boolean;
  canConfirmAppointments: boolean;
  canSignRecords: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type UserModulePermission = {
  id: EntityId;
  tenantId: string;
  tenantUserId: string;
  moduleKey: ProductKey | 'messages' | 'documents' | 'qm' | 'reporting' | 'ti' | 'settings';
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canExport: boolean;
  canManageSettings: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type LoginAuditEvent = {
  id: EntityId;
  tenantId: string | null;
  loginType: AuthLoginType;
  accountId: string | null;
  usernameOrCodeHint: string;
  success: boolean;
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: ISODateTime;
};

export type BusinessRegistrationInput = {
  companyName: string;
  legalForm: string;
  industry: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  website?: string;
  ikNumber?: string;
  taxNumber?: string;
  vatId?: string;
  contactFirstName: string;
  contactLastName: string;
  contactRole: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone?: string;
  adminPassword: string;
  selectedModules: ProductKey[];
};

export type AccessCredentialsReveal = {
  username?: string;
  oneTimePassword?: string;
  portalCode?: string;
  expiresAt?: ISODateTime | null;
};

export const USERNAME_MAX_LENGTH = 20;
export const PORTAL_CODE_LENGTH = 6;
export const PORTAL_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
