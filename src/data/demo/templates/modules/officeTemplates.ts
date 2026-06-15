import { batchTpl, seriesTpl } from '../helpers';

const INTAKE = batchTpl('tpl-office-intake', 'office', 'documentation_text', [
  { title: 'Intake — Erstkontakt', content: 'Erstkontakt mit {{clientName}} am {{date}}. Anliegen: {{topic}}.', categoryKey: 'intake' },
  { title: 'Intake — Angehörige', content: 'Gespräch mit Angehörigen zu {{clientName}}. Kontakt: {{contactName}}.', categoryKey: 'intake' },
  { title: 'Intake — Pflegegrad klären', content: 'Pflegegrad {{careLevel}} besprochen. Nächster Schritt: {{nextStep}}.', categoryKey: 'intake' },
  { title: 'Intake — Leistungsbedarf', content: 'Leistungsbedarf für {{clientName}}: {{serviceType}}.', categoryKey: 'intake' },
  { title: 'Intake — Kostenträger', content: 'Kostenträger {{careFundName}} erfasst.', categoryKey: 'intake' },
  { title: 'Intake — Notfallkontakt', content: 'Notfallkontakt: {{emergencyContactName}}, Tel. {{phone}}.', categoryKey: 'intake' },
  { title: 'Intake — Wohnungssituation', content: 'Wohnsituation bei {{clientName}}: {{address}}.', categoryKey: 'intake' },
  { title: 'Intake — Hilfsmittel', content: 'Bestehende Hilfsmittel: {{aids}}.', categoryKey: 'intake' },
]);

const NOTES = seriesTpl(
  'tpl-office-notes',
  'office',
  'documentation_text',
  'notes',
  [
    'Telefonnotiz', 'Hausbesuch Protokoll', 'Rückruf dokumentiert', 'Interne Absprache',
    'Kostenträger-Rückmeldung', 'Termin vereinbart', 'Unterlagen angefordert',
    'Statusänderung notiert', 'Angehörigenkontakt', 'Qualitätshinweis',
  ],
  (title) => `${title} für {{clientName}} am {{date}}: {{notes}}.`,
);

const FOLLOWUPS = batchTpl('tpl-office-followup', 'office', 'task', [
  { title: 'Wiedervorlage Vertrag', content: 'Vertragsunterzeichnung nachfassen — {{clientName}}.', categoryKey: 'followups' },
  { title: 'Wiedervorlage MD-Termin', content: 'MD-Termin vorbereiten für {{clientName}}.', categoryKey: 'followups' },
  { title: 'Wiedervorlage Pflegegrad', content: 'Pflegegrad-Antrag prüfen — {{clientName}}.', categoryKey: 'followups' },
  { title: 'Wiedervorlage Rechnung', content: 'Offene Rechnung klären — {{invoiceNumber}}.', categoryKey: 'followups' },
  { title: 'Wiedervorlage Dokumente', content: 'Fehlende Unterlagen anfordern bei {{clientName}}.', categoryKey: 'followups' },
  { title: 'Wiedervorlage Angehörige', content: 'Rückmeldung an Angehörige — {{contactName}}.', categoryKey: 'followups' },
  { title: 'Wiedervorlage Kostenträger', content: 'Kostenträger {{careFundName}} kontaktieren.', categoryKey: 'followups' },
  { title: 'Wiedervorlage Qualität', content: 'Qualitätsrückmeldung bearbeiten.', categoryKey: 'followups' },
]);

const TASKS = seriesTpl(
  'tpl-office-task',
  'office',
  'task',
  'office_tasks',
  [
    'Stammdaten prüfen', 'Vertrag vorbereiten', 'Einwilligungen einholen', 'Pflegekasse informieren',
    'Einsatzplan abstimmen', 'Dokumente scannen', 'Portal freischalten', 'Abrechnung vorbereiten',
    'QM-Checkliste', 'Onboarding abschließen',
  ],
  (title) => `Office-Aufgabe: ${title} — {{clientName}}.`,
);

const CONTRACTS = batchTpl('tpl-office-contract', 'office', 'document', [
  { title: 'Pflegevertrag Standard', content: 'Pflegevertrag zwischen {{companyName}} und {{clientName}}, Beginn {{startDate}}.', categoryKey: 'contracts' },
  { title: 'Leistungsvereinbarung SGB XI', content: 'Leistungsvereinbarung nach SGB XI für {{clientName}}.', categoryKey: 'contracts' },
  { title: 'Leistungsvereinbarung privat', content: 'Private Leistungsvereinbarung — Stundensatz {{hourlyRate}} €.', categoryKey: 'contracts' },
  { title: 'Zusatzvereinbarung Haushalt', content: 'Zusatzleistungen Haushalt für {{clientName}}.', categoryKey: 'contracts' },
  { title: 'Zusatzvereinbarung Betreuung', content: 'Betreuungsleistungen gemäß Bedarf.', categoryKey: 'contracts' },
  { title: 'Kündigungsvereinbarung', content: 'Beendigung zum {{endDate}} — Fristen beachten.', categoryKey: 'contracts' },
  { title: 'Vertragshinweis Datenschutz', content: 'Datenschutzhinweise gemäß DSGVO ausgehändigt.', categoryKey: 'contracts' },
  { title: 'Vertragshinweis Widerruf', content: 'Widerrufsbelehrung ausgehändigt am {{date}}.', categoryKey: 'contracts' },
]);

const CONSENTS = batchTpl('tpl-office-consent', 'office', 'consent', [
  { title: 'Datenschutz Einwilligung', content: 'Ich willige in die Verarbeitung meiner personenbezogenen Daten ein.', categoryKey: 'consent_type', opts: { isDefault: true } },
  { title: 'Foto-/Video-Einwilligung', content: 'Einwilligung zur Foto-/Videodokumentation zu Qualitätszwecken.', categoryKey: 'consent_type' },
  { title: 'Portal-Einwilligung', content: 'Einwilligung zur Nutzung des Klient:innenportals.', categoryKey: 'consent_type' },
  { title: 'Kommunikation Angehörige', content: 'Einwilligung zur Information von Angehörigen.', categoryKey: 'consent_type' },
  { title: 'Medizinische Datenweitergabe', content: 'Einwilligung zur Weitergabe medizinischer Daten an behandelnde Ärzte.', categoryKey: 'consent_type' },
  { title: 'Einwilligung TI/KIM', content: 'Einwilligung zur elektronischen Kommunikation im Gesundheitswesen.', categoryKey: 'consent_type' },
]);

export const OFFICE_TEMPLATES = [...INTAKE, ...NOTES, ...FOLLOWUPS, ...TASKS, ...CONTRACTS, ...CONSENTS];
