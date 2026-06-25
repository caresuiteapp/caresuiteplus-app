import { ReactNode, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  lightLiquidGlassWebFx,
  useAuroraGlassActive,
  useAuroraGlassCardStyle,
} from '@/design/tokens/auroraGlass';
import { careEffects } from '@/design/tokens/effects';
import { galaxyGlow, galaxyPalette } from '@/design/tokens/galaxy';
import { resolveLlganViewGlass } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { useLegacyTheme } from '@/design/tokens/themeBridge';

type GlassCardProps = {
  children: ReactNode;
  onPress?: () => void;
  glow?: boolean;
  accentColor?: string;
  selected?: boolean;
  style?: import('react-native').StyleProp<ViewStyle>;
};

/** Liquid-glass card — LLGAN milchglas on light aurora, dark galaxy glass otherwise. */
export function GlassCard({
  children,
  onPress,
  glow = false,
  accentColor,
  selected = false,
  style,
}: GlassCardProps) {
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const auroraCardStyle = useAuroraGlassCardStyle({ viewContext: 'login', intensity: 'strong' });
  const loginGlass = resolveLlganViewGlass('login', 'strong');
  const useLightGlass = auroraActive && isLight;

  const borderColor = selected
    ? accentColor ?? galaxyPalette.careOrange
    : useLightGlass
      ? loginGlass.borderWhite
      : careEffects.glass.border;

  const glowStyle: ViewStyle | null = useLightGlass ? null : (galaxyGlow.cyan as ViewStyle);
  const selectedStyle: ViewStyle | null = useLightGlass ? null : (galaxyGlow.orange as ViewStyle);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: careRadius.lg,
          borderWidth: 1,
          overflow: 'hidden',
          padding: careSpacing.md,
        },
        cardDark: {
          backgroundColor: galaxyPalette.cardGlass,
        },
        accentRim: {
          borderLeftWidth: 3,
        },
        content: {
          position: 'relative',
          gap: careSpacing.sm,
        },
        pressed: {
          opacity: 0.92,
        },
      }),
    [useLightGlass],
  );

  const inner = (
    <View
      style={[
        styles.card,
        useLightGlass ? auroraCardStyle : styles.cardDark,
        glow && !useLightGlass ? glowStyle : null,
        selected && !useLightGlass ? selectedStyle : null,
        { borderColor },
        accentColor && !selected ? { ...styles.accentRim, borderLeftColor: accentColor } : null,
        style,
      ]}
    >
      {!useLightGlass ? (
        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      {useLightGlass && Platform.OS === 'web' ? (
        <View
          style={
            {
              ...StyleSheet.absoluteFillObject,
              ...lightLiquidGlassWebFx(loginGlass.blurDesktop, loginGlass.saturate),
              boxShadow: `${loginGlass.shadow}, ${loginGlass.shadowInset}`,
            } as ViewStyle
          }
          pointerEvents="none"
        />
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => (pressed ? styles.pressed : undefined) as ViewStyle | undefined}
    >
      {inner}
    </Pressable>
  );
}
