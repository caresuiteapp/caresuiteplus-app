/** Leistungsart / Klient:innenart (Spec 1.2) */
export type ClientCareContext =
  | 'daily_assistance'
  | 'support_care'
  | 'companionship'
  | 'ambulatory_care'
  | 'stationary_care'
  | 'consulting'
  | 'academy_prepared';

export type IntakeSectionKey =
  | 'leistungsart'
  | 'stammdaten'
  | 'adresse_kontakt'
  | 'versorgung'
  | 'kostentraeger'
  | 'angehoerige'
  | 'notfall_zugang'
  | 'vertraege_einwilligungen'
  | 'dokumente'
  | 'module'
  | 'pruefung';

export type ClientRecordTabKey =
  | 'uebersicht'
  | 'stammdaten'
  | 'leistungsbereiche'
  | 'budget'
  | 'kontakt'
  | 'angehoerige'
  | 'pflegegrad'
  | 'module'
  | 'vertrag'
  | 'einwilligungen'
  | 'dokumente'
  | 'einsaetze'
  | 'nachweise'
  | 'dokumentation'
  | 'protokolle'
  | 'vitalwerte'
  | 'medikation'
  | 'icd'
  | 'rezepte'
  | 'risiken'
  | 'abrechnung'
  | 'portal'
  | 'nachrichten'
  | 'verlauf'
  | 'audit'
  | 'aktionen'
  | 'pflege'
  | 'bewohnerdaten'
  | 'wohnbereich'
  | 'tagesstruktur'
  | 'mahlzeiten'
  | 'fallakte'
  | 'beratungsanlass'
  | 'massnahmen'
  | 'wiedervorlagen'
  | 'aufgaben'
  | 'mehr';

const SUPPORT_ONLY: ClientCareContext[] = [
  'daily_assistance',
  'support_care',
  'companionship',
];

const BASE_REQUIRED = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'street',
  'zip',
  'city',
  'phoneOrContact',
  'serviceStart',
  'billingTypes',
  'emergencyContact',
  'consentDatenschutz',
  'consentVertrag',
];

const SUPPORT_REQUIRED = [...BASE_REQUIRED, 'supportWishes'];

const AMBULATORY_REQUIRED = [
  ...BASE_REQUIRED,
  'careLevel',
  'careFund',
  'healthInsurance',
  'insuranceNumber',
  'familyDoctor',
  'homeAccess',
  'keyInfo',
];

const STATIONARY_REQUIRED = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'phoneOrContact',
  'facility',
  'careArea',
  'roomNumber',
  'careLevel',
  'careFund',
  'emergencyContact',
  'consentDatenschutz',
  'consentVertrag',
];

const CONSULTING_REQUIRED = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'phoneOrContact',
  'consultingReason',
  'consultingType',
  'consentDatenschutz',
];

function withCoreTabs(tabs: ClientRecordTabKey[]): ClientRecordTabKey[] {
  const result = [...tabs];
  if (!result.includes('leistungsbereiche')) {
    const insertAt = result.indexOf('stammdaten') + 1;
    result.splice(insertAt, 0, 'leistungsbereiche', 'budget');
  }
  if (!result.includes('portal') && !result.includes('beratungsanlass')) {
    const verlaufIdx = result.indexOf('verlauf');
    if (verlaufIdx >= 0) result.splice(verlaufIdx, 0, 'portal');
  }
  return result;
}

function hasAny(contexts: ClientCareContext[], keys: ClientCareContext[]): boolean {
  return keys.some((k) => contexts.includes(k));
}

function isSupportOnly(contexts: ClientCareContext[]): boolean {
  if (contexts.length === 0) return false;
  const supportSet = new Set(SUPPORT_ONLY);
  return contexts.every((c) => supportSet.has(c));
}

export function hasAmbulatoryCare(contexts: ClientCareContext[]): boolean {
  return contexts.includes('ambulatory_care');
}

export function hasStationaryCare(contexts: ClientCareContext[]): boolean {
  return contexts.includes('stationary_care');
}

export function hasConsulting(contexts: ClientCareContext[]): boolean {
  return contexts.includes('consulting');
}

export function hasSupportContext(contexts: ClientCareContext[]): boolean {
  return hasAny(contexts, SUPPORT_ONLY);
}

export function getRequiredFieldsForClientContext(
  contexts: ClientCareContext[],
): string[] {
  if (contexts.length === 0) return ['careContexts'];
  const fields = new Set<string>(['careContexts']);

  if (hasStationaryCare(contexts) && !hasAmbulatoryCare(contexts)) {
    STATIONARY_REQUIRED.forEach((f) => fields.add(f));
  } else if (hasAmbulatoryCare(contexts)) {
    AMBULATORY_REQUIRED.forEach((f) => fields.add(f));
  } else if (isSupportOnly(contexts)) {
    SUPPORT_REQUIRED.forEach((f) => fields.add(f));
  } else {
    BASE_REQUIRED.forEach((f) => fields.add(f));
  }

  if (hasConsulting(contexts)) {
    CONSULTING_REQUIRED.forEach((f) => fields.add(f));
  }

  return [...fields];
}

export function getOptionalFieldsForClientContext(
  contexts: ClientCareContext[],
): string[] {
  const optional = [
    'salutation',
    'gender',
    'birthPlace',
    'nationality',
    'language',
    'maritalStatus',
    'housingForm',
    'specialNotes',
    'relatives',
    'authorizedPerson',
    'keySafe',
    'pets',
    'smoker',
    'preferredTimes',
    'excludedTimes',
    'mobilityNotes',
    'communicationNotes',
  ];

  if (isSupportOnly(contexts)) {
    optional.push('careLevel', 'careFund', 'relatives', 'keyInfo');
  }

  if (hasAmbulatoryCare(contexts) || hasStationaryCare(contexts)) {
    optional.push(
      'medications',
      'vitals',
      'icdCodes',
      'prescriptions',
      'woundStatus',
      'risks',
    );
  }

  if (hasStationaryCare(contexts)) {
    optional.push('mealForm', 'dailyStructure', 'bedPosition', 'costForm');
  }

  if (hasConsulting(contexts)) {
    optional.push('followUpDate', 'consultingDocuments');
  }

  return optional;
}

export function getVisibleSectionsForClientContext(
  contexts: ClientCareContext[],
): IntakeSectionKey[] {
  const all: IntakeSectionKey[] = [
    'leistungsart',
    'stammdaten',
    'adresse_kontakt',
    'versorgung',
    'kostentraeger',
    'angehoerige',
    'notfall_zugang',
    'vertraege_einwilligungen',
    'dokumente',
    'module',
    'pruefung',
  ];

  if (contexts.length === 0) return ['leistungsart'];

  const visible = new Set<IntakeSectionKey>([
    'leistungsart',
    'stammdaten',
    'adresse_kontakt',
    'kostentraeger',
    'angehoerige',
    'notfall_zugang',
    'vertraege_einwilligungen',
    'dokumente',
    'module',
    'pruefung',
  ]);

  if (hasAmbulatoryCare(contexts) || hasStationaryCare(contexts) || hasConsulting(contexts)) {
    visible.add('versorgung');
  }

  if (isSupportOnly(contexts)) {
    visible.add('versorgung');
  }

  return all.filter((s) => visible.has(s));
}

export function getRecommendedModulesForClientContext(
  contexts: ClientCareContext[],
): string[] {
  const modules = new Set<string>(['office']);

  if (hasSupportContext(contexts)) modules.add('assist');
  if (hasAmbulatoryCare(contexts)) {
    modules.add('pflege');
    modules.add('assist');
  }
  if (hasStationaryCare(contexts)) {
    modules.add('stationaer');
    modules.add('pflege');
  }
  if (hasConsulting(contexts)) modules.add('beratung');
  if (contexts.includes('academy_prepared')) modules.add('akademie');

  modules.add('portal');
  modules.add('reporting');
  return [...modules];
}

export function getRelevantTemplatesForClientContext(
  contexts: ClientCareContext[],
): string[] {
  const templates = ['datenschutz', 'kundenvertrag', 'leistungsvereinbarung'];

  if (hasSupportContext(contexts)) {
    templates.push('alltagsbegleitungsvertrag', 'betreuungsvertrag');
  }
  if (hasAmbulatoryCare(contexts)) {
    templates.push('pflegevertrag', 'hausbesuchsvereinbarung', 'schluesselvereinbarung');
  }
  if (hasStationaryCare(contexts)) {
    templates.push('pflegevertrag', 'portalvereinbarung');
  }
  if (hasConsulting(contexts)) {
    templates.push('beratungsvereinbarung', 'beratungsprotokoll');
  }
  if (contexts.includes('academy_prepared')) {
    templates.push('schulungsvereinbarung');
  }

  return templates;
}

export function getRelevantDocumentChecklistForClientContext(
  contexts: ClientCareContext[],
): string[] {
  const docs = ['datenschutz', 'vertrag'];

  if (hasAmbulatoryCare(contexts) || hasStationaryCare(contexts)) {
    docs.push(
      'pflegegradbescheid',
      'medikationsplan',
      'versichertenkarte',
      'kassenbescheid',
    );
  }
  if (hasSupportContext(contexts)) {
    docs.push('vollmacht', 'schluesselprotokoll');
  }
  if (hasConsulting(contexts)) {
    docs.push('beratungsprotokoll', 'vollmacht');
  }

  return docs;
}

export function getRelevantConsentTemplatesForClientContext(
  contexts: ClientCareContext[],
): string[] {
  const consents = ['datenschutz', 'vertrag', 'kontakt'];

  if (hasAmbulatoryCare(contexts) || hasStationaryCare(contexts)) {
    consents.push('schweigepflicht', 'foto', 'abrechnung');
  }
  if (hasSupportContext(contexts)) {
    consents.push('notfall', 'foto');
  }
  if (hasConsulting(contexts)) {
    consents.push('angehoerige', 'elektronisch');
  }

  return consents;
}

/** Collapse context-specific tabs into the primary Akte navigation (§4). */
export function normalizeClientRecordTabs(contextTabs: ClientRecordTabKey[]): ClientRecordTabKey[] {
  const primary: ClientRecordTabKey[] = ['uebersicht', 'stammdaten'];

  if (
    contextTabs.some((t) =>
      ['leistungsbereiche', 'budget', 'pflegegrad', 'pflege', 'bewohnerdaten'].includes(t),
    )
  ) {
    primary.push('leistungsbereiche');
  }
  if (contextTabs.some((t) => ['kontakt', 'angehoerige'].includes(t))) {
    primary.push('kontakt');
  }
  if (contextTabs.some((t) => ['einsaetze', 'aufgaben'].includes(t))) {
    primary.push('einsaetze');
  }
  if (
    contextTabs.some((t) =>
      ['dokumente', 'nachweise', 'einwilligungen', 'vertrag', 'dokumentation'].includes(t),
    )
  ) {
    primary.push('dokumente');
  }
  if (contextTabs.includes('portal')) {
    primary.push('portal');
  }
  primary.push('verlauf');

  const covered = new Set<ClientRecordTabKey>([
    ...primary,
    'budget',
    'angehoerige',
    'nachweise',
    'einwilligungen',
    'vertrag',
    'aufgaben',
    'aktionen',
    'audit',
  ]);
  const overflow = contextTabs.filter((t) => !covered.has(t) && t !== 'mehr');
  if (overflow.length > 0 || contextTabs.includes('mehr')) {
    primary.push('mehr');
  }

  return primary;
}

function finalizeRecordTabs(tabs: ClientRecordTabKey[]): ClientRecordTabKey[] {
  return normalizeClientRecordTabs(withCoreTabs(tabs));
}

export function getClientRecordTabsForClientContext(
  contexts: ClientCareContext[],
): ClientRecordTabKey[] {
  if (contexts.length === 0) {
    return normalizeClientRecordTabs([
      'uebersicht',
      'stammdaten',
      'leistungsbereiche',
      'budget',
      'kontakt',
      'verlauf',
      'mehr',
    ]);
  }

  if (hasConsulting(contexts) && !hasAmbulatoryCare(contexts) && !hasStationaryCare(contexts)) {
    return finalizeRecordTabs([
      'uebersicht',
      'fallakte',
      'stammdaten',
      'angehoerige',
      'beratungsanlass',
      'protokolle',
      'massnahmen',
      'wiedervorlagen',
      'dokumente',
      'abrechnung',
      'verlauf',
      'aktionen',
    ]);
  }

  if (hasStationaryCare(contexts) && !hasAmbulatoryCare(contexts)) {
    return finalizeRecordTabs([
      'uebersicht',
      'bewohnerdaten',
      'wohnbereich',
      'pflege',
      'tagesstruktur',
      'mahlzeiten',
      'medikation',
      'vitalwerte',
      'dokumentation',
      'dokumente',
      'angehoerige',
      'verlauf',
      'aktionen',
    ]);
  }

  if (hasAmbulatoryCare(contexts)) {
    const tabs: ClientRecordTabKey[] = [
      'uebersicht',
      'stammdaten',
      'pflege',
      'medikation',
      'vitalwerte',
      'risiken',
      'rezepte',
      'einsaetze',
      'dokumentation',
      'dokumente',
      'abrechnung',
      'verlauf',
      'aktionen',
    ];
    if (hasSupportContext(contexts)) {
      tabs.splice(3, 0, 'aufgaben');
    }
    return finalizeRecordTabs(tabs);
  }

  // Support only: Alltagsbegleitung / Betreuung / Begleitung
  return finalizeRecordTabs([
    'uebersicht',
    'stammdaten',
    'kontakt',
    'aufgaben',
    'einsaetze',
    'nachweise',
    'dokumente',
    'vertrag',
    'abrechnung',
    'portal',
    'verlauf',
    'mehr',
    'aktionen',
  ]);
}

export const INTAKE_SECTION_LABELS: Record<IntakeSectionKey, string> = {
  leistungsart: 'Leistungsart / Klient:innenart',
  stammdaten: 'Stammdaten',
  adresse_kontakt: 'Adresse & Kontakt',
  versorgung: 'Versorgung / Pflege / Betreuung',
  kostentraeger: 'Kostenträger / Abrechnung',
  angehoerige: 'Angehörige / Bevollmächtigte',
  notfall_zugang: 'Notfall / Zugang / Wohnsituation',
  vertraege_einwilligungen: 'Verträge & Einwilligungen',
  dokumente: 'Dokumente hochladen / scannen / fotografieren',
  module: 'Module & Zuständigkeiten',
  pruefung: 'Prüfung & Abschluss',
};

export const CLIENT_RECORD_TAB_LABELS: Record<ClientRecordTabKey, string> = {
  uebersicht: 'Übersicht',
  stammdaten: 'Stammdaten',
  leistungsbereiche: 'Leistungen & Budget',
  budget: 'Budget',
  kontakt: 'Kontakte',
  angehoerige: 'Angehörige',
  pflegegrad: 'Pflegegrad & Kassen',
  module: 'Module',
  vertrag: 'Vertrag',
  einwilligungen: 'Einwilligungen',
  dokumente: 'Dokumente & Nachweise',
  einsaetze: 'Einsätze & Termine',
  nachweise: 'Leistungsnachweise',
  dokumentation: 'Dokumentation',
  protokolle: 'Protokolle',
  vitalwerte: 'Vitalwerte',
  medikation: 'Medikation',
  icd: 'ICD / Hinweise',
  rezepte: 'Rezepte & Verordnungen',
  risiken: 'Risiken',
  abrechnung: 'Abrechnung',
  portal: 'Portal & Freigaben',
  nachrichten: 'Nachrichten',
  verlauf: 'Verlauf',
  audit: 'Audit',
  aktionen: 'Aktionen',
  pflege: 'Pflege',
  bewohnerdaten: 'Bewohnerdaten',
  wohnbereich: 'Wohnbereich / Zimmer',
  tagesstruktur: 'Tagesstruktur',
  mahlzeiten: 'Mahlzeiten',
  fallakte: 'Fallakte',
  beratungsanlass: 'Beratungsanlass',
  massnahmen: 'Maßnahmen',
  wiedervorlagen: 'Wiedervorlagen',
  aufgaben: 'Aufgaben & Wünsche',
  mehr: 'Mehr',
};

export function getSupportOnlyHint(contexts: ClientCareContext[]): string | null {
  if (isSupportOnly(contexts)) {
    return 'Für Alltagsbegleitung, Betreuung und Begleitung werden nur die Daten abgefragt, die für Einsatzplanung, Kontakt, Abrechnung, Sicherheit und Dokumentation erforderlich sind. Pflegefachliche Angaben sind optional.';
  }
  if (hasStationaryCare(contexts) && !hasAmbulatoryCare(contexts)) {
    return 'Bei stationärer Pflege werden Wohnbereichs-, Zimmer- und Einrichtungsdaten abgefragt. Wohnungszugang und Schlüsselverwaltung sind nur relevant, wenn zusätzlich ambulante Leistungen bestehen.';
  }
  return null;
}

export function requiresNursingFields(contexts: ClientCareContext[]): boolean {
  return hasAmbulatoryCare(contexts) || hasStationaryCare(contexts);
}
