import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { RequireAuth, RequireRole } from '@/lib/auth';
import { RelativePortalShell } from '@/components/portal/RelativePortalShell';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function RelativePortalLayout() {
  return (
    <RequireAuth redirectTo={'/auth/portal-code-login' as never}>
      <RequireRole>
        <RelativePortalShell>
          <View style={styles.stackHost}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: routeLayoutContentStyle,
                animation: 'slide_from_right',
              }}
            />
          </View>
        </RelativePortalShell>
      </RequireRole>
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  stackHost: {
    flex: 1,
    backgroundColor: 'transparent',
    minHeight: 0,
  },
});
