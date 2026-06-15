import type { ProductKey } from '@/types';

export type ModuleExtensionLink = {
  path: string;
  label: string;
  icon: string;
};

/**
 * Extension-Routen pro Modul — für Schnellnavigation zwischen Erweiterungs-Screens.
 */
export const MODULE_EXTENSION_LINKS: Partial<Record<ProductKey, ModuleExtensionLink[]>> = {
  stationaer: [
    { path: '/stationaer/bewohner', label: 'Bewohner:innen', icon: '🏥' },
    { path: '/stationaer/wohnbereiche', label: 'Wohnbereiche', icon: '🛏️' },
    { path: '/stationaer/uebergabebericht', label: 'Übergabebericht', icon: '📝' },
    { path: '/stationaer/auswertungen', label: 'Auswertungen', icon: '📈' },
    { path: '/stationaer/settings', label: 'Einstellungen', icon: '⚙️' },
  ],
  akademie: [
    { path: '/akademie/courses', label: 'Kurse', icon: '🎓' },
    { path: '/akademie/teilnehmer', label: 'Teilnehmer', icon: '👥' },
    { path: '/akademie/zertifikate', label: 'Zertifikate', icon: '🏅' },
    { path: '/akademie/auswertungen', label: 'Auswertungen', icon: '📈' },
    { path: '/akademie/settings', label: 'Einstellungen', icon: '⚙️' },
  ],
  beratung: [
    { path: '/beratung/cases', label: 'Fälle', icon: '📋' },
    { path: '/beratung/zugeordnete-klienten', label: 'Office-Klient:innen', icon: '👥' },
    { path: '/beratung/protokolle', label: 'Protokolle', icon: '📄' },
    { path: '/beratung/wiedervorlagen', label: 'Wiedervorlagen', icon: '🔔' },
    { path: '/beratung/auswertungen', label: 'Auswertungen', icon: '📈' },
    { path: '/beratung/settings', label: 'Einstellungen', icon: '⚙️' },
  ],
  pflege: [
    { path: '/pflege/plans', label: 'Pflegepläne', icon: '📋' },
    { path: '/pflege/vitalwerte', label: 'Vitalwerte', icon: '❤️' },
    { path: '/pflege/zugeordnete-klienten', label: 'Office-Klient:innen', icon: '👥' },
    { path: '/pflege/sis', label: 'SIS', icon: '📊' },
    { path: '/pflege/medikation', label: 'Medikation', icon: '💊' },
    { path: '/pflege/dienstplaene', label: 'Dienstpläne', icon: '📅' },
    { path: '/pflege/dokumentation', label: 'Dokumentation', icon: '📄' },
    { path: '/pflege/wunddokumentation', label: 'Wunddoku', icon: '🩹' },
    { path: '/pflege/auswertungen', label: 'Auswertungen', icon: '📈' },
    { path: '/pflege/settings', label: 'Einstellungen', icon: '⚙️' },
  ],
  assist: [
    { path: '/assist/assignments', label: 'Einsätze', icon: '📋' },
    { path: '/assist/zugeordnete-klienten', label: 'Office-Klient:innen', icon: '👥' },
    { path: '/assist/durchfuehrung', label: 'Durchführung', icon: '✅' },
    { path: '/assist/nachweise', label: 'Nachweise', icon: '📝' },
    { path: '/assist/fahrten', label: 'Fahrten', icon: '🚗' },
    { path: '/assist/calendar', label: 'Kalender', icon: '📅' },
  ],
};

export function getModuleExtensionLinks(productKey: ProductKey): ModuleExtensionLink[] {
  return MODULE_EXTENSION_LINKS[productKey] ?? [];
}

export function getModuleExtensionPaths(productKey: ProductKey): string[] {
  return getModuleExtensionLinks(productKey).map((l) => l.path);
}
