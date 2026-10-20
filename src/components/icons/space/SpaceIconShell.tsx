import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import {
  ACCENT_ICON_FRAME_GRADIENT,
  RAIL_ICON_GLASS_LIGHT,
  accentDarkSoftBorder,
} from '@/design/tokens/accentContrast';
import { withAlpha } from '@/design/tokens/motion';

export type SpaceIconFrame = 'card' | 'rail';

type SpaceIconShellProps = {
  accentColor: string;
  size: number;
  children: ReactNode;
  active?: boolean;
  borderRadius?: number;
  /** `rail` = frosted glass circle for the module icon rail. */
  frame?: SpaceIconFrame;
};

function railGlassWebFx(active: boolean, blurPx: number, accentColor: string, size: number): ViewStyle | null {
  if (Platform.OS !== 'web') return null;
  const glowSpread = Math.round(size * (active ? 0.5 : 0.34));
  const glowAlpha = active ? 0.58 : 0.38;
  const insetHighlight = active ? 'inset 0 1px 0 rgba(255,255,255,0.68)' : 'inset 0 1px 0 rgba(255,255,255,0.52)';
  return {
    backdropFilter: `blur(${blurPx}px) saturate(1.2)`,
    WebkitBackdropFilter: `blur(${blurPx}px) saturate(1.2)`,
    boxShadow: `0 0 ${glowSpread}px ${withAlpha(accentColor, glowAlpha)}, ${insetHighlight}`,
  } as ViewStyle;
}

const webGlow = (
  color: string,
  active: boolean,
  size: number,
  rail: boolean,
): ViewStyle | null =>
  Platform.OS === 'web'
    ? ({
        boxShadow: rail
          ? active
            ? `0 0 ${Math.round(size * 0.55)}px ${withAlpha(color, 0.7)}`
            : `0 0 ${Math.round(size * 0.4)}px ${withAlpha(color, 0.4)}`
          : active
            ? `0 0 ${Math.round(size * 0.45)}px ${withAlpha(color, 0.55)}, 0 4px 12px rgba(15,23,42,0.08)`
            : `0 0 ${Math.round(size * 0.32)}px ${withAlpha(color, 0.38)}, 0 2px 8px rgba(15,23,42,0.06)`,
      } as ViewStyle)
    : null;

/** Shared light-glass frame for all Space-3D icons. */
export function SpaceIconShell({
  accentColor,
  size,
  children,
  active = false,
  borderRadius = 12,
  frame = 'card',
}: SpaceIconShellProps) {
  const rail = frame === 'rail';
  const { isLight } = useLegacyTheme();
  const glassTokens = RAIL_ICON_GLASS_LIGHT;
  const useGlassFrame = isLight || rail;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          width: size,
          height: size,
          borderRadius: rail ? size / 2 : borderRadius,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: useGlassFrame ? 1 : rail ? 0 : 1,
          borderColor: useGlassFrame
            ? active
              ? glassTokens.borderActive ?? accentDarkSoftBorder(accentColor, active)
              : glassTokens.border
            : rail
              ? 'transparent'
              : withAlpha(accentColor, active ? 0.95 : 0.42),
          backgroundColor: useGlassFrame
            ? active
              ? glassTokens.surfaceActive
              : glassTokens.surface
            : 'transparent',
          ...(useGlassFrame
            ? (railGlassWebFx(active, glassTokens.blurPx, accentColor, size) ?? {})
            : (webGlow(accentColor, active, size, rail) ?? {})),
          transform: active ? [{ scale: rail ? 1.08 : 1.04 }] : [{ scale: 1 }],
        },
        nebula: {
          position: 'absolute',
          top: -size * 0.22,
          right: -size * 0.18,
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: size,
          backgroundColor: withAlpha(accentColor, active ? 0.22 : 0.14),
        },
        stage: {
          width: size * 0.86,
          height: size * 0.86,
          alignItems: 'center',
          justifyContent: 'center',
        },
        star: {
          position: 'absolute',
          top: 4,
          left: 6,
          width: 2,
          height: 2,
          borderRadius: 1,
          backgroundColor: 'rgba(255,255,255,0.75)',
        },
      }),
    [accentColor, active, borderRadius, glassTokens, rail, size, useGlassFrame],
  );

  const frameGradient = !useGlassFrame && !rail ? ACCENT_ICON_FRAME_GRADIENT : null;
  const showDecor = useGlassFrame && !rail;

  return (
    <View style={styles.root}>
      {frameGradient ? (
        <LinearGradient
          colors={[...frameGradient]}
          start={{ x: 0.12, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {showDecor ? <View style={styles.nebula} pointerEvents="none" /> : null}
      <View style={styles.stage}>{children}</View>
      {showDecor ? <View style={styles.star} pointerEvents="none" /> : null}
    </View>
  );
}
