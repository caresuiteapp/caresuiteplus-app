/**
 * CareSuite+ Adaptive Design System — brand colors (light + dark).
 */
export const careSuiteColors = {
  light: {
    background: {
      app: '#F8FAFC',
      soft: '#FFFFFF',
      elevated: '#FFFFFF',
      dark: '#050816',
      darkElevated: '#0B1024',
    },
    brand: {
      navy: '#07122A',
      orange: '#FF7A1A',
      gold: '#FFB347',
      cyan: '#35D7FF',
      violet: '#8B7CFF',
    },
    text: {
      primary: '#0F1B33',
      secondary: '#334155',
      muted: '#475569',
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
      app: '#080D1A',
      soft: '#101827',
      elevated: '#171B22',
      dark: '#050816',
      darkElevated: '#0B1024',
    },
    brand: {
      navy: '#07122A',
      orange: '#FF9500',
      gold: '#FFD166',
      cyan: '#62F3FF',
      violet: '#7C5CFF',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#C6CEDB',
      muted: '#8B95A7',
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
