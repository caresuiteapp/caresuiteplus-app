import type { ModuleNavConfig } from '@/types/navigation/platform';

export const akademieNav: ModuleNavConfig = {
  moduleKey: 'akademie', label: 'Akademie',
  groups: [
    { title: 'Lernen & Wissen', items: [
      { key: 'dashboard', label: 'Übersicht', icon: '🏠', href: '/akademie' },
      { key: 'courses', label: 'Kurse', icon: '🎓', href: '/akademie/kurse' },
      { key: 'templates', label: 'Vorlagen & Kursbaukasten', icon: '🧩', href: '/akademie/vorlagen' },
      { key: 'library', label: 'Lernmaterialien', icon: '📚', href: '/akademie/mediathek' },
    ] },
    { title: 'Teilnahme & Abschluss', items: [
      { key: 'planning', label: 'Schulungsplan', icon: '📅', href: '/akademie/schulungsplan' },
      { key: 'mandatory', label: 'Pflichtschulungen', icon: '✓', href: '/akademie/pflichtschulungen' },
      { key: 'assignments', label: 'Teilnahmen', icon: '👥', href: '/akademie/teilnehmer' },
      { key: 'reviews', label: 'Prüfung & Freigabe', icon: '📝', href: '/akademie/pruefungen' },
      { key: 'certificates', label: 'Lernnachweise', icon: '🏅', href: '/akademie/zertifikate' },
      { key: 'reports', label: 'Auswertungen', icon: '📊', href: '/akademie/auswertungen' },
    ] },
  ],
};
