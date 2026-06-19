import { ReactNode, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { designTokens } from '@/theme';

type CareLightListHeroFrameProps = {
  children: ReactNode;
  style?: ViewStyle;
  accentColor?: string;
};

/** List/detail hero — light surface on mobile, glass panel on dark PlatformShell. */
export function CareLightListHeroFrame({
  children,
  style,
  accentColor = careLightColors.orange,
}: CareLightListHeroFrameProps) {
  const { isDark } = useCareLightPalette();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          borderRadius: careRadius.lg,
          borderWidth: 1,
          borderColor: isDark ? designTokens.glass.border : careLightColors.border,
          borderLeftWidth: 3,
          borderLeftColor: accentColor,
          backgroundColor: isDark ? designTokens.glass.background : careLightColors.surface,
          overflow: 'hidden',
          marginBottom: careSpacing.md,
          shadowColor: isDark ? '#000000' : careLightColors.navy,
          shadowOpacity: isDark ? 0.28 : 0.05,
          shadowRadius: isDark ? 14 : 10,
          shadowOffset: { width: 0, height: isDark ? 6 : 3 },
          elevation: isDark ? 8 : 2,
        },
        gradient: {
          ...StyleSheet.absoluteFillObject,
        },
        sheenLine: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: designTokens.sheen.height,
          backgroundColor: designTokens.sheen.color,
        },
        content: {
          padding: careSpacing.md,
          gap: careSpacing.sm,
        },
      }),
    [accentColor, isDark],
  );

  if (isDark) {
    return (
      <View style={[styles.wrapper, style]}>
        <LinearGradient
          colors={[...designTokens.hero.gradient]}
          start={designTokens.hero.gradientStart}
          end={designTokens.hero.gradientEnd}
          style={styles.gradient}
        />
        <View style={styles.sheenLine} />
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.content}>{children}</View>
    </View>
  );
}
