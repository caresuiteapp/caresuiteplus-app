import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { LoadingState } from '@/components/ui';
import { buildPlatformLoginPath, hasSupabaseAuthSession } from '@/lib/platformConsole/platformSession';
import { PlatformForbiddenScreen } from '@/screens/platformConsole';

export default function PlatformForbiddenRoute() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await hasSupabaseAuthSession();
      if (cancelled) return;
      setHasSession(session);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <LoadingState message="Zugriff wird geprüft…" />;
  }

  if (!hasSession) {
    return <Redirect href={buildPlatformLoginPath('/platform/dashboard') as never} />;
  }

  return <PlatformForbiddenScreen />;
}
