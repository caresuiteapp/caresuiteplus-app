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
  group:
    | 'tenant'
    | 'client'
    | 'employee'
    | 'appointment'
    | 'document'
    | 'billing'
    | 'message'
    | 'company'
    | 'care'
    | 'communication'
    | 'course'
    | 'clinical'
    | 'general';
};

export const TEMPLATE_VARIABLES: TemplateVariableDefinition[] = [
  // Mandant / Unternehmen
  { key: 'tenantName', label: 'Mandantenname', example: 'CareSuite Demo GmbH', group: 'tenant' },
  { key: 'companyName', label: 'Unternehmensname', example: 'CareSuite Pflegedienst', group: 'tenant' },
  { key: 'tenantAddress', label: 'Mandanten-Adresse', example: 'Musterstraße 10, 10115 Berlin', group: 'tenant' },
  { key: 'tenantPhone', label: 'Mandanten-Telefon', example: '+49 30 987654', group: 'tenant' },
  { key: 'tenantEmail', label: 'Mandanten-E-Mail', example: 'buero@caresuite.de', group: 'tenant' },
  { key: 'facilityName', label: 'Einrichtungsname', example: 'CareSuite Haus Nord', group: 'tenant' },
  { key: 'wardName', label: 'Wohnbereich', example: 'Wohnbereich A', group: 'tenant' },
  // Klient:in
  { key: 'clientName', label: 'Klient:in (vollständig)', example: 'Helga Schneider', group: 'client' },
  { key: 'clientFirstName', label: 'Vorname Klient:in', example: 'Helga', group: 'client' },
  { key: 'clientLastName', label: 'Nachname Klient:in', example: 'Schneider', group: 'client' },
  { key: 'dateOfBirth', label: 'Geburtsdatum', example: '1948-03-15', group: 'client' },
  { key: 'careLevel', label: 'Pflegegrad', example: 'PG 2', group: 'client' },
  { key: 'address', label: 'Adresse', example: 'Musterstraße 1, 10115 Berlin', group: 'client' },
  { key: 'phone', label: 'Telefon', example: '+49 30 123456', group: 'client' },
  { key: 'email', label: 'E-Mail', example: 'kontakt@example.de', group: 'client' },
  { key: 'emergencyContactName', label: 'Notfallkontakt', example: 'Maria Schneider', group: 'client' },
  { key: 'relativeName', label: 'Angehörige:r', example: 'Maria Schneider', group: 'client' },
  { key: 'guardianName', label: 'Gesetzliche:r Betreuer:in', example: 'Dr. Thomas Weber', group: 'client' },
  { key: 'careFundName', label: 'Pflegekasse / Kostenträger', example: 'AOK Nordost', group: 'client' },
  { key: 'roomNumber', label: 'Zimmernummer', example: 'A-12', group: 'client' },
  // Mitarbeiter:in
  { key: 'employeeName', label: 'Mitarbeiter:in', example: 'Anna Pflege', group: 'employee' },
  { key: 'employeeFirstName', label: 'Vorname Mitarbeiter:in', example: 'Anna', group: 'employee' },
  { key: 'employeeLastName', label: 'Nachname Mitarbeiter:in', example: 'Pflege', group: 'employee' },
  { key: 'employeeRole', label: 'Funktion / Rolle', example: 'Pflegefachkraft', group: 'employee' },
  { key: 'employeeDepartment', label: 'Abteilung / Team', example: 'Ambulanter Dienst', group: 'employee' },
  { key: 'employeePhone', label: 'Telefon Mitarbeiter:in', example: '+49 170 1234567', group: 'employee' },
  // Termine
  { key: 'date', label: 'Datum', example: '2026-06-13', group: 'appointment' },
  { key: 'time', label: 'Uhrzeit', example: '14:30', group: 'appointment' },
  { key: 'appointmentDate', label: 'Termindatum', example: '2026-06-20', group: 'appointment' },
  { key: 'appointmentTime', label: 'Terminuhrzeit', example: '10:00', group: 'appointment' },
  { key: 'appointmentLocation', label: 'Terminort', example: 'Praxis Dr. Meyer', group: 'appointment' },
  { key: 'startDate', label: 'Startdatum', example: '2026-01-01', group: 'appointment' },
  { key: 'endDate', label: 'Enddatum', example: '2026-12-31', group: 'appointment' },
  { key: 'dueDate', label: 'Fälligkeitsdatum', example: '2026-07-01', group: 'appointment' },
  { key: 'month', label: 'Monat', example: 'Juni 2026', group: 'appointment' },
  { key: 'period', label: 'Zeitraum', example: '01.06.–30.06.2026', group: 'appointment' },
  { key: 'start', label: 'Beginn (Uhrzeit/Datum)', example: '22:00', group: 'appointment' },
  { key: 'end', label: 'Ende (Uhrzeit/Datum)', example: '23:30', group: 'appointment' },
  // Dokumente
  { key: 'documentName', label: 'Dokumentname', example: 'Pflegeplan Juni 2026', group: 'document' },
  { key: 'documentType', label: 'Dokumenttyp', example: 'Pflegedokumentation', group: 'document' },
  { key: 'body', label: 'Freitext / Inhalt', example: 'Anbei der gewünschte Befund.', group: 'document' },
  // Abrechnung
  { key: 'invoiceNumber', label: 'Rechnungsnummer', example: 'RE-2026-0042', group: 'billing' },
  { key: 'amount', label: 'Betrag', example: '384,50', group: 'billing' },
  { key: 'creditNumber', label: 'Gutschriftnummer', example: 'GS-2026-0003', group: 'billing' },
  { key: 'hourlyRate', label: 'Stundensatz', example: '38,00', group: 'billing' },
  { key: 'billingPeriod', label: 'Abrechnungszeitraum', example: 'Juni 2026', group: 'billing' },
  { key: 'dueAmount', label: 'Fälliger Betrag', example: '412,00', group: 'billing' },
  { key: 'paymentDueDate', label: 'Zahlungsziel', example: '2026-07-15', group: 'billing' },
  // Nachricht / Kommunikation
  { key: 'contactName', label: 'Kontaktperson', example: 'Thomas Müller', group: 'message' },
  { key: 'senderName', label: 'Absender', example: 'Büro CareSuite', group: 'message' },
  { key: 'recipientName', label: 'Empfänger', example: 'Helga Schneider', group: 'message' },
  { key: 'messageSubject', label: 'Betreff', example: 'Terminbestätigung', group: 'message' },
  { key: 'message', label: 'Nachrichtentext', example: 'Ihre Unterlagen liegen bereit.', group: 'message' },
  { key: 'info', label: 'Information', example: 'Teamabstimmung 15:00', group: 'message' },
  { key: 'fromPerson', label: 'Von Person', example: 'Frühdienst', group: 'message' },
  { key: 'toPerson', label: 'An Person', example: 'Spätdienst', group: 'message' },
  { key: 'name', label: 'Name (allgemein)', example: 'Max Mustermann', group: 'message' },
  // Pflege / Klinik
  { key: 'serviceType', label: 'Leistungsart', example: 'Grundpflege', group: 'care' },
  { key: 'serviceName', label: 'Leistungsbezeichnung', example: 'Körperpflege', group: 'care' },
  { key: 'goal', label: 'Ziel', example: 'Selbstständigkeit fördern', group: 'care' },
  { key: 'measure', label: 'Maßnahme', example: 'Gehtraining 2× täglich', group: 'care' },
  { key: 'grade', label: 'Note / Pflegegrad', example: '2', group: 'care' },
  { key: 'shift', label: 'Schicht / Dienst', example: 'Frühdienst', group: 'care' },
  { key: 'topic', label: 'Thema', example: 'Pflegegradberatung', group: 'general' },
  { key: 'notes', label: 'Notizen', example: 'Ruhiger Verlauf', group: 'general' },
  { key: 'summary', label: 'Zusammenfassung', example: 'Termin vereinbart', group: 'general' },
  { key: 'nextStep', label: 'Nächster Schritt', example: 'MD-Termin vereinbaren', group: 'general' },
  { key: 'location', label: 'Ort / Lokalisation', example: 'Praxis Nord', group: 'general' },
  { key: 'dietType', label: 'Kostform', example: 'Vollkost', group: 'clinical' },
  { key: 'bloodPressure', label: 'Blutdruck', example: '120/80', group: 'clinical' },
  { key: 'pulse', label: 'Puls', example: '72', group: 'clinical' },
  { key: 'temp', label: 'Temperatur', example: '36,8', group: 'clinical' },
  { key: 'size', label: 'Größe', example: '2 × 3 cm', group: 'clinical' },
  { key: 'exudate', label: 'Exsudat', example: 'gering', group: 'clinical' },
  { key: 'mobilityLevel', label: 'Mobilität', example: 'Rollator', group: 'clinical' },
  { key: 'aids', label: 'Hilfsmittel', example: 'Rollator, Duschstuhl', group: 'clinical' },
  { key: 'cognitionNotes', label: 'Kognition', example: 'zeitweise desorientiert', group: 'clinical' },
  { key: 'hospitalName', label: 'Krankenhaus', example: 'Klinikum Nord', group: 'clinical' },
  { key: 'participantName', label: 'Teilnehmer:in', example: 'Lisa Schulz', group: 'course' },
  { key: 'courseName', label: 'Kursname', example: 'Hygiene in der Pflege', group: 'course' },
];

export function getTemplateVariableKeys(): string[] {
  return TEMPLATE_VARIABLES.map((v) => v.key);
}

export function getSampleVariableValues(): Record<string, string> {
  return Object.fromEntries(TEMPLATE_VARIABLES.map((v) => [v.key, v.example]));
}

type ComposeRecipientKind = 'client' | 'employee' | 'contact';

/** Platzhalter, die nach dem Rendern noch im Text stehen. */
export function findUnresolvedTemplatePlaceholders(content: string): string[] {
  return [...new Set([...content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
}

export type ComposePreviewValidation = {
  ok: boolean;
  unresolvedPlaceholders: string[];
  minLengthOk: boolean;
};

export function validateComposePreview(body: string, rendered: string): ComposePreviewValidation {
  const trimmed = rendered.trim();
  const unresolvedPlaceholders = findUnresolvedTemplatePlaceholders(rendered);
  const minLengthOk = trimmed.length === 0 || trimmed.length >= 10;
  return {
    ok: minLengthOk && unresolvedPlaceholders.length === 0,
    unresolvedPlaceholders,
    minLengthOk,
  };
}

/** Vorlagenvariablen für Compose: Empfängername überschreibt Beispielwerte in der Vorschau. */
export function getComposeVariableValues(options?: {
  recipientKind?: ComposeRecipientKind;
  recipientName?: string | null;
  senderName?: string | null;
  tenantName?: string | null;
}): Record<string, string> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  const samples = getSampleVariableValues();
  const variables: Record<string, string> = {
    ...samples,
    date,
    time,
    appointmentDate: date,
    appointmentTime: time,
    billingPeriod: formatMonthLabel(now),
    paymentDueDate: formatMonthLabel(now),
    senderName: options?.senderName?.trim() || 'Büro CareSuite',
    tenantPhone: samples.tenantPhone ?? '+49 30 987654',
    tenantEmail: samples.tenantEmail ?? 'buero@caresuite.de',
  };

  if (options?.tenantName?.trim()) {
    variables.tenantName = options.tenantName.trim();
    variables.companyName = options.tenantName.trim();
  }

  const name = options?.recipientName?.trim();
  if (!name || !options?.recipientKind) {
    return variables;
  }

  const [firstName, ...lastParts] = name.split(/\s+/);
  const lastName = lastParts.join(' ');

  if (options.recipientKind === 'client') {
    return {
      ...variables,
      clientName: name,
      clientFirstName: firstName,
      clientLastName: lastName || firstName,
      recipientName: name,
      name,
      toPerson: name,
    };
  }

  if (options.recipientKind === 'employee') {
    return {
      ...variables,
      employeeName: name,
      employeeFirstName: firstName,
      employeeLastName: lastName || firstName,
      recipientName: name,
      name,
      toPerson: name,
    };
  }

  return {
    ...variables,
    contactName: name,
    relativeName: name,
    guardianName: name,
    emergencyContactName: name,
    recipientName: name,
    name,
    toPerson: name,
  };
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}
