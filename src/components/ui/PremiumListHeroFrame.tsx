import { useThemeMode } from '@/design/ThemeModeProvider';
import { ListHeroSurfaceContext } from '@/design/tokens/listHeroSurfaceContext';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { withAlpha } from '@/design/tokens/motion';
import { auroraHeroWrapperStyle, auroraSharedStyles, AURORA_HERO_COLORS } from '@/components/aurora/auroraShared';
import { CareLightListHeroFrame } from './CareLightListHeroFrame';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { designTokens, spacing } from '@/theme';

type PremiumListHeroFrameProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  accentColor?: string;
};

/** Shared hero shell — aurora gradient on animated shells, plain light card elsewhere. */
export function PremiumListHeroFrame({ children, style, accentColor }: PremiumListHeroFrameProps) {
  const { mode } = useThemeMode();
  const shellHostsAurora = useShellHostsAurora();

  if (mode === 'light' && !shellHostsAurora) {
    return (
      <ListHeroSurfaceContext.Provider value="light">
        <CareLightListHeroFrame style={style} accentColor={accentColor}>
          {children}
        </CareLightListHeroFrame>
      </ListHeroSurfaceContext.Provider>
    );
  }

  return (
    <ListHeroSurfaceContext.Provider value="gradient">
      <AuroraPremiumListHeroFrame style={style}>{children}</AuroraPremiumListHeroFrame>
    </ListHeroSurfaceContext.Provider>
  );
}

function AuroraPremiumListHeroFrame({ children, style }: PremiumListHeroFrameProps) {
  const styles = StyleSheet.create({
    content: {
      padding: spacing.md,
      gap: spacing.sm,
    },
  });

  return (
    <View style={[auroraHeroWrapperStyle(), style]}>
      <LinearGradient
        colors={[...AURORA_HERO_COLORS]}
        start={designTokens.hero.gradientStart}
        end={designTokens.hero.gradientEnd}
        style={auroraSharedStyles.heroGradient}
      />
      <View style={auroraSharedStyles.heroOrbA} pointerEvents="none" />
      <View style={auroraSharedStyles.heroOrbB} pointerEvents="none" />
      <LinearGradient
        colors={[withAlpha('#FFFFFF', 0.22), 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={auroraSharedStyles.heroSheen}
        pointerEvents="none"
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}
