import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { isRouteAvailableInPortalApp } from '@/lib/platform/portalAppEdition';

export function PortalOnlyRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = isRouteAvailableInPortalApp(pathname);

  useEffect(() => {
    if (allowed) return;
    router.replace('/');
  }, [allowed, router]);

  if (!allowed) {
    return (
      <View accessibilityLabel="Portal-App wird geöffnet" style={styles.loading}>
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
