import type { TenantScopedEntity } from '../../core/base';

export type PortalAccessStatus =
  | 'aktiv'
  | 'nicht_eingerichtet'
  | 'gesperrt'
  | 'deaktiviert'
  | 'eingeladen';

export const PORTAL_ACCESS_STATUS_LABELS: Record<PortalAccessStatus, string> = {
  aktiv: 'Aktiv',
  nicht_eingerichtet: 'Noch nicht eingerichtet',
  eingeladen: 'Noch nicht eingerichtet',
  gesperrt: 'Gesperrt',
  deaktiviert: 'Deaktiviert',
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

export type ClientPortalCredentialsReveal = {
  username: string;
  accessCode: string;
};
