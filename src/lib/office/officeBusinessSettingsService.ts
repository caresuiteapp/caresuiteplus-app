import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

export type OfficeSettingsLink = {
  id: string;
  label: string;
  route: string;
  description: string;
};

export type OfficeSettingsSnapshot = {
  links: OfficeSettingsLink[];
  tenantLabel: string;
};

const SETTINGS_LINKS: OfficeSettingsLink[] = [
  {
    id: 'document-live-preview',
    label: 'Live-Vorschau (Dokumente)',
    route: '/business/templates/live-preview',
    description: 'HTML-Vorschau mit Beispieldatensätzen',
  },
  {
    id: 'document-ci',
    label: 'CI & Layout (Dokumente)',
    route: '/business/templates/ci-layout',
    description: 'Logo, Farben, A4-Layout und Geschäftsdokument-Fußzeilen',
  },
  {
    id: 'templates',
    label: 'Vorlagen & Kataloge',
    route: '/business/templates/settings',
    description: 'Mandantenvorlagen und Dropdown-Kataloge',
  },
  {
    id: 'permissions',
    label: 'Office Berechtigungen',
    route: '/business/office/permissions',
    description: 'Rollenprofile und Modulrechte',
  },
  {
    id: 'modules',
    label: 'Modulzuordnungen',
    route: '/business/office/modules',
    description: 'Klient:innen, Mitarbeitende, Leistungen',
  },
  {
    id: 'portals',
    label: 'Portale',
    route: '/business/office/portals',
    description: 'Klient:innen-, Angehörigen- und Mitarbeitendenportale',
  },
  {
    id: 'inventory',
    label: 'Inventar & Rückgabe',
    route: '/business/office/inventory',
    description: 'Geräte, Dienstkleidung, Ausgabe und Rückgabe',
  },
  {
    id: 'qm',
    label: 'QM Einstellungen',
    route: '/business/office/qm/settings',
    description: 'Qualitätsmanagement-Konfiguration',
  },
  {
    id: 'payments',
    label: 'Zahlungsanbieter',
    route: '/business/office/payments/settings',
    description: 'Stripe, Mollie, GoCardless, PayPal — Sandbox & Webhooks',
  },
];

export async function fetchOfficeSettingsSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<OfficeSettingsSnapshot>> {
  const denied = enforcePermission<OfficeSettingsSnapshot>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  await new Promise((r) => setTimeout(r, 160));
  return {
    ok: true,
    data: {
      links: SETTINGS_LINKS,
      tenantLabel: 'Demo-Mandant',
    },
  };
}
