/**
 * CareSuite HealthOS Liquid Command compatibility palette.
 *
 * Existing productive workflows still import @/theme from light Office
 * working surfaces. The default compatibility palette therefore has to be
 * dark ink on light surfaces. Explicit dark shell regions use darkColors or
 * the systemLiquidGlass tokens.
 */
import { legacyColorsFromPalette } from '@/design/tokens/themeBridge';

/** Default export — readable ink and surfaces for the light workspace. */
export const colors = legacyColorsFromPalette('light');

/** Dark palette for explicit legacy/dark-mode surfaces. */
export const darkColors = legacyColorsFromPalette('dark');

/** Explicit light compatibility palette. */
export const lightColors = legacyColorsFromPalette('light');
