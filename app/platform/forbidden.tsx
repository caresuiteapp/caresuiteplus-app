import { RequireAuth } from '@/lib/auth';
import { PlatformForbiddenScreen } from '@/screens/platformConsole';

export default function PlatformForbiddenRoute() {
  return (
    <RequireAuth redirectTo={'/auth/business-login' as never}>
      <PlatformForbiddenScreen />
    </RequireAuth>
  );
}
