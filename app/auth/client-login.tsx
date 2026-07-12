import { startTransition, useEffect } from 'react';
import { useRouter, type Href } from 'expo-router';
import { LoadingState } from '@/components/ui';
import { useHydrated } from '@/hooks/useHydrated';

export default function ClientLoginRoute() {
  const router = useRouter();
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    startTransition(() => {
      router.replace('/auth/portal-code-login' as Href);
    });
  }, [hydrated, router]);

  return <LoadingState message="Weiterleitung…" />;
}
