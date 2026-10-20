import type { DocumentCatalogEntry, DocumentLayoutFamily } from './types';

type TemplateDef = Omit<DocumentCatalogEntry, 'templateNumber' | 'layoutFamily'> & {
  templateNumber: number;
  layoutFamily?: DocumentLayoutFamily;
};

function inferLayoutFamily(entry: TemplateDef): DocumentLayoutFamily {
  if (entry.layoutFamily) return entry.layoutFamily;
  if (entry.builderKey === 'stammblatt') return 'client_master';
  if (entry.builderKey === 'leistungsnachweis') return 'service_proof';
  if (entry.builderKey === 'rechnung') return 'invoice';
  if (entry.builderKey === 'beratungsprotokoll') return 'consultation';
  if (entry.builderKey === 'pflegeprotokoll') return 'care_clinical';
  if (entry.category === 'vertrag') return 'contract';
  if (entry.templateKey.includes('mahnung')) return 'dunning';
  if (entry.category === 'dienstplan') return 'shift_plan';
  if (entry.category === 'tourenplan') return 'tour_plan';
  if (entry.category === 'fahrzeug') return 'vehicle_log';
  if (entry.category === 'akademie') return 'academy_certificate';
  if (entry.category === 'assist') return 'assist_visit';
  if (entry.templateKey.includes('beschwerde') || entry.templateKey.includes('sturz')) return 'incident';
  if (entry.layoutKind === 'form' && entry.category === 'klient') return 'checklist';
  if (entry.category === 'mitarbeiter') return 'employee_form';
  return 'generic_form';
}

function assistOk(modules: string[], medical = false): Pick<DocumentCatalogEntry, 'isAssistAllowed' | 'isMedicalOrTreatmentRelated'> {
  const assistModule = modules.includes('assist');
  return {
    isAssistAllowed: assistModule && !medical,
    isMedicalOrTreatmentRelated: medical,
  };
}

const CLIENT_TEMPLATES: TemplateDef[] = [
  { templateNumber: 1, templateKey: 'absaugprotokoll', name: 'Absaugprotokoll', shortName: 'Absaugprotokoll', category: 'klient', moduleScope: ['pflege', 'stationaer'], layoutKind: 'table', templateType: 'care_documentation', ...assistOk(['pflege'], true), isCareRelated: true, targetRecordType: 'client_record', defaultStorageArea: 'pflegeakte', builderKey: 'pflegeprotokoll', manualFields: [{ fieldKey: 'sekretmenge', label: 'Sekretmenge' }, { fieldKey: 'massnahme', label: 'Maßnahme' }] },
  { templateNumber: 2, templateKey: 'abtretung_45b', name: 'Abtretungserklärung §45b SGB XI', shortName: 'Abtretung45b', category: 'vertrag', moduleScope: ['assist', 'office', 'pflege', 'beratung'], layoutKind: 'din5008', templateType: 'contract', ...assistOk(['assist', 'office']), targetRecordType: 'client_record', defaultStorageArea: 'vertraege', builderKey: 'generic_form', manualFields: [{ fieldKey: 'leistungsbeginn', label: 'Leistungsbeginn' }] },
  { templateNumber: 3, templateKey: 'interessent_anfrage', name: 'Anfrage / Interessent', shortName: 'Interessent', category: 'klient', moduleScope: ['office', 'assist', 'beratung'], layoutKind: 'form', templateType: 'client_admission', ...assistOk(['assist', 'office']), targetRecordType: 'prospect_record', defaultStorageArea: 'interessenten', builderKey: 'generic_form' },
  { templateNumber: 11, templateKey: 'beschwerdeprotokoll', name: 'Beschwerdeprotokoll', shortName: 'Beschwerde', category: 'qm', moduleScope: ['office', 'assist', 'pflege', 'stationaer'], layoutKind: 'form', templateType: 'protocol', ...assistOk(['office', 'assist']), targetRecordType: 'client_record', defaultStorageArea: 'qm', builderKey: 'generic_form' },
  { templateNumber: 39, templateKey: 'kommunikationsnachweis', name: 'Kommunikationsnachweis', shortName: 'Kommunikation', category: 'klient', moduleScope: ['assist', 'office', 'pflege', 'beratung', 'stationaer'], layoutKind: 'form', templateType: 'protocol', ...assistOk(['assist']), targetRecordType: 'client_record', defaultStorageArea: 'kommunikation', builderKey: 'generic_form' },
  { templateNumber: 51, templateKey: 'notfallblatt', name: 'Notfallblatt', shortName: 'Notfall', category: 'klient', moduleScope: ['assist', 'pflege', 'stationaer', 'beratung'], layoutKind: 'premium', templateType: 'care_documentation', ...assistOk(['assist']), targetRecordType: 'client_record', defaultStorageArea: 'notfall', builderKey: 'stammblatt' },
  { templateNumber: 63, templateKey: 'stammblatt', name: 'Stammblatt', shortName: 'Stammblatt', category: 'klient', moduleScope: ['assist', 'office', 'pflege', 'beratung', 'stationaer'], layoutKind: 'premium', templateType: 'client_admission', ...assistOk(['assist']), targetRecordType: 'client_record', defaultStorageArea: 'stammdaten', builderKey: 'stammblatt' },
  { templateNumber: 72, templateKey: 'zeitprotokoll', name: 'Zeitprotokoll', shortName: 'Zeitprotokoll', category: 'leistungsnachweis', moduleScope: ['assist', 'pflege', 'office', 'stationaer'], layoutKind: 'table', templateType: 'service_record', ...assistOk(['assist']), targetRecordType: 'client_record', defaultStorageArea: 'einsaetze', builderKey: 'leistungsnachweis' },
];

const PFLEGE_TEMPLATES: TemplateDef[] = [
  'pflegeanamnese', 'sis', 'massnahmenplanung', 'pflegeplanung', 'pflegebericht', 'pflegevisite',
  'medikationsplan', 'wundbericht', 'schmerzprotokoll', 'trinkprotokoll', 'lagerungsprotokoll',
  'btm_massnahmen', 'beatmungsprotokoll', 'kathetercheck', 'diabetesueberwachung', 'braden_skala',
].map((key, index) => ({
  templateNumber: 93 + index,
  templateKey: key,
  name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  shortName: key.slice(0, 24),
  category: 'pflege',
  moduleScope: ['pflege', 'stationaer'],
  layoutKind: 'table' as const,
  templateType: 'care_documentation',
  ...assistOk(['pflege', 'stationaer'], true),
  isCareRelated: true,
  targetRecordType: 'client_record',
  defaultStorageArea: 'pflegeakte',
  builderKey: 'pflegeprotokoll',
}));

const OFFICE_HR_SHIFT_TEMPLATES: TemplateDef[] = [
  { templateNumber: 4, templateKey: 'personalstammdaten', name: 'Personalstammdaten', shortName: 'Personalstamm', category: 'mitarbeiter', moduleScope: ['office'], layoutKind: 'premium', templateType: 'employee_record', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'employee_record', defaultStorageArea: 'personalakte', builderKey: 'generic_form', layoutFamily: 'employee_form' },
  { templateNumber: 5, templateKey: 'urlaubsantrag', name: 'Urlaubsantrag', shortName: 'Urlaubsantrag', category: 'mitarbeiter', moduleScope: ['office'], layoutKind: 'form', templateType: 'employee_record', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'employee_record', defaultStorageArea: 'personalakte', builderKey: 'generic_form', layoutFamily: 'employee_form' },
  { templateNumber: 6, templateKey: 'stundenzettel', name: 'Stundenzettel', shortName: 'Stundenzettel', category: 'mitarbeiter', moduleScope: ['office'], layoutKind: 'table', templateType: 'employee_record', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'employee_record', defaultStorageArea: 'personalakte', builderKey: 'generic_form', layoutFamily: 'employee_form' },
  { templateNumber: 7, templateKey: 'dienstplan_soll', name: 'Dienstplan Soll', shortName: 'DienstplanSoll', category: 'dienstplan', moduleScope: ['office', 'pflege'], layoutKind: 'table', templateType: 'shift_plan', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'shift_record', defaultStorageArea: 'dienstplan', builderKey: 'generic_form', layoutFamily: 'shift_plan' },
  { templateNumber: 8, templateKey: 'dienstplan_ist', name: 'Dienstplan Ist', shortName: 'DienstplanIst', category: 'dienstplan', moduleScope: ['office', 'pflege'], layoutKind: 'table', templateType: 'shift_plan', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'shift_record', defaultStorageArea: 'dienstplan', builderKey: 'generic_form', layoutFamily: 'shift_plan' },
  { templateNumber: 9, templateKey: 'tourenplan_woche', name: 'Tourenplan Wochensicht', shortName: 'TourenWoche', category: 'tourenplan', moduleScope: ['office', 'assist'], layoutKind: 'table', templateType: 'tour_plan', isAssistAllowed: true, isMedicalOrTreatmentRelated: false, targetRecordType: 'tour_record', defaultStorageArea: 'tourenplan', builderKey: 'generic_form', layoutFamily: 'tour_plan' },
  { templateNumber: 12, templateKey: 'tourenplan_tag', name: 'Tourenplan Tagessicht', shortName: 'TourenTag', category: 'tourenplan', moduleScope: ['office', 'assist'], layoutKind: 'table', templateType: 'tour_plan', isAssistAllowed: true, isMedicalOrTreatmentRelated: false, targetRecordType: 'tour_record', defaultStorageArea: 'tourenplan', builderKey: 'generic_form', layoutFamily: 'tour_plan' },
  { templateNumber: 13, templateKey: 'fahrtenbuch', name: 'Fahrtenbuch', shortName: 'Fahrtenbuch', category: 'fahrzeug', moduleScope: ['office'], layoutKind: 'table', templateType: 'vehicle_log', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'vehicle_record', defaultStorageArea: 'fahrzeugakte', builderKey: 'generic_form', layoutFamily: 'vehicle_log' },
  { templateNumber: 14, templateKey: 'bewohnerstammblatt', name: 'Bewohnerstammblatt', shortName: 'Bewohnerstamm', category: 'stationaer', moduleScope: ['stationaer'], layoutKind: 'premium', templateType: 'client_admission', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'client_record', defaultStorageArea: 'stationaerakte', builderKey: 'stammblatt', layoutFamily: 'client_master' },
];

const OFFICE_TEMPLATES: TemplateDef[] = [
  { templateNumber: 109, templateKey: 'rechnung', name: 'Rechnung', shortName: 'Rechnung', category: 'rechnung', moduleScope: ['office'], layoutKind: 'din5008', templateType: 'invoice', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'invoice_record', defaultStorageArea: 'rechnungen', builderKey: 'rechnung' },
  { templateNumber: 111, templateKey: 'mahnung', name: 'Mahnung', shortName: 'Mahnung', category: 'rechnung', moduleScope: ['office'], layoutKind: 'din5008', templateType: 'dunning_letter', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'invoice_record', defaultStorageArea: 'mahnungen', builderKey: 'generic_form' },
  { templateNumber: 148, templateKey: 'leistungsnachweis', name: 'Leistungsnachweis', shortName: 'Leistungsnachweis', category: 'leistungsnachweis', moduleScope: ['assist', 'pflege', 'office'], layoutKind: 'premium', templateType: 'leistungsnachweis', ...assistOk(['assist', 'office']), targetRecordType: 'client_record', defaultStorageArea: 'nachweise', builderKey: 'leistungsnachweis' },
];

const BERATUNG_TEMPLATES: TemplateDef[] = [
  { templateNumber: 10, templateKey: 'beratungsprotokoll', name: 'Beratungsprotokoll', shortName: 'Beratungsprotokoll', category: 'beratung', moduleScope: ['beratung'], layoutKind: 'din5008', templateType: 'consultation_record', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'consultation_record', defaultStorageArea: 'beratungsakte', builderKey: 'beratungsprotokoll' },
  { templateNumber: 48, templateKey: 'beratungsnachweis_37_3', name: 'Nachweis Beratungsbesuch §37 Abs. 3 SGB XI', shortName: 'Beratung37_3', category: 'beratung', moduleScope: ['beratung', 'pflege'], layoutKind: 'din5008', templateType: 'consultation_record', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'consultation_record', defaultStorageArea: 'beratungsakte', builderKey: 'beratungsprotokoll' },
];

const ASSIST_EXTRA: TemplateDef[] = [
  { templateNumber: 149, templateKey: 'klient_nicht_angetroffen', name: 'Klient:in nicht angetroffen', shortName: 'NichtAngetroffen', category: 'assist', moduleScope: ['assist'], layoutKind: 'form', templateType: 'service_record', isAssistAllowed: true, isMedicalOrTreatmentRelated: false, targetRecordType: 'client_record', defaultStorageArea: 'einsaetze', builderKey: 'generic_form' },
  { templateNumber: 150, templateKey: 'einsatzabbruch', name: 'Einsatzabbruchprotokoll', shortName: 'Einsatzabbruch', category: 'assist', moduleScope: ['assist'], layoutKind: 'form', templateType: 'service_record', isAssistAllowed: true, isMedicalOrTreatmentRelated: false, targetRecordType: 'client_record', defaultStorageArea: 'einsaetze', builderKey: 'generic_form' },
  { templateNumber: 151, templateKey: 'angehoerigeninformation', name: 'Angehörigeninformation', shortName: 'Angehoerige', category: 'assist', moduleScope: ['assist'], layoutKind: 'premium', templateType: 'protocol', isAssistAllowed: true, isMedicalOrTreatmentRelated: false, targetRecordType: 'client_record', defaultStorageArea: 'kommunikation', builderKey: 'generic_form' },
  { templateNumber: 152, templateKey: 'betreuungswunsch', name: 'Betreuungswunschbogen', shortName: 'Betreuungswunsch', category: 'assist', moduleScope: ['assist'], layoutKind: 'form', templateType: 'client_admission', isAssistAllowed: true, isMedicalOrTreatmentRelated: false, targetRecordType: 'client_record', defaultStorageArea: 'stammdaten', builderKey: 'generic_form' },
  { templateNumber: 153, templateKey: 'alltagsbegleitungsplan', name: 'Alltagsbegleitungsplan', shortName: 'Alltagsplan', category: 'assist', moduleScope: ['assist'], layoutKind: 'premium', templateType: 'care_documentation', isAssistAllowed: true, isMedicalOrTreatmentRelated: false, targetRecordType: 'client_record', defaultStorageArea: 'leistungsplanung', builderKey: 'generic_form' },
  { templateNumber: 154, templateKey: 'ersatztermin_vereinbarung', name: 'Ersatztermin-Vereinbarung', shortName: 'Ersatztermin', category: 'assist', moduleScope: ['assist'], layoutKind: 'form', templateType: 'protocol', isAssistAllowed: true, isMedicalOrTreatmentRelated: false, targetRecordType: 'client_record', defaultStorageArea: 'einsaetze', builderKey: 'generic_form' },
  { templateNumber: 155, templateKey: 'erstkontakt_assist', name: 'Erstkontakt-Protokoll Assist', shortName: 'ErstkontaktAssist', category: 'assist', moduleScope: ['assist'], layoutKind: 'form', templateType: 'client_admission', isAssistAllowed: true, isMedicalOrTreatmentRelated: false, targetRecordType: 'prospect_record', defaultStorageArea: 'interessenten', builderKey: 'generic_form' },
  { templateNumber: 156, templateKey: 'hauswirtschaftsplan', name: 'Hauswirtschaftlicher Aufgabenplan', shortName: 'Hauswirtschaftsplan', category: 'assist', moduleScope: ['assist'], layoutKind: 'table', templateType: 'care_documentation', isAssistAllowed: true, isMedicalOrTreatmentRelated: false, targetRecordType: 'client_record', defaultStorageArea: 'leistungsplanung', builderKey: 'generic_form' },
  { templateNumber: 157, templateKey: 'einsatzabschluss_assist', name: 'Einsatzabschlussbericht Assist', shortName: 'Einsatzabschluss', category: 'assist', moduleScope: ['assist'], layoutKind: 'form', templateType: 'service_record', isAssistAllowed: true, isMedicalOrTreatmentRelated: false, targetRecordType: 'client_record', defaultStorageArea: 'einsaetze', builderKey: 'generic_form' },
  { templateNumber: 158, templateKey: 'monatsuebersicht_45b', name: 'Monatsübersicht Assist §45b', shortName: 'Monat45b', category: 'assist', moduleScope: ['assist', 'office'], layoutKind: 'table', templateType: 'report', isAssistAllowed: true, isMedicalOrTreatmentRelated: false, targetRecordType: 'client_record', defaultStorageArea: 'nachweise', builderKey: 'generic_form' },
];

const OFFICE_EXTRA: TemplateDef[] = [
  { templateNumber: 159, templateKey: 'mandanten_stammdatenblatt', name: 'Mandanten-Stammdatenblatt', shortName: 'MandantStamm', category: 'office', moduleScope: ['office'], layoutKind: 'premium', templateType: 'report', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'tenant_record', defaultStorageArea: 'office', builderKey: 'generic_form' },
  { templateNumber: 160, templateKey: 'rollen_rechtefreigabe', name: 'Rollen- und Rechtefreigabe', shortName: 'Rechtefreigabe', category: 'office', moduleScope: ['office'], layoutKind: 'form', templateType: 'protocol', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'tenant_record', defaultStorageArea: 'office', builderKey: 'generic_form' },
  { templateNumber: 161, templateKey: 'software_nutzungsprotokoll', name: 'Software-Nutzungsprotokoll', shortName: 'SoftwareProtokoll', category: 'office', moduleScope: ['office'], layoutKind: 'form', templateType: 'protocol', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'tenant_record', defaultStorageArea: 'office', builderKey: 'generic_form' },
  { templateNumber: 162, templateKey: 'datenschutz_freigabe', name: 'Datenschutz-Freigabe Dokumente', shortName: 'DatenschutzFreigabe', category: 'office', moduleScope: ['office'], layoutKind: 'din5008', templateType: 'data_protection_consent', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'tenant_record', defaultStorageArea: 'office', builderKey: 'generic_form' },
  { templateNumber: 163, templateKey: 'integrationsstatus', name: 'Integrationsstatus Microsoft / Google / Fax', shortName: 'IntegrationStatus', category: 'office', moduleScope: ['office'], layoutKind: 'table', templateType: 'report', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'tenant_record', defaultStorageArea: 'office', builderKey: 'generic_form' },
  { templateNumber: 164, templateKey: 'abrechnungspruefliste', name: 'Abrechnungsprüfliste', shortName: 'Abrechnungspruef', category: 'office', moduleScope: ['office'], layoutKind: 'table', templateType: 'report', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'invoice_record', defaultStorageArea: 'rechnungen', builderKey: 'generic_form' },
  { templateNumber: 165, templateKey: 'offene_dokumente_liste', name: 'Offene-Dokumente-Liste', shortName: 'OffeneDokumente', category: 'office', moduleScope: ['office'], layoutKind: 'list', templateType: 'report', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'tenant_record', defaultStorageArea: 'office', builderKey: 'generic_form' },
  { templateNumber: 166, templateKey: 'akten_vollstaendigkeit', name: 'Aktenvollständigkeitsprüfung', shortName: 'AktenVollstaendig', category: 'office', moduleScope: ['office'], layoutKind: 'table', templateType: 'checklist', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'client_record', defaultStorageArea: 'archiv', builderKey: 'generic_form' },
];

const BERATUNG_EXTRA: TemplateDef[] = [
  { templateNumber: 167, templateKey: 'pflegegrad_erstberatung', name: 'Pflegegrad-Erstberatung', shortName: 'PG_Erstberatung', category: 'beratung', moduleScope: ['beratung'], layoutKind: 'din5008', templateType: 'consultation_record', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'consultation_record', defaultStorageArea: 'beratungsakte', builderKey: 'beratungsprotokoll' },
  { templateNumber: 168, templateKey: 'angehoerigenberatung', name: 'Angehörigenberatung', shortName: 'Angehoerigenberatung', category: 'beratung', moduleScope: ['beratung'], layoutKind: 'din5008', templateType: 'consultation_record', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'consultation_record', defaultStorageArea: 'beratungsakte', builderKey: 'beratungsprotokoll' },
  { templateNumber: 169, templateKey: 'leistungsberatung_sgb_xi', name: 'Leistungsberatung SGB XI', shortName: 'Leistungsberatung', category: 'beratung', moduleScope: ['beratung'], layoutKind: 'din5008', templateType: 'consultation_record', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'consultation_record', defaultStorageArea: 'beratungsakte', builderKey: 'beratungsprotokoll' },
  { templateNumber: 170, templateKey: 'budgetpruefung', name: 'Budgetprüfung', shortName: 'Budgetpruefung', category: 'beratung', moduleScope: ['beratung', 'office'], layoutKind: 'table', templateType: 'report', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'consultation_record', defaultStorageArea: 'beratungsakte', builderKey: 'generic_form' },
  { templateNumber: 171, templateKey: 'massnahmenempfehlung', name: 'Maßnahmenempfehlung', shortName: 'Massnahmenempfehlung', category: 'beratung', moduleScope: ['beratung'], layoutKind: 'premium', templateType: 'consultation_record', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'consultation_record', defaultStorageArea: 'beratungsakte', builderKey: 'beratungsprotokoll' },
  { templateNumber: 172, templateKey: 'beratungsabschluss', name: 'Beratungsabschlussbericht', shortName: 'Beratungsabschluss', category: 'beratung', moduleScope: ['beratung'], layoutKind: 'din5008', templateType: 'consultation_record', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'consultation_record', defaultStorageArea: 'beratungsakte', builderKey: 'beratungsprotokoll' },
];

const AKADEMIE_TEMPLATES: TemplateDef[] = [
  { templateNumber: 173, templateKey: 'teilnehmerliste', name: 'Teilnehmerliste', shortName: 'Teilnehmerliste', category: 'akademie', moduleScope: ['akademie'], layoutKind: 'list', templateType: 'report', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'course_record', defaultStorageArea: 'akademie', builderKey: 'generic_form' },
  { templateNumber: 174, templateKey: 'anwesenheitsliste', name: 'Anwesenheitsliste', shortName: 'Anwesenheit', category: 'akademie', moduleScope: ['akademie'], layoutKind: 'list', templateType: 'report', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'course_record', defaultStorageArea: 'akademie', builderKey: 'generic_form' },
  { templateNumber: 175, templateKey: 'teilnahmebescheinigung', name: 'Teilnahmebescheinigung', shortName: 'Teilnahme', category: 'akademie', moduleScope: ['akademie'], layoutKind: 'premium', templateType: 'report', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'course_record', defaultStorageArea: 'akademie', builderKey: 'generic_form' },
  { templateNumber: 176, templateKey: 'zertifikat', name: 'Zertifikat', shortName: 'Zertifikat', category: 'akademie', moduleScope: ['akademie'], layoutKind: 'premium', templateType: 'report', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'course_record', defaultStorageArea: 'akademie', builderKey: 'generic_form' },
  { templateNumber: 177, templateKey: 'pruefung_lernzielkontrolle', name: 'Prüfung / Lernzielkontrolle', shortName: 'Lernzielkontrolle', category: 'akademie', moduleScope: ['akademie'], layoutKind: 'form', templateType: 'checklist', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'course_record', defaultStorageArea: 'akademie', builderKey: 'generic_form' },
  { templateNumber: 178, templateKey: 'feedbackbogen', name: 'Feedbackbogen', shortName: 'Feedback', category: 'akademie', moduleScope: ['akademie'], layoutKind: 'form', templateType: 'checklist', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'course_record', defaultStorageArea: 'akademie', builderKey: 'generic_form' },
  { templateNumber: 179, templateKey: 'unterweisungsnachweis', name: 'Unterweisungsnachweis', shortName: 'Unterweisung', category: 'akademie', moduleScope: ['akademie', 'office'], layoutKind: 'form', templateType: 'report', isAssistAllowed: false, isMedicalOrTreatmentRelated: false, targetRecordType: 'course_record', defaultStorageArea: 'akademie', builderKey: 'generic_form' },
];

/** Generiert fehlende Platzhalter-Einträge bis 179 Systemvorlagen. */
function fillCatalogGaps(existing: TemplateDef[]): DocumentCatalogEntry[] {
  const byNumber = new Map(existing.map((e) => [e.templateNumber, e]));
  const result: DocumentCatalogEntry[] = [];

  for (let n = 1; n <= 179; n += 1) {
    const found = byNumber.get(n);
    if (found) {
      result.push({ ...found, layoutFamily: inferLayoutFamily(found) });
      continue;
    }
    result.push({
      templateNumber: n,
      templateKey: `system_doc_${String(n).padStart(3, '0')}`,
      name: `CareSuite Dokumentvorlage ${n}`,
      shortName: `Doc${n}`,
      category: 'system',
      moduleScope: ['office'],
      layoutKind: 'premium',
      layoutFamily: 'generic_form',
      templateType: 'generic',
      isAssistAllowed: false,
      isMedicalOrTreatmentRelated: false,
      targetRecordType: 'client_record',
      defaultStorageArea: 'archiv',
      builderKey: 'generic_form',
      manualFields: [{ fieldKey: 'notiz', label: 'Eintrag' }],
    });
  }
  return result;
}

const CORE_ENTRIES: TemplateDef[] = [
  ...CLIENT_TEMPLATES,
  ...OFFICE_HR_SHIFT_TEMPLATES,
  ...PFLEGE_TEMPLATES,
  ...OFFICE_TEMPLATES,
  ...BERATUNG_TEMPLATES,
  ...ASSIST_EXTRA,
  ...OFFICE_EXTRA,
  ...BERATUNG_EXTRA,
  ...AKADEMIE_TEMPLATES,
];

export const SYSTEM_DOCUMENT_CATALOG_MANIFEST: DocumentCatalogEntry[] = fillCatalogGaps(CORE_ENTRIES);

export function getCatalogEntryByKey(templateKey: string): DocumentCatalogEntry | undefined {
  return SYSTEM_DOCUMENT_CATALOG_MANIFEST.find((e) => e.templateKey === templateKey);
}

export function getAssistAllowedCatalogEntries(): DocumentCatalogEntry[] {
  return SYSTEM_DOCUMENT_CATALOG_MANIFEST.filter(
    (e) => e.isAssistAllowed && !e.isMedicalOrTreatmentRelated,
  );
}
