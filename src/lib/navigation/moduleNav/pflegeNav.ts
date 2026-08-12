import type { ModuleNavConfig } from '@/types/navigation/platform';

export const pflegeNav: ModuleNavConfig = {
  moduleKey: 'pflege',
  label: 'Pflege',
  groups: [
    {
      title: 'Übersicht',
      items: [{ key: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/pflege' }],
    },
    {
      title: 'Pflegeplanung',
      items: [
        { key: 'calendar', label: 'Kalender', icon: '📅', href: '/pflege/calendar' },
        { key: 'plans', label: 'Pflegepläne', icon: '📋', href: '/pflege/plans' },
        { key: 'planung', label: 'Planung', icon: '🗓️', href: '/pflege/planung' },
        { key: 'dienstplaene', label: 'Dienstpläne', icon: '📅', href: '/pflege/dienstplaene' },
        { key: 'massnahmen', label: 'Maßnahmen', icon: '✅', href: '/pflege/massnahmen' },
      ],
    },
    {
      title: 'Dokumentation',
      items: [
        { key: 'dokumentation', label: 'Pflegedokumentation', icon: '📝', href: '/pflege/dokumentation' },
        { key: 'vitalwerte', label: 'Vitalwerte', icon: '❤️', href: '/pflege/vitalwerte' },
        { key: 'medikation', label: 'Medikation', icon: '💊', href: '/pflege/medikation' },
        { key: 'behandlungspflege', label: 'Behandlungspflege', icon: '🩺', href: '/pflege/behandlungspflege' },
        { key: 'wunden', label: 'Wunddokumentation', icon: '🩹', href: '/pflege/wunddokumentation' },
      ],
    },
    {
      title: 'Assessment & Berichte',
      items: [
        { key: 'sis', label: 'Pflegeverständnis & SIS', icon: '📊', href: '/pflege/sis' },
        { key: 'berichte', label: 'Berichte', icon: '📄', href: '/pflege/berichte' },
        { key: 'uebergaben', label: 'Übergaben', icon: '🔄', href: '/pflege/uebergaben' },
      ],
    },
    {
      title: 'Qualität',
      items: [
        { key: 'risiken', label: 'Risikomanagement', icon: '⚠', href: '/pflege/risiken' },
        { key: 'evaluation', label: 'Evaluationen', icon: '✓', href: '/pflege/evaluation' },
        { key: 'visiten', label: 'Pflegevisiten', icon: '🔎', href: '/pflege/visiten' },
        { key: 'abweichungen', label: 'Qualitätsabweichungen', icon: '!', href: '/pflege/abweichungen' },
        { key: 'md-readiness', label: 'MD-Prüfbereitschaft', icon: '🛡️', href: '/pflege/md-pruefbereitschaft' },
        { key: 'reports', label: 'Qualitätskennzahlen', icon: '📈', href: '/pflege/reports' },
      ],
    },
    {
      title: 'Leistung & Abrechnung',
      items: [
        { key: 'leistungsnachweise', label: 'Leistungsnachweise', icon: '§', href: '/pflege/leistungsnachweise' },
        { key: 'abrechnung', label: 'Abrechnungsfreigabe', icon: '€', href: '/pflege/abrechnung' },
        { key: 'rechnungsgrundlagen', label: 'Rechnungsgrundlagen', icon: '🧾', href: '/pflege/rechnungsgrundlagen' },
        { key: 'gesamtabnahme', label: 'Gesamtabnahme', icon: '✓', href: '/pflege/gesamtabnahme' },
      ],
    },
    {
      title: 'Einstellungen',
      items: [
        { key: 'settings', label: 'Pflege-Einstellungen', icon: '⚙️', href: '/pflege/settings' },
        { key: 'zugeordnete', label: 'Zugeordnete Klient:innen', icon: '👥', href: '/pflege/zugeordnete-klienten' },
      ],
    },
  ],
};
