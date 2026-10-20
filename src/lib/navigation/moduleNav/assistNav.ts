import type { ModuleNavConfig } from '@/types/navigation/platform';

export const assistNav: ModuleNavConfig = {
  moduleKey: 'assist',
  label: 'Assist',
  groups: [
    {
      title: 'Übersicht',
      items: [{ key: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/assist' }],
    },
    {
      title: 'Einsätze & Durchführung',
      items: [
        { key: 'assignments', label: 'Einsätze', icon: '📋', href: '/assist/assignments' },
        { key: 'durchfuehrung', label: 'Durchführung', icon: '✅', href: '/assist/durchfuehrung' },
        { key: 'nachweise', label: 'Nachweise', icon: '📝', href: '/assist/nachweise' },
        { key: 'aufgaben', label: 'Aufgaben', icon: '☑️', href: '/assist/aufgaben' },
      ],
    },
    {
      title: 'Mobilität & Planung',
      items: [
        { key: 'fahrten', label: 'Fahrten', icon: '🚗', href: '/assist/fahrten' },
        { key: 'touren', label: 'Touren', icon: '🗺️', href: '/assist/touren' },
        { key: 'calendar', label: 'Kalender', icon: '📅', href: '/assist/calendar' },
        { key: 'live-status', label: 'Live-Status', icon: '📡', href: '/assist/live-status' },
      ],
    },
    {
      title: 'Qualität & Einstellungen',
      items: [
        { key: 'qualitaet', label: 'Qualität', icon: '⭐', href: '/assist/qualitaet' },
        { key: 'zugeordnete', label: 'Zugeordnete Klient:innen', icon: '👥', href: '/assist/zugeordnete-klienten' },
        {
          key: 'settings',
          label: 'Einstellungen',
          icon: '⚙️',
          href: '/assist/einstellungen',
          openInModal: true,
          modalKey: 'assist.settings',
        },
      ],
    },
  ],
};
