/**
 * CareSuite HealthOS Liquid Command compatibility palette.
 *
 * Existing productive workflows may still import @/theme while their visual
 * primitives are migrated. They must resolve to the same three-colour dark
 * HealthOS language and may never reintroduce the former light ERP surface.
 */
import { legacyColorsFromPalette } from '@/design/tokens/themeBridge';

/** Default export — canonical dark Liquid Command palette. */
export const colors = legacyColorsFromPalette('dark');

/** Dark palette for explicit legacy/dark-mode surfaces. */
export const darkColors = legacyColorsFromPalette('dark');

/** Compatibility alias — the system uses one visual language. */
export const lightColors = legacyColorsFromPalette('dark');
