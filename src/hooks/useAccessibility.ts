import { useMemo } from 'react';
import { PixelRatio, useWindowDimensions } from 'react-native';
import {
  accessibility,
  buttonHeights,
  getFontScaleTier,
  minTouchHeight,
  scaleFontSize,
  type FontScaleTier,
} from '@/theme/accessibility';

export function useAccessibility() {
  const { fontScale: windowFontScale } = useWindowDimensions();
  const fontScale = windowFontScale ?? PixelRatio.getFontScale();

  return useMemo(
    () => ({
      fontScale,
      fontScaleTier: getFontScaleTier(fontScale) as FontScaleTier,
      minTouchSize: accessibility.minTouchSize,
      buttonHeights,
      scaleFontSize: (baseSize: number, maxScale?: number) =>
        scaleFontSize(baseSize, fontScale, maxScale),
      minTouchHeight,
    }),
    [fontScale],
  );
}
