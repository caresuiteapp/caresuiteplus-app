import { StyleSheet, type ViewStyle } from 'react-native';
import { neonGlow, withAlpha } from '@/design/tokens/motion';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import {
  AURORA_HERO_GRADIENT,
  careSuiteAuroraTheme,
} from '@/theme/careSuiteAurora';

export const AURORA_HERO_COLORS = AURORA_HERO_GRADIENT;

export function auroraHeroWrapperStyle(): ViewStyle {
  return {
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: withAlpha(careSuiteAuroraTheme.accent.pink, 0.35),
    overflow: 'hidden',
    marginBottom: careSpacing.md,
    ...neonGlow(careSuiteAuroraTheme.accent.pink, 0.35, 28, 16),
  };
}

export const auroraSharedStyles = StyleSheet.create({
  heroOrbA: {
    position: 'absolute',
    top: -60,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: withAlpha('#FFFFFF', 0.12),
  },
  heroOrbB: {
    position: 'absolute',
    bottom: -80,
    left: '30%',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: withAlpha(careSuiteAuroraTheme.accent.cyan, 0.22),
  },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  heroSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '52%',
  },
  heroContent: {
    padding: careSpacing.md,
    gap: careSpacing.sm,
  },
  glassSurface: {
    backgroundColor: careSuiteAuroraTheme.glass.backgroundStrong,
    borderColor: careSuiteAuroraTheme.glass.border,
    borderWidth: 1,
    borderRadius: careRadius.lg,
  },
});
