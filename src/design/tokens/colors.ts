/** CareSuite HealthOS — system-wide three-colour Liquid Glass palette. */
import { SYSTEM_LIQUID_COLORS, systemLiquidGlass } from './systemLiquidGlass';
import { spatialModuleAccents } from './spatialCareSuite';

const systemPalette = {
  background: {
    app: systemLiquidGlass.page,
    soft: systemLiquidGlass.panel,
    elevated: systemLiquidGlass.card,
    dark: systemLiquidGlass.pageDeep,
    darkElevated: systemLiquidGlass.pageElevated,
  },
  brand: {
    navy: SYSTEM_LIQUID_COLORS.navy,
    orange: spatialModuleAccents.office,
    gold: spatialModuleAccents.akademie,
    cyan: spatialModuleAccents.assist,
    violet: spatialModuleAccents.beratung,
  },
  text: {
    primary: systemLiquidGlass.text.primary,
    secondary: systemLiquidGlass.text.secondary,
    muted: systemLiquidGlass.text.muted,
    inverse: SYSTEM_LIQUID_COLORS.navy,
  },
  status: {
    success: '#39D98A',
    warning: '#FFBF47',
    danger: '#FF5D6C',
    info: SYSTEM_LIQUID_COLORS.electricBlue,
  },
  module: {
    ...spatialModuleAccents,
  },
} as const;

export const careSuiteColors = {
  light: systemPalette,
  dark: systemPalette,
} as const;

export type ColorMode = keyof typeof careSuiteColors;

export function resolveCareSuitePalette(mode: ColorMode = 'dark') {
  return careSuiteColors[mode];
}
