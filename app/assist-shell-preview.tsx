import { Redirect } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { ShellLayout } from '@/components/layout';
import { PlatformShellPreviewContent } from '@/components/dev/PlatformShellPreviewContent';
import { moduleColor } from '@/design/tokens/modules';

/** __DEV__ only — Assist shell preview for responsive screenshots. */
export default function AssistShellPreviewRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <ShellLayout area="assist" accentColor={moduleColor('assist')}>
      <View style={styles.slot}>
        <PlatformShellPreviewContent />
      </View>
    </ShellLayout>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, backgroundColor: 'transparent' },
});
