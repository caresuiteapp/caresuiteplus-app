import { batchTpl, seriesTpl } from '../helpers';

const TYPES = batchTpl('tpl-beratung-type', 'beratung', 'dropdown_value', [
  { title: 'Erstberatung Pflegegrad', content: 'pflegegrad_erst', categoryKey: 'counseling_topic' },
  { title: 'Wiederholungsberatung', content: 'wiederholung', categoryKey: 'counseling_topic' },
  { title: 'Angehörigenberatung', content: 'angehoerige', categoryKey: 'counseling_topic' },
  { title: 'Entlastungsleistungen', content: 'entlastung', categoryKey: 'counseling_topic' },
  { title: 'Verhinderungspflege', content: 'verhinderung', categoryKey: 'counseling_topic' },
  { title: 'Wohnraumanpassung', content: 'wohnraum', categoryKey: 'counseling_topic' },
  { title: 'Hilfsmittelberatung', content: 'hilfsmittel', categoryKey: 'counseling_topic' },
  { title: 'Case Management', content: 'case_mgmt', categoryKey: 'counseling_topic' },
]);

const CHECKLIST = seriesTpl(
  'tpl-beratung-check',
  'beratung',
  'checklist',
  'checklist',
  [
    'Anliegen erfasst', 'Einwilligung Beratung', 'Pflegegrad besprochen', 'Leistungsansprüche erläutert',
    'Entlastungsleistungen', 'Hilfsmittel', 'Wohnraumanpassung', 'Angehörige einbezogen',
    'Nächster Termin', 'Unterlagen übergeben',
  ],
  (title) => `☐ ${title}`,
);

const PROTOCOL = batchTpl('tpl-beratung-proto', 'beratung', 'counseling_protocol', [
  { title: 'Beratungsprotokoll Standard', content: 'Beratung mit {{clientName}} am {{date}}. Thema: {{topic}}. Ergebnis: {{summary}}.', categoryKey: 'protocol' },
  { title: 'Beratungsprotokoll Pflegegrad', content: 'Pflegegrad-Beratung {{grade}} — Leistungen und Ansprüche erläutert.', categoryKey: 'protocol' },
  { title: 'Beratungsprotokoll Angehörige', content: 'Gespräch mit Angehörigen zu {{clientName}} — {{contactName}}.', categoryKey: 'protocol' },
  { title: 'Beratungsprotokoll MD-Vorbereitung', content: 'Vorbereitung MD-Termin für {{clientName}} am {{date}}.', categoryKey: 'protocol' },
  { title: 'Beratungsprotokoll Kurz', content: 'Kurzprotokoll: {{topic}} — {{notes}}.', categoryKey: 'protocol' },
]);

const ACTION_PLAN = seriesTpl(
  'tpl-beratung-action',
  'beratung',
  'documentation_text',
  'action_plan',
  ['Antrag Pflegegrad', 'Hilfsmittel beantragen', 'Entlastungsbudget', 'Verhinderungspflege', 'Wohnraumberatung', 'Angehörigen entlasten', 'Pflegedienst vermitteln', 'MD-Termin'],
  (title) => `Maßnahmenplan: ${title} für {{clientName}} — Ziel {{goal}}, bis {{endDate}}.`,
);

const FOLLOWUPS = seriesTpl(
  'tpl-beratung-follow',
  'beratung',
  'task',
  'followups',
  ['MD-Ergebnis nachhalten', 'Antrag Status prüfen', 'Angehörige informieren', 'Unterlagen nachreichen', 'Wiedervorlage 3 Monate', 'Wiedervorlage 6 Monate', 'Qualitätsrückmeldung'],
  (title) => `Wiedervorlage Beratung: ${title} — {{clientName}}.`,
);

export const BERATUNG_TEMPLATES = [...TYPES, ...CHECKLIST, ...PROTOCOL, ...ACTION_PLAN, ...FOLLOWUPS];
