import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getServiceMode } from '@/lib/services/mode';
import { isDemoMode } from '@/lib/supabase/config';
import { carePermissionOwner, carePermissionOwnerIsCurrent, sameCarePermissionOwner } from '@/lib/permissions/carePermissionOwner.web';
import { useCareRuntimePermissions } from './useCareRuntimePermissions.web';
import { createNativeCarePlanSourceController } from '@/lib/pflege/nativeCarePlanSourceController.web';
import { nativeCarePlanSourceRepository } from '@/lib/pflege/nativeCarePlanSourceRepository.supabase.web';
import type { NativeCarePlanSourceSelection } from '@/lib/pflege/nativeCarePlanSourceRepository.web';

export function useNativeCarePlanSource(selection: NativeCarePlanSourceSelection) {
  const auth = useAuth(), tenantId = useServiceTenantId(), permissions = useCareRuntimePermissions();
  const owner = carePermissionOwner(auth, tenantId, isDemoMode()), sdk = getSupabaseClient();
  const latest = useRef({ selection, owner, permissions, sdk });
  latest.current = { selection, owner, permissions, sdk };
  const [, update] = useState(0);
  const frame = useRef<{
    selection: NativeCarePlanSourceSelection;
    owner: typeof owner;
    grants: typeof permissions.permissions;
    sdk: typeof sdk;
    controller: ReturnType<typeof createNativeCarePlanSourceController>;
  } | null>(null);
  if (!frame.current || !sameCarePermissionOwner(frame.current.owner, owner) || frame.current.grants !== permissions.permissions
    || frame.current.sdk !== sdk || frame.current.selection.planId !== selection.planId || frame.current.selection.clientId !== selection.clientId
    || frame.current.selection.sourceAssessmentId !== selection.sourceAssessmentId) {
    frame.current?.controller.dispose();
    const selected = Object.freeze({ ...selection });
    const ownFrame: NonNullable<typeof frame.current> = {
      selection: selected, owner, grants: permissions.permissions, sdk,
      controller: createNativeCarePlanSourceController({
        isCurrent: () => {
          const current = latest.current;
          return frame.current === ownFrame && !!owner && !owner.demo && carePermissionOwnerIsCurrent(owner)
            && sameCarePermissionOwner(owner, current.owner) && current.permissions.permissions === ownFrame.grants
            && current.permissions.can('pflege.plans.view') && current.permissions.tenantId === owner.tenantId
            && current.selection.planId === selected.planId && current.selection.clientId === selected.clientId
            && current.selection.sourceAssessmentId === selected.sourceAssessmentId
            && !!sdk && current.sdk === sdk && getSupabaseClient() === sdk && getServiceMode() === 'supabase';
        },
        read: () => owner?.accessToken ? nativeCarePlanSourceRepository.read({
          tenantId: owner.tenantId, actorId: owner.profileId, accessToken: owner.accessToken, expiresAt: owner.expiresAt,
          isCurrent: () => ownFrame.controller.current(),
        }, selected) : Promise.resolve({ ok: false as const, error: 'Die eigene Sitzung ist nicht bestätigt.' }),
      }),
    };
    frame.current = ownFrame;
  }
  const ownFrame = frame.current, controller = ownFrame.controller;
  const available = !!owner && !owner.demo && !!owner.accessToken && Number.isFinite(owner.expiresAt)
    && permissions.can('pflege.plans.view') && permissions.tenantId === owner.tenantId && !!sdk;
  useEffect(() => {
    controller.mount();
    if (available) void controller.refresh().finally(() => { if (frame.current === ownFrame) update(value => value + 1); });
    return () => controller.dispose();
  }, [ownFrame, available]);
  const refresh = async () => {
    if (frame.current !== ownFrame || !controller.current()) return;
    const pending = controller.refresh(); update(value => value + 1);
    await pending;
    if (frame.current === ownFrame && controller.current()) update(value => value + 1);
  };
  const open = async (navigate: (assessmentId: string) => void) => {
    if (frame.current !== ownFrame || !controller.current()) return;
    const pending = controller.sourceForNavigation(); update(value => value + 1);
    const assessmentId = await pending;
    if (frame.current !== ownFrame || !controller.current()) return;
    update(value => value + 1);
    if (assessmentId) navigate(assessmentId);
  };
  return { ...controller.state(), available, refresh, open };
}
