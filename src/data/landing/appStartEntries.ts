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
    label: 'Anmeldung Verwaltung',
    description: '',
    icon: '🏢',
    accentColor: '#FF9500',
  },
  {
    path: '/auth/employee-login',
    label: 'Anmeldung Mitarbeiter:in Portal',
    description: '',
    icon: '👤',
    accentColor: '#62F3FF',
  },
  {
    path: '/auth/portal-code-login',
    label: 'Anmeldung Klient:innen Portal',
    description: '',
    icon: '🏠',
    accentColor: '#FFD166',
  },
  {
    path: '/auth/register-business',
    label: 'Kostenlos Registrieren',
    description: '',
    icon: '✨',
    accentColor: '#7C5CFF',
  },
];
