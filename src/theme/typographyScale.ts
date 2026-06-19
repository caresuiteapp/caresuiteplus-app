/**
 * CareSuite+ — Typography scale (WP 025–026).
 * Display- und Hero-Varianten für Premium-Überschriften.
 */
import type { TextStyle } from 'react-native';
import { webScaledFontMetric } from '@/design/web/webFontSize';
import { colors } from './colors';

const size = webScaledFontMetric;

export const typographyScale = {
  display: {
    fontSize: size(42),
    lineHeight: size(48),
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.8,
  } as TextStyle,
  displayCompact: {
    fontSize: size(36),
    lineHeight: size(42),
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.6,
  } as TextStyle,
  hero: {
    fontSize: size(34),
    lineHeight: size(40),
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  } as TextStyle,
  heroMuted: {
    fontSize: size(34),
    lineHeight: size(40),
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: -0.4,
  } as TextStyle,
} as const;
