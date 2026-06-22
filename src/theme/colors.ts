/**
 * CareSuite+ Design System — Premium Dark SaaS (legacy @/theme surface).
 * Dark values are sourced from careSuiteColors; use ThemeModeProvider + tokens for light mode.
 */
import { legacyColorsFromPalette } from '@/design/tokens/themeBridge';

/** Default export — dark palette (GlobalAnimatedBackground / aurora shell). */
export const colors = legacyColorsFromPalette('dark');

/** Dark palette for explicit legacy/dark-mode surfaces. */
export const darkColors = legacyColorsFromPalette('dark');

/** @deprecated Use darkColors */
export const lightColors = legacyColorsFromPalette('light');
