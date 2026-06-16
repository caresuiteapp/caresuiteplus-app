import type { TextStyle } from 'react-native';
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
  const h1 = resolveResponsiveValue(width, h1Sizes);
  const h2 = resolveResponsiveValue(width, h2Sizes);
  const cardTitle = resolveResponsiveValue(width, cardTitleSizes);

  return {
    h1: {
      fontSize: h1.fontSize,
      lineHeight: h1.lineHeight,
      fontWeight: '800',
      color: galaxyPalette.textPrimary,
    } as TextStyle,
    h2: {
      fontSize: h2.fontSize,
      lineHeight: h2.lineHeight,
      fontWeight: '700',
      color: galaxyPalette.textPrimary,
    } as TextStyle,
    cardTitle: {
      fontSize: cardTitle.fontSize,
      lineHeight: cardTitle.lineHeight,
      fontWeight: '600',
      color: galaxyPalette.textPrimary,
    } as TextStyle,
    body: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400',
      color: galaxyPalette.textSecondary,
    } as TextStyle,
    label: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      color: galaxyPalette.textSecondary,
    } as TextStyle,
    button: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600',
      color: galaxyPalette.textPrimary,
    } as TextStyle,
    caption: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400',
      color: galaxyPalette.textMuted,
    } as TextStyle,
    eyebrow: {
      fontSize: 11,
      lineHeight: 14,
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
