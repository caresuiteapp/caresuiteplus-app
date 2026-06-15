/**
 * CareSuite+ — Typography scale (WP 025–026).
 * Display- und Hero-Varianten für Premium-Überschriften.
 */
import type { TextStyle } from 'react-native';
import { colors } from './colors';

export const typographyScale = {
  display: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.8,
  } as TextStyle,
  displayCompact: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.6,
  } as TextStyle,
  hero: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  } as TextStyle,
  heroMuted: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: -0.4,
  } as TextStyle,
} as const;
