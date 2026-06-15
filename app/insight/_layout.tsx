import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ShellLayout } from '@/components/layout';
import { RequireModuleVisibility } from '@/components/ui/RequireModuleVisibility';
import { moduleColor } from '@/design/tokens/modules';
import { RequireAuth, RequireRole } from '@/lib/auth';

export default function InsightLayout() {
  const insightAccent = moduleColor('insight');

  return (
    <RequireAuth redirectTo={'/auth/business-login' as never}>
      <RequireRole>
        <RequireModuleVisibility>
          <ShellLayout area="business" accentColor={insightAccent}>
            <View style={styles.slot}>
              <Stack screenOptions={{ headerShown: false }} />
            </View>
          </ShellLayout>
        </RequireModuleVisibility>
      </RequireRole>
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
});
