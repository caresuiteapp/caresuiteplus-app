import type { AccessDashboardStats } from '@/lib/auth/permissionService';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type AccessKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildAccessDashboardKpis(stats: AccessDashboardStats, mode: ColorMode = 'dark'): AccessKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'internal',
      label: 'Interne Benutzer',
      value: String(stats.internalUsers),
      subValue: 'Mandanten-Admin',
      icon: '👤',
      accentColor: colors.orange,
    },
    {
      id: 'employee',
      label: 'Mitarbeiterzugänge',
      value: String(stats.employeeAccounts),
      subValue: 'Portal-Accounts',
      icon: '🧑‍⚕️',
      accentColor: colors.cyan,
    },
    {
      id: 'portal',
      label: 'Portal-Codes',
      value: String(stats.activePortalCodes),
      subValue: 'Aktiv',
      icon: '🔑',
      accentColor: colors.gold,
    },
    {
      id: 'blocked',
      label: 'Gesperrt',
      value: String(stats.blockedAccesses),
      subValue: 'Zu prüfen',
      icon: '⛔',
      accentColor: colors.amber,
    },
    {
      id: 'pending',
      label: 'Erst-Logins',
      value: String(stats.pendingFirstLogins),
      subValue: 'Offen',
      icon: '📬',
      accentColor: colors.violet,
    },
    {
      id: 'logins',
      label: 'Letzte Logins',
      value: String(stats.recentLogins),
      subValue: 'Erfolgreich',
      icon: '✅',
      accentColor: colors.success,
    },
  ];
}

export type AccessListHeroVariant =
  | 'internal-users'
  | 'employee-portal'
  | 'client-portal'
  | 'relative-portal'
  | 'login-audit'
  | 'roles'
  | 'module-permissions';

const VARIANT_META = (
  colors: ReturnType<typeof legacyColorsFromPalette>,
): Record<
  AccessListHeroVariant,
  { eyebrow: string; title: string; meta: string; icon: string; accentColor: string }
> => ({
  'internal-users': {
    eyebrow: 'OFFICE · ZUGÄNGE',
    title: 'Interne Benutzer',
    meta: 'Mandanten-Administratoren und interne Rollen',
    icon: '👤',
    accentColor: colors.orange,
  },
  'employee-portal': {
    eyebrow: 'OFFICE · ZUGÄNGE',
    title: 'Mitarbeitendenportal',
    meta: 'Zugänge für Pflegekräfte und Außendienst',
    icon: '🧑‍⚕️',
    accentColor: colors.cyan,
  },
  'client-portal': {
    eyebrow: 'OFFICE · ZUGÄNGE',
    title: 'Klient:innenportal',
    meta: 'Portal-Codes für Klient:innen',
    icon: '🏠',
    accentColor: colors.gold,
  },
  'relative-portal': {
    eyebrow: 'OFFICE · ZUGÄNGE',
    title: 'Angehörigenportal',
    meta: 'Einmal-Codes für Angehörige',
    icon: '👨‍👩‍👧',
    accentColor: colors.violet,
  },
  'login-audit': {
    eyebrow: 'OFFICE · AUDIT',
    title: 'Login-Protokoll',
    meta: 'Erfolgreiche und fehlgeschlagene Anmeldungen',
    icon: '📋',
    accentColor: colors.cyan,
  },
  roles: {
    eyebrow: 'OFFICE · ROLLEN',
    title: 'Rollen & Rechte',
    meta: 'Standard-Modulrechte je interner Rolle',
    icon: '🛡️',
    accentColor: colors.orange,
  },
  'module-permissions': {
    eyebrow: 'OFFICE · ROLLEN',
    title: 'Modulrechte',
    meta: 'Individuelle Modulberechtigungen pro Benutzer',
    icon: '⚙️',
    accentColor: colors.cyan,
  },
});

export type AccessListKpiContext = {
  tenantName?: string;
  isLive?: boolean;
};

export function buildAccessListKpis(
  variant: AccessListHeroVariant,
  itemCount: number,
  mode: ColorMode = 'dark',
  context?: AccessListKpiContext,
): AccessKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const meta = VARIANT_META(colors)[variant];
  const isLive = context?.isLive ?? false;
  const tenantName = context?.tenantName?.trim() || 'Ihr Mandant';

  return [
    {
      id: 'count',
      label: 'Einträge',
      value: String(itemCount),
      subValue: meta.title,
      icon: meta.icon,
      accentColor: meta.accentColor,
    },
    {
      id: 'scope',
      label: 'Mandant',
      value: isLive ? tenantName : 'Demo',
      subValue: isLive ? 'Live-Mandant' : 'Lokaler Store',
      icon: '🏢',
      accentColor: colors.orange,
    },
    {
      id: 'status',
      label: 'Backend',
      value: isLive ? 'Live' : 'Prep.',
      subValue: isLive ? 'Supabase' : 'Kein Live-Sync',
      icon: '📡',
      accentColor: colors.violet,
    },
  ];
}

export function getAccessListHeroMeta(variant: AccessListHeroVariant, mode: ColorMode = 'dark') {
  return VARIANT_META(legacyColorsFromPalette(mode))[variant];
}
