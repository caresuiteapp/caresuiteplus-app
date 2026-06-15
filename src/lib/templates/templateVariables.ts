/** Ersetzt {{variable}} Platzhalter im Vorlagentext. */
export function renderTemplateWithVariables(
  content: string,
  variables: Record<string, string>,
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match,
  );
}

export function extractTemplateVariables(content: string): string[] {
  return [...new Set([...content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
}

/** Section 19 — zentrale Vorlagenvariablen für CareSuite+ */
export type TemplateVariableDefinition = {
  key: string;
  label: string;
  example: string;
  group: 'client' | 'employee' | 'company' | 'care' | 'billing' | 'communication' | 'course' | 'clinical' | 'general';
};

export const TEMPLATE_VARIABLES: TemplateVariableDefinition[] = [
  { key: 'clientName', label: 'Klient:in (vollständig)', example: 'Helga Schneider', group: 'client' },
  { key: 'clientFirstName', label: 'Vorname Klient:in', example: 'Helga', group: 'client' },
  { key: 'clientLastName', label: 'Nachname Klient:in', example: 'Schneider', group: 'client' },
  { key: 'dateOfBirth', label: 'Geburtsdatum', example: '1948-03-15', group: 'client' },
  { key: 'careLevel', label: 'Pflegegrad', example: 'PG 2', group: 'client' },
  { key: 'address', label: 'Adresse', example: 'Musterstraße 1, 10115 Berlin', group: 'client' },
  { key: 'phone', label: 'Telefon', example: '+49 30 123456', group: 'client' },
  { key: 'email', label: 'E-Mail', example: 'kontakt@example.de', group: 'client' },
  { key: 'emergencyContactName', label: 'Notfallkontakt', example: 'Maria Schneider', group: 'client' },
  { key: 'careFundName', label: 'Pflegekasse / Kostenträger', example: 'AOK Nordost', group: 'client' },
  { key: 'employeeName', label: 'Mitarbeiter:in', example: 'Anna Pflege', group: 'employee' },
  { key: 'contactName', label: 'Kontaktperson', example: 'Thomas Müller', group: 'communication' },
  { key: 'companyName', label: 'Unternehmensname', example: 'CareSuite Pflegedienst', group: 'company' },
  { key: 'tenantName', label: 'Mandantenname', example: 'CareSuite Demo GmbH', group: 'company' },
  { key: 'date', label: 'Datum', example: '2026-06-13', group: 'general' },
  { key: 'time', label: 'Uhrzeit', example: '14:30', group: 'general' },
  { key: 'startDate', label: 'Startdatum', example: '2026-01-01', group: 'general' },
  { key: 'endDate', label: 'Enddatum', example: '2026-12-31', group: 'general' },
  { key: 'dueDate', label: 'Fälligkeitsdatum', example: '2026-07-01', group: 'general' },
  { key: 'month', label: 'Monat', example: 'Juni 2026', group: 'general' },
  { key: 'period', label: 'Zeitraum', example: '01.06.–30.06.2026', group: 'general' },
  { key: 'invoiceNumber', label: 'Rechnungsnummer', example: 'RE-2026-0042', group: 'billing' },
  { key: 'amount', label: 'Betrag', example: '384,50', group: 'billing' },
  { key: 'creditNumber', label: 'Gutschriftnummer', example: 'GS-2026-0003', group: 'billing' },
  { key: 'hourlyRate', label: 'Stundensatz', example: '38,00', group: 'billing' },
  { key: 'serviceType', label: 'Leistungsart', example: 'Grundpflege', group: 'care' },
  { key: 'serviceName', label: 'Leistungsbezeichnung', example: 'Körperpflege', group: 'care' },
  { key: 'topic', label: 'Thema', example: 'Pflegegradberatung', group: 'general' },
  { key: 'notes', label: 'Notizen', example: 'Ruhiger Verlauf', group: 'general' },
  { key: 'summary', label: 'Zusammenfassung', example: 'Termin vereinbart', group: 'general' },
  { key: 'message', label: 'Nachrichtentext', example: 'Ihre Unterlagen liegen bereit.', group: 'communication' },
  { key: 'info', label: 'Information', example: 'Teamabstimmung 15:00', group: 'communication' },
  { key: 'goal', label: 'Ziel', example: 'Selbstständigkeit fördern', group: 'care' },
  { key: 'measure', label: 'Maßnahme', example: 'Gehtraining 2× täglich', group: 'care' },
  { key: 'grade', label: 'Note / Pflegegrad', example: '2', group: 'care' },
  { key: 'nextStep', label: 'Nächster Schritt', example: 'MD-Termin vereinbaren', group: 'general' },
  { key: 'shift', label: 'Schicht / Dienst', example: 'Frühdienst', group: 'general' },
  { key: 'roomNumber', label: 'Zimmernummer', example: 'A-12', group: 'care' },
  { key: 'dietType', label: 'Kostform', example: 'Vollkost', group: 'clinical' },
  { key: 'bloodPressure', label: 'Blutdruck', example: '120/80', group: 'clinical' },
  { key: 'pulse', label: 'Puls', example: '72', group: 'clinical' },
  { key: 'temp', label: 'Temperatur', example: '36,8', group: 'clinical' },
  { key: 'location', label: 'Lokalisation', example: 'Ferse links', group: 'clinical' },
  { key: 'size', label: 'Größe', example: '2 × 3 cm', group: 'clinical' },
  { key: 'exudate', label: 'Exsudat', example: 'gering', group: 'clinical' },
  { key: 'mobilityLevel', label: 'Mobilität', example: 'Rollator', group: 'clinical' },
  { key: 'aids', label: 'Hilfsmittel', example: 'Rollator, Duschstuhl', group: 'clinical' },
  { key: 'cognitionNotes', label: 'Kognition', example: 'zeitweise desorientiert', group: 'clinical' },
  { key: 'hospitalName', label: 'Krankenhaus', example: 'Klinikum Nord', group: 'clinical' },
  { key: 'participantName', label: 'Teilnehmer:in', example: 'Lisa Schulz', group: 'course' },
  { key: 'courseName', label: 'Kursname', example: 'Hygiene in der Pflege', group: 'course' },
  { key: 'body', label: 'Freitext / Inhalt', example: 'Anbei der gewünschte Befund.', group: 'general' },
  { key: 'name', label: 'Name (allgemein)', example: 'Max Mustermann', group: 'general' },
  { key: 'fromPerson', label: 'Von Person', example: 'Frühdienst', group: 'general' },
  { key: 'toPerson', label: 'An Person', example: 'Spätdienst', group: 'general' },
  { key: 'start', label: 'Beginn (Uhrzeit/Datum)', example: '22:00', group: 'general' },
];

export function getTemplateVariableKeys(): string[] {
  return TEMPLATE_VARIABLES.map((v) => v.key);
}

export function getSampleVariableValues(): Record<string, string> {
  return Object.fromEntries(TEMPLATE_VARIABLES.map((v) => [v.key, v.example]));
}
