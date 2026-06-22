import type { CsvImportType, CsvRowIssue } from '@/types/csv';

export type CsvHintContext = {
  importType: CsvImportType;
  roleOptions?: string[];
  leistungsartLabels?: string[];
};

const DATE_HINT =
  'Erlaubte Datumsformate: TT.MM.JJJJ (z. B. 15.04.1938), JJJJ-MM-TT (z. B. 1938-04-15) oder TT/MM/JJJJ.';

const BOOLEAN_HINT = 'Erlaubte Werte: ja, nein, yes, no, true, false, 1, 0, j, n.';

const EMAIL_HINT = 'Gültige E-Mail-Adresse erforderlich, z. B. max.mustermann@beispiel.de.';

const PLZ_HINT = '5-stellige deutsche Postleitzahl, z. B. 44137.';

const PG_HINT = 'Erlaubt: PG1, PG2, PG3, PG4, PG5 (auch Schreibweise 1–5 ohne PG).';

const EMPLOYMENT_HINT =
  'Erlaubt: Vollzeit, Teilzeit, Minijob, Praktikum, Werkstudent, Honorarkraft, Ehrenamt, Sonstige.';

const NUMBER_HINT = 'Dezimalzahl, Komma oder Punkt erlaubt, z. B. 38 oder 19,50.';

const STEUER_HINT = 'Steuer-ID: genau 11 Ziffern ohne Leerzeichen, z. B. 12345678901.';

const IBAN_HINT =
  'Gültige IBAN ohne Leerzeichen, z. B. DE89370400440532013000 (DE: DE + 20 Ziffern).';

const ANREDE_HINT = 'Erlaubt: Herr, Frau, Divers (optional).';

const DATE_FIELDS = new Set([
  'geburtsdatum',
  'eintrittsdatum',
  'leistungsbeginn',
  'pflegegrad_seit',
  'probezeit_bis',
  'austrittsdatum',
  'fuehrungszeugnis_datum',
  'erste_hilfe_datum',
]);

const BOOLEAN_FIELDS = new Set([
  'beihilfe',
  'privatversicherung',
  'entlastungsbetrag_aktiv',
  'umwandlungsanspruch_aktiv',
  'jahresbudget_aktiv',
  'einsatzadresse_abweichend',
  'schluessel_vorhanden',
  'fuehrungszeugnis_vorhanden',
  'lg1_lg2_vorhanden',
  'fuehrerschein_vorhanden',
  'fahrzeug_vorhanden',
]);

const FIELD_LABELS: Record<string, string> = {
  vorname: 'Vorname',
  nachname: 'Nachname',
  geburtsdatum: 'Geburtsdatum',
  strasse: 'Straße',
  hausnummer: 'Hausnummer',
  plz: 'PLZ',
  ort: 'Ort',
  telefon_1: 'Telefon',
  telefon: 'Telefon',
  email: 'E-Mail',
  pflegegrad: 'Pflegegrad',
  leistungsart: 'Leistungsart',
  status: 'Status',
  eintrittsdatum: 'Eintrittsdatum',
  rolle: 'Rolle',
  beschaeftigungsart: 'Beschäftigungsart',
  wochenstunden: 'Wochenstunden',
  stundenlohn: 'Stundenlohn',
  urlaubsanspruch: 'Urlaubsanspruch',
  steuer_id: 'Steuer-ID',
  iban: 'IBAN',
  anrede: 'Anrede',
};

function clientStatusHint(): string {
  return 'Erlaubt: aktiv, inaktiv, warteliste, archiviert (auch englisch: active, inactive, lead, archived, paused).';
}

function employeeStatusHint(): string {
  return 'Erlaubt: aktiv, inaktiv, beurlaubt, ausgeschieden, archiviert (auch englisch: active, inactive, vacation, terminated, blocked, sick).';
}

function leistungsartHint(labels: string[] | undefined): string {
  if (labels && labels.length > 0) {
    return `Erlaubte Leistungsarten: ${labels.join(', ')}.`;
  }
  return 'Erlaubt z. B.: Alltagsbegleitung, Betreuung, Begleitung, Ambulante Pflege, Stationäre Pflege, Beratung.';
}

function roleHint(roleOptions: string[] | undefined): string {
  if (roleOptions && roleOptions.length > 0) {
    return `Erlaubte Rollen: ${roleOptions.join(', ')}. Schreibweise exakt wie in der Liste.`;
  }
  return 'Rolle muss exakt einer im System hinterlegten Rollenbezeichnung entsprechen.';
}

function requiredHint(fieldName: string | null): string {
  const label = fieldName ? (FIELD_LABELS[fieldName] ?? fieldName) : 'Feld';
  return `Pflichtfeld — bitte „${label}" ausfüllen.`;
}

export function resolveCsvFieldHint(
  fieldName: string | null,
  errorCode: string,
  context: CsvHintContext,
): string {
  switch (errorCode) {
    case 'REQUIRED':
      return requiredHint(fieldName);
    case 'INVALID_DATE':
      return DATE_HINT;
    case 'INVALID_EMAIL':
      return EMAIL_HINT;
    case 'INVALID_ZIP':
      return PLZ_HINT;
    case 'INVALID_CARE_LEVEL':
      return PG_HINT;
    case 'INVALID_SERVICE':
      return leistungsartHint(context.leistungsartLabels);
    case 'INVALID_ROLE':
      return roleHint(context.roleOptions);
    case 'INVALID_EMPLOYMENT':
      return EMPLOYMENT_HINT;
    case 'INVALID_STATUS':
      return context.importType === 'employees' ? employeeStatusHint() : clientStatusHint();
    case 'INVALID_NUMBER':
      return NUMBER_HINT;
    case 'INVALID_TAX_ID':
      return STEUER_HINT;
    case 'INVALID_IBAN':
      return IBAN_HINT;
    case 'DUPLICATE':
      return 'Bestehende Datensätze werden nicht überschrieben (Importmodus: nur neu anlegen). Dublette prüfen oder Zeile entfernen.';
    case 'IGNORED_TENANT':
      return 'Spalte tenant_id nicht verwenden — der Mandant wird automatisch aus Ihrer Anmeldung übernommen.';
    case 'SENSITIVE_SKIPPED':
      return 'Für sensible Felder (IBAN, Steuer-ID, Stundenlohn) ist die Berechtigung „Sensible Mitarbeiterdaten einsehen" erforderlich.';
    default:
      break;
  }

  if (fieldName && DATE_FIELDS.has(fieldName)) return DATE_HINT;
  if (fieldName && BOOLEAN_FIELDS.has(fieldName)) return BOOLEAN_HINT;
  if (fieldName === 'anrede') return ANREDE_HINT;
  if (fieldName === 'plz') return PLZ_HINT;
  if (fieldName === 'email') return EMAIL_HINT;
  if (fieldName === 'pflegegrad') return PG_HINT;
  if (fieldName === 'leistungsart') return leistungsartHint(context.leistungsartLabels);
  if (fieldName === 'rolle') return roleHint(context.roleOptions);
  if (fieldName === 'beschaeftigungsart') return EMPLOYMENT_HINT;
  if (fieldName === 'status') {
    return context.importType === 'employees' ? employeeStatusHint() : clientStatusHint();
  }
  if (fieldName === 'steuer_id') return STEUER_HINT;
  if (fieldName === 'iban') return IBAN_HINT;
  if (fieldName === 'wochenstunden' || fieldName === 'stundenlohn' || fieldName === 'urlaubsanspruch') {
    return NUMBER_HINT;
  }

  return 'Bitte Wert gemäß Importvorlage korrigieren. Vorlage unter „Vorlagen" herunterladen.';
}

export function enrichCsvRowIssue(issue: CsvRowIssue, context: CsvHintContext): CsvRowIssue {
  if (issue.hint?.trim()) return issue;
  return {
    ...issue,
    hint: resolveCsvFieldHint(issue.fieldName, issue.errorCode, context),
  };
}

export function enrichCsvRowIssues(issues: CsvRowIssue[], context: CsvHintContext): CsvRowIssue[] {
  return issues.map((i) => enrichCsvRowIssue(i, context));
}
