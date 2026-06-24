import type { TextStyle } from 'react-native';
import { webScaledFontMetric } from '@/design/web/webFontSize';
import { resolveResponsiveValue, type ResponsiveValueMap } from './responsiveValue';
import { galaxyPalette } from './galaxy';

type SizePair = { fontSize: number; lineHeight: number };

const h1Sizes: ResponsiveValueMap<SizePair> = {
  phone: { fontSize: 26, lineHeight: 32 },
  tablet: { fontSize: 30, lineHeight: 36 },
  desktop: { fontSize: 32, lineHeight: 38 },
  wide: { fontSize: 34, lineHeight: 40 },
};

const h2Sizes: ResponsiveValueMap<SizePair> = {
  phone: { fontSize: 22, lineHeight: 28 },
  tablet: { fontSize: 24, lineHeight: 30 },
  desktop: { fontSize: 26, lineHeight: 32 },
  wide: { fontSize: 28, lineHeight: 34 },
};

const cardTitleSizes: ResponsiveValueMap<SizePair> = {
  phone: { fontSize: 17, lineHeight: 22 },
  tablet: { fontSize: 18, lineHeight: 24 },
  desktop: { fontSize: 19, lineHeight: 24 },
  wide: { fontSize: 20, lineHeight: 26 },
};

/** Responsive heading styles — avoids mid-word breaks via sane line heights, no wide letterSpacing. */
export function resolveGalaxyTypography(width: number) {
  const size = webScaledFontMetric;
  const h1 = resolveResponsiveValue(width, h1Sizes);
  const h2 = resolveResponsiveValue(width, h2Sizes);
  const cardTitle = resolveResponsiveValue(width, cardTitleSizes);

  return {
    h1: {
      fontSize: size(h1.fontSize),
      lineHeight: size(h1.lineHeight),
      fontWeight: '800',
      color: galaxyPalette.textPrimary,
    } as TextStyle,
    h2: {
      fontSize: size(h2.fontSize),
      lineHeight: size(h2.lineHeight),
      fontWeight: '700',
      color: galaxyPalette.textPrimary,
    } as TextStyle,
    cardTitle: {
      fontSize: size(cardTitle.fontSize),
      lineHeight: size(cardTitle.lineHeight),
      fontWeight: '600',
      color: galaxyPalette.textPrimary,
    } as TextStyle,
    body: {
      fontSize: size(15),
      lineHeight: size(22),
      fontWeight: '400',
      color: galaxyPalette.textSecondary,
    } as TextStyle,
    bodyStrong: {
      fontSize: size(15),
      lineHeight: size(22),
      fontWeight: '600',
      color: galaxyPalette.textPrimary,
    } as TextStyle,
    label: {
      fontSize: size(12),
      lineHeight: size(16),
      fontWeight: '600',
      color: galaxyPalette.textSecondary,
    } as TextStyle,
    button: {
      fontSize: size(16),
      lineHeight: size(22),
      fontWeight: '600',
      color: galaxyPalette.textPrimary,
    } as TextStyle,
    caption: {
      fontSize: size(13),
      lineHeight: size(18),
      fontWeight: '400',
      color: galaxyPalette.textMuted,
    } as TextStyle,
    eyebrow: {
      fontSize: size(11),
      lineHeight: size(14),
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase' as const,
      color: galaxyPalette.galaxyCyan,
    } as TextStyle,
  };
}

/** Shared text props that prevent awkward breaks inside cards. */
export const noBreakTextProps = {
  flexShrink: 1,
  minWidth: 0,
} as const;
