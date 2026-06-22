import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { withAlpha } from '@/design/tokens/motion';

export type SpaceIconFrame = 'card' | 'rail';

type SpaceIconShellProps = {
  accentColor: string;
  size: number;
  children: ReactNode;
  active?: boolean;
  borderRadius?: number;
  /** `rail` = runder Deep-Space-Hintergrund, kein Kasten, kein Nebula-Dekor. */
  frame?: SpaceIconFrame;
};

const webGlow = (
  color: string,
  active: boolean,
  size: number,
  rail: boolean,
  lightRail: boolean,
): ViewStyle | null =>
  Platform.OS === 'web'
    ? ({
        boxShadow: lightRail
          ? active
            ? `0 0 ${Math.round(size * 0.45)}px ${withAlpha(color, 0.55)}`
            : `0 0 ${Math.round(size * 0.28)}px ${withAlpha(color, 0.28)}`
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
  const lightRail = rail && isLight;
  const lightCard = !rail && isLight;

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
          borderWidth: lightRail || lightCard ? 1 : rail ? 0 : 1,
          borderColor: lightRail
            ? withAlpha(accentColor, active ? 0.55 : 0.32)
            : lightCard
              ? withAlpha(accentColor, active ? 0.48 : 0.28)
              : rail
                ? 'transparent'
                : withAlpha(accentColor, active ? 0.95 : 0.42),
          backgroundColor: lightRail
            ? withAlpha(accentColor, active ? 0.24 : 0.12)
            : lightCard
              ? withAlpha(accentColor, active ? 0.18 : 0.1)
              : 'transparent',
          ...(webGlow(accentColor, active, size, rail, lightRail) ?? {}),
          transform: active ? [{ scale: rail ? 1.08 : 1.04 }] : [{ scale: 1 }],
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
    [accentColor, active, borderRadius, lightCard, lightRail, rail, size],
  );

  const frameGradient = lightRail || lightCard
    ? null
    : (['#030711', '#101833', '#07101F'] as const);

  return (
    <View style={styles.root}>
      {frameGradient ? (
        <LinearGradient
          colors={frameGradient}
          start={{ x: 0.12, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {!rail && !lightRail && !lightCard ? <View style={styles.nebula} pointerEvents="none" /> : null}
      <View style={styles.stage}>{children}</View>
      {!rail && !lightRail && !lightCard ? <View style={styles.star} pointerEvents="none" /> : null}
    </View>
  );
}
