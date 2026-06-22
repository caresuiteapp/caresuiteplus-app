import type { NavigationEntry } from '@/types/navigation/routes';
import type { ProductKey, RoleKey } from '@/types';

export const MODULE_NAV_CONFIG: Record<
  ProductKey,
  { icon: string; description: string; accentColor: string; path: string }
> = {
  office: {
    icon: '🏢',
    description: 'Verwaltung, Klient:innen, Rechnungen',
    accentColor: '#FF9500',
    path: '/office',
  },
  assist: {
    icon: '🤝',
    description: 'Alltagsbegleitung und Einsätze',
    accentColor: '#FFB020',
    path: '/assist',
  },
  pflege: {
    icon: '💊',
    description: 'Pflegeplanung und Vitalwerte',
    accentColor: '#22C55E',
    path: '/pflege',
  },
  stationaer: {
    icon: '🏥',
    description: 'Bewohner:innen und Übergaben',
    accentColor: '#7C5CFF',
    path: '/stationaer',
  },
  beratung: {
    icon: '💬',
    description: 'Beratungsfälle und Protokolle',
    accentColor: '#62F3FF',
    path: '/beratung',
  },
  akademie: {
    icon: '🎓',
    description: 'Kurse und Zertifikate',
    accentColor: '#FFD166',
    path: '/akademie',
  },
};

/** Internal developer tools — not shown on public app start page. */
export const DEV_TOOL_ENTRIES: NavigationEntry[] = [
  {
    path: '/business/admin/architecture',
    label: 'Technisches Fundament',
    description: 'Architektur & Datenmodell (WP 001)',
    icon: '⚙️',
    accentColor: '#8B95A7',
    requiresAuth: true,
  },
  {
    path: '/business/admin/design-system',
    label: 'Design System',
    description: 'Premium Visual Identity (WP 021–040)',
    icon: '🎨',
    accentColor: '#FFB020',
    requiresAuth: true,
  },
  {
    path: '/onboarding',
    label: 'Onboarding',
    description: 'Neuen Mandanten einrichten — Demo-Wizard',
    icon: '🚀',
    accentColor: '#22C55E',
    requiresAuth: false,
  },
];

/** @deprecated Use APP_START_ENTRIES for public landing; DEV_TOOL_ENTRIES for internal nav. */
export const PUBLIC_ENTRIES: NavigationEntry[] = DEV_TOOL_ENTRIES;

/** @deprecated Demo login removed — kept for legacy test references only. */
export const DEMO_LOGIN_ROLES: Record<string, RoleKey[]> = {
  business: [
    'business_admin',
    'business_manager',
    'billing',
    'dispatch',
    'counselor',
    'akademie_admin',
  ],
  employee: ['employee_portal', 'caregiver', 'nurse'],
  client: ['client_portal', 'family_portal'],
};
