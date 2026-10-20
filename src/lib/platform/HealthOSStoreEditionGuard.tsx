import { useEffect, type ReactNode } from 'react';
import { runAppTransition } from '@/lib/react/runAppTransition';
import { usePathname, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  isHealthOSCoreEdition,
  isRouteAvailableInHealthOSCore,
} from './healthOSStoreEdition';

type StableRouter = {
  replace: (target: string) => void;
};

export function HealthOSStoreEditionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter() as unknown as StableRouter;
  const allowed = isRouteAvailableInHealthOSCore(pathname);

  useEffect(() => {
    if (!isHealthOSCoreEdition || allowed) return;
    runAppTransition(() => router.replace('/'));
  }, [allowed, router]);

  if (isHealthOSCoreEdition && !allowed) {
    return (
      <View accessibilityLabel="CareSuite HealthOS wird geöffnet" style={styles.loading}>
        <ActivityIndicator color="#1683FF" size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    flex: 1,
    justifyContent: 'center',
  },
});
