import type { ModuleNavConfig } from '@/types/navigation/platform';

export const stationaerNav: ModuleNavConfig = {
  moduleKey: 'stationaer',
  label: 'Stationär',
  groups: [
    {
      title: 'Übersicht',
      items: [{ key: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/stationaer' }],
    },
    {
      title: 'Bewohner:innen',
      items: [
        { key: 'calendar', label: 'Kalender', icon: '📅', href: '/stationaer/calendar' },
        { key: 'bewohner', label: 'Bewohner:innen', icon: '🏥', href: '/stationaer/bewohner' },
        { key: 'belegung', label: 'Belegung', icon: '🛏️', href: '/stationaer/belegung' },
        { key: 'planung', label: 'Bewohnerplanung', icon: '📋', href: '/stationaer/bewohnerplanung' },
      ],
    },
    {
      title: 'Wohnbereiche & Alltag',
      items: [
        { key: 'wohnbereiche', label: 'Wohnbereiche', icon: '🏠', href: '/stationaer/wohnbereiche' },
        { key: 'zimmer', label: 'Zimmer', icon: '🚪', href: '/stationaer/zimmer' },
        { key: 'tagesstruktur', label: 'Tagesstruktur', icon: '⏰', href: '/stationaer/tagesstruktur' },
        { key: 'mahlzeiten', label: 'Mahlzeiten', icon: '🍽️', href: '/stationaer/mahlzeiten' },
      ],
    },
    {
      title: 'Übergabe & Berichte',
      items: [
        { key: 'uebergabe', label: 'Übergabe', icon: '🔄', href: '/stationaer/uebergabe' },
        { key: 'uebergabebericht', label: 'Übergabeberichte', icon: '📝', href: '/stationaer/uebergabebericht' },
        { key: 'reports', label: 'Auswertungen', icon: '📈', href: '/stationaer/auswertungen' },
      ],
    },
    {
      title: 'Einstellungen',
      items: [{ key: 'settings', label: 'Einstellungen', icon: '⚙️', href: '/stationaer/settings' }],
    },
  ],
};
