/**
 * CareSuite+ Design System — Premium Dark SaaS (legacy @/theme surface).
 * Dark values are sourced from careSuiteColors; use ThemeModeProvider + tokens for light mode.
 */
import { legacyColorsFromPalette } from '@/design/tokens/themeBridge';

/** Default export — canonical dark Liquid Glass palette. */
export const colors = legacyColorsFromPalette('dark');

/** Dark palette for explicit legacy/dark-mode surfaces. */
export const darkColors = legacyColorsFromPalette('dark');

/** Compatibility alias — the system uses one visual language. */
export const lightColors = legacyColorsFromPalette('dark');
