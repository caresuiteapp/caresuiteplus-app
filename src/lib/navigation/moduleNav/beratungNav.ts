import type { ModuleNavConfig } from '@/types/navigation/platform';

export const beratungNav: ModuleNavConfig = {
  moduleKey: 'beratung',
  label: 'Beratung',
  groups: [
    {
      title: 'Übersicht',
      items: [{ key: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/beratung' }],
    },
    {
      title: 'Fälle & Protokolle',
      items: [
        { key: 'calendar', label: 'Kalender', icon: '📅', href: '/beratung/calendar' },
        { key: 'cases', label: 'Fälle', icon: '📋', href: '/beratung/cases' },
        { key: 'faelle', label: 'Fallübersicht', icon: '📂', href: '/beratung/faelle' },
        { key: 'protokolle', label: 'Protokolle', icon: '📝', href: '/beratung/protokolle' },
        { key: 'wiedervorlagen', label: 'Wiedervorlagen', icon: '🔔', href: '/beratung/wiedervorlagen' },
      ],
    },
    {
      title: 'Beratung & Kontakt',
      items: [
        { key: 'erstgespraech', label: 'Erstgespräch', icon: '🤝', href: '/beratung/erstgespraech' },
        { key: 'kontaktverlauf', label: 'Kontaktverlauf', icon: '📞', href: '/beratung/kontaktverlauf' },
        { key: 'angehoerige', label: 'Angehörige', icon: '👨‍👩‍👧', href: '/beratung/angehoerige' },
      ],
    },
    {
      title: 'Auswertung & Einstellungen',
      items: [
        { key: 'berichte', label: 'Berichte', icon: '📄', href: '/beratung/berichte' },
        { key: 'auswertungen', label: 'Auswertungen', icon: '📈', href: '/beratung/auswertungen' },
        { key: 'settings', label: 'Einstellungen', icon: '⚙️', href: '/beratung/settings' },
      ],
    },
  ],
};
