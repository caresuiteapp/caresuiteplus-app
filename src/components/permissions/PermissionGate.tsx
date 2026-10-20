import type { ReactNode } from 'react';
import type { PermissionKey } from '@/types/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { LockedActionBanner } from './LockedActionBanner';

type PermissionGateProps = {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
  showLockedHint?: boolean;
  lockedTitle?: string;
};

export function PermissionGate({
  permission,
  children,
  fallback = null,
  showLockedHint = false,
  lockedTitle,
}: PermissionGateProps) {
  const { can, check, roleLabel } = usePermissions();
  const decision = check(permission);

  if (can(permission)) {
    return <>{children}</>;
  }

  if (showLockedHint && decision.reason) {
    return (
      <LockedActionBanner
        title={lockedTitle}
        message={decision.reason}
        roleLabel={roleLabel}
      />
    );
  }

  return <>{fallback}</>;
}
