import type { HealthOSNavConfig } from './types';

/**
 * Central HealthOS navigation plan (H2).
 * Routes are referenced only — existing production routes are not redirected.
 */
export const HEALTHOS_OFFICE_NAV: HealthOSNavConfig = {
  role: 'office',
  label: 'Office HealthOS',
  groups: [
    {
      title: 'Steuerung',
      items: [
        { key: 'command-center', label: 'Command Center', icon: '🎯', href: '/office' },
      ],
    },
    {
      title: 'Stammdaten & Einsätze',
      items: [
        { key: 'clients', label: 'Klient:innen', icon: '👥', href: '/office/clients' },
        { key: 'employees', label: 'Mitarbeitende', icon: '👤', href: '/office/employees' },
        { key: 'assignments', label: 'Einsätze', icon: '📋', href: '/office/calendar' },
        {
          key: 'proofs',
          label: 'Nachweise',
          icon: '📝',
          href: '/assist/nachweise',
          visibility: 'disabled',
          planningNote: 'Office-Nachweis-Hub noch nicht konsolidiert — Assist-Route nicht live verlinken.',
        },
      ],
    },
    {
      title: 'Dokumente & Finanzen',
      items: [
        { key: 'documents', label: 'Dokumente & Unterschriften', icon: '📁', href: '/office/documents-signatures' },
        {
          key: 'budgets',
          label: 'Budgets',
          icon: '💰',
          visibility: 'hidden',
          planningNote: 'P0 Budget-Zone — nur in Akte, nicht über Shell-Nav.',
        },
        {
          key: 'wfm',
          label: 'Zeitkonto / WFM',
          icon: '⏱️',
          href: '/business/office/time-tracking',
          planningNote: 'P0 WFM — Route existiert, Shell-Verlinkung erst H3.',
        },
        {
          key: 'billing',
          label: 'Abrechnung',
          icon: '🧾',
          href: '/office/invoices',
        },
      ],
    },
    {
      title: 'Kommunikation & Qualität',
      items: [
        {
          key: 'communication',
          label: 'Kommunikation',
          icon: '💬',
          href: '/office/messages?audience=employees&view=chats&chatAge=new',
        },
        {
          key: 'blockers-quality',
          label: 'Blocker / Qualität',
          icon: '✅',
          href: '/business/office/qm',
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          key: 'settings',
          label: 'Einstellungen',
          icon: '⚙️',
          href: '/business/office/modules',
        },
      ],
    },
  ],
};

export const HEALTHOS_ASSIST_NAV: HealthOSNavConfig = {
  role: 'assist',
  label: 'Assist HealthOS',
  groups: [
    {
      title: 'Übersicht',
      items: [{ key: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/assist' }],
    },
    {
      title: 'Einsätze',
      items: [
        { key: 'planning', label: 'Einsatzplanung', icon: '📅', href: '/assist/assignments' },
        { key: 'live', label: 'Live-Einsätze', icon: '📡', href: '/assist/live-status' },
        { key: 'proofs', label: 'Nachweise', icon: '📝', href: '/assist/nachweise' },
      ],
    },
    {
      title: 'Leistung & Qualität',
      items: [
        {
          key: 'budgets',
          label: 'Budgets',
          icon: '💰',
          visibility: 'hidden',
          planningNote: 'P0 Budget — nicht über Assist-Shell-Nav.',
        },
        {
          key: 'service-types',
          label: 'Leistungsarten',
          icon: '📚',
          href: '/business/office/settings/assist-catalogs',
          visibility: 'disabled',
          planningNote: 'Admin-Katalog — H4 Settings-Hub.',
        },
        { key: 'quality', label: 'Qualität / Blocker', icon: '⭐', href: '/assist/qualitaet' },
      ],
    },
    {
      title: 'System',
      items: [
        {
          key: 'communication',
          label: 'Kommunikation',
          icon: '💬',
          visibility: 'disabled',
          planningNote: 'Assist-Messenger noch nicht als eigener Nav-Punkt.',
        },
        {
          key: 'settings',
          label: 'Einstellungen',
          icon: '⚙️',
          href: '/assist/einstellungen',
        },
      ],
    },
  ],
};

export const HEALTHOS_EMPLOYEE_PORTAL_NAV: HealthOSNavConfig = {
  role: 'employee_portal',
  label: 'Mitarbeitendenportal',
  groups: [
    {
      title: 'Heute',
      items: [{ key: 'today', label: 'Heute', icon: '🏠', href: '/portal/employee' }],
    },
    {
      title: 'Einsätze',
      items: [
        {
          key: 'assignments',
          label: 'Meine Einsätze',
          icon: '📅',
          href: '/portal/employee/assignments',
        },
        {
          key: 'schedule',
          label: 'Kalender',
          icon: '📅',
          href: '/portal/employee/calendar',
        },
        {
          key: 'clients',
          label: 'Klientenakten',
          icon: '👥',
          href: '/portal/employee/clients',
        },
        {
          key: 'uploads',
          label: 'Uploads / Dokumente',
          icon: '📤',
          href: '/portal/employee/uploads',
        },
      ],
    },
    {
      title: 'Kommunikation & Zeit',
      items: [
        {
          key: 'messages',
          label: 'Nachrichten',
          icon: '💬',
          href: '/portal/employee/messages',
        },
        {
          key: 'times',
          label: 'Meine Zeiten',
          icon: '⏱️',
          href: '/portal/employee/times',
        },
        {
          key: 'absence',
          label: 'Urlaub / Abwesenheit',
          icon: '🌴',
          visibility: 'disabled',
          planningNote: 'H5 — noch kein dedizierter Portal-Hub.',
        },
      ],
    },
    {
      title: 'Profil',
      items: [
        {
          key: 'signatures',
          label: 'Unterschriften',
          icon: '✍️',
          href: '/portal/employee/signatures',
        },
        {
          key: 'documents',
          label: 'Dokumente',
          icon: '📄',
          href: '/portal/employee/documents',
        },
        { key: 'profile', label: 'Profil', icon: '👤', href: '/portal/employee/profile' },
      ],
    },
  ],
};

export const HEALTHOS_CLIENT_PORTAL_NAV: HealthOSNavConfig = {
  role: 'client_portal',
  label: 'Klient:innenportal',
  groups: [
    {
      title: 'Start',
      items: [{ key: 'overview', label: 'Übersicht', icon: '🏠', href: '/portal/client' }],
    },
    {
      title: 'Termine & Nachweise',
      items: [
        {
          key: 'appointments',
          label: 'Termine',
          icon: '📅',
          href: '/portal/client/appointments',
        },
        {
          key: 'proofs',
          label: 'Nachweise',
          icon: '📝',
          visibility: 'disabled',
          planningNote: 'H6 — Nachweis-Übersicht noch nicht im Portal-Nav.',
        },
      ],
    },
    {
      title: 'Dokumente & Budget',
      items: [
        {
          key: 'documents',
          label: 'Dokumente',
          icon: '📄',
          href: '/portal/client/documents',
        },
        {
          key: 'budget',
          label: 'Budget',
          icon: '💰',
          visibility: 'hidden',
          planningNote: 'Deep-Route assist-budget — P0, nicht Bottom-Nav.',
        },
      ],
    },
    {
      title: 'Kontakt',
      items: [
        {
          key: 'messages',
          label: 'Nachrichten',
          icon: '💬',
          href: '/portal/client/messages',
        },
        {
          key: 'master-data',
          label: 'Stammdaten',
          icon: '📋',
          href: '/portal/client/profile',
        },
        {
          key: 'help',
          label: 'Hilfe / Kontakt',
          icon: '❓',
          visibility: 'disabled',
          planningNote: 'H6 — Help-Center.',
        },
      ],
    },
  ],
};

export const HEALTHOS_NAV_BY_ROLE = {
  office: HEALTHOS_OFFICE_NAV,
  assist: HEALTHOS_ASSIST_NAV,
  employee_portal: HEALTHOS_EMPLOYEE_PORTAL_NAV,
  client_portal: HEALTHOS_CLIENT_PORTAL_NAV,
} as const;

export type HealthOSNavRoleKey = keyof typeof HEALTHOS_NAV_BY_ROLE;
