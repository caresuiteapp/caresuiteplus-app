import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ShellLayout } from '@/components/layout';
import { moduleColor } from '@/design/tokens/modules';
import { RequireAuth, RequireRole } from '@/lib/auth';

export default function OfficeInventoryLayout() {
  const accent = moduleColor('office');

  return (
    <RequireAuth redirectTo={'/auth/business-login' as never}>
      <RequireRole>
        <ShellLayout area="office" accentColor={accent}>
          <View style={styles.slot}>
            <Stack
              screenOptions={{
                headerShown: false,
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
  slot: { flex: 1 },
});
