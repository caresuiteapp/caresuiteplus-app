import type { ShellTabConfig } from '@/types/navigation/shell';

/** Canonical Office area — shared by sidebar tabs and dashboard Schnellzugriff. */
export type OfficeNavArea = {
  id: string;
  key: string;
  label: string;
  icon: string;
  href: string;
  description: string;
  accentColor: string;
};

export const OFFICE_INDEX_TAB: ShellTabConfig = {
  key: 'index',
  label: 'Office',
  icon: '🏢',
  href: '/office',
};

/**
 * Office navigable areas (excluding dashboard home).
 * Order matches dashboard Schnellzugriff for 1:1 parity with sidebar.
 */
export const OFFICE_NAV_AREAS: readonly OfficeNavArea[] = [
  {
    id: 'clients',
    key: 'clients',
    label: 'Klient:innen',
    icon: '👥',
    href: '/office/clients',
    description: 'Liste, Suche, Filter und Status',
    accentColor: '#62F3FF',
  },
  {
    id: 'employees',
    key: 'employees',
    label: 'Mitarbeitende',
    icon: '👤',
    href: '/office/employees',
    description: 'Teamliste mit Qualifikationen',
    accentColor: '#62F3FF',
  },
  {
    id: 'invoices',
    key: 'invoices',
    label: 'Rechnungen',
    icon: '🧾',
    href: '/office/invoices',
    description: 'Abrechnung, Budgets und Mahnwesen',
    accentColor: '#FFD166',
  },
  {
    id: 'documents',
    key: 'documents',
    label: 'Dokumente & Unterschriften',
    icon: '📁',
    href: '/business/office/documents/signatures',
    description: 'Signaturaufträge und Dokumentenverwaltung',
    accentColor: '#7C5CFF',
  },
  {
    id: 'documents-archive',
    key: 'documents-archive',
    label: 'Dokumentenablage',
    icon: '🗂️',
    href: '/office/documents',
    description: 'Zentrale Akte und Uploads',
    accentColor: '#7C5CFF',
  },
  {
    id: 'appointments',
    key: 'appointments',
    label: 'Terminverwaltung',
    icon: '📅',
    href: '/office/appointments',
    description: 'Terminliste, Anlegen und Bearbeitung',
    accentColor: '#62F3FF',
  },
  {
    id: 'calendar',
    key: 'calendar',
    label: 'Kalender',
    icon: '🗓️',
    href: '/office/calendar',
    description: 'Mehransicht Kalender',
    accentColor: '#62F3FF',
  },
  {
    id: 'messages',
    key: 'messages',
    label: 'Nachrichten',
    icon: '💬',
    href: '/office/messages',
    description: 'Interne Kommunikation',
    accentColor: '#62F3FF',
  },
  {
    id: 'broadcasts',
    key: 'broadcasts',
    label: 'Broadcast',
    icon: '📢',
    href: '/office/messages?audience=employees&view=broadcasts',
    description: 'Rundschreiben an Mitarbeitende',
    accentColor: '#62F3FF',
  },
  {
    id: 'qm',
    key: 'qm',
    label: 'Qualitätsmanagement',
    icon: '✅',
    href: '/business/office/qm',
    description: 'Handbuch, Prüfungen, Compliance',
    accentColor: '#7C5CFF',
  },
  {
    id: 'access',
    key: 'access',
    label: 'Zugänge & Benutzer',
    icon: '🔐',
    href: '/business/office/access',
    description: 'Portale, Rollen und Rechte',
    accentColor: '#F97316',
  },
  {
    id: 'modules',
    key: 'modules',
    label: 'Modulzuordnungen',
    icon: '🧩',
    href: '/business/office/modules',
    description: 'Klient:innen, MA, Leistungen je Fachmodul',
    accentColor: '#22C55E',
  },
  {
    id: 'audit',
    key: 'audit',
    label: 'Audit-Log',
    icon: '📋',
    href: '/business/office/audit-log',
    description: 'Office Änderungsprotokoll',
    accentColor: '#94A3B8',
  },
];

export function officeNavAreaToTab(area: OfficeNavArea): ShellTabConfig {
  return {
    key: area.key,
    label: area.label,
    icon: area.icon,
    href: area.href,
  };
}

export const OFFICE_AREA_TABS: ShellTabConfig[] = OFFICE_NAV_AREAS.map(officeNavAreaToTab);

export function buildOfficeTabs(): ShellTabConfig[] {
  return [OFFICE_INDEX_TAB, ...OFFICE_AREA_TABS];
}

/** Labels for Schnellzugriff parity checks (excludes dashboard home). */
export const OFFICE_QUICK_ACCESS_LABELS = OFFICE_NAV_AREAS.map((area) => area.label);

/** Routes for Schnellzugriff parity checks (excludes dashboard home). */
export const OFFICE_QUICK_ACCESS_ROUTES = OFFICE_NAV_AREAS.map((area) => area.href);
