import { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';import { useThemeMode } from '@/design/ThemeModeProvider';
import {
  LightLiquidGlassAuroraNebulaBackground,
  OfficePremiumGlassBackground,
} from '@/components/backgrounds';
import { useIsOfficeRoute } from '@/hooks/useIsOfficeRoute';
import { AuroraBackground } from './aurorabackground';

type GlobalAnimatedBackgroundProps = {  /** Override ThemeModeProvider (e.g. CareSuiteBackground legacy `mode` prop). */
  mode?: 'light' | 'dark';
  /** Disable aurora / nebula drift. Honours prefers-reduced-motion when true. */
  animated?: boolean;
  style?: ViewStyle;
  children?: ReactNode;
  /** Leichte Abdunklung (Modals / Formulare). */
  dimmed?: boolean;
  /** Office-Route — von RootShell übergeben für zuverlässiges Umschalten. */
  isOfficeRoute?: boolean;
};

/**
 * Single shell-root background for CareSuite+.
 * Dark: animated aurora gradient. Light: LLGAN or Office Premium Glass (Office routes).
 * Mount once at app/_layout root — never inside columns or per-screen.
 */
export function GlobalAnimatedBackground({
  mode: modeOverride,
  animated = true,
  style,
  children,
  dimmed = false,
  isOfficeRoute: isOfficeRouteProp,
}: GlobalAnimatedBackgroundProps) {
  const { mode: themeMode } = useThemeMode();
  const mode = modeOverride ?? themeMode;
  const isOfficeRouteHook = useIsOfficeRoute();
  const isOfficeRoute = isOfficeRouteProp ?? isOfficeRouteHook;

  if (mode === 'dark') {
    return (
      <View style={[styles.root, style]} pointerEvents="box-none">
        <AuroraBackground animated={animated} />
        {children}
      </View>
    );
  }

  const LightBackground = isOfficeRoute
    ? OfficePremiumGlassBackground
    : LightLiquidGlassAuroraNebulaBackground;

  return (
    <View style={[styles.root, styles.lightRoot, style]} pointerEvents="none">
      <LightBackground key={isOfficeRoute ? 'office-premium-glass' : 'llgan'} animated={animated} dimmed={dimmed} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  lightRoot: {
    backgroundColor: 'transparent',
  },});
