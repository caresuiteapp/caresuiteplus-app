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
import { glassFx, withAlpha } from '@/design/tokens/motion';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { sheen as sheenTokens } from '@/theme';

type GlassCardProps = {
  children: ReactNode;
  onPress?: () => void;
  glow?: boolean;
  accentColor?: string;
  selected?: boolean;
  style?: import('react-native').StyleProp<ViewStyle>;
};

const LIGHT_SHEEN = ['rgba(255,255,255,0.46)', 'rgba(255,255,255,0.14)', 'transparent'] as const;

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
  const portalGlass = resolveLlganViewGlass('dashboard', 'strong');
  const useLightGlass = auroraActive && isLight;

  const borderColor = selected
    ? accentColor ?? galaxyPalette.careOrange
    : accentColor
      ? accentColor
      : useLightGlass
        ? loginGlass.borderWhite
        : careEffects.glass.border;

  const borderWidth = accentColor ? 2 : 1;

  const glowStyle: ViewStyle | null = useLightGlass ? null : (galaxyGlow.cyan as ViewStyle);
  const selectedStyle: ViewStyle | null = useLightGlass ? null : (galaxyGlow.orange as ViewStyle);

  const lightGlassSurface = useMemo((): ViewStyle => {
    if (!useLightGlass) return {};

    const fill = accentColor ? portalGlass.card : loginGlass.card;
    const blur = accentColor ? portalGlass.blurDesktop : loginGlass.blurDesktop;
    const saturate = accentColor ? portalGlass.saturate : loginGlass.saturate;
    const baseShadow = accentColor ? portalGlass.shadow : loginGlass.shadow;
    const insetShadow = accentColor ? portalGlass.shadowInset : loginGlass.shadowInset;
    const accentGlow = accentColor
      ? `, 0 10px 36px ${withAlpha(accentColor, 0.22)}`
      : '';

    return {
      ...auroraCardStyle,
      backgroundColor: fill,
      ...(Platform.OS === 'web'
        ? {
            ...lightLiquidGlassWebFx(blur, saturate),
            boxShadow: `${baseShadow}, ${insetShadow}${accentGlow}`,
          }
        : null),
    };
  }, [accentColor, auroraCardStyle, loginGlass, portalGlass, useLightGlass]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        shadowHost: {
          borderRadius: careRadius.lg,
          shadowColor: accentColor ?? 'rgba(70,110,170,0.18)',
          shadowOffset: { width: 0, height: accentColor ? 10 : 12 },
          shadowOpacity: accentColor ? 0.3 : 0.2,
          shadowRadius: accentColor ? 22 : 16,
          elevation: accentColor ? 10 : 8,
        },
        card: {
          borderRadius: careRadius.lg,
          borderWidth: 1,
          overflow: 'hidden',
          padding: careSpacing.md,
        },
        cardDark: {
          backgroundColor: galaxyPalette.cardGlass,
        },
        innerBorder: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: careRadius.lg,
          borderWidth: 1,
          borderColor: useLightGlass ? 'rgba(255,255,255,0.54)' : glassFx.innerBorder,
        },
        sheenOverlay: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '48%',
          borderTopLeftRadius: careRadius.lg,
          borderTopRightRadius: careRadius.lg,
        },
        content: {
          position: 'relative',
          gap: careSpacing.sm,
        },
        pressed: {
          opacity: 0.92,
        },
      }),
    [accentColor, useLightGlass],
  );

  const cardBody = (
    <View
      style={[
        styles.card,
        useLightGlass ? lightGlassSurface : styles.cardDark,
        glow && !useLightGlass ? glowStyle : null,
        selected && !useLightGlass ? selectedStyle : null,
        { borderColor, borderWidth },
        style,
      ]}
    >
      {!useLightGlass ? (
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      ) : (
        <LinearGradient
          colors={[...LIGHT_SHEEN]}
          start={sheenTokens.gradientStart}
          end={sheenTokens.gradientEnd}
          style={styles.sheenOverlay}
          pointerEvents="none"
        />
      )}
      {!useLightGlass ? (
        <LinearGradient
          colors={glassFx.sheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.55 }}
          style={styles.sheenOverlay}
          pointerEvents="none"
        />
      ) : null}
      <View style={styles.innerBorder} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );

  const inner = <View style={styles.shadowHost}>{cardBody}</View>;

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
