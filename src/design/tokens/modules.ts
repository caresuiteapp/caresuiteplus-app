import { careSuiteColors, type ColorMode } from './colors';

function moduleColorsForMode(mode: ColorMode) {
  return careSuiteColors[mode].module;
}

export { moduleColorsForMode };

export const careModuleTokens = {
  office: {
    key: 'office',
    label: 'Office',
    color: moduleColorsForMode('light').office,
    icon: '🏢',
  },
  assist: {
    key: 'assist',
    label: 'Assist',
    color: moduleColorsForMode('light').assist,
    icon: '🚗',
  },
  pflege: {
    key: 'pflege',
    label: 'Pflege',
    color: moduleColorsForMode('light').pflege,
    icon: '💚',
  },
  beratung: {
    key: 'beratung',
    label: 'Beratung',
    color: moduleColorsForMode('light').beratung,
    icon: '📋',
  },
  stationaer: {
    key: 'stationaer',
    label: 'Stationär',
    color: moduleColorsForMode('light').stationaer,
    icon: '🏥',
  },
  akademie: {
    key: 'akademie',
    label: 'Akademie',
    color: moduleColorsForMode('light').akademie,
    icon: '🎓',
  },
  qm: {
    key: 'qm',
    label: 'QM',
    color: moduleColorsForMode('light').qm,
    icon: '✅',
  },
  insight: {
    key: 'insight',
    label: 'InsightCenter',
    color: moduleColorsForMode('light').insight,
    icon: '📊',
  },
} as const;

export type CareModuleKey = keyof typeof careModuleTokens;

export function moduleColor(key: CareModuleKey, mode: ColorMode = 'dark'): string {
  return moduleColorsForMode(mode)[key];
}
