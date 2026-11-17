import { CENTRAL_CATALOG_INDEX } from '@/data/seeds/documentCatalog/centralCatalogIndex';
import type { CentralDocumentTarget } from '@/types/documents/centralCatalog';

export type DocumentWorkflow = 'company' | 'client_intake' | 'client_documents' | 'client_contracts' | 'employee_onboarding' | 'employee_documents' | 'employee_exit' | 'assignment' | 'service_proof' | 'invoice' | 'budget' | 'care' | 'care_assessment' | 'care_plan' | 'vitals' | 'wound' | 'medication' | 'hygiene' | 'incident' | 'handover' | 'quality' | 'privacy' | 'training' | 'equipment' | 'portal_access' | 'consultation';
export type DocumentRecommendationContext = {
  module?: string;
  workflow?: DocumentWorkflow;
  clientId?: string | null;
  employeeId?: string | null;
  assignmentId?: string | null;
  invoiceId?: string | null;
  medicationId?: string | null;
  woundId?: string | null;
  period?: string | null;
};
type RecommendationRule = readonly [key: string, reason: string, modules?: readonly string[]];
const officeAndAmbulatoryCare = ['', 'office', 'pflege'] as const;
const ambulatoryModules = [...officeAndAmbulatoryCare, 'assist'] as const;
const residentialModule = ['stationaer'] as const;

export const DOCUMENT_RECOMMENDATION_RULES: Record<DocumentWorkflow, readonly RecommendationRule[]> = {
  company: [['csdc_software_001', 'Softwareleistungen und Nutzung für das Unternehmen vereinbaren.'], ['csdc_datenschutz_003', 'Zuständigkeiten und Zugriffsrechte dokumentieren.'], ['csdc_qm_001', 'Leistungsangebot und Organisation der Einrichtung beschreiben.']],
  client_intake: [['csdc_aufnahme_002', 'Aufnahme vorbereiten und offene Angaben festhalten.'], ['csdc_aufnahme_003', 'Stammdaten aus der ausgewählten Klientenakte übernehmen.'], ['csdc_vollmachten_001', 'Über die Verarbeitung der Klientendaten informieren.']],
  client_documents: [['csdc_aufnahme_003', 'Stammdaten als bearbeitbares Dokument ausgeben.'], ['csdc_vollmachten_001', 'Datenschutzinformation für diese Akte erstellen.'], ['csdc_einsatz_006', 'Erbrachte Leistungen und Bestätigungen dokumentieren.']],
  client_contracts: [
    ['csdc_vertraege_005', 'Einen Entwurf für Wohn- und Betreuungsleistungen der Einrichtung erstellen.', residentialModule],
    ['csdc_vertraege_001', 'Ambulante Pflegeleistungen und individuelle Vereinbarungen festhalten.', officeAndAmbulatoryCare],
    ['csdc_vertraege_003', 'Einen Vertrag für individuell vereinbarte Alltagsbegleitung vorbereiten.', ['assist']],
    ['csdc_vertraege_002', 'Betreuungsleistungen und deren Umfang festhalten.', ['', 'office', 'assist']],
    ['csdc_vollmachten_002', 'Eine zweckbezogene Einwilligung vorbereiten.'],
    ['csdc_vertraege_016', 'Eine Änderung zu einem bestehenden Vertrag vorbereiten.', ambulatoryModules],
  ],
  employee_onboarding: [['csdc_personal_001', 'Personalstammdaten aus dieser Akte übernehmen.'], ['csdc_personal_002', 'Arbeitsbedingungen und individuelle Ergänzungen vorbereiten.'], ['csdc_personal_008', 'Einarbeitung und Zuständigkeiten planen.']],
  employee_documents: [['csdc_personal_001', 'Personalstammdaten als Dokument ausgeben.'], ['csdc_datenschutz_005', 'Über die Verarbeitung von Beschäftigtendaten informieren.'], ['csdc_software_007', 'Dienstliche Nutzung von CareSuite HealthOS vereinbaren.']],
  employee_exit: [['csdc_personal_022', 'Rückgaben, offene Aufgaben und Zugänge bei Austritt prüfen.']],
  assignment: [['csdc_einsatz_003', 'Aufgaben und Rahmenbedingungen des Klienten festhalten.'], ['csdc_einsatz_004', 'Eine Aufgabenliste für den ausgewählten Einsatz erstellen.'], ['csdc_einsatz_008', 'Eine Absage mit dem tatsächlichen Grund dokumentieren.']],
  service_proof: [['csdc_einsatz_006', 'Tatsächliche Einsatzzeiten übernehmen und Leistungen ergänzen.'], ['csdc_alltag_016', 'Leistungen der Alltagsunterstützung dokumentieren.'], ['csdc_abrechnung_001', 'Eine Leistungsbestätigung zur Abrechnung vorbereiten.']],
  invoice: [['csdc_abrechnung_004', 'Eine Rechnung an den Kostenträger vorbereiten.'], ['csdc_abrechnung_005', 'Eigenanteile oder privat vereinbarte Leistungen dokumentieren.'], ['csdc_abrechnung_007', 'Die Abrechnungsprüfung festhalten.']],
  budget: [['csdc_abrechnung_008', 'Budgets und Leistungsarten zusammenstellen.'], ['csdc_antraege_006', 'Rechnungs- und Erstattungsunterlagen vorbereiten.'], ['csdc_abrechnung_002', 'Abrechnungsfähige Leistungen prüfen und ergänzen.']],
  care: [
    ['csdc_pflegeplanung_001', 'Pflegerelevante Vorgeschichte und aktuellen Unterstützungsbedarf erfassen.'],
    ['csdc_pflegeplanung_007', 'Individuelle Pflegeziele und geplante Maßnahmen festhalten.'],
    ['csdc_pflegeplanung_010', 'Beobachtungen und Veränderungen im Pflegeverlauf dokumentieren.'],
  ],
  care_assessment: [
    ['csdc_pflegeplanung_001', 'Pflegerelevante Vorgeschichte und aktuellen Unterstützungsbedarf erfassen.'],
    ['csdc_pflegeplanung_004', 'Vorhandene Fähigkeiten und benötigte Unterstützung festhalten.'],
    ['csdc_pflegeplanung_006', 'Pflegerische Risiken und festgestellte Anzeichen dokumentieren.'],
  ],
  care_plan: [
    ['csdc_pflegeplanung_007', 'Individuelle Pflegeziele und geplante Maßnahmen festhalten.'],
    ['csdc_pflegeplanung_009', 'Gemeinsam vereinbarte Pflegeziele dokumentieren.'],
    ['csdc_pflegeplanung_011', 'Wirksamkeit und Anpassungsbedarf der Maßnahmen erfassen.'],
  ],
  vitals: [
    ['csdc_behandlungspflege_008', 'Gemessene Vitalwerte mit Zeitpunkt und Einheit festhalten.'],
    ['csdc_behandlungspflege_009', 'Gemessene Blutzuckerwerte im Verlauf dokumentieren.'],
    ['csdc_risiken_008', 'Gemessene Körpergewichte im Verlauf dokumentieren.'],
  ],
  wound: [['csdc_wunden_002', 'Ein Wundassessment für diese Klientenakte vorbereiten.'], ['csdc_wunden_003', 'Den Wundverlauf fachlich dokumentieren.'], ['csdc_vollmachten_004', 'Eine erforderliche Einwilligung zur Fotodokumentation vorbereiten.']],
  medication: [['csdc_medikamente_001', 'Einen vorhandenen Medikationsplan als Original mit Begleitblatt ablegen.'], ['csdc_medikamente_003', 'Verordnete Änderungen mit ihrer Quelle dokumentieren.'], ['csdc_medikamente_012', 'Die Medikamentenübernahme bei Aufnahme oder Rückkehr festhalten.']],
  hygiene: [['csdc_hygiene_001', 'Den einrichtungsspezifischen Hygieneplan bearbeiten.'], ['csdc_hygiene_002', 'Reinigung und Desinfektion planen.'], ['csdc_hygiene_005', 'Eine Hygieneschulung nachweisen.']],
  incident: [['csdc_notfall_004', 'Einen beobachteten Unfall oder ein Ereignis dokumentieren.'], ['csdc_notfall_001', 'Notfallinformationen für die Klientenakte vorbereiten.']],
  handover: [['csdc_einsatz_011', 'Relevante Informationen für die nächste Versorgung festhalten.'], ['csdc_abschluss_002', 'Die Übergabe an einen anderen Dienst dokumentieren.'], ['csdc_teilstationaer_007', 'Die Übergabe zwischen Einrichtung und Häuslichkeit festhalten.', residentialModule]],
  quality: [['csdc_qm_007', 'Prozesse und Qualitätsanforderungen dokumentieren.'], ['csdc_qm_008', 'Arbeitsanweisungen mit eigenen Ergänzungen erstellen.'], ['csdc_qm_011', 'Beschwerden und ihre Bearbeitung festhalten.']],
  privacy: [['csdc_datenschutz_001', 'Verarbeitungszwecke und Verantwortlichkeiten beschreiben.'], ['csdc_datenschutz_002', 'Tatsächlich umgesetzte Schutzmaßnahmen dokumentieren.'], ['csdc_datenschutz_006', 'Aufbewahrung und Löschverfahren festlegen.']],
  training: [['csdc_personal_011', 'Teilnahme und Schulungsinhalte in der Personalakte nachweisen.'], ['csdc_software_008', 'Die Nutzung von CareSuite HealthOS unterweisen.'], ['csdc_personal_010', 'Fortbildungen für die ausgewählte Person planen.']],
  equipment: [['csdc_alltag_011', 'Die Übergabe oder Rückgabe von Schlüsseln dokumentieren.'], ['csdc_stationaer_004', 'Inventar und Eigentum der ausgewählten Person festhalten.', residentialModule], ['csdc_aufnahme_012', 'Bereits vorhandene Hilfsmittel aufnehmen.'], ['csdc_arbeitsschutz_017', 'Übergabe und Funktionskontrolle von Hilfsmitteln im Unternehmen dokumentieren.', ambulatoryModules]],
  portal_access: [['csdc_software_004', 'Nutzung und Berechtigungen des Mitarbeiterportals vereinbaren.'], ['csdc_software_005', 'Nutzung und Berechtigungen des Klientenportals vereinbaren.'], ['csdc_datenschutz_003', 'Das Berechtigungskonzept des Unternehmens prüfen.']],
  consultation: [['csdc_antraege_010', 'Versorgungsbedarf und Beratungsergebnisse festhalten.'], ['csdc_aufnahme_011', 'Das Aufnahmegespräch für die ausgewählte Person dokumentieren.'], ['csdc_vollmachten_001', 'Die Datenschutzinformation zur Beratung bereitstellen.']],
};

export function normalizeDocumentModule(module?: string): string {
  const key = module === 'ambulant' ? 'pflege' : module === 'betreuung' || module === 'alltagsbegleitung' ? 'assist' : module;
  return key && /^[a-z][a-z0-9_-]{0,63}$/.test(key) ? key : '';
}

/** Routes carry identifiers only. Personal data and document contents stay out of URLs. */
export function documentCatalogRoute(context: DocumentRecommendationContext & { templateKey?: string; tab?: 'catalog' | 'records' }): string {
  const query = new URLSearchParams();
  const module = normalizeDocumentModule(context.module);
  if (module) query.set('module', module);
  if (context.workflow && context.workflow in DOCUMENT_RECOMMENDATION_RULES) query.set('workflow', context.workflow);
  if (context.templateKey && /^csdc_[a-z]+_\d{3}$/.test(context.templateKey)) query.set('templateKey', context.templateKey);
  for (const key of ['clientId', 'employeeId', 'assignmentId', 'invoiceId', 'medicationId', 'woundId'] as const) {
    const id = context[key];
    if (id && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id)) query.set(key, id);
  }
  if (context.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(context.period)) query.set('period', context.period);
  if (context.tab === 'records') query.set('tab', 'records');
  return `/business/office/document-catalog${query.size ? `?${query}` : ''}`;
}

export function documentWorkflowForArea(module: string, area?: string, trigger?: string): DocumentWorkflow {
  const text = `${area ?? ''} ${trigger ?? ''}`.toLowerCase();
  if (/wound|wund/.test(text)) return 'wound';
  if (/medication|medikation|medikament/.test(text)) return 'medication';
  if (/privacy|datenschutz/.test(text)) return 'privacy';
  if (/quality|\bqm\b|audit/.test(text)) return 'quality';
  if (/hygiene/.test(text)) return 'hygiene';
  if (/handover|übergabe/.test(text)) return 'handover';
  if (/offboarding|exit|austritt/.test(text)) return 'employee_exit';
  if (/contract|vertrag/.test(text)) return 'client_contracts';
  if (/intake|aufnahme/.test(text)) return 'client_intake';
  if (/portal/.test(text)) return 'portal_access';
  if (/budget/.test(text)) return 'budget';
  if (/invoice|billing|abrechnung/.test(text)) return 'invoice';
  if (/visit_complete|proof|nachweis/.test(text)) return 'service_proof';
  if (/assignment|appointment|visit|tour/.test(text)) return 'assignment';
  if (/hr|people|personnel|employee/.test(text)) return 'employee_documents';
  if (/equipment|inventory|material/.test(text)) return 'equipment';
  if (/course|training|shift/.test(text) || module === 'akademie') return 'training';
  if (module === 'beratung') return 'consultation';
  if (module === 'pflege' || module === 'ambulant' || module === 'stationaer') {
    if (/vital/.test(text)) return 'vitals';
    if (/anamnes|assessment|\bsis\b/.test(text)) return 'care_assessment';
    if (/pflegepl|care[-_ ]?plan|\bplans?\b|maßnahme|massnahme|measures|evaluation/.test(text)) return 'care_plan';
    return 'care';
  }
  if (module === 'assist') return 'service_proof';
  return /client|document/.test(text) ? 'client_documents' : 'company';
}

export function getDocumentRecommendations(context: DocumentRecommendationContext, limit = 3) {
  const workflow = context.workflow ?? documentWorkflowForArea(context.module ?? 'office');
  const module = normalizeDocumentModule(context.module);
  return DOCUMENT_RECOMMENDATION_RULES[workflow].flatMap(([key, reason, ruleModules]) => {
    if (ruleModules && !ruleModules.includes(module)) return [];
    const definition = CENTRAL_CATALOG_INDEX.find((entry) => entry.key === key);
    if (!definition || (context.clientId && definition.target === 'employee' && !context.employeeId) || (context.employeeId && !context.clientId && definition.target === 'client')) return [];
    return [{ ...definition, reason, href: documentCatalogRoute({ ...context, templateKey: key }) }];
  }).slice(0, Math.max(0, Math.min(4, limit)));
}

export function documentRecordScope(context: DocumentRecommendationContext): { target: CentralDocumentTarget; entityId: string } | undefined {
  if (context.clientId) return { target: 'client', entityId: context.clientId };
  if (context.employeeId) return { target: 'employee', entityId: context.employeeId };
  return undefined;
}
