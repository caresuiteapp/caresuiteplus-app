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
        { key: 'wunden', label: 'Wunddokumentation', icon: '🩹', href: '/pflege/wunddokumentation' },
      ],
    },
    {
      title: 'Assessment & Berichte',
      items: [
        { key: 'sis', label: 'SIS / Assessment', icon: '📊', href: '/pflege/sis' },
        { key: 'berichte', label: 'Berichte', icon: '📄', href: '/pflege/berichte' },
        { key: 'uebergaben', label: 'Übergaben', icon: '🔄', href: '/pflege/uebergaben' },
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
