import type { TenantScopedEntity } from '../../core/base';

export type PortalAccessStatus = 'aktiv' | 'eingeladen' | 'gesperrt' | 'deaktiviert';

export const PORTAL_ACCESS_STATUS_LABELS: Record<PortalAccessStatus, string> = {
  aktiv: 'Aktiv',
  eingeladen: 'Eingeladen',
  gesperrt: 'Gesperrt',
  deaktiviert: 'Deaktiviert',
};

export type ClientPortalAccess = TenantScopedEntity & {
  clientId: string;
  contactId: string | null;
  email: string;
  status: PortalAccessStatus;
  lastLoginAt: string | null;
  invitedAt: string | null;
  modulesEnabled: string[];
  twoFactorEnabled: boolean;
};
