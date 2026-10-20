import type { TenantScopedEntity } from '../../core/base';

export type PortalAccessStatus =
  | 'aktiv'
  | 'eingeladen'
  | 'gesperrt'
  | 'deaktiviert'
  | 'nicht_eingerichtet';

export const PORTAL_ACCESS_STATUS_LABELS: Record<PortalAccessStatus, string> = {
  aktiv: 'Aktiv',
  eingeladen: 'Eingeladen',
  gesperrt: 'Gesperrt',
  deaktiviert: 'Deaktiviert',
  nicht_eingerichtet: 'Nicht eingerichtet',
};

export type ClientPortalCredentialsReveal = {
  username: string;
  accessCode: string;
};

export type ClientPortalAccess = TenantScopedEntity & {
  clientId: string;
  contactId: string | null;
  email: string | null;
  portalUsername: string | null;
  portalEnabled: boolean;
  status: PortalAccessStatus;
  lastLoginAt: string | null;
  invitedAt: string | null;
  codeCreatedAt: string | null;
  codeRotatedAt: string | null;
  modulesEnabled: string[];
  twoFactorEnabled: boolean;
};
