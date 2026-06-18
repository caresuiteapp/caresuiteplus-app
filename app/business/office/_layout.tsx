import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { ShellLayout } from '@/components/layout';
import { RequireAuth, RequireRole } from '@/lib/auth';
import { moduleColor } from '@/design/tokens/modules';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function BusinessOfficeLayout() {
  return (
    <RequireAuth redirectTo={'/auth/business-login' as never}>
      <RequireRole>
        <ShellLayout area="office" accentColor={moduleColor('office')}>
          <View style={styles.slot}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: routeLayoutContentStyle,
                animation: 'slide_from_right',
              }}
            />
          </View>
        </ShellLayout>
      </RequireRole>
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, backgroundColor: 'transparent' },
});
