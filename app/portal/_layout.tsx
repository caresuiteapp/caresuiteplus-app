import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ShellAnimatedBackgroundLayer } from '@/components/ui/effects';
import { routeLayoutContentStyle } from '@/design/routeLayoutStyle';

/** WP322/342 — Portal-Root-Navigation with dedicated animated backdrop. */
export default function PortalRootLayout() {
  return (
    <View style={styles.root}>
      <ShellAnimatedBackgroundLayer />
      <View style={styles.content} pointerEvents="box-none">
        <Stack screenOptions={{ headerShown: false, contentStyle: routeLayoutContentStyle }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
    minHeight: 0,
  },
  content: {
    flex: 1,
    zIndex: 1,
    position: 'relative',
    backgroundColor: 'transparent',
    minHeight: 0,
  },
});
