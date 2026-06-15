import { useMemo } from 'react';
import { useAuth } from '@/lib/auth/context';
import {
  canAccessCommunicationCenter,
  canSendPortalMessage,
  canViewPortalThreads,
  hasCommunicationPermission,
} from '@/features/communication/communication.permissions';
import type { RoleKey } from '@/types/core/auth';
import type { CommunicationAudience } from '@/features/communication/communication.types';

function audienceFromRole(roleKey: RoleKey | null | undefined): CommunicationAudience {
  switch (roleKey) {
    case 'employee_portal':
    case 'caregiver':
    case 'nurse':
      return 'employee_portal';
    case 'family_portal':
      return 'relative_portal';
    case 'client_portal':
      return 'client_portal';
    default:
      return 'business';
  }
}

export function useCommunicationPermissions() {
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? null;
  const audience = audienceFromRole(roleKey);

  return useMemo(
    () => ({
      audience,
      canViewCenter: canAccessCommunicationCenter(roleKey),
      canCreateThread: hasCommunicationPermission(roleKey, 'communication.create_thread'),
      canSendMessage: hasCommunicationPermission(roleKey, 'communication.send_message'),
      canSendInternalNote: hasCommunicationPermission(roleKey, 'communication.send_internal_note'),
      canArchive: hasCommunicationPermission(roleKey, 'communication.archive_thread'),
      canAssign: hasCommunicationPermission(roleKey, 'communication.assign_thread'),
      canUpload: hasCommunicationPermission(roleKey, 'communication.upload_attachment'),
      canVoice: hasCommunicationPermission(roleKey, 'communication.send_voice_message'),
      canManageSettings: hasCommunicationPermission(roleKey, 'communication.manage_settings'),
      canViewPortal: canViewPortalThreads(roleKey, audience),
      canReplyPortal: canSendPortalMessage(roleKey, audience),
      canViewDeleted: hasCommunicationPermission(roleKey, 'communication.view_deleted_messages'),
    }),
    [roleKey, audience],
  );
}
