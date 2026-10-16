import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { RequireAuth } from '@/lib/auth/RequireAuth';
import { RequireRole } from '@/lib/auth/RequireRole';
import { resolveAuthSessionTarget } from '@/lib/auth/sessionTarget';
import { SessionAccessRecovery } from '@/lib/auth/SessionAccessRecovery.web';
import { WEB_DESKTOP_ROUTE } from '@/lib/navigation/businessHome';
import { CommandCenterScreen } from './CommandCenterScreen';

function DesktopIdentity() {
  const auth = useAuth();
  const target = resolveAuthSessionTarget(auth);
  if (!target.canRedirectHome) return <SessionAccessRecovery />;
  if (target.homePath !== WEB_DESKTOP_ROUTE) return <Redirect href={target.homePath as never} />;
  return <RequireRole><CommandCenterScreen /></RequireRole>;
}

/** Reload restores identity before showing the desktop; anonymous visits use the normal login return. */
export function DesktopEntryScreen() {
  return <RequireAuth redirectTo={'/auth/business-login' as never}><DesktopIdentity /></RequireAuth>;
}
