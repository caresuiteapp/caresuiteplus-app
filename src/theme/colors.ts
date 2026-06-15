/**
 * CareSuite+ Design System — Premium Dark SaaS (legacy @/theme surface).
 * Dark values are sourced from careSuiteColors; use ThemeModeProvider + tokens for light mode.
 */
import { legacyColorsFromPalette } from '@/design/tokens/themeBridge';

/** Default export — light palette (demo default via ThemeModeProvider). */
export const colors = legacyColorsFromPalette('light');

/** Dark palette for explicit legacy/dark-mode surfaces. */
export const darkColors = legacyColorsFromPalette('dark');

/** @deprecated Use darkColors */
export const lightColors = legacyColorsFromPalette('light');
