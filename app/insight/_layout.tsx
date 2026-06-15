import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ShellLayout } from '@/components/layout';
import { moduleColor } from '@/design/tokens/modules';
import { RequireAuth, RequireRole } from '@/lib/auth';

export default function InsightLayout() {
  const insightAccent = moduleColor('insight');

  return (
    <RequireAuth redirectTo={'/auth/business-login' as never}>
      <RequireRole>
        <ShellLayout area="business" accentColor={insightAccent}>
          <View style={styles.slot}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </ShellLayout>
      </RequireRole>
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
});
