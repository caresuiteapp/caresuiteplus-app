import { moduleColor } from '@/design/tokens/modules';

export type AppStartEntry = {
  path: string;
  label: string;
  description: string;
  icon: string;
  accentColor: string;
};

export const DEMO_START_PATH = '/auth/demo';

/** Four public portal entry cards — demo is footer-only. */
export const APP_START_ENTRIES: AppStartEntry[] = [
  {
    path: '/auth/business-login',
    label: 'Unternehmen / Verwaltung',
    description: 'Für Geschäftsführung, Verwaltung, Planung und Abrechnung.',
    icon: '🏢',
    accentColor: moduleColor('office'),
  },
  {
    path: '/auth/employee-login',
    label: 'Mitarbeiterportal',
    description: 'Für Einsätze, Dokumentation, Zeiten und Nachrichten.',
    icon: '👤',
    accentColor: moduleColor('assist'),
  },
  {
    path: '/auth/portal-code-login',
    label: 'Klient:innen / Angehörige',
    description: 'Für Termine, Dokumente, Nachrichten und Freigaben.',
    icon: '🏠',
    accentColor: moduleColor('beratung'),
  },
  {
    path: '/auth/register-business',
    label: 'Neues Unternehmen registrieren',
    description: 'CareSuite+ einrichten und passende Module auswählen.',
    icon: '✨',
    accentColor: moduleColor('qm'),
  },
];
