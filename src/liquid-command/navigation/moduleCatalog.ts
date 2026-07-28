import type { LiquidModuleDefinition, LiquidModuleKey, LiquidWorkArea } from '../types';

export type LiquidGlobalShortcut = {
  id: string;
  label: string;
  description: string;
  glyph: string;
  route: string;
  keywords: string;
};

/**
 * Productive cross-module destinations that must remain reachable from every
 * Liquid Command screen. These routes open the existing, validated workflows;
 * Liquid Command is the navigation owner, not a parallel demo catalogue.
 */
export const liquidGlobalShortcuts: readonly LiquidGlobalShortcut[] = [
  {
    id: 'today',
    label: 'Heute',
    description: 'Unternehmenslage, Klient:innenkarte und heutige Einsätze',
    glyph: '▦',
    route: '/',
    keywords: 'dashboard command center karte klienten heute',
  },
  {
    id: 'assignments',
    label: 'Einsätze',
    description: 'Alle Einsätze, Durchführung, Bearbeitung und Abschluss',
    glyph: '≡',
    route: '/assist?area=assignments',
    keywords: 'termine einsatz visit planung durchführen',
  },
  {
    id: 'clients',
    label: 'Klient:innen',
    description: 'Stammdaten, Versorgung, Budgets und Dokumente',
    glyph: '○',
    route: '/assist?area=clients',
    keywords: 'kunden klienten akte pflegegrad budget',
  },
  {
    id: 'messages',
    label: 'Nachrichten',
    description: 'Posteingang, Unterhaltungen, Aufgaben und Vorlagen',
    glyph: '▱',
    route: '/office/messages',
    keywords: 'kommunikation chat inbox postfach nachrichten',
  },
  {
    id: 'payroll',
    label: 'Gehaltsstatistik',
    description: 'Monatsübersicht, Zeitkonten, Auslagen, PDF und Bestätigung',
    glyph: '€',
    route: '/business/office/payroll',
    keywords: 'gehalt lohn payroll brutto zeitkonto auslagen pdf',
  },
  {
    id: 'timekeeping',
    label: 'Arbeitszeit',
    description: 'Zeiten, Prüfungen, Abwesenheiten, Zeitkonten und Exporte',
    glyph: '◷',
    route: '/business/office/time-tracking',
    keywords: 'arbeitszeit wfm urlaub krank überstunden prüfung',
  },
  {
    id: 'documents',
    label: 'Dokumente',
    description: 'Ablage, Vorschau, Download, Versionen und Signaturen',
    glyph: '□',
    route: '/office?area=documents',
    keywords: 'dateien dokumente unterschrift signatur download vorschau',
  },
  {
    id: 'portals',
    label: 'Portale & Zugänge',
    description: 'Mitarbeitende, Klient:innen, Angehörige und interne Benutzer',
    glyph: '⌘',
    route: '/business/office/access',
    keywords: 'portal zugang login codes mitarbeiter klient angehörige benutzer',
  },
  {
    id: 'bodymap',
    label: 'BodyMap',
    description: 'Körperkarte, Wunden, Dekubitus und Verlaufskontrolle',
    glyph: '⌾',
    route: '/pflege/bodymap',
    keywords: 'körper bodymap wunde dekubitus pflege',
  },
  {
    id: 'profile',
    label: 'Profil',
    description: 'Persönliche Angaben, Sicherheit und Sitzung',
    glyph: '♙',
    route: '/settings/profile',
    keywords: 'profil konto passwort abmelden sicherheit',
  },
] as const;

export const liquidModules: readonly LiquidModuleDefinition[] = [
  {
    key: 'home',
    label: 'Command Center',
    shortLabel: 'Heute',
    glyph: '⌂',
    route: '/',
    description: 'Unternehmenslage, Live-Situation und nächste Entscheidungen.',
    primaryAction: 'Neue Aktion',
  },
  {
    key: 'office',
    label: 'Office',
    shortLabel: 'Office',
    glyph: '▣',
    route: '/office',
    description: 'Unternehmen, Personal, Abrechnung, Dokumente und Audit.',
    primaryAction: 'Datensatz anlegen',
  },
  {
    key: 'assist',
    label: 'Assist',
    shortLabel: 'Assist',
    glyph: '◇',
    route: '/assist',
    description: 'Einsätze, Planung, Live-Status, Nachweise und Budgets.',
    primaryAction: 'Einsatz planen',
  },
  {
    key: 'pflege',
    label: 'Pflege',
    shortLabel: 'Pflege',
    glyph: '✚',
    route: '/pflege',
    description: 'SIS, Maßnahmen, Medikation, Diagnosen und Wunden.',
    primaryAction: 'Dokumentieren',
  },
  {
    key: 'stationaer',
    label: 'Stationär',
    shortLabel: 'Stationär',
    glyph: '▦',
    route: '/stationaer',
    description: 'Bewohner:innen, Wohnbereiche, Schichten und Übergaben.',
    primaryAction: 'Übergabe starten',
  },
  {
    key: 'beratung',
    label: 'Beratung',
    shortLabel: 'Beratung',
    glyph: '◎',
    route: '/beratung',
    description: 'Fälle, Assessments, Empfehlungen und Follow-up.',
    primaryAction: 'Beratungsfall anlegen',
  },
  {
    key: 'akademie',
    label: 'Akademie',
    shortLabel: 'Akademie',
    glyph: '△',
    route: '/akademie',
    description: 'Lernpfade, Kurse, Prüfungen und Pflichtunterweisungen.',
    primaryAction: 'Lerninhalt anlegen',
  },
  {
    key: 'robotics',
    label: 'Robotics',
    shortLabel: 'Robotics',
    glyph: '⬡',
    route: '/robotics',
    description: 'Geräte, Aufgaben, Telemetrie, Wartung und Sicherheitszonen.',
    primaryAction: 'Gerät verbinden',
  },
  {
    key: 'platform',
    label: 'Platform Console',
    shortLabel: 'Platform',
    glyph: '◈',
    route: '/platform',
    description: 'Mandanten, Tarife, Flags, Support, Releases und Audit.',
    primaryAction: 'Mandant öffnen',
  },
  {
    key: 'settings',
    label: 'Einstellungen',
    shortLabel: 'Mehr',
    glyph: '⚙',
    route: '/settings',
    description: 'Organisation, Rollen, Integrationen, Datenschutz und Vorlagen.',
    primaryAction: 'Einstellung suchen',
  },
] as const;

export const liquidWorkAreas: Record<LiquidModuleKey, readonly LiquidWorkArea[]> = {
  home: [
    { id: 'situation', label: 'Versorgung heute', description: 'Alle Klient:innen, Einsätze und Risiken', pageType: 'command-center', route: '/' },
    { id: 'decisions', label: 'Entscheidungen', description: 'Freigaben und Eskalationen', pageType: 'review', route: '/?area=decisions' },
  ],
  office: [
    { id: 'company', label: 'Unternehmen', description: 'Stammdaten, Standorte und Organisation', pageType: 'record', route: '/office?area=company' },
    { id: 'clients', label: 'Klient:innen', description: 'Stammdaten, Akten, Kostenträger und Portale', pageType: 'work-list', route: '/office?area=clients' },
    { id: 'people', label: 'Personal', description: 'Mitarbeitende und Personalakten', pageType: 'work-list', route: '/office?area=people' },
    { id: 'timekeeping', label: 'Arbeitszeit', description: 'Prüfungen, Abwesenheiten und Zeitkonten', pageType: 'review', route: '/business/office/time-tracking' },
    { id: 'payroll', label: 'Gehaltsstatistik', description: 'Monatsberechnung, Auslagen, PDF und Bestätigung', pageType: 'analytics', route: '/business/office/payroll' },
    { id: 'billing', label: 'Rechnungen', description: 'Abrechnung, Zahlungen und Mahnungen', pageType: 'review', route: '/office?area=billing' },
    { id: 'documents', label: 'Dokumente', description: 'Vorschau, Download, Versionen und Signaturen', pageType: 'work-list', route: '/office?area=documents' },
    { id: 'communication', label: 'Nachrichten', description: 'Posteingang, Unterhaltungen, Aufgaben und Vorlagen', pageType: 'work-list', route: '/office/messages' },
    { id: 'portals', label: 'Portale & Zugänge', description: 'Konten, Codes, Rollen und Freigaben', pageType: 'settings', route: '/business/office/access' },
    { id: 'inventory', label: 'Inventar', description: 'Geräte, Ausgabe und Rückgabe', pageType: 'work-list', route: '/office?area=inventory' },
    { id: 'audit', label: 'Audit', description: 'Nachvollziehbare Änderungen und Exporte', pageType: 'analytics', route: '/office?area=audit' },
  ],
  assist: [
    { id: 'clients', label: 'Klient:innen', description: 'Versorgungskontext und Budgets', pageType: 'work-list', route: '/assist?area=clients' },
    { id: 'assignments', label: 'Einsätze', description: 'Status, Bearbeitung und Abschluss', pageType: 'work-list', route: '/assist?area=assignments' },
    { id: 'planning', label: 'Planung', description: 'Kalender, Ressourcen und Konflikte', pageType: 'planning', route: '/assist?area=planning' },
    { id: 'live', label: 'Live-Status', description: 'GPS, Anfahrt und Abweichungen', pageType: 'command-center', route: '/assist?area=live' },
    { id: 'proofs', label: 'Nachweise', description: 'Prüfung, Unterschrift und Freigabe', pageType: 'review', route: '/assist?area=proofs' },
    { id: 'budgets', label: 'Budgets', description: 'Anspruch, Verbrauch und Prognose', pageType: 'analytics', route: '/assist?area=budgets' },
    { id: 'portals', label: 'Portale', description: 'Zugänge und Freigaben', pageType: 'settings', route: '/assist?area=portals' },
  ],
  pflege: [
    { id: 'sis', label: 'SIS', description: 'Strukturierte Informationssammlung', pageType: 'editor', route: '/pflege?area=sis' },
    { id: 'measures', label: 'Maßnahmen', description: 'Planung und Evaluation', pageType: 'planning', route: '/pflege?area=measures' },
    { id: 'medication', label: 'Medikation', description: 'Plan, Gabe und Abweichung', pageType: 'review', route: '/pflege?area=medication' },
    { id: 'diagnoses', label: 'Diagnosen', description: 'Diagnosen und Verordnungen', pageType: 'record', route: '/pflege?area=diagnoses' },
    { id: 'wounds', label: 'Wunden', description: 'BodyMap, Dekubitus und Verlauf', pageType: 'editor', route: '/pflege?area=wounds' },
    { id: 'vitals', label: 'Vitalwerte', description: 'Erfassung, Verlauf und Grenzwerte', pageType: 'analytics', route: '/pflege?area=vitals' },
    { id: 'reports', label: 'Pflegeberichte', description: 'Chronologie und Freigabe', pageType: 'work-list', route: '/pflege?area=reports' },
  ],
  stationaer: [
    { id: 'residents', label: 'Bewohner:innen', description: 'Akte und Versorgung', pageType: 'work-list', route: '/stationaer?area=residents' },
    { id: 'wards', label: 'Wohnbereiche', description: 'Belegung und Ressourcen', pageType: 'planning', route: '/stationaer?area=wards' },
    { id: 'shifts', label: 'Schichten', description: 'Besetzung und Übergaben', pageType: 'planning', route: '/stationaer?area=shifts' },
    { id: 'handover', label: 'Übergaben', description: 'Risiken, Aufgaben und Bestätigung', pageType: 'review', route: '/stationaer?area=handover' },
    { id: 'services', label: 'Leistungen', description: 'Durchführung und Nachweise', pageType: 'work-list', route: '/stationaer?area=services' },
    { id: 'occupancy', label: 'Belegung', description: 'Kapazität und Prognose', pageType: 'analytics', route: '/stationaer?area=occupancy' },
  ],
  beratung: [
    { id: 'cases', label: 'Beratungsfälle', description: 'Status, Verantwortung und Verlauf', pageType: 'work-list', route: '/beratung?area=cases' },
    { id: 'appointments', label: 'Termine', description: 'Planung und Vorbereitung', pageType: 'planning', route: '/beratung?area=appointments' },
    { id: 'assessments', label: 'Assessments', description: 'Geführte Erhebung', pageType: 'editor', route: '/beratung?area=assessments' },
    { id: 'recommendations', label: 'Empfehlungen', description: 'Maßnahmen und Freigabe', pageType: 'review', route: '/beratung?area=recommendations' },
    { id: 'proofs', label: 'Nachweise', description: 'Dokumentation und Export', pageType: 'work-list', route: '/beratung?area=proofs' },
    { id: 'follow-up', label: 'Follow-up', description: 'Wiedervorlagen und Ergebnisse', pageType: 'planning', route: '/beratung?area=follow-up' },
  ],
  akademie: [
    { id: 'paths', label: 'Lernpfade', description: 'Rollenbasierte Entwicklung', pageType: 'planning', route: '/akademie?area=paths' },
    { id: 'courses', label: 'Kurse', description: 'Inhalte und Termine', pageType: 'work-list', route: '/akademie?area=courses' },
    { id: 'exams', label: 'Prüfungen', description: 'Durchführung und Bewertung', pageType: 'review', route: '/akademie?area=exams' },
    { id: 'certificates', label: 'Zertifikate', description: 'Nachweis und Gültigkeit', pageType: 'work-list', route: '/akademie?area=certificates' },
    { id: 'mandatory', label: 'Pflichtunterweisungen', description: 'Fristen und Eskalation', pageType: 'analytics', route: '/akademie?area=mandatory' },
  ],
  robotics: [
    { id: 'devices', label: 'Geräte', description: 'Zustand und Zuordnung', pageType: 'work-list', route: '/robotics?area=devices' },
    { id: 'tasks', label: 'Aufgaben', description: 'Aufträge und Prioritäten', pageType: 'planning', route: '/robotics?area=tasks' },
    { id: 'telemetry', label: 'Telemetrie', description: 'Live-Daten und Abweichungen', pageType: 'analytics', route: '/robotics?area=telemetry' },
    { id: 'maintenance', label: 'Wartung', description: 'Intervalle und Nachweise', pageType: 'review', route: '/robotics?area=maintenance' },
    { id: 'zones', label: 'Sicherheitszonen', description: 'Freigaben und Grenzen', pageType: 'settings', route: '/robotics?area=zones' },
    { id: 'handover', label: 'Übergaben', description: 'Mensch-Maschine-Verantwortung', pageType: 'review', route: '/robotics?area=handover' },
  ],
  platform: [
    { id: 'tenants', label: 'Mandanten', description: 'Status, Module und Limits', pageType: 'work-list', route: '/platform?area=tenants' },
    { id: 'plans', label: 'Tarife', description: 'Pläne, Rabatte und Grenzen', pageType: 'settings', route: '/platform?area=plans' },
    { id: 'billing', label: 'Abrechnung', description: 'Rechnungen und Zahlungen', pageType: 'review', route: '/platform?area=billing' },
    { id: 'flags', label: 'Feature Flags', description: 'Kontrollierte Freigaben', pageType: 'settings', route: '/platform?area=flags' },
    { id: 'support', label: 'Support', description: 'Fälle und Systemdiagnose', pageType: 'work-list', route: '/platform?area=support' },
    { id: 'releases', label: 'Releases', description: 'Versionen und Deploy-Status', pageType: 'review', route: '/platform?area=releases' },
    { id: 'audit', label: 'Audit', description: 'Systemweite Ereignisse', pageType: 'analytics', route: '/platform?area=audit' },
  ],
  settings: [
    { id: 'organization', label: 'Organisation', description: 'Stammdaten und Standorte', pageType: 'settings', route: '/settings?area=organization' },
    { id: 'roles', label: 'Rollen & Rechte', description: 'Berechtigungen und Wirkung', pageType: 'settings', route: '/settings?area=roles' },
    { id: 'integrations', label: 'Integrationen', description: 'Workspace, DATEV und Telemedizin', pageType: 'settings', route: '/settings?area=integrations' },
    { id: 'privacy', label: 'Datenschutz', description: 'Einwilligungen und Aufbewahrung', pageType: 'settings', route: '/settings?area=privacy' },
    { id: 'templates', label: 'Vorlagen', description: 'Dokumente und Kommunikation', pageType: 'settings', route: '/settings?area=templates' },
    { id: 'branding', label: 'Branding', description: 'Mandantenidentität ohne Modulfarben', pageType: 'settings', route: '/settings?area=branding' },
  ],
};

export function getLiquidModule(key: LiquidModuleKey): LiquidModuleDefinition {
  return liquidModules.find((module) => module.key === key) ?? liquidModules[0];
}
