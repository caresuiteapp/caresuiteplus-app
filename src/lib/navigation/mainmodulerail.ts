import { moduleColor } from '@/design/tokens/modules';
import type { MainModuleRailItem } from '@/types/navigation/platform';

/** Fixed main-module rail — icons only, no detail navigation. */
export const MAIN_MODULE_RAIL: readonly MainModuleRailItem[] = [
  {
    key: 'zentrale',
    label: 'Zentrale',
    icon: '🏠',
    path: '/business',
    accentColor: moduleColor('insight'),
  },
  {
    key: 'office',
    label: 'Office',
    icon: '🏢',
    path: '/office',
    accentColor: moduleColor('office'),
  },
  {
    key: 'assist',
    label: 'Assist',
    icon: '🤝',
    path: '/assist',
    accentColor: moduleColor('assist'),
  },
  {
    key: 'pflege',
    label: 'Pflege',
    icon: '💊',
    path: '/pflege',
    accentColor: moduleColor('pflege'),
  },
  {
    key: 'stationaer',
    label: 'Stationär',
    icon: '🏥',
    path: '/stationaer',
    accentColor: moduleColor('stationaer'),
  },
  {
    key: 'beratung',
    label: 'Beratung',
    icon: '💬',
    path: '/beratung',
    accentColor: moduleColor('beratung'),
  },
  {
    key: 'akademie',
    label: 'Akademie',
    icon: '🎓',
    path: '/akademie',
    accentColor: moduleColor('akademie'),
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: '⚙️',
    path: '/settings',
    accentColor: '#94A3B8',
  },
] as const;
