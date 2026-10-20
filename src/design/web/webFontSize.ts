import { Platform, type TextStyle } from 'react-native';

/** CSS custom property set by WebFontScaleProvider on :root. */
export const WEB_FONT_SCALE_CSS_VAR = 'var(--app-font-scale, 1)';

/**
 * Web-only: returns a CSS calc() expression so font metrics scale with --app-font-scale.
 * Native: returns the base px value unchanged.
 */
export function webScaledFontMetric(px: number): number {
  if (Platform.OS !== 'web') return px;
  // RN Web passes fontSize/lineHeight to the DOM; calc() reacts to --app-font-scale updates.
  return `calc(${px}px * ${WEB_FONT_SCALE_CSS_VAR})` as unknown as number;
}

/** Applies web font scaling to fontSize and lineHeight on a text style object. */
export function applyWebFontScaleToTextStyle(style: TextStyle): TextStyle {
  if (Platform.OS !== 'web') return style;

  const next: TextStyle = { ...style };
  if (typeof next.fontSize === 'number') {
    next.fontSize = webScaledFontMetric(next.fontSize);
  }
  if (typeof next.lineHeight === 'number') {
    next.lineHeight = webScaledFontMetric(next.lineHeight);
  }
  return next;
}
