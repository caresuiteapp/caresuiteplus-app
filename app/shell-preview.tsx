import { Redirect } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { ShellLayout } from '@/components/layout';
import { PlatformShellPreviewContent } from '@/components/dev/PlatformShellPreviewContent';

/** __DEV__ only — renders PlatformShell with mock dashboard for responsive screenshots. */
export default function ShellPreviewRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <ShellLayout area="business">
      <View style={styles.slot}>
        <PlatformShellPreviewContent />
      </View>
    </ShellLayout>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, backgroundColor: 'transparent' },
});
