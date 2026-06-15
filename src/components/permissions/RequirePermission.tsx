import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import type { PermissionKey } from '@/types/permissions';
import { ErrorState, PremiumButton } from '@/components/ui';
import { ScreenShell } from '@/components/layout';
import { usePermissions } from '@/hooks/usePermissions';

type RequirePermissionProps = {
  permission: PermissionKey;
  children: ReactNode;
  title?: string;
  backLabel?: string;
};

export function RequirePermission({
  permission,
  children,
  title = 'Kein Zugriff',
  backLabel = 'Zurück',
}: RequirePermissionProps) {
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const decision = check(permission);

  if (can(permission)) {
    return <>{children}</>;
  }

  return (
    <ScreenShell title={title} subtitle={roleLabel ?? 'Berechtigung fehlt'}>
      <ErrorState
        title={title}
        message={decision.reason ?? 'Sie haben keine Berechtigung für diese Seite.'}
      />
      <PremiumButton title={backLabel} variant="secondary" onPress={() => router.back()} />
    </ScreenShell>
  );
}
