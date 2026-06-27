import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { ClientPortalShell } from '@/components/portal/ClientPortalShell';
import { RequireAuth, RequireRole } from '@/lib/auth';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

/** Shell lives here — all client portal routes share sticky header + bottom nav. */
export default function ClientPortalLayout() {
  return (
    <RequireAuth redirectTo={'/auth/client-login' as never}>
      <RequireRole>
        <ClientPortalShell>
          <View style={styles.slot}>
            <Stack screenOptions={{ headerShown: false, contentStyle: routeLayoutContentStyle }} />
          </View>
        </ClientPortalShell>
      </RequireRole>
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, backgroundColor: 'transparent', minHeight: 0 },
});
