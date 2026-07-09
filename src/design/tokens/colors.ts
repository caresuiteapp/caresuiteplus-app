/**
 * CareSuite+ Adaptive Design System — brand colors (light + dark).
 */
export const careSuiteColors = {
  light: {
    background: {
      app: '#F8FAFC',
      soft: '#FFFFFF',
      elevated: '#FFFFFF',
      dark: '#F1F5F9',
      darkElevated: '#E2E8F0',
    },
    brand: {
      navy: '#07122A',
      orange: '#FF7A1A',
      gold: '#FFB347',
      cyan: '#35D7FF',
      violet: '#8B7CFF',
    },
    text: {
      primary: '#000000',
      secondary: '#000000',
      muted: '#000000',
      inverse: '#F8FAFC',
    },
    status: {
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#0EA5E9',
    },
    module: {
      office: '#FF7A1A',
      assist: '#0EA5E9',
      pflege: '#22C55E',
      beratung: '#8B5CF6',
      stationaer: '#EF4444',
      akademie: '#FACC15',
      qm: '#14B8A6',
      insight: '#2563EB',
    },
  },
  dark: {
    background: {
      app: '#F8FAFC',
      soft: '#FFFFFF',
      elevated: '#FFFFFF',
      dark: '#F1F5F9',
      darkElevated: '#E2E8F0',
    },
    brand: {
      navy: '#07122A',
      orange: '#FF9500',
      gold: '#FFD166',
      cyan: '#62F3FF',
      violet: '#7C5CFF',
    },
    text: {
      primary: '#000000',
      secondary: '#000000',
      muted: '#000000',
      inverse: '#07122A',
    },
    status: {
      success: '#22C55E',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#38BDF8',
    },
    module: {
      office: '#FF9500',
      assist: '#62F3FF',
      pflege: '#22C55E',
      beratung: '#8B5CF6',
      stationaer: '#EF4444',
      akademie: '#FFEB3B',
      qm: '#14B8A6',
      insight: '#2563EB',
    },
  },
} as const;

export type ColorMode = keyof typeof careSuiteColors;

export function resolveCareSuitePalette(mode: ColorMode = 'dark') {
  return careSuiteColors[mode];
}
