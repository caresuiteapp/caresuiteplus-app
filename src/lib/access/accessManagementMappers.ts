import type {
  EmployeePortalAccount,
  InternalRoleKey,
  LoginAuditEvent,
  RelativePortalCode,
  TenantUser,
  UserAccessStatus,
  PortalCodeStatus,
} from '@/lib/auth/auth.types';

function asString(value: unknown, fallback = ''): string {
  return value != null ? String(value) : fallback;
}

function asNullableString(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value);
}

export function mapTenantUserRow(row: Record<string, unknown>): TenantUser {
  return {
    id: asString(row.id),
    tenantId: asString(row.tenant_id),
    authUserId: asNullableString(row.auth_user_id),
    employeeId: asNullableString(row.employee_id),
    displayName: asString(row.display_name),
    firstName: asString(row.first_name),
    lastName: asString(row.last_name),
    email: asString(row.email),
    username: asString(row.username),
    roleKey: asString(row.role_key) as InternalRoleKey,
    status: asString(row.status, 'active') as UserAccessStatus,
    mustChangePassword: Boolean(row.must_change_password),
    firstLoginCompleted: Boolean(row.first_login_completed),
    lastLoginAt: asNullableString(row.last_login_at),
    lastPasswordChangeAt: asNullableString(row.last_password_change_at),
    createdBy: asNullableString(row.created_by),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    archivedAt: asNullableString(row.archived_at),
  };
}

export function mapEmployeePortalAccountRow(row: Record<string, unknown>): EmployeePortalAccount {
  return {
    id: asString(row.id),
    tenantId: asString(row.tenant_id),
    employeeId: asString(row.employee_id),
    username: asString(row.username),
    status: asString(row.status, 'pending_first_login') as UserAccessStatus,
    mustChangePassword: Boolean(row.must_change_password),
    firstLoginCompleted: Boolean(row.first_login_completed),
    temporaryPasswordCreatedAt: asNullableString(row.temporary_password_created_at),
    temporaryPasswordExpiresAt: asNullableString(row.temporary_password_expires_at),
    lastLoginAt: asNullableString(row.last_login_at),
    createdBy: asNullableString(row.created_by),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    blockedAt: asNullableString(row.blocked_at),
    blockedBy: asNullableString(row.blocked_by),
    blockedReason: asNullableString(row.blocked_reason),
  };
}

export function mapRelativePortalCodeRow(row: Record<string, unknown>): RelativePortalCode {
  return {
    id: asString(row.id),
    tenantId: asString(row.tenant_id),
    clientId: asString(row.client_id),
    relativeContactId: asString(row.relative_contact_id),
    status: asString(row.status, 'active') as PortalCodeStatus,
    expiresAt: asNullableString(row.expires_at),
    lastUsedAt: asNullableString(row.last_used_at),
    createdBy: asNullableString(row.created_by),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    blockedAt: asNullableString(row.blocked_at),
    blockedBy: asNullableString(row.blocked_by),
    blockedReason: asNullableString(row.blocked_reason),
    regeneratedAt: asNullableString(row.regenerated_at),
  };
}

export function mapLoginAuditEventRow(row: Record<string, unknown>): LoginAuditEvent {
  return {
    id: asString(row.id),
    tenantId: asNullableString(row.tenant_id),
    loginType: asString(row.login_type) as LoginAuditEvent['loginType'],
    accountId: asNullableString(row.account_id),
    usernameOrCodeHint: asString(row.username_or_code_hint),
    success: Boolean(row.success),
    failureReason: asNullableString(row.failure_reason),
    ipAddress: asNullableString(row.ip_address),
    userAgent: asNullableString(row.user_agent),
    createdAt: asString(row.created_at),
  };
}

export type RelativePortalAccessListItem = RelativePortalCode & {
  clientName: string;
  relativeContactName: string;
};
