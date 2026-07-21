/** CareSuite HealthOS — system-wide three-colour Liquid Glass palette. */
import { SYSTEM_LIQUID_COLORS, systemLiquidGlass } from './systemLiquidGlass';

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
    orange: SYSTEM_LIQUID_COLORS.electricBlue,
    gold: SYSTEM_LIQUID_COLORS.electricBlue,
    cyan: SYSTEM_LIQUID_COLORS.electricBlue,
    violet: SYSTEM_LIQUID_COLORS.electricBlue,
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
    office: SYSTEM_LIQUID_COLORS.electricBlue,
    assist: SYSTEM_LIQUID_COLORS.electricBlue,
    pflege: SYSTEM_LIQUID_COLORS.electricBlue,
    beratung: SYSTEM_LIQUID_COLORS.electricBlue,
    stationaer: SYSTEM_LIQUID_COLORS.electricBlue,
    akademie: SYSTEM_LIQUID_COLORS.electricBlue,
    qm: SYSTEM_LIQUID_COLORS.electricBlue,
    insight: SYSTEM_LIQUID_COLORS.electricBlue,
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
