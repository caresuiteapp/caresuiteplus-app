import type { ISODateTime, EntityId } from './base';

export type RoleKey =
  | 'business_admin'
  | 'business_manager'
  | 'billing'
  | 'dispatch'
  | 'nurse'
  | 'caregiver'
  | 'counselor'
  | 'akademie_admin'
  | 'employee_portal'
  | 'client_portal'
  | 'family_portal';

export type Role = {
  id: EntityId;
  key: RoleKey;
  name: string;
  description: string | null;
  createdAt: ISODateTime;
};

export type RolePermission = {
  id: EntityId;
  roleId: string;
  permissionKey: string;
};

export type Profile = {
  id: EntityId;
  tenantId: string | null;
  roleId: string | null;
  roleKey: RoleKey | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  employeeId?: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type AuthUser = {
  id: EntityId;
  email: string;
  displayName: string | null;
  roleKey: RoleKey | null;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
};
