import type { RoleKey } from '@/types';
import { careAssessmentRuntimeAccess } from '../careAssessment/careAssessmentRuntimeAccess.web.ts';
import { woundUuid } from './woundCareDomain.ts';

export type WoundEditorOwner = { tenantId: string; profileId: string; role: RoleKey };
type Profile = { tenantId?: string | null; id?: string | null; roleKey?: RoleKey | null } | null | undefined;
type Input = { owner?: WoundEditorOwner | null; profile: Profile; serviceTenant: string | null; runtimeTenant: string | null;
  runtimeRole: RoleKey | null; canView: boolean; canManage: boolean; blocked?: boolean };

/** Keep native form identity separate from temporary runtime access; backend services still authorize each request. */
export function woundEditorAccess(input: Input) {
  const profile = input.profile;
  const nativeOwner = woundUuid(profile?.tenantId) && woundUuid(profile?.id) && profile?.roleKey
    ? { tenantId: profile.tenantId, profileId: profile.id, role: profile.roleKey } as WoundEditorOwner : null;
  const owner = input.owner === undefined ? nativeOwner : input.owner;
  const access = careAssessmentRuntimeAccess({ tenantId: owner?.tenantId, profileId: owner?.profileId, profileRole: owner?.role,
    runtimeTenantId: input.runtimeTenant, runtimeRole: input.runtimeRole, canView: input.canView, canManage: input.canManage });
  const currentOwner = !!owner && !!nativeOwner && owner.tenantId === nativeOwner.tenantId
    && owner.profileId === nativeOwner.profileId && owner.role === nativeOwner.role && input.serviceTenant === owner.tenantId;
  const canView = currentOwner && input.blocked !== true && access.canRead;
  return { owner, key: JSON.stringify(owner), canView, canManage: canView && access.canManage };
}
