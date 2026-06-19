import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { GlobalAnimatedBackground } from '@/components/ui/effects';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';

type CareSuiteBackgroundProps = {
  mode?: 'light' | 'dark';
  children: ReactNode;
  style?: ViewStyle;
  /** Disable aurora drift animation (dark mode only). */
  animated?: boolean;
};

/** @deprecated Prefer GlobalAnimatedBackground at shell root. Kept for auth/landing screens. */
export function CareSuiteBackground({
  mode = 'dark',
  children,
  style,
  animated = true,
}: CareSuiteBackgroundProps) {
  const shellHostsAurora = useShellHostsAurora();

  if (shellHostsAurora) {
    return (
      <View style={[styles.root, style]} pointerEvents="box-none">
        {children}
      </View>
    );
  }

  if (mode === 'light') {
    return (
      <View style={[styles.root, style]}>
        <GlobalAnimatedBackground mode="light" animated={false} />
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.root, style]}>
      <GlobalAnimatedBackground mode="dark" animated={animated} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
});
