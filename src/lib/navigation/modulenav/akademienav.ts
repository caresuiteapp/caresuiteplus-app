import type { ModuleNavConfig } from '@/types/navigation/platform';

export const akademieNav: ModuleNavConfig = {
  moduleKey: 'akademie',
  label: 'Akademie',
  groups: [
    {
      title: 'Übersicht',
      items: [{ key: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/akademie' }],
    },
    {
      title: 'Kurse & Lernen',
      items: [
        { key: 'calendar', label: 'Kalender', icon: '📅', href: '/akademie/calendar' },
        { key: 'courses', label: 'Kurse', icon: '🎓', href: '/akademie/courses' },
        { key: 'kurse', label: 'Kursverwaltung', icon: '📚', href: '/akademie/kurse' },
        { key: 'pflichtschulungen', label: 'Pflichtschulungen', icon: '⚠️', href: '/akademie/pflichtschulungen' },
        { key: 'mediathek', label: 'Mediathek', icon: '🎬', href: '/akademie/mediathek' },
      ],
    },
    {
      title: 'Teilnehmer & Zertifikate',
      items: [
        { key: 'teilnehmer', label: 'Teilnehmer:innen', icon: '👥', href: '/akademie/teilnehmer' },
        { key: 'zertifikate', label: 'Zertifikate', icon: '🏅', href: '/akademie/zertifikate' },
        { key: 'pruefungen', label: 'Prüfungen', icon: '📝', href: '/akademie/pruefungen' },
      ],
    },
    {
      title: 'Planung & Auswertung',
      items: [
        { key: 'schulungsplan', label: 'Schulungsplan', icon: '🗓️', href: '/akademie/schulungsplan' },
        { key: 'auswertungen', label: 'Auswertungen', icon: '📈', href: '/akademie/auswertungen' },
        { key: 'settings', label: 'Einstellungen', icon: '⚙️', href: '/akademie/settings' },
      ],
    },
  ],
};
