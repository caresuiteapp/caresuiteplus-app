import type { PermissionKey } from '@/types/permissions';

export type CompanyAccess = {
  permissions: readonly PermissionKey[];
  scopeLimited: boolean;
  canManageScopes: boolean;
};
export type CompanyScopeKind = 'entity' | 'site' | 'department';
export type CompanyScopeGrant = { kind: CompanyScopeKind; targetId: string };
export type CompanyAccessProfile = {
  id: string;
  displayName: string;
  roleKey: string;
  scopeLimited: boolean;
  version: number;
  hasLegacyLimits: boolean;
  isCurrentProfile: boolean;
  grants: CompanyScopeGrant[];
};
export type CompanyScopeSnapshot = { profiles: CompanyAccessProfile[] };
export type CompanyScopeSaveInput = {
  profileId: string;
  limited: boolean;
  grants: readonly CompanyScopeGrant[];
  expectedVersion: number;
};
export type CompanyScopeSaveReceipt = { profileId: string; scopeLimited: boolean; version: number };
