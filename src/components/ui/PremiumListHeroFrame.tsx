import { useThemeMode } from '@/design/ThemeModeProvider';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { CareLightListHeroFrame } from './CareLightListHeroFrame';
import { designTokens, radius, sheen, spacing } from '@/theme';

type PremiumListHeroFrameProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  accentColor?: string;
};

/** Shared hero shell — light CareLight in demo default, dark Premium in explicit dark mode. */
export function PremiumListHeroFrame({ children, style, accentColor }: PremiumListHeroFrameProps) {
  const { mode } = useThemeMode();

  if (mode === 'light') {
    return (
      <CareLightListHeroFrame style={style} accentColor={accentColor}>
        {children}
      </CareLightListHeroFrame>
    );
  }

  return <DarkPremiumListHeroFrame style={style}>{children}</DarkPremiumListHeroFrame>;
}

function DarkPremiumListHeroFrame({ children, style }: PremiumListHeroFrameProps) {
  const { colors, gradients } = useLegacyTheme();
  const styles = StyleSheet.create({
    wrapper: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    gradient: {
      ...StyleSheet.absoluteFillObject,
    },
    sheenLine: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: sheen.height,
      backgroundColor: sheen.color,
    },
    content: {
      padding: spacing.md,
      gap: spacing.sm,
    },
  });

  return (
    <View style={[styles.wrapper, style]}>
      <LinearGradient
        colors={[...gradients.hero.list]}
        start={designTokens.hero.gradientStart}
        end={designTokens.hero.gradientEnd}
        style={styles.gradient}
      />
      <View style={styles.sheenLine} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}
