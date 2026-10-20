/**
 * System-Seeds für Assist-Kataloge (C.ASSIST-OFFICE-TEMPLATE.1)
 * Single Source of Truth für Demo-Modus, Tests und SQL-Migration-Referenz.
 */
import type {
  CatalogDefinition,
  CatalogGroup,
  CatalogItem,
  TemplateBinding,
} from '@/types/assistCatalog';

const NOW = '2026-01-01T00:00:00.000Z';

function gid(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const suffix = (h + 0x100000000).toString(16).padStart(12, '0').slice(-12);
  return `a1000000-0000-4000-8000-${suffix}`;
}

function cid(catalogKey: string, itemKey: string): string {
  return gid(`${catalogKey}::${itemKey}`);
}

function defId(catalogKey: string): string {
  return gid(`def::${catalogKey}`);
}

export const ASSIST_CATALOG_GROUPS: CatalogGroup[] = [
  { id: gid('grp-assist-einsatz'), tenantId: null, moduleScope: 'assist', groupKey: 'assist_einsatz', name: 'Assist Einsatz', description: 'Einsatzplanung und -durchführung', icon: '📋', color: '#2563eb', sortOrder: 1, isSystemDefault: true, isActive: true, createdAt: NOW, updatedAt: NOW },
  { id: gid('grp-neuaufnahme'), tenantId: null, moduleScope: 'assist', groupKey: 'neuaufnahme', name: 'Neuaufnahme', description: 'Aufnahme und Erstbesuch', icon: '📝', color: '#7c3aed', sortOrder: 2, isSystemDefault: true, isActive: true, createdAt: NOW, updatedAt: NOW },
  { id: gid('grp-dokumentation'), tenantId: null, moduleScope: 'assist', groupKey: 'dokumentation', name: 'Dokumentation', description: 'Textbausteine und Nachweise', icon: '📄', color: '#059669', sortOrder: 3, isSystemDefault: true, isActive: true, createdAt: NOW, updatedAt: NOW },
  { id: gid('grp-dokumente'), tenantId: null, moduleScope: 'assist', groupKey: 'dokumente', name: 'Dokumente', description: 'Dokumentvorlagen', icon: '📑', color: '#0891b2', sortOrder: 4, isSystemDefault: true, isActive: true, createdAt: NOW, updatedAt: NOW },
  { id: gid('grp-aufgaben'), tenantId: null, moduleScope: 'assist', groupKey: 'aufgaben', name: 'Aufgaben', description: 'Pakete und Einzelaufgaben', icon: '✅', color: '#d97706', sortOrder: 5, isSystemDefault: true, isActive: true, createdAt: NOW, updatedAt: NOW },
  { id: gid('grp-abrechnung'), tenantId: null, moduleScope: 'assist', groupKey: 'abrechnung', name: 'Abrechnung', description: 'Budgets und Abrechnungsstatus', icon: '💶', color: '#64748b', sortOrder: 6, isSystemDefault: true, isActive: true, createdAt: NOW, updatedAt: NOW },
];

type DefSeed = Omit<CatalogDefinition, 'createdAt' | 'updatedAt'>;

function def(
  catalogKey: string,
  name: string,
  groupKey: string,
  catalogType: CatalogDefinition['catalogType'],
  selectionMode: CatalogDefinition['selectionMode'],
  sortOrder: number,
): DefSeed {
  const group = ASSIST_CATALOG_GROUPS.find((g) => g.groupKey === groupKey);
  return {
    id: defId(catalogKey),
    tenantId: null,
    groupId: group?.id ?? null,
    moduleScope: 'assist',
    catalogKey,
    name,
    description: null,
    catalogType,
    selectionMode,
    visibilityScope: 'assist',
    requiredPermission: null,
    isSystemDefault: true,
    isEditable: false,
    isActive: true,
    sortOrder,
  };
}

export const ASSIST_CATALOG_DEFINITIONS: DefSeed[] = [
  def('assist.assignment.subjects', 'Einsatz-Betreff', 'assist_einsatz', 'single_select', 'searchable_dropdown', 1),
  def('assist.assignment.types', 'Einsatzarten', 'assist_einsatz', 'chip_select', 'grouped_chips', 2),
  def('assist.service.categories', 'Leistungskategorien', 'assist_einsatz', 'chip_select', 'chips', 3),
  def('assist.task.packages', 'Aufgabenpakete', 'aufgaben', 'task_package', 'template_picker', 4),
  def('assist.task.items', 'Einzelaufgaben', 'aufgaben', 'task_item', 'checkbox_list', 5),
  def('assist.documentation.quick_blocks', 'Dokumentationsbausteine', 'dokumentation', 'text_block', 'quick_insert', 6),
  def('assist.task.not_completed_reasons', 'Gründe: Aufgabe nicht erledigt', 'assist_einsatz', 'status_reason', 'dropdown', 7),
  def('assist.assignment.abort_reasons', 'Einsatzabbruchgründe', 'assist_einsatz', 'status_reason', 'dropdown', 8),
  def('assist.assignment.cancellation_reasons', 'Ausfallgründe', 'assist_einsatz', 'status_reason', 'dropdown', 9),
  def('assist.intake.templates', 'Neuaufnahme-Vorlagen', 'neuaufnahme', 'form_template', 'template_picker', 10),
  def('assist.intake.service_wish', 'Leistungswunsch', 'neuaufnahme', 'multi_select', 'chips', 11),
  def('assist.intake.household', 'Haushaltssituation', 'neuaufnahme', 'multi_select', 'chips', 12),
  def('assist.intake.mobility', 'Mobilität', 'neuaufnahme', 'multi_select', 'chips', 13),
  def('assist.intake.orientation', 'Orientierung / Kommunikation', 'neuaufnahme', 'multi_select', 'chips', 14),
  def('assist.intake.access', 'Zugang', 'neuaufnahme', 'multi_select', 'chips', 15),
  def('assist.intake.risks', 'Risiken / Hinweise', 'neuaufnahme', 'multi_select', 'chips', 16),
  def('assist.intake.documents', 'Dokumente / Einwilligungen', 'neuaufnahme', 'multi_select', 'chips', 17),
  def('assist.document.types', 'Dokumentarten', 'dokumente', 'single_select', 'dropdown', 18),
  def('assist.service_proof.templates', 'Leistungsnachweis-Vorlagen', 'dokumentation', 'document_template', 'template_picker', 19),
  def('assist.communication.templates', 'Kommunikationsvorlagen', 'dokumentation', 'template', 'quick_insert', 20),
  def('assist.billing.budget_sources', 'Abrechnungstöpfe', 'abrechnung', 'billing_category', 'dropdown', 21),
  def('assist.billing.statuses', 'Abrechnungsstatus', 'abrechnung', 'single_select', 'dropdown', 22),
  def('assist.billing.notes', 'Abrechnungshinweise', 'abrechnung', 'text_block', 'quick_insert', 23),
  def('assist.risk_flags', 'Risiken & Hinweise', 'assist_einsatz', 'chip_select', 'chips', 24),
];

function itemsFromLabels(
  catalogKey: string,
  labels: string[],
  extra?: Partial<CatalogItem>,
): CatalogItem[] {
  const catalogId = defId(catalogKey);
  return labels.map((label, i) => ({
    id: cid(catalogKey, `${slug(label)}_${i}`),
    tenantId: null,
    catalogId,
    parentItemId: null,
    itemKey: `${slug(label)}_${i}`,
    label,
    shortLabel: null,
    description: null,
    helperText: null,
    tags: [],
    icon: null,
    color: null,
    sortOrder: i,
    isSystemDefault: true,
    isActive: true,
    isBillableRelevant: false,
    isDocumentationRequired: false,
    isSignatureRelevant: false,
    isRiskRelevant: false,
    defaultDurationMinutes: null,
    defaultPriceHint: null,
    defaultUnit: null,
    payloadJson: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...extra,
  }));
}

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const SUBJECTS = [
  'Regelmäßige Alltagsbegleitung', 'Hauswirtschaftliche Unterstützung', 'Einkauf und Besorgung',
  'Begleitung außer Haus', 'Gesellschaft und Betreuung', 'Entlastung pflegender Angehöriger',
  'Unterstützung im Haushalt', 'Aktivierung und Beschäftigung', 'Terminbegleitung', 'Arztbegleitung',
  'Behördenbegleitung', 'Spaziergang / Mobilisation im Alltag', 'Mahlzeitenunterstützung',
  'Wäscheversorgung', 'Wohnumfeld ordnen', 'Kontroll-/Entlastungsbesuch', 'Erstbesuch / Neuaufnahme',
  'Kennenlerntermin', 'Beratungsnahes Aufnahmegespräch', 'Dokumentations-/Nachweistermin',
  'Vertretungseinsatz', 'Zusatztermin', 'kurzfristiger Entlastungseinsatz', 'Ausfall-/Ersatztermin',
  'Klient:in nicht angetroffen', 'Einsatzabbruch', 'Notfall-/Auffälligkeitsmeldung',
  'Rücksprache mit Angehörigen erforderlich', 'Rücksprache mit Büro erforderlich', 'individueller Einsatz',
];

const ASSIGNMENT_TYPE_GROUPS: Record<string, string[]> = {
  regelversorgung: ['Regeltermin', 'wiederkehrender Einsatz', 'wöchentlicher Einsatz', '14-tägiger Einsatz', 'monatlicher Einsatz'],
  zusatzversorgung: ['Zusatztermin', 'kurzfristiger Termin', 'Ersatztermin', 'Vertretungseinsatz', 'einmaliger Einsatz'],
  aufnahme: ['Erstbesuch', 'Neuaufnahme', 'Kennenlerntermin', 'Aufnahmeprüfung', 'Dokumentenprüfung', 'Angehörigengespräch'],
  besonderheiten: ['Ausfalleinsatz', 'Klient:in nicht angetroffen', 'abgebrochener Einsatz', 'Notfallbezogener Einsatz', 'Einsatz mit Rücksprachebedarf'],
};

const SERVICE_CATEGORIES = [
  'Hauswirtschaft', 'Alltagsbegleitung', 'Betreuung', 'Begleitung außer Haus', 'Einkauf / Besorgung',
  'Entlastung Angehörige', 'Organisation im Alltag', 'Aktivierung', 'Gesellschaft leisten',
  'Mahlzeitenbezogene Unterstützung', 'Wäsche / Ordnung', 'Dokumentation / Aufnahme',
  'Kommunikation / Rücksprache', 'Sonstiges',
];

type TaskPackageSeed = {
  key: string;
  label: string;
  description: string;
  durationMinutes: number;
  tasks: { title: string; mandatory?: boolean; optional?: boolean }[];
  employeeHint?: string;
};

const TASK_PACKAGES: TaskPackageSeed[] = [
  {
    key: 'hw_standard_2h',
    label: 'Hauswirtschaft Standard — 2 Stunden',
    description: 'Standardpaket für hauswirtschaftliche Unterstützung im Rahmen der Alltagsunterstützung.',
    durationMinutes: 120,
    tasks: [
      { title: 'Einsatzbeginn dokumentieren', mandatory: true },
      { title: 'kurze Sichtkontrolle Wohnbereich' },
      { title: 'Küche aufräumen' },
      { title: 'Arbeitsflächen in der Küche reinigen' },
      { title: 'Bad sichtreinigen' },
      { title: 'Staubsaugen' },
      { title: 'Boden wischen nach Bedarf', optional: true },
      { title: 'Müll entsorgen', optional: true },
      { title: 'Wäsche sortieren nach Bedarf', optional: true },
      { title: 'Abschlusskontrolle', mandatory: true },
      { title: 'Einsatz dokumentieren', mandatory: true },
    ],
  },
  {
    key: 'hw_kompakt_1h',
    label: 'Hauswirtschaft Kompakt — 1 Stunde',
    description: 'Kompakte hauswirtschaftliche Unterstützung.',
    durationMinutes: 60,
    tasks: [
      { title: 'Küche sichtreinigen' },
      { title: 'Bad sichtreinigen' },
      { title: 'Müll prüfen/entsorgen' },
      { title: 'kurze Ordnung herstellen' },
      { title: 'Einsatz dokumentieren', mandatory: true },
    ],
  },
  {
    key: 'hw_intensiv_3h',
    label: 'Hauswirtschaft Intensiv — 3 Stunden',
    description: 'Intensive hauswirtschaftliche Unterstützung.',
    durationMinutes: 180,
    tasks: [
      { title: 'Wohnbereich aufräumen' },
      { title: 'Küche reinigen' },
      { title: 'Bad reinigen' },
      { title: 'Flur reinigen' },
      { title: 'Staubsaugen' },
      { title: 'Boden wischen' },
      { title: 'Wäsche sortieren' },
      { title: 'Waschmaschine vorbereiten/starten, soweit vereinbart' },
      { title: 'Müll entsorgen' },
      { title: 'Bettwäsche wechseln, soweit vereinbart' },
      { title: 'Rückmeldung an Büro bei Auffälligkeiten' },
      { title: 'Einsatz dokumentieren', mandatory: true },
    ],
  },
  {
    key: 'einkauf_standard',
    label: 'Einkauf Standard',
    description: 'Einkaufsservice für den Haushalt.',
    durationMinutes: 90,
    tasks: [
      { title: 'Einkaufsliste prüfen' },
      { title: 'Budget/Geldübergabe dokumentieren, falls relevant' },
      { title: 'Einkauf durchführen' },
      { title: 'Kassenbon sichern/fotografieren, falls erlaubt' },
      { title: 'Einkäufe einräumen' },
      { title: 'Rückgeld übergeben/dokumentieren' },
      { title: 'Einsatz dokumentieren', mandatory: true },
    ],
  },
  {
    key: 'einkauf_begleitung',
    label: 'Einkauf mit Begleitung',
    description: 'Begleiteter Einkauf.',
    durationMinutes: 120,
    tasks: [
      { title: 'Klient:in abholen/vorbereiten' },
      { title: 'Einkaufsliste prüfen' },
      { title: 'gemeinsame Einkaufsfahrt/Wegeplanung' },
      { title: 'Begleitung im Geschäft' },
      { title: 'Einkäufe transportieren' },
      { title: 'Einkäufe einräumen' },
      { title: 'Rückkehr dokumentieren' },
      { title: 'Einsatz dokumentieren', mandatory: true },
    ],
  },
  {
    key: 'begleitung_arzt',
    label: 'Begleitung Arzttermin',
    description: 'Begleitung zu medizinischen Terminen — keine medizinische Beratung.',
    durationMinutes: 120,
    tasks: [
      { title: 'Terminzeit prüfen' },
      { title: 'Unterlagen prüfen, soweit bereitgestellt' },
      { title: 'Klient:in begleiten' },
      { title: 'Wartezeit dokumentieren' },
      { title: 'Rückweg begleiten' },
      { title: 'Rückmeldung an Büro/Angehörige, falls vereinbart' },
      { title: 'keine medizinische Beratung durchführen', mandatory: true },
      { title: 'Einsatz dokumentieren', mandatory: true },
    ],
  },
  {
    key: 'begleitung_behoerde',
    label: 'Behörden-/Terminbegleitung',
    description: 'Begleitung zu Behörden- und Terminen.',
    durationMinutes: 120,
    tasks: [
      { title: 'Termin prüfen' },
      { title: 'benötigte Unterlagen erinnern' },
      { title: 'Begleitung zum Termin' },
      { title: 'Wartezeit begleiten' },
      { title: 'Rückweg begleiten' },
      { title: 'offene Punkte notieren' },
      { title: 'Rückmeldung an Büro, falls erforderlich' },
      { title: 'Einsatz dokumentieren', mandatory: true },
    ],
  },
  {
    key: 'gesellschaft_betreuung',
    label: 'Gesellschaft & Betreuung',
    description: 'Gesellschaft leisten und betreuen.',
    durationMinutes: 120,
    tasks: [
      { title: 'Begrüßung und Befinden allgemein wahrnehmen' },
      { title: 'Gespräch führen' },
      { title: 'gemeinsame Beschäftigung nach Wunsch' },
      { title: 'Vorlesen / Spiele / Erinnerungsarbeit nach Wunsch' },
      { title: 'Getränk anbieten, soweit vereinbart' },
      { title: 'Spaziergang nach Wunsch' },
      { title: 'Auffälligkeiten dokumentieren' },
      { title: 'Einsatz dokumentieren', mandatory: true },
    ],
  },
  {
    key: 'aktivierung_spaziergang',
    label: 'Aktivierung & Spaziergang',
    description: 'Aktivierung und Spaziergang im Alltag.',
    durationMinutes: 90,
    tasks: [
      { title: 'Tagesform einschätzen' },
      { title: 'Spaziergang vorbereiten' },
      { title: 'wettergerechte Kleidung erinnern' },
      { title: 'Spaziergang begleiten' },
      { title: 'Pausen ermöglichen' },
      { title: 'Rückkehr sicherstellen' },
      { title: 'Auffälligkeiten dokumentieren' },
      { title: 'Einsatz dokumentieren', mandatory: true },
    ],
  },
  {
    key: 'entlastung_angehoerige',
    label: 'Entlastung Angehörige',
    description: 'Entlastung pflegender Angehöriger.',
    durationMinutes: 120,
    tasks: [
      { title: 'Übergabe mit Angehörigen' },
      { title: 'Betreuungswunsch klären' },
      { title: 'Klient:in betreuen' },
      { title: 'Beschäftigung anbieten' },
      { title: 'Angehörige entlasten' },
      { title: 'Abschlussrückmeldung geben' },
      { title: 'Einsatz dokumentieren', mandatory: true },
    ],
  },
  {
    key: 'mahlzeitennahe',
    label: 'Mahlzeitennahe Unterstützung',
    description: 'Unterstützung rund um Mahlzeiten — keine medizinische Ernährungstherapie.',
    durationMinutes: 60,
    tasks: [
      { title: 'Küche vorbereiten' },
      { title: 'Mahlzeit bereitstellen oder einfache Vorbereitung unterstützen, soweit vereinbart' },
      { title: 'Tisch vorbereiten' },
      { title: 'nach dem Essen aufräumen' },
      { title: 'Küche sichtreinigen' },
      { title: 'Einsatz dokumentieren', mandatory: true },
    ],
    employeeHint: 'Keine medizinische Ernährungstherapie. Keine pflegerische Nahrungsanreicherung als Behandlungspflege.',
  },
  {
    key: 'waesche_ordnung',
    label: 'Wäsche & Ordnung',
    description: 'Wäscheversorgung und Ordnung.',
    durationMinutes: 90,
    tasks: [
      { title: 'Wäsche sammeln/sortieren' },
      { title: 'Waschmaschine vorbereiten/starten, falls vereinbart' },
      { title: 'trockene Wäsche zusammenlegen' },
      { title: 'Wäsche einräumen' },
      { title: 'Wohnbereich ordnen' },
      { title: 'Einsatz dokumentieren', mandatory: true },
    ],
  },
  {
    key: 'erstbesuch_neuaufnahme',
    label: 'Erstbesuch / Neuaufnahme',
    description: 'Erstbesuch und Neuaufnahme dokumentieren.',
    durationMinutes: 90,
    tasks: [
      { title: 'Stammdaten prüfen' },
      { title: 'Pflegegrad/Budgetinformationen aufnehmen' },
      { title: 'Leistungswunsch erfassen' },
      { title: 'Haushaltssituation erfassen' },
      { title: 'Zugang/Hinweise erfassen' },
      { title: 'Risiken/Hinweise erfassen' },
      { title: 'Dokumente prüfen' },
      { title: 'Einwilligungen prüfen' },
      { title: 'Folgeprozess anlegen' },
      { title: 'Neuaufnahme dokumentieren', mandatory: true },
    ],
  },
  {
    key: 'kontroll_entlastung',
    label: 'Kontroll-/Entlastungsbesuch',
    description: 'Kurzer Kontroll- und Entlastungsbesuch.',
    durationMinutes: 60,
    tasks: [
      { title: 'Klient:in antreffen prüfen' },
      { title: 'allgemeines Befinden wahrnehmen' },
      { title: 'Haushaltssituation grob prüfen' },
      { title: 'vereinbarte kurze Hilfe leisten' },
      { title: 'Auffälligkeiten melden' },
      { title: 'Einsatz dokumentieren', mandatory: true },
    ],
  },
  {
    key: 'nicht_angetroffen',
    label: 'Klient:in nicht angetroffen',
    description: 'Protokoll wenn niemand angetroffen wurde.',
    durationMinutes: 15,
    tasks: [
      { title: 'Klingeln/Kontaktversuch dokumentieren' },
      { title: 'telefonischen Kontaktversuch dokumentieren' },
      { title: 'Wartezeit dokumentieren' },
      { title: 'Rückmeldung an Büro' },
      { title: 'Nachbarn nur datenschutzkonform und ohne sensible Angaben einbeziehen' },
      { title: 'Einsatz als nicht angetroffen dokumentieren', mandatory: true },
      { title: 'Folgeentscheidung durch Büro markieren', mandatory: true },
    ],
    employeeHint: 'Pflichtnotiz und Pflichtgrund erforderlich.',
  },
];

const TASK_ITEM_CATEGORIES: Record<string, string[]> = {
  einsatzstart: [
    'Einsatz antreten', 'Unterwegs markieren', 'Angekommen markieren', 'Einsatz starten',
    'Klient:in begrüßen', 'Tagesform allgemein wahrnehmen', 'kurze Übergabe mit Angehörigen',
    'Zugangssituation prüfen', 'Schlüssel-/Türsituation prüfen', 'Besonderheiten vor Beginn dokumentieren',
  ],
  haushalt: [
    'Küche aufräumen', 'Arbeitsflächen reinigen', 'Geschirr einräumen', 'Geschirr ausräumen',
    'Spülmaschine einräumen', 'Spülmaschine ausräumen', 'Bad sichtreinigen', 'Toilette sichtreinigen',
    'Waschbecken reinigen', 'Dusche/Badewanne sichtreinigen', 'Staubsaugen', 'Boden wischen',
    'Staub wischen', 'Müll entsorgen', 'Kühlschrank grob prüfen', 'Wohnbereich ordnen', 'Flur ordnen',
    'Bettwäsche wechseln', 'Blumen gießen',
  ],
  waesche: [
    'Wäsche sortieren', 'Waschmaschine befüllen', 'Waschmaschine starten', 'Wäsche aufhängen',
    'Wäsche abhängen', 'Wäsche zusammenlegen', 'Wäsche einräumen', 'Handtücher wechseln',
  ],
  einkauf: [
    'Einkaufsliste aufnehmen', 'Einkaufsliste prüfen', 'Einkauf durchführen', 'Post einwerfen',
    'Paket abgeben', 'Besorgung erledigen', 'Kassenbon sichern', 'Rückgeld dokumentieren', 'Einkäufe einräumen',
  ],
  begleitung: [
    'Spaziergang begleiten', 'Arzttermin begleiten', 'Behördentermin begleiten', 'Einkauf begleiten',
    'Wartezeit dokumentieren', 'Rückkehr sicherstellen',
  ],
  betreuung: [
    'Gespräch führen', 'Gesellschaft leisten', 'Vorlesen', 'Gesellschaftsspiel anbieten',
    'Erinnerungsarbeit', 'Musik hören', 'leichte Aktivierung im Alltag', 'Spaziergang anbieten',
    'Getränk anbieten, soweit vereinbart',
  ],
  organisation: [
    'Termine erinnern', 'Unterlagen sortieren', 'einfache Post vorsortieren', 'Rückrufwunsch notieren',
    'Büro-Rückmeldung erstellen', 'Folgetermin prüfen', 'Materialbedarf melden',
  ],
  dokumentation: [
    'Einsatz dokumentieren', 'Besonderheit dokumentieren', 'Leistungsnachweis erzeugen',
    'Unterschrift einholen', 'Abschlussnotiz erstellen',
  ],
  warnhinweis: [
    'Medikamente stellen', 'Medikamente verabreichen', 'Injektionen', 'Wundversorgung',
    'medizinische Beratung', 'pflegerische Körperpflege als Pflegeleistung',
    'Finanzentscheidungen treffen', 'Rechtsberatung',
  ],
};

const DOC_BLOCKS: Record<string, string[]> = {
  allgemein: [
    'Einsatz wurde planmäßig durchgeführt.', 'Klient:in wurde wohlauf angetroffen.',
    'Keine besonderen Auffälligkeiten festgestellt.', 'Aufgaben wurden gemäß Planung erledigt.',
    'Wohnung wurde ordnungsgemäß verlassen.', 'Rückmeldung an das Büro ist erforderlich.',
  ],
  aufgabenstatus: [
    'Einzelne Aufgaben wurden auf Wunsch der Klientin/des Klienten nicht durchgeführt.',
    'Einzelne Aufgaben konnten aus zeitlichen Gründen nicht vollständig durchgeführt werden.',
    'Einzelne Aufgaben waren aufgrund der Situation vor Ort nicht möglich.',
  ],
  auffaelligkeiten: [
    'Auffälligkeit wurde festgestellt und dokumentiert.', 'Rücksprache mit Büro erforderlich.',
    'Dringende Rückmeldung erforderlich.',
  ],
  nicht_angetroffen: [
    'Klient:in wurde zum geplanten Einsatzzeitpunkt nicht angetroffen.', 'Es wurde geklingelt.',
    'Büro wurde informiert.',
  ],
  abbruch: [
    'Einsatz wurde vorzeitig beendet.', 'Büro wurde über den Abbruch informiert.',
  ],
};

function buildAssignmentTypeItems(): CatalogItem[] {
  const catalogKey = 'assist.assignment.types';
  const catalogId = defId(catalogKey);
  const items: CatalogItem[] = [];
  let order = 0;
  for (const [groupKey, labels] of Object.entries(ASSIGNMENT_TYPE_GROUPS)) {
    for (const label of labels) {
      items.push({
        id: cid(catalogKey, `${groupKey}_${slug(label)}`),
        tenantId: null,
        catalogId,
        parentItemId: null,
        itemKey: `${groupKey}_${slug(label)}`,
        label,
        shortLabel: null,
        description: null,
        helperText: null,
        tags: [groupKey],
        icon: null,
        color: null,
        sortOrder: order++,
        isSystemDefault: true,
        isActive: true,
        isBillableRelevant: false,
        isDocumentationRequired: false,
        isSignatureRelevant: false,
        isRiskRelevant: false,
        defaultDurationMinutes: null,
        defaultPriceHint: null,
        defaultUnit: null,
        payloadJson: { groupKey },
        createdAt: NOW,
        updatedAt: NOW,
      });
    }
  }
  return items;
}

function buildTaskPackages(): CatalogItem[] {
  const catalogKey = 'assist.task.packages';
  const catalogId = defId(catalogKey);
  const packages: CatalogItem[] = [];
  const childTasks: CatalogItem[] = [];

  TASK_PACKAGES.forEach((pkg, pi) => {
    const packageId = cid(catalogKey, pkg.key);
    packages.push({
      id: packageId,
      tenantId: null,
      catalogId,
      parentItemId: null,
      itemKey: pkg.key,
      label: pkg.label,
      shortLabel: null,
      description: pkg.description,
      helperText: pkg.employeeHint ?? null,
      tags: ['task_package'],
      icon: '📦',
      color: null,
      sortOrder: pi,
      isSystemDefault: true,
      isActive: true,
      isBillableRelevant: true,
      isDocumentationRequired: true,
      isSignatureRelevant: false,
      isRiskRelevant: false,
      defaultDurationMinutes: pkg.durationMinutes,
      defaultPriceHint: null,
      defaultUnit: 'Minuten',
      payloadJson: { packageType: 'task_package' },
      createdAt: NOW,
      updatedAt: NOW,
    });

    pkg.tasks.forEach((t, ti) => {
      childTasks.push({
        id: cid(catalogKey, `${pkg.key}__${slug(t.title)}`),
        tenantId: null,
        catalogId,
        parentItemId: packageId,
        itemKey: `${pkg.key}__${slug(t.title)}`,
        label: t.title,
        shortLabel: null,
        description: null,
        helperText: null,
        tags: ['package_task'],
        icon: null,
        color: null,
        sortOrder: ti,
        isSystemDefault: true,
        isActive: true,
        isBillableRelevant: true,
        isDocumentationRequired: true,
        isSignatureRelevant: false,
        isRiskRelevant: false,
        defaultDurationMinutes: null,
        defaultPriceHint: null,
        defaultUnit: null,
        payloadJson: {
          isMandatory: Boolean(t.mandatory),
          isOptional: Boolean(t.optional),
        },
        createdAt: NOW,
        updatedAt: NOW,
      });
    });
  });

  return [...packages, ...childTasks];
}

function buildTaskItems(): CatalogItem[] {
  const catalogKey = 'assist.task.items';
  const catalogId = defId(catalogKey);
  const items: CatalogItem[] = [];
  let order = 0;
  for (const [category, labels] of Object.entries(TASK_ITEM_CATEGORIES)) {
    const notExecutable = category === 'warnhinweis';
    for (const label of labels) {
      items.push({
        id: cid(catalogKey, `${category}_${slug(label)}`),
        tenantId: null,
        catalogId,
        parentItemId: null,
        itemKey: `${category}_${slug(label)}`,
        label,
        shortLabel: null,
        description: notExecutable ? 'Nicht als Assist-Leistung durchführbar' : null,
        helperText: null,
        tags: [category],
        icon: notExecutable ? '⚠️' : null,
        color: notExecutable ? '#dc2626' : null,
        sortOrder: order++,
        isSystemDefault: true,
        isActive: true,
        isBillableRelevant: !notExecutable,
        isDocumentationRequired: !notExecutable,
        isSignatureRelevant: false,
        isRiskRelevant: notExecutable,
        defaultDurationMinutes: null,
        defaultPriceHint: null,
        defaultUnit: null,
        payloadJson: { category, notExecutable },
        createdAt: NOW,
        updatedAt: NOW,
      });
    }
  }
  return items;
}

function buildDocBlocks(): CatalogItem[] {
  const catalogKey = 'assist.documentation.quick_blocks';
  const catalogId = defId(catalogKey);
  const items: CatalogItem[] = [];
  let order = 0;
  for (const [category, blocks] of Object.entries(DOC_BLOCKS)) {
    blocks.forEach((text, bi) => {
      items.push({
        id: cid(catalogKey, `block_${category}_${bi}`),
        tenantId: null,
        catalogId,
        parentItemId: null,
        itemKey: `block_${category}_${bi}`,
        label: text.length > 48 ? `${text.slice(0, 45)}…` : text,
        shortLabel: null,
        description: text,
        helperText: null,
        tags: [category],
        icon: null,
        color: null,
        sortOrder: order++,
        isSystemDefault: true,
        isActive: true,
        isBillableRelevant: false,
        isDocumentationRequired: false,
        isSignatureRelevant: false,
        isRiskRelevant: false,
        defaultDurationMinutes: null,
        defaultPriceHint: null,
        defaultUnit: null,
        payloadJson: { textBlock: text, category, quickChip: true },
        createdAt: NOW,
        updatedAt: NOW,
      });
    });
  }
  return items;
}

function buildRiskFlags(): CatalogItem[] {
  const labels = [
    { label: 'Sturzrisiko', color: '#dc2626', confirm: true },
    { label: 'Orientierung eingeschränkt', color: '#ea580c' },
    { label: 'Weglauftendenz', color: '#dc2626' },
    { label: 'Schlüsselthema beachten', color: '#ca8a04' },
    { label: 'Haustier beachten', color: '#ca8a04' },
    { label: 'Raucherhaushalt', color: '#64748b' },
    { label: 'Hygienehinweis', color: '#ea580c' },
    { label: 'Infektionshinweis', color: '#dc2626', confirm: true },
    { label: 'Angehörigenkonflikt', color: '#ea580c' },
    { label: 'rechtliche Betreuung', color: '#6366f1' },
    { label: 'nur mit Rücksprache', color: '#6366f1' },
    { label: 'Notfallkontakt prüfen', color: '#dc2626' },
    { label: 'Zugang erschwert', color: '#ca8a04' },
    { label: 'Sicherheitsbedenken', color: '#dc2626', confirm: true },
    { label: 'keine medizinischen Tätigkeiten durchführen', color: '#dc2626' },
    { label: 'keine Finanzentscheidungen', color: '#6366f1' },
    { label: 'besondere Diskretion', color: '#64748b' },
  ];
  return labels.map((r, i) => ({
    id: cid('assist.risk_flags', slug(r.label)),
    tenantId: null,
    catalogId: defId('assist.risk_flags'),
    parentItemId: null,
    itemKey: slug(r.label),
    label: r.label,
    shortLabel: null,
    description: null,
    helperText: null,
    tags: ['risk'],
    icon: '⚠️',
    color: r.color,
    sortOrder: i,
    isSystemDefault: true,
    isActive: true,
    isBillableRelevant: false,
    isDocumentationRequired: false,
    isSignatureRelevant: false,
    isRiskRelevant: true,
    defaultDurationMinutes: null,
    defaultPriceHint: null,
    defaultUnit: null,
    payloadJson: { confirmBeforeStart: Boolean(r.confirm) },
    createdAt: NOW,
    updatedAt: NOW,
  }));
}

export const ASSIST_SYSTEM_CATALOG_ITEMS: CatalogItem[] = [
  ...itemsFromLabels('assist.assignment.subjects', SUBJECTS, {
    payloadJson: { quickChip: true },
  }),
  ...buildAssignmentTypeItems(),
  ...itemsFromLabels('assist.service.categories', SERVICE_CATEGORIES),
  ...buildTaskPackages(),
  ...buildTaskItems(),
  ...buildDocBlocks(),
  ...itemsFromLabels('assist.task.not_completed_reasons', [
    'Klient:in nicht angetroffen', 'Klient:in hat Aufgabe nicht gewünscht', 'Aufgabe vor Ort nicht möglich',
    'Zeit nicht ausreichend', 'Material nicht vorhanden', 'Zugang nicht möglich',
    'gesundheitliche Tagesform ließ Aufgabe nicht zu', 'Wetterlage ließ Aufgabe nicht zu',
    'Terminverschiebung', 'Rücksprache erforderlich', 'Sicherheitsbedenken',
    'Aufgabe gehört nicht zum vereinbarten Leistungsumfang',
    'Aufgabe darf nicht als Assist-Leistung durchgeführt werden', 'sonstiger Grund',
  ], { payloadJson: { requiresReason: true } }),
  ...itemsFromLabels('assist.assignment.abort_reasons', [
    'Klient:in nicht angetroffen', 'Klient:in lehnt Einsatz ab', 'Klient:in krank / nicht einsatzfähig',
    'Notfallsituation', 'Zugang zur Wohnung nicht möglich', 'Sicherheitsbedenken', 'Konfliktsituation vor Ort',
    'falsche Einsatzdaten', 'Termin wurde nicht bestätigt', 'Angehörige/Büro nicht erreichbar',
    'Mitarbeitende:r musste abbrechen', 'Wetter-/Verkehrslage', 'sonstiger Grund',
  ], { payloadJson: { requiresNote: true } }),
  ...itemsFromLabels('assist.assignment.cancellation_reasons', [
    'Absage durch Klient:in', 'Absage durch Angehörige', 'Absage durch Mitarbeitende:n',
    'Krankheit Klient:in', 'Krankheit Mitarbeitende:r', 'Krankenhausaufenthalt', 'Reha/Kurzzeitpflege',
    'Terminüberschneidung', 'Urlaub Klient:in', 'Urlaub Mitarbeitende:r', 'kein Zugang möglich',
    'Klient:in nicht angetroffen', 'Wetter/Verkehr', 'organisatorischer Grund', 'sonstiger Grund',
  ]),
  ...itemsFromLabels('assist.intake.templates', [
    'Standard-Neuaufnahme Assist', 'Kurzaufnahme Telefon', 'Hausbesuch Neuaufnahme',
    'Angehörigen-Aufnahmegespräch', 'Klient:in mit Pflegegrad', 'Selbstzahler-Aufnahme',
    'Aufnahme nach Krankenhaus/Reha', 'Aufnahme mit besonderem Rücksprachebedarf',
    'Wiederaufnahme nach Pause', 'Bestandskund:innen-Aktualisierung',
  ]),
  ...itemsFromLabels('assist.intake.service_wish', [
    'Hauswirtschaft', 'Einkauf', 'Begleitung', 'Betreuung', 'Entlastung Angehörige', 'Spaziergang',
    'Wäsche', 'Mahlzeitennahe Unterstützung', 'Organisation im Alltag', 'regelmäßige Unterstützung',
    'kurzfristige Unterstützung', 'noch unklar',
  ]),
  ...itemsFromLabels('assist.intake.household', [
    'lebt allein', 'lebt mit Partner:in', 'lebt mit Angehörigen', 'Haustier vorhanden', 'Wohnung', 'Haus',
    'Etage mit Aufzug', 'Etage ohne Aufzug', 'Zugang erschwert', 'Haushalt gepflegt',
    'Haushalt teilweise belastet', 'Haushalt stark belastet', 'Rücksprache erforderlich',
  ]),
  ...itemsFromLabels('assist.intake.mobility', [
    'selbstständig mobil', 'mit Rollator', 'mit Rollstuhl', 'unsicheres Gangbild',
    'sturzgefährdet laut Angabe', 'Treppen schwierig', 'Begleitung außer Haus erforderlich',
    'verlässt Wohnung selten', 'unbekannt',
  ]),
  ...itemsFromLabels('assist.intake.orientation', [
    'orientiert', 'zeitweise vergesslich', 'schwerhörig', 'spricht leise', 'benötigt einfache Sprache',
    'Angehörige sollen einbezogen werden', 'gesetzliche Betreuung vorhanden',
    'Kommunikationsbesonderheiten beachten',
  ]),
  ...itemsFromLabels('assist.intake.access', [
    'normale Klingel', 'Klingel defekt', 'Schlüssel vorhanden', 'Schlüsseltresor vorhanden',
    'Zugang nur mit Angehörigen', 'Haustür schwer zu öffnen', 'Hund/Katze vorhanden',
    'Parkmöglichkeit schwierig', 'genaue Zugangsinformation erforderlich',
  ]),
  ...itemsFromLabels('assist.intake.risks', [
    'Sturzrisiko', 'Weglauftendenz laut Angabe', 'aggressive Haustiere', 'Raucherhaushalt',
    'hygienische Belastung', 'Messie-Verdacht', 'Infektionshinweis', 'psychische Belastung',
    'Konfliktpotential Angehörige', 'rechtliche Betreuung', 'besondere Diskretion', 'Notfallkontakt zwingend',
  ]),
  ...itemsFromLabels('assist.intake.documents', [
    'Vertrag erhalten', 'Vertrag unterschrieben', 'Vollmacht vorhanden', 'Abtretung vorhanden',
    'Datenschutzeinwilligung vorhanden', 'Schweigepflichtentbindung vorhanden', 'Pflegegradnachweis vorhanden',
    'Kostenübernahme geprüft', 'Selbstzahlervereinbarung erforderlich', 'Unterlagen fehlen', 'Rückfrage an Büro',
  ]),
  ...itemsFromLabels('assist.document.types', [
    'Kundenvertrag', 'Stammdatenblatt', 'Erstbesuchsprotokoll', 'Neuaufnahmeprotokoll',
    'Datenschutz-Einwilligung', 'Leistungsnachweis', 'Einsatznachweis', 'Monatsnachweis',
    'Notfallprotokoll', 'Klient:in nicht angetroffen-Protokoll', 'Abbruchprotokoll',
    'interne Fallnotiz', 'Budgetübersicht', 'Selbstzahlervereinbarung',
  ]),
  ...itemsFromLabels('assist.service_proof.templates', [
    'Einzel-Einsatznachweis Assist', 'Monatsnachweis Assist',
  ]),
  ...itemsFromLabels('assist.communication.templates', [
    'Einsatzbestätigung', 'Terminänderung', 'Klient:in nicht angetroffen', 'Unterlagen fehlen',
    'Rücksprache erforderlich', 'Auffälligkeit prüfen', 'Folgeplanung prüfen',
  ], {
    payloadJson: { templateType: 'communication' },
  }),
  ...itemsFromLabels('assist.billing.budget_sources', [
    'Entlastungsbetrag §45b SGB XI', 'Umwandlungsanspruch §45a SGB XI', 'Verhinderungspflege',
    'Selbstzahler', 'Privat Zusatzleistung', 'Kulanz / intern nicht abrechnen', 'noch ungeklärt',
  ]),
  ...itemsFromLabels('assist.billing.statuses', [
    'nicht abrechnungsbereit', 'abrechnungsbereit', 'Nachweis fehlt', 'Signatur fehlt',
    'Klärung erforderlich', 'abgerechnet', 'bezahlt', 'abgelehnt', 'storniert',
  ]),
  ...itemsFromLabels('assist.billing.notes', [
    'Pflegegrad prüfen', 'Budget prüfen', 'Abtretung prüfen', 'Vollmacht prüfen',
    'Selbstzahlerrechnung erforderlich', 'Leistungsnachweis fehlt', 'Unterschrift fehlt',
    'Rücksprache Kostenträger erforderlich', 'nicht abrechnen', 'manuell prüfen',
  ]),
  ...buildRiskFlags(),
];

export const ASSIST_DEFAULT_BINDINGS: Omit<TemplateBinding, 'createdAt' | 'updatedAt'>[] = [
  { id: gid('bind-subject'), tenantId: null, templateId: null, catalogId: defId('assist.assignment.subjects'), targetModule: 'assist', targetArea: 'assist_new_assignment', targetComponent: 'AssignmentCreateForm', targetField: 'assignment_subject', bindingType: 'catalog', isRequired: true, isDefault: false, sortOrder: 1, conditionsJson: {} },
  { id: gid('bind-type'), tenantId: null, templateId: null, catalogId: defId('assist.assignment.types'), targetModule: 'assist', targetArea: 'assist_new_assignment', targetComponent: 'AssignmentCreateForm', targetField: 'assignment_type', bindingType: 'catalog', isRequired: false, isDefault: false, sortOrder: 2, conditionsJson: {} },
  { id: gid('bind-packages'), tenantId: null, templateId: null, catalogId: defId('assist.task.packages'), targetModule: 'assist', targetArea: 'assist_new_assignment', targetComponent: 'AssignmentCreateForm', targetField: 'task_package', bindingType: 'catalog', isRequired: false, isDefault: false, sortOrder: 3, conditionsJson: {} },
  { id: gid('bind-tasks'), tenantId: null, templateId: null, catalogId: defId('assist.task.items'), targetModule: 'assist', targetArea: 'assist_assignment_execution', targetComponent: 'VisitTasksPanel', targetField: 'task_items', bindingType: 'catalog', isRequired: false, isDefault: false, sortOrder: 4, conditionsJson: {} },
  { id: gid('bind-docblocks'), tenantId: null, templateId: null, catalogId: defId('assist.documentation.quick_blocks'), targetModule: 'assist', targetArea: 'assist_assignment_documentation', targetComponent: 'VisitExecutionScreen', targetField: 'documentation_quick_text', bindingType: 'catalog', isRequired: false, isDefault: false, sortOrder: 5, conditionsJson: {} },
  { id: gid('bind-notdone'), tenantId: null, templateId: null, catalogId: defId('assist.task.not_completed_reasons'), targetModule: 'assist', targetArea: 'assist_assignment_execution', targetComponent: 'VisitTasksPanel', targetField: 'not_completed_reason', bindingType: 'catalog', isRequired: false, isDefault: false, sortOrder: 6, conditionsJson: {} },
];

export function getCatalogDefinitionByKey(catalogKey: string): DefSeed | undefined {
  return ASSIST_CATALOG_DEFINITIONS.find((d) => d.catalogKey === catalogKey);
}

export function getCatalogItemsByKey(catalogKey: string, includeInactive = false): CatalogItem[] {
  const catalogId = defId(catalogKey);
  return ASSIST_SYSTEM_CATALOG_ITEMS.filter(
    (i) => i.catalogId === catalogId && (includeInactive || i.isActive) && !i.parentItemId,
  );
}

export function getPackageChildTasks(packageItemId: string): CatalogItem[] {
  return ASSIST_SYSTEM_CATALOG_ITEMS.filter(
    (i) => i.parentItemId === packageItemId && i.isActive,
  ).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getCatalogItemsForCatalog(catalogKey: string, includeChildren = true): CatalogItem[] {
  const catalogId = defId(catalogKey);
  return ASSIST_SYSTEM_CATALOG_ITEMS.filter(
    (i) =>
      i.catalogId === catalogId &&
      i.isActive &&
      (includeChildren || !i.parentItemId),
  ).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function buildAssistCatalogSnapshot(): {
  groups: CatalogGroup[];
  definitions: CatalogDefinition[];
  items: CatalogItem[];
  bindings: TemplateBinding[];
} {
  return {
    groups: ASSIST_CATALOG_GROUPS,
    definitions: ASSIST_CATALOG_DEFINITIONS.map((d) => ({ ...d, createdAt: NOW, updatedAt: NOW })),
    items: ASSIST_SYSTEM_CATALOG_ITEMS,
    bindings: ASSIST_DEFAULT_BINDINGS.map((b) => ({ ...b, createdAt: NOW, updatedAt: NOW })),
  };
}
