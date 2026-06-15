import type { AuthLoginType, InternalRoleKey, PortalCodeStatus, UserAccessStatus } from '@/lib/auth/auth.types';

export const INTERNAL_ROLE_LABELS: Record<InternalRoleKey, string> = {
  owner: 'Inhaber:in',
  management: 'Geschäftsführung',
  pdl: 'PDL',
  administration: 'Verwaltung',
  billing: 'Abrechnung',
  quality_management: 'Qualitätsmanagement',
  team_lead: 'Teamleitung',
  dispatcher: 'Disponent:in',
  employee: 'Mitarbeiter:in',
  readonly: 'Nur Lesen',
};

export const ACCESS_STATUS_LABELS: Record<UserAccessStatus, string> = {
  active: 'Aktiv',
  blocked: 'Gesperrt',
  pending_first_login: 'Erst-Login offen',
  password_reset_required: 'Passwort-Reset erforderlich',
  expired: 'Abgelaufen',
  archived: 'Archiviert',
};

export const PORTAL_CODE_STATUS_LABELS: Record<PortalCodeStatus, string> = {
  active: 'Aktiv',
  blocked: 'Gesperrt',
  expired: 'Abgelaufen',
  regenerated: 'Erneuert',
  revoked: 'Widerrufen',
};

export const LOGIN_TYPE_LABELS: Record<AuthLoginType, string> = {
  business: 'Business-Login',
  employee_portal: 'Mitarbeiterportal',
  client_portal: 'Klient:innenportal',
  relative_portal: 'Angehörigenportal',
};

export const MODULE_LABELS: Record<string, string> = {
  office: 'Office',
  pflege: 'Pflege',
  assist: 'Assist',
  beratung: 'Beratung',
  akademie: 'Akademie',
  stationaer: 'Stationär',
  messages: 'Nachrichten',
  documents: 'Dokumente',
  qm: 'QM',
  reporting: 'Reporting',
  ti: 'TI',
  settings: 'Einstellungen',
};

export const PERMISSION_ACTION_LABELS = {
  canView: 'Ansehen',
  canCreate: 'Anlegen',
  canEdit: 'Bearbeiten',
  canArchive: 'Archivieren',
  canExport: 'Export',
  canManageSettings: 'Einstellungen',
} as const;

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('de-DE');
}
