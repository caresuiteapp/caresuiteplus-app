import type { ServiceResult } from '@/types';

export type AuthPortalOption = {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  accentColor: string;
};

const AUTH_PORTAL_OPTIONS: AuthPortalOption[] = [
  {
    id: 'business',
    title: 'Unternehmen / Verwaltung anmelden',
    description: 'Für Geschäftsführung, Verwaltung, PDL, Buchhaltung und Admins.',
    icon: '🏢',
    route: '/auth/business-login',
    accentColor: '#FF9500',
  },
  {
    id: 'employee',
    title: 'Mitarbeiterportal',
    description: 'Für Mitarbeitende mit persönlichem Zugang.',
    icon: '👤',
    route: '/auth/employee-login',
    accentColor: '#22D3EE',
  },
  {
    id: 'portal',
    title: 'Klient:innen / Angehörige',
    description: 'Einfacher Login mit 6-stelligem Code.',
    icon: '🏠',
    route: '/auth/portal-code-login',
    accentColor: '#FBBF24',
  },
  {
    id: 'register',
    title: 'Neues Unternehmen registrieren',
    description: 'CareSuite+ testen oder kaufen.',
    icon: '✨',
    route: '/auth/register-business',
    accentColor: '#A78BFA',
  },
];

/** Login-Auswahl — verfügbare Portal-Zugänge */
export async function fetchAuthPortalOptions(): Promise<ServiceResult<AuthPortalOption[]>> {
  await new Promise((r) => setTimeout(r, 100));
  return { ok: true, data: AUTH_PORTAL_OPTIONS };
}
