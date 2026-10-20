export type AppStartIconKey = 'building' | 'user' | 'home' | 'sparkle';

export type AppStartEntry = {
  path: string;
  label: string;
  description: string;
  iconKey: AppStartIconKey;
  accentColor: string;
};

/** Responsive icon tile size for landing portal cards. */
export function resolveAppStartIconSize(isPhone: boolean, isDesktopOrWide: boolean): number {
  if (isPhone) return 60;
  if (isDesktopOrWide) return 68;
  return 64;
}


export const APP_START_ENTRIES: AppStartEntry[] = [
  {
    path: '/auth/business-login',
    label: 'Anmeldung Verwaltung',
    description: 'Office, Personal, Abrechnung und Mandantenverwaltung',
    iconKey: 'building',
    accentColor: '#FF9500',
  },
  {
    path: '/auth/employee-login',
    label: 'Anmeldung Mitarbeiter:in Portal',
    description: 'Einsätze, Dienstplan, Nachrichten und Profil',
    iconKey: 'user',
    accentColor: '#62F3FF',
  },
  {
    path: '/auth/portal-code-login',
    label: 'Anmeldung Klient:innen Portal',
    description: 'Termine, Dokumente und Nachrichten für Klient:innen',
    iconKey: 'home',
    accentColor: '#FFD166',
  },
  {
    path: '/auth/register-business',
    label: 'Kostenlos Registrieren',
    description: 'CareSuite+ für Ihr Pflege- oder Assistenzbüro einrichten',
    iconKey: 'sparkle',
    accentColor: '#7C5CFF',
  },
];
