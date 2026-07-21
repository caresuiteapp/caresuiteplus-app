/**
 * CareSuite+ Design System — canonical light surface for legacy @/theme imports.
 */
import { legacyColorsFromPalette } from '@/design/tokens/themeBridge';

/** Default export — canonical light Liquid Glass palette. */
export const colors = legacyColorsFromPalette('light');

/** Dark palette for explicit legacy/dark-mode surfaces. */
export const darkColors = legacyColorsFromPalette('light');

/** Compatibility alias — the system uses one visual language. */
export const lightColors = legacyColorsFromPalette('light');
