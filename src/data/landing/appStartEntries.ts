export type AppStartEntry = {
  path: string;
  label: string;
  description: string;
  icon: string;
  accentColor: string;
};

export const DEMO_START_PATH = '/auth/demo';

export const APP_START_ENTRIES: AppStartEntry[] = [
  {
    path: '/auth/business-login',
    label: 'Unternehmen / Verwaltung',
    description: 'Für Geschäftsführung, Verwaltung, PDL und Admins.',
    icon: '🏢',
    accentColor: '#FF9500',
  },
  {
    path: '/auth/employee-login',
    label: 'Mitarbeiterportal',
    description: 'Einsätze, Dokumentation und Nachrichten.',
    icon: '👤',
    accentColor: '#62F3FF',
  },
  {
    path: '/auth/portal-code-login',
    label: 'Klient:innen / Angehörige',
    description: 'Termine, Dokumente und Nachrichten per Portal-Code.',
    icon: '🏠',
    accentColor: '#FFD166',
  },
  {
    path: '/auth/register-business',
    label: 'Registrieren',
    description: 'Neues Unternehmen anlegen — keine Kreditkarte.',
    icon: '✨',
    accentColor: '#7C5CFF',
  },
  {
    path: DEMO_START_PATH,
    label: 'Demo mit Beispieldaten ansehen',
    description: 'CareSuite+ ohne Passwort mit Beispieldaten erkunden.',
    icon: '🎯',
    accentColor: '#62F3FF',
  },
];
