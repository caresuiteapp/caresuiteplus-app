export const PFLEGE_CATALOG_CATEGORIES = [
  'Pflegealltag', 'Pflegeplanung', 'Pflegedokumente', 'Qualität', 'Leistungsabrechnung', 'Betrieb',
] as const;

export type PflegeCatalogCategory = (typeof PFLEGE_CATALOG_CATEGORIES)[number];
type Presentation = Readonly<{ label: string; category: PflegeCatalogCategory; description: string }>;

/** Display metadata only. It neither adds routes nor changes their permission rules or stored widget IDs. */
const presentation = {
  '/pflege': { label: 'Pflegeübersicht', category: 'Pflegealltag', description: 'Zu den Pflegebereichen, Prioritäten und aktuellen Aufgaben.' },
  '/pflege/klienten': { label: 'Pflegeakten', category: 'Pflegealltag', description: 'Stammdaten und Pflegeakten der zugeordneten Klient:innen öffnen.' },
  '/pflege/sis': { label: 'SIS & Assessment', category: 'Pflegeplanung', description: 'Strukturierte Informationssammlungen und Assessments eines Pflegefalls erfassen und wiederfinden.' },
  '/pflege/plans': { label: 'Pflegepläne', category: 'Pflegeplanung', description: 'Bestehende Pflegepläne durchsuchen, Details und Fassungen prüfen.' },
  '/pflege/dokumentation': { label: 'Pflegedokumentation', category: 'Pflegedokumente', description: 'Durchgeführte Versorgung und Beobachtungen im Pflegeverlauf festhalten.' },
  '/pflege/vitalwerte': { label: 'Vitalwerte', category: 'Pflegedokumente', description: 'Messungen erfassen und dokumentierte Werte im Verlauf prüfen.' },
  '/pflege/medikation': { label: 'Medikation', category: 'Pflegedokumente', description: 'Verordnungen, Medikationspläne, Präparate, Arztsuche und dokumentierte Gaben öffnen.' },
  '/pflege/behandlungspflege': { label: 'Behandlungspflege', category: 'Pflegedokumente', description: 'Verordnete Behandlungen und ihre dokumentierte Durchführung prüfen.' },
  '/pflege/wunddokumentation': { label: 'Wunddokumentation', category: 'Pflegedokumente', description: 'Wundfälle, Befunde und dokumentierte Verläufe öffnen.' },
  '/pflege/uebergaben': { label: 'Übergaben', category: 'Pflegealltag', description: 'Pflegerelevante Meldungen an das übernehmende Team weitergeben.' },
  '/pflege/tourenplanung': { label: 'Pflegetouren', category: 'Pflegeplanung', description: 'Pflegetouren mit Besuchen, Zeiten und Zuständigkeiten planen.' },
  '/pflege/risiken': { label: 'Pflegequalität: Risiken', category: 'Qualität', description: 'Erhöhte Pflegerisiken ansehen und ausstehende Risikoüberprüfungen öffnen.' },
  '/pflege/personal': { label: 'Pflegepersonal', category: 'Betrieb', description: 'Mitarbeitende und zugehörige Personalakten im Pflegekontext öffnen.' },
  '/pflege/dienstplaene': { label: 'Dienstplan', category: 'Betrieb', description: 'Dienste, Schichten und Besetzung der Pflege organisieren.' },
  '/pflege/fuhrpark': { label: 'Fuhrpark', category: 'Betrieb', description: 'Die Fahrzeugansicht des Inventars mit Status und Zuordnungen öffnen.' },
  '/pflege/inventar': { label: 'Inventar', category: 'Betrieb', description: 'Geräte, Hilfsmittel, Ausgaben und Rücknahmen im Pflegekontext öffnen.' },
  '/pflege/planung': { label: 'Pflegeplanung & Verlauf', category: 'Pflegeplanung', description: 'Pflegeplanung öffnen, neue Pläne anlegen und den Verlauf mit Zielen und Maßnahmen prüfen.' },
  '/pflege/diagnosen': { label: 'Diagnosen', category: 'Pflegedokumente', description: 'Ärztlich dokumentierte Diagnosen und ihre Pflegerelevanz prüfen.' },
  '/pflege/verordnungen': { label: 'Verordnungen', category: 'Pflegedokumente', description: 'Verordnungen, Genehmigungen und Fristen je Pflegefall prüfen.' },
  '/pflege/berichte': { label: 'Pflegeberichte', category: 'Pflegedokumente', description: 'Pflegeberichte und Beobachtungen chronologisch lesen und erfassen.' },
  '/pflege/evaluation': { label: 'Evaluationen', category: 'Qualität', description: 'Fällige Evaluationen und den Bedarf zur Fortschreibung eines Pflegeplans prüfen.' },
  '/pflege/visiten': { label: 'Pflegevisiten', category: 'Qualität', description: 'Pflegevisiten und fachliche Feststellungen je Pflegefall öffnen.' },
  '/pflege/abweichungen': { label: 'Abweichungen', category: 'Qualität', description: 'Dokumentierte Qualitätsabweichungen und die zugehörige Bearbeitung öffnen.' },
  '/pflege/md-pruefbereitschaft': { label: 'MD-Prüfbereitschaft', category: 'Qualität', description: 'Vorhandene Nachweise je Pflegefall und offene Prüfpunkte ansehen.' },
  '/pflege/reports': { label: 'Qualitätskennzahlen', category: 'Qualität', description: 'Kennzahlen der Pflegequalität prüfen und zu den zugehörigen Arbeitslisten wechseln.' },
  '/pflege/leistungsnachweise': { label: 'Leistungsnachweise', category: 'Leistungsabrechnung', description: 'Nachweise der erbrachten Leistungen erfassen, signieren und prüfen.' },
  '/pflege/abrechnung': { label: 'Abrechnung', category: 'Leistungsabrechnung', description: 'Abrechnungsfälle, offene Prüfpunkte und Freigaben bearbeiten.' },
  '/pflege/rechnungsgrundlagen': { label: 'Rechnungsgrundlagen', category: 'Leistungsabrechnung', description: 'Freigegebene Leistungen für eine Rechnungsgrundlage zusammenfassen.' },
  '/pflege/gesamtabnahme': { label: 'Gesamtabnahme', category: 'Leistungsabrechnung', description: 'Den dokumentierten Stand einer Abrechnungsperiode prüfen und abnehmen.' },
  '/pflege/settings': { label: 'Pflege-Einstellungen', category: 'Betrieb', description: 'Organisation und Einstellungen des Pflegemoduls öffnen.' },
  '/pflege/versorgungsuebersicht': { label: 'Versorgungsübersicht', category: 'Pflegealltag', description: 'Pflegefälle und ihren dokumentierten Versorgungsstand im Überblick prüfen.' },
  '/pflege/aufnahme': { label: 'Aufnahme & Versorgung', category: 'Pflegealltag', description: 'Pflegeaufnahmen vorbereiten und fehlende Voraussetzungen je Fall erkennen.' },
  '/pflege/aufgaben': { label: 'Aufgaben & Wiedervorlagen', category: 'Pflegealltag', description: 'Pflegeaufgaben mit Zuständigkeit, Termin und Bearbeitungsstand verwalten.' },
  '/pflege/calendar': { label: 'Kalender', category: 'Pflegeplanung', description: 'Termine im Pflegekalender ansehen und organisieren.' },
  '/pflege/massnahmen': { label: 'Aktive Maßnahmen', category: 'Pflegeplanung', description: 'Einzelne aktive Maßnahmen nach Klient:in, Zuständigkeit und fälliger Evaluation prüfen.' },
  '/pflege/leistungskatalog': { label: 'Leistungen & Vergütung', category: 'Leistungsabrechnung', description: 'Pflegeleistungen und ihre hinterlegten Vergütungssätze prüfen.' },
  '/pflege/zugeordnete-klienten': { label: 'Zugeordnete Klient:innen', category: 'Pflegealltag', description: 'Die dem Pflegemodul zugeordneten Klient:innen ansehen.' },
} as const satisfies Record<string, Presentation>;

type PflegeCatalogRoute = keyof typeof presentation;

// The existing base widget IDs and order are part of saved desktop preferences.
const widgetRoutes = [
  ['pflege-overview', '/pflege'], ['pflege-clients', '/pflege/klienten'],
  ['pflege-sis', '/pflege/sis'], ['pflege-plans', '/pflege/plans'],
  ['pflege-documentation', '/pflege/dokumentation'], ['pflege-vitals', '/pflege/vitalwerte'],
  ['pflege-medication', '/pflege/medikation'], ['pflege-treatment', '/pflege/behandlungspflege'],
  ['pflege-wounds', '/pflege/wunddokumentation'], ['pflege-handover', '/pflege/uebergaben'],
  ['pflege-tours', '/pflege/tourenplanung'], ['pflege-quality', '/pflege/risiken'],
] as const satisfies readonly (readonly [string, PflegeCatalogRoute])[];

export const PFLEGE_BASE_WIDGETS = widgetRoutes.map(([id, route]) => ({ id, route, ...presentation[route] }));

export function pflegeCatalogPresentation(route: string): Presentation | undefined {
  return Object.hasOwn(presentation, route) ? presentation[route as PflegeCatalogRoute] : undefined;
}
