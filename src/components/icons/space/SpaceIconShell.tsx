import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import {
  ACCENT_ICON_FRAME_GRADIENT,
  RAIL_ICON_GLASS_DARK,
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
  const glowSpread = Math.round(size * (active ? 0.42 : 0.3));
  const glowAlpha = active ? 0.52 : 0.34;
  return {
    backdropFilter: `blur(${blurPx}px) saturate(1.35)`,
    WebkitBackdropFilter: `blur(${blurPx}px) saturate(1.35)`,
    boxShadow: active
      ? `0 0 ${glowSpread}px ${withAlpha(accentColor, glowAlpha)}, 0 4px 14px rgba(15,23,42,0.22), inset 0 1px 0 rgba(255,255,255,0.55)`
      : `0 0 ${glowSpread}px ${withAlpha(accentColor, glowAlpha)}, 0 2px 10px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.45)`,
  } as ViewStyle;
}

const webGlow = (
  color: string,
  active: boolean,
  size: number,
  rail: boolean,
  darkSoftBacking: boolean,
): ViewStyle | null =>
  Platform.OS === 'web'
    ? ({
        boxShadow: darkSoftBacking
          ? active
            ? `0 0 ${Math.round(size * 0.45)}px ${withAlpha(color, 0.55)}, 0 4px 12px rgba(15,23,42,0.35)`
            : `0 0 ${Math.round(size * 0.32)}px ${withAlpha(color, 0.38)}, 0 2px 8px rgba(15,23,42,0.28)`
          : rail
            ? active
              ? `0 0 ${Math.round(size * 0.55)}px ${withAlpha(color, 0.7)}`
              : `0 0 ${Math.round(size * 0.4)}px ${withAlpha(color, 0.4)}`
            : active
              ? `0 0 ${Math.round(size * 0.5)}px ${withAlpha(color, 0.65)}, 0 6px 18px rgba(0,0,0,0.45)`
              : `0 0 ${Math.round(size * 0.35)}px ${withAlpha(color, 0.45)}, 0 3px 10px rgba(0,0,0,0.35)`,
      } as ViewStyle)
    : null;

/** Shared deep-space frame for all Space-3D icons. */
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
  const darkSoftBacking = isLight && !rail;
  const railGlass = rail;
  const railGlassTokens = isLight ? RAIL_ICON_GLASS_LIGHT : RAIL_ICON_GLASS_DARK;

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
          borderWidth: railGlass || darkSoftBacking ? 1 : rail ? 0 : 1,
          borderColor: railGlass
            ? active
              ? accentDarkSoftBorder(accentColor, true)
              : railGlassTokens.border
            : darkSoftBacking
              ? accentDarkSoftBorder(accentColor, active)
              : rail
                ? 'transparent'
                : withAlpha(accentColor, active ? 0.95 : 0.42),
          backgroundColor: railGlass
            ? active
              ? railGlassTokens.surfaceActive
              : railGlassTokens.surface
            : 'transparent',
          ...(railGlass
            ? (railGlassWebFx(active, railGlassTokens.blurPx, accentColor, size) ?? {})
            : (webGlow(accentColor, active, size, rail, darkSoftBacking) ?? {})),
          transform: active ? [{ scale: rail ? 1.08 : 1.04 }] : [{ scale: 1 }],
        },
        railDarkTint: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: isLight
            ? active
              ? RAIL_ICON_GLASS_LIGHT.darkTintActive
              : RAIL_ICON_GLASS_LIGHT.darkTint
            : active
              ? RAIL_ICON_GLASS_DARK.sheenActive
              : RAIL_ICON_GLASS_DARK.sheen,
        },
        nebula: {
          position: 'absolute',
          top: -size * 0.22,
          right: -size * 0.18,
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: size,
          backgroundColor: withAlpha(accentColor, active ? 0.32 : 0.2),
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
    [accentColor, active, borderRadius, darkSoftBacking, isLight, rail, railGlass, railGlassTokens, size],
  );

  const frameGradient = !rail ? ACCENT_ICON_FRAME_GRADIENT : null;
  const showDecor = !rail && (darkSoftBacking || !isLight);

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
      {railGlass ? <View style={styles.railDarkTint} pointerEvents="none" /> : null}
      {showDecor ? <View style={styles.nebula} pointerEvents="none" /> : null}
      <View style={styles.stage}>{children}</View>
      {showDecor ? <View style={styles.star} pointerEvents="none" /> : null}
    </View>
  );
}
