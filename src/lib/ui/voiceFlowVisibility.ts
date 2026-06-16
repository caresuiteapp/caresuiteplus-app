import type { RoleKey } from '@/types';
import {
  isClientPortalRole,
  isEmployeePortalRole,
} from '@/lib/permissions/workspaceRoles';
import { isDemoMode } from '@/lib/supabase/config';
import type { UiFeatureStatus } from './uiVisibility';

export type VoiceFlowContext = {
  isAuthenticated: boolean;
  roleKey: RoleKey | null;
  assignmentId?: string | null;
  tenantId?: string | null;
  sessionTenantId?: string | null;
  documentationAllowed?: boolean;
  featureStatus?: UiFeatureStatus;
};

export type VoiceFlowVisibility = {
  showPanel: boolean;
  showStartButton: boolean;
};

function defaultVoiceFlowFeatureStatus(): UiFeatureStatus {
  return isDemoMode() ? 'beta' : 'preparedOnly';
}

function isVoiceFlowEmployeeRole(roleKey: RoleKey | null): boolean {
  if (!roleKey) return false;
  return isEmployeePortalRole(roleKey);
}

/** VoiceFlow is assignment-documentation only — never on public start or client portals. */
export function resolveVoiceFlowVisibility(ctx: VoiceFlowContext): VoiceFlowVisibility {
  if (!ctx.isAuthenticated || !ctx.roleKey) {
    return { showPanel: false, showStartButton: false };
  }

  if (isClientPortalRole(ctx.roleKey)) {
    return { showPanel: false, showStartButton: false };
  }

  if (!isVoiceFlowEmployeeRole(ctx.roleKey)) {
    return { showPanel: false, showStartButton: false };
  }

  if (!ctx.assignmentId) {
    return { showPanel: false, showStartButton: false };
  }

  if (ctx.documentationAllowed === false) {
    return { showPanel: false, showStartButton: false };
  }

  if (
    ctx.tenantId &&
    ctx.sessionTenantId &&
    ctx.tenantId !== ctx.sessionTenantId
  ) {
    return { showPanel: false, showStartButton: false };
  }

  const status = ctx.featureStatus ?? defaultVoiceFlowFeatureStatus();

  if (status === 'internal') {
    return { showPanel: false, showStartButton: false };
  }

  const showStartButton = status === 'beta' || status === 'demoMode';
  const showPanel =
    status === 'beta' ||
    status === 'demoMode' ||
    status === 'preparedOnly' ||
    status === 'coming_soon';

  return { showPanel, showStartButton };
}
