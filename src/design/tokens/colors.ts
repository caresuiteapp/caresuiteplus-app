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
      primary: '#07122A',
      secondary: '#475569',
      muted: '#64748B',
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
      akademie: '#F59E0B',
      qm: '#14B8A6',
      insight: '#2563EB',
    },
  },
  dark: {
    background: {
      app: '#08111F',
      soft: '#0B1026',
      elevated: '#101827',
      dark: '#050816',
      darkElevated: '#0B1026',
    },
    brand: {
      navy: '#08111F',
      orange: '#FF6B1A',
      gold: '#FFB347',
      cyan: '#22D3EE',
      violet: '#8B5CF6',
    },
    text: {
      primary: '#F8FAFC',
      secondary: '#CBD5E1',
      muted: '#94A3B8',
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
      akademie: '#F59E0B',
      qm: '#14B8A6',
      insight: '#2563EB',
    },
  },
} as const;

export type ColorMode = keyof typeof careSuiteColors;

export function resolveCareSuitePalette(mode: ColorMode = 'dark') {
  return careSuiteColors[mode];
}
