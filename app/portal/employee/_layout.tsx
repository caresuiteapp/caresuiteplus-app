import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { EmployeePortalShell } from '@/components/portal/EmployeePortalShell';
import { RequireAuth, RequireEmployeePasswordSetup, RequireRole } from '@/lib/auth';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

/** Shell lives here — all employee portal routes share sticky header + bottom nav. */
export default function EmployeePortalLayout() {
  return (
    <RequireAuth redirectTo={'/auth/employee-login' as never}>
      <RequireEmployeePasswordSetup>
        <RequireRole>
          <EmployeePortalShell>
            <View style={styles.slot}>
              <Stack screenOptions={{ headerShown: false, contentStyle: routeLayoutContentStyle }} />
            </View>
          </EmployeePortalShell>
        </RequireRole>
      </RequireEmployeePasswordSetup>
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, backgroundColor: 'transparent', minHeight: 0 },
});
