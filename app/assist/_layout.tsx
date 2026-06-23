import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { ShellLayout } from '@/components/layout';
import { RequireAuth, RequireRole } from '@/lib/auth';
import { RequireProductAccess } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

export default function AssistLayout() {
  return (
    <RequireAuth redirectTo={'/auth/business-login' as never}>
      <RequireRole>
        <RequireProductAccess>
          <ShellLayout area="assist" accentColor={moduleColor('assist')}>
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
        </RequireProductAccess>
      </RequireRole>
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    flexGrow: 1,
    alignSelf: 'stretch',
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    backgroundColor: 'transparent',
  },
});
