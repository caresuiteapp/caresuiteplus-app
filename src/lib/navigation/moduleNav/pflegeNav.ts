import type { ModuleNavConfig } from '@/types/navigation/platform';

export const pflegeNav: ModuleNavConfig = {
  moduleKey: 'pflege',
  label: 'Pflegedienst Ambulant',
  groups: [
    {
      title: 'Übersicht',
      items: [
        { key: 'dashboard', label: 'Startseite', icon: '🏠', href: '/pflege' },
        { key: 'care-overview', label: 'Versorgungsübersicht', icon: '📊', href: '/pflege/versorgungsuebersicht' },
        { key: 'clients', label: 'Klient:innenakten', icon: '👥', href: '/pflege/klienten' },
        { key: 'admissions', label: 'Aufnahme & Versorgung', icon: '📋', href: '/pflege/aufnahme' },
        { key: 'tasks', label: 'Aufgaben & Wiedervorlagen', icon: '✅', href: '/pflege/aufgaben' },
        { key: 'staff', label: 'Pflegepersonalakten', icon: '🧑‍⚕️', href: '/pflege/personal' },
      ],
    },
    {
      title: 'Pflegeplanung',
      items: [
        { key: 'calendar', label: 'Kalender', icon: '📅', href: '/pflege/calendar' },
        { key: 'tours', label: 'Tourenplanung', icon: '🗺️', href: '/pflege/tourenplanung' },
        { key: 'plans', label: 'Pflegepläne', icon: '📋', href: '/pflege/plans' },
        { key: 'planung', label: 'Planung', icon: '🗓️', href: '/pflege/planung' },
        { key: 'dienstplaene', label: 'Dienstpläne', icon: '📅', href: '/pflege/dienstplaene' },
        { key: 'massnahmen', label: 'Maßnahmen', icon: '✅', href: '/pflege/massnahmen' },
      ],
    },
    {
      title: 'Betriebsorganisation',
      items: [
        { key: 'fleet', label: 'Fuhrpark', icon: '🚗', href: '/pflege/fuhrpark' },
        { key: 'inventory', label: 'Inventar', icon: '📦', href: '/pflege/inventar' },
      ],
    },
    {
      title: 'Dokumentation',
      items: [
        { key: 'dokumentation', label: 'Pflegedokumentation', icon: '📝', href: '/pflege/dokumentation' },
        { key: 'vitalwerte', label: 'Vitalwerte', icon: '❤️', href: '/pflege/vitalwerte' },
        { key: 'medikation', label: 'Medikation', icon: '💊', href: '/pflege/medikation' },
        { key: 'behandlungspflege', label: 'Behandlungspflege', icon: '🩺', href: '/pflege/behandlungspflege' },
        { key: 'orders', label: 'Verordnungen & Genehmigungen', icon: '📄', href: '/pflege/verordnungen' },
        { key: 'diagnoses', label: 'Diagnosen', icon: '🩺', href: '/pflege/diagnosen' },
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
        { key: 'tariffs', label: 'Leistungen & Vergütung', icon: '€', href: '/pflege/leistungskatalog' },
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
