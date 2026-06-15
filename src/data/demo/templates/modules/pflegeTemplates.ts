import { seriesTpl } from '../helpers';

const SIS = seriesTpl(
  'tpl-pflege-sis',
  'pflege',
  'sis',
  'sis_topic',
  [
    'Mobilität', 'Kognition / Orientierung', 'Selbstversorgung Körperpflege', 'Selbstversorgung Essen',
    'Ausscheidung', 'Schlaf', 'Schmerz', 'Wundmanagement', 'Medikation', 'Kommunikation',
    'Soziale Kontakte', 'Hauswirtschaftliche Versorgung',
  ],
  (title) => `SIS ${title}: {{clientName}} — Einschätzung {{date}}. Befund: {{notes}}.`,
);

const ANAMNESIS = seriesTpl(
  'tpl-pflege-anam',
  'pflege',
  'documentation_text',
  'anamnesis',
  [
    'Vorerkrankungen', 'Operationen', 'Allergien', 'Medikamente dauerhaft', 'Hilfsmittel',
    'Ernährung / Trinken', 'Ausscheidung', 'Schlafverhalten', 'Schmerzanamnese', 'Sturzvorgeschichte',
    'Dekubitusrisiko', 'Kognitive Einschränkung', 'Psychische Belastung', 'Soziales Umfeld',
    'Pflegegrad bisher', 'Lebenssituation', 'Patientenverfügung', 'Notfallplan', 'Anamnese Zusammenfassung',
  ],
  (title) => `Anamnese — ${title}: {{clientName}}.`,
);

const PLANNING = seriesTpl(
  'tpl-pflege-plan',
  'pflege',
  'care_plan',
  'planning',
  [
    'Grundpflege', 'Behandlungspflege', 'Mobilisation', 'Dekubitusprophylaxe', 'Sturzprophylaxe',
    'Schmerzmanagement', 'Ernährung', 'Flüssigkeit', 'Medikation', 'Wundversorgung',
    'Kommunikation fördern', 'Aktivierung', 'Angehörigenarbeit', 'Entlassungsplanung',
  ],
  (title) => `Pflegeplanung ${title} für {{clientName}} — Ziel: {{goal}}.`,
);

const GOALS = seriesTpl(
  'tpl-pflege-goal',
  'pflege',
  'care_plan',
  'goals',
  [
    'Selbstständigkeit fördern', 'Schmerzreduktion', 'Mobilität erhalten', 'Dekubitus vermeiden',
    'Sturz vermeiden', 'Ausreichende Flüssigkeitszufuhr', 'Ausgewogene Ernährung', 'Soziale Teilhabe',
    'Orientierung stärken', 'Schlaf verbessern', 'Wundheilung', 'Medikamentencompliance',
    'Lebensqualität',
  ],
  (title) => `Pflegeziel: ${title} — messbar bis {{endDate}}.`,
);

const MEASURES = seriesTpl(
  'tpl-pflege-measure',
  'pflege',
  'care_plan',
  'measures',
  [
    'Lagerung 2-stündlich', 'Hautinspektion', 'Mobilisation 3x täglich', 'Gehtraining',
    'Schmerzskala dokumentieren', 'Trinkprotokoll', 'Essensanreichen', 'Medikamentengabe',
    'Wundversorgung nach Plan', 'Kompressionsstrümpfe', 'Hilfsmittel anpassen', 'Angehörige schulen',
    'Sturzsensor prüfen', 'Umgebung sichern', 'Aktivierung täglich', 'Beratung Ernährung',
    'Physiotherapie koordinieren', 'Schmerzmanagement-Plan',
  ],
  (title) => `Maßnahme: ${title} — {{clientName}}, Verantwortlich: {{employeeName}}.`,
);

const RISKS = seriesTpl(
  'tpl-pflege-risk',
  'pflege',
  'risk_assessment',
  'care_risk_type',
  [
    'Sturzrisiko', 'Dekubitusrisiko', 'Mangelernährung', 'Dehydratation', 'Inkontinenz',
    'Schmerz', 'Wundinfektion', 'Medikationsfehler', 'Aspiration', 'Entgleisung Diabetes',
    'Suizidalität', 'Weglaufgefahr', 'Hautintegrität', 'Kontraktur',
  ],
  (title) => `Risiko ${title}: Einschätzung für {{clientName}} — Maßnahmen: {{measure}}.`,
);

const VITALS = seriesTpl(
  'tpl-pflege-vital',
  'pflege',
  'documentation_text',
  'vitals',
  [
    'Blutdruck', 'Puls', 'Temperatur', 'Atemfrequenz', 'SpO2', 'Blutzucker',
    'Gewicht', 'Schmerz VAS', 'BMI', 'Flüssigkeitsbilanz', 'Ausscheidung', 'Schlafqualität',
  ],
  (title) => `${title}: {{clientName}} — Wert erfasst am {{date}} {{time}}.`,
);

const MEDS = seriesTpl(
  'tpl-pflege-med',
  'pflege',
  'documentation_text',
  'meds',
  [
    'Medikamentengabe morgens', 'Medikamentengabe mittags', 'Medikamentengabe abends',
    'Medikamentengabe nachts', 'Bedarfsmedikation', 'Inhalation', 'Insulin', 'Augentropfen',
    'Salbe / Creme', 'Pflasterwechsel', 'Abweichung vom Plan', 'Nebenwirkung dokumentiert',
    'Apothekengang', 'Medikamentenplan aktualisiert',
  ],
  (title) => `${title}: {{clientName}} — {{employeeName}}.`,
);

const WOUNDS = seriesTpl(
  'tpl-pflege-wound',
  'pflege',
  'documentation_text',
  'wounds',
  [
    'Wundbeurteilung initial', 'Wundgröße messen', 'Exsudat', 'Wundrand', 'Wundgrund',
    'Geruch', 'Schmerz bei Versorgung', 'Verbandwechsel', 'Dekubitus Grad I', 'Dekubitus Grad II',
    'Dekubitus Grad III', 'Dekubitus Grad IV', 'Wundheilungsverlauf', 'Foto-Dokumentation',
    'Überweisung Wundmanager',
  ],
  (title) => `Wunde — ${title}: Lokalisation {{location}}, {{clientName}}.`,
);

const REPORTS = seriesTpl(
  'tpl-pflege-report',
  'pflege',
  'documentation_text',
  'reports',
  [
    'Tagesbericht', 'Nachtbericht', 'Übergabe Frühdienst', 'Übergabe Spätdienst',
    'Übergabe Nachtdienst', 'Wochenbericht', 'Entlassungsbericht', 'Verlaufsbericht',
    'Angehörigeninfo', 'Arztinformation', 'MD-Vorbereitung', 'Qualitätsrückmeldung',
    'Ereignisbericht', 'Sturzprotokoll',
  ],
  (title) => `${title} für {{clientName}} am {{date}}: {{summary}}.`,
);

export const PFLEGE_TEMPLATES = [
  ...SIS,
  ...ANAMNESIS,
  ...PLANNING,
  ...GOALS,
  ...MEASURES,
  ...RISKS,
  ...VITALS,
  ...MEDS,
  ...WOUNDS,
  ...REPORTS,
];
