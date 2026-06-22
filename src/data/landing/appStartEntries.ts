export type AppStartIconKey = 'building' | 'user' | 'home' | 'sparkle';

export type AppStartEntry = {
  path: string;
  label: string;
  description: string;
  iconKey: AppStartIconKey;
  accentColor: string;
};


export const APP_START_ENTRIES: AppStartEntry[] = [
  {
    path: '/auth/business-login',
    label: 'Anmeldung Verwaltung',
    description: '',
    iconKey: 'building',
    accentColor: '#FF9500',
  },
  {
    path: '/auth/employee-login',
    label: 'Anmeldung Mitarbeiter:in Portal',
    description: '',
    iconKey: 'user',
    accentColor: '#62F3FF',
  },
  {
    path: '/auth/portal-code-login',
    label: 'Anmeldung Klient:innen Portal',
    description: '',
    iconKey: 'home',
    accentColor: '#FFD166',
  },
  {
    path: '/auth/register-business',
    label: 'Kostenlos Registrieren',
    description: '',
    iconKey: 'sparkle',
    accentColor: '#7C5CFF',
  },
];
