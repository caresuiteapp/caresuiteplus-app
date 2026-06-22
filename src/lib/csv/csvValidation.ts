import type { CsvFieldMapping, CsvImportPreview, CsvImportType, CsvValidatedRow, CsvValidationSummary } from '@/types/csv';
import type { ClientImportRow } from '@/types/clientImport';
import { CLIENT_IMPORT_REQUIRED_FIELDS } from '@/types/clientImport';
import type { EmployeeImportRow } from '@/types/employeeImport';
import { EMPLOYEE_IMPORT_REQUIRED_FIELDS } from '@/types/employeeImport';
import { getSystemCatalog } from '@/lib/catalogs/systemCatalogs';
import { applyMapping, detectIgnoredColumns, getUnmappedRequiredFields, mapCsvHeaders } from './csvHeaderMapping';
import { parseCsvContent, rowsToObjects } from './csvParser';
import {
  isValidEmail,
  isValidGermanZip,
  isValidIban,
  isValidSteuerId,
  issue,
  normalizeCareLevel,
  normalizeClientStatus,
  normalizeEmploymentType,
  normalizeEmployeeStatus,
  parseBoolean,
  parseFlexibleDate,
  parseNumber,
  resolveLeistungsartKey,
  resolveRoleTitle,
} from './csvValueUtils';
import { markDuplicateRows } from './csvDuplicateCheck';
import { enrichCsvRowIssue, type CsvHintContext } from './csvFieldHints';

const LEISTUNGSART_CATALOG = getSystemCatalog('leistungsart').entries.map((e) => ({
  key: e.key,
  label: e.label,
}));

function emptyClientRow(): ClientImportRow {
  return {
    kundennummer: null,
    anrede: null,
    titel: null,
    vorname: '',
    nachname: '',
    geburtsdatum: '',
    strasse: '',
    hausnummer: '',
    plz: '',
    ort: '',
    telefon_1: '',
    telefon_2: null,
    mobil: null,
    email: null,
    pflegegrad: '',
    pflegegrad_seit: null,
    leistungsart: '',
    kostentraeger_name: null,
    kostentraeger_art: null,
    versichertennummer: null,
    pflegekasse: null,
    krankenkasse: null,
    beihilfe: null,
    privatversicherung: null,
    entlastungsbetrag_aktiv: null,
    umwandlungsanspruch_aktiv: null,
    jahresbudget_aktiv: null,
    abrechnungsart: null,
    leistungsbeginn: null,
    einsatzadresse_abweichend: null,
    einsatz_strasse: null,
    einsatz_hausnummer: null,
    einsatz_plz: null,
    einsatz_ort: null,
    notfallkontakt_name: null,
    notfallkontakt_beziehung: null,
    notfallkontakt_telefon: null,
    betreuer_name: null,
    betreuer_telefon: null,
    betreuer_email: null,
    hausarzt_name: null,
    hausarzt_telefon: null,
    diagnose_hinweise: null,
    allergien: null,
    mobilitaet: null,
    schluessel_vorhanden: null,
    haustiere: null,
    besonderheiten: null,
    interne_notiz: null,
    status: 'active',
  };
}

function emptyEmployeeRow(): EmployeeImportRow {
  return {
    personalnummer: null,
    anrede: null,
    titel: null,
    vorname: '',
    nachname: '',
    geburtsdatum: '',
    email: '',
    telefon: '',
    mobil: null,
    strasse: null,
    hausnummer: null,
    plz: null,
    ort: null,
    geburtsort: null,
    staatsangehoerigkeit: null,
    steuer_id: null,
    sozialversicherungsnummer: null,
    krankenkasse: null,
    iban: null,
    bic: null,
    eintrittsdatum: '',
    rolle: '',
    beschaeftigungsart: '',
    wochenstunden: null,
    stundenlohn: null,
    urlaubsanspruch: null,
    probezeit_bis: null,
    austrittsdatum: null,
    notfallkontakt_name: null,
    notfallkontakt_beziehung: null,
    notfallkontakt_telefon: null,
    fuehrungszeugnis_vorhanden: null,
    fuehrungszeugnis_datum: null,
    qualifikation: null,
    lg1_lg2_vorhanden: null,
    erste_hilfe_datum: null,
    fuehrerschein_vorhanden: null,
    fahrzeug_vorhanden: null,
    einsatzbereiche: null,
    interne_notiz: null,
    status: 'active',
  };
}

function validateClientRow(
  rowNumber: number,
  mapped: Record<string, string>,
): CsvValidatedRow<ClientImportRow> {
  const issues = [];
  const data = emptyClientRow();

  if (mapped.tenant_id) {
    issues.push(
      issue(rowNumber, 'tenant_id', 'IGNORED_TENANT', 'tenant_id aus CSV wird ignoriert.', mapped.tenant_id, 'warning'),
    );
  }

  data.vorname = mapped.vorname?.trim() ?? '';
  data.nachname = mapped.nachname?.trim() ?? '';
  if (!data.vorname) issues.push(issue(rowNumber, 'vorname', 'REQUIRED', 'Pflichtfeld fehlt: Vorname.', mapped.vorname ?? '', 'error'));
  if (!data.nachname) issues.push(issue(rowNumber, 'nachname', 'REQUIRED', 'Pflichtfeld fehlt: Nachname.', mapped.nachname ?? '', 'error'));

  const dob = parseFlexibleDate(mapped.geburtsdatum ?? '');
  if (!dob) {
    issues.push(issue(rowNumber, 'geburtsdatum', 'INVALID_DATE', `Ungültiges Datumsformat in Zeile ${rowNumber}.`, mapped.geburtsdatum ?? '', 'error', 'Bitte Datum im Format TT.MM.JJJJ eintragen'));
  } else {
    data.geburtsdatum = dob;
  }

  data.strasse = mapped.strasse?.trim() ?? '';
  data.hausnummer = mapped.hausnummer?.trim() ?? '';
  data.plz = mapped.plz?.trim() ?? '';
  data.ort = mapped.ort?.trim() ?? '';
  data.telefon_1 = mapped.telefon_1?.trim() ?? '';

  if (!data.strasse) issues.push(issue(rowNumber, 'strasse', 'REQUIRED', 'Pflichtfeld fehlt: Straße.', '', 'error'));
  if (!data.hausnummer) issues.push(issue(rowNumber, 'hausnummer', 'REQUIRED', 'Pflichtfeld fehlt: Hausnummer.', '', 'error'));
  if (!isValidGermanZip(data.plz)) issues.push(issue(rowNumber, 'plz', 'INVALID_ZIP', 'PLZ muss 5-stellig sein.', data.plz, 'error'));
  if (!data.ort) issues.push(issue(rowNumber, 'ort', 'REQUIRED', 'Pflichtfeld fehlt: Ort.', '', 'error'));
  if (!data.telefon_1) issues.push(issue(rowNumber, 'telefon_1', 'REQUIRED', 'Pflichtfeld fehlt: Telefon.', '', 'error'));

  const pg = normalizeCareLevel(mapped.pflegegrad ?? '');
  if (!pg) {
    issues.push(issue(rowNumber, 'pflegegrad', 'INVALID_CARE_LEVEL', `Ungültiger Pflegegrad in Zeile ${rowNumber}. Erlaubt sind PG1, PG2, PG3, PG4 oder PG5.`, mapped.pflegegrad ?? '', 'error'));
  } else {
    data.pflegegrad = pg;
  }

  const leistung = resolveLeistungsartKey(mapped.leistungsart ?? '', LEISTUNGSART_CATALOG);
  if (!leistung) {
    issues.push(issue(rowNumber, 'leistungsart', 'INVALID_SERVICE', 'Leistungsart ist ungültig oder unbekannt.', mapped.leistungsart ?? '', 'error'));
  } else {
    data.leistungsart = leistung;
  }

  if (mapped.email?.trim() && !isValidEmail(mapped.email)) {
    issues.push(issue(rowNumber, 'email', 'INVALID_EMAIL', 'E-Mail ist ungültig.', mapped.email, 'error'));
  } else {
    data.email = mapped.email?.trim() || null;
  }

  if (mapped.pflegegrad_seit?.trim()) {
    const pgSince = parseFlexibleDate(mapped.pflegegrad_seit);
    if (!pgSince) issues.push(issue(rowNumber, 'pflegegrad_seit', 'INVALID_DATE', 'Ungültiges Datumsformat für Pflegegrad seit.', mapped.pflegegrad_seit, 'error'));
    else data.pflegegrad_seit = pgSince;
  }

  if (mapped.leistungsbeginn?.trim()) {
    const start = parseFlexibleDate(mapped.leistungsbeginn);
    if (!start) issues.push(issue(rowNumber, 'leistungsbeginn', 'INVALID_DATE', 'Ungültiges Datumsformat für Leistungsbeginn.', mapped.leistungsbeginn, 'error'));
    else data.leistungsbeginn = start;
  }

  const statusRaw = mapped.status?.trim() || 'aktiv';
  const allowedStatus = ['aktiv', 'inaktiv', 'warteliste', 'archiviert', 'active', 'inactive', 'lead', 'archived', 'paused'];
  if (!allowedStatus.includes(statusRaw.toLowerCase())) {
    issues.push(issue(rowNumber, 'status', 'INVALID_STATUS', 'Status ist ungültig.', statusRaw, 'error'));
  } else {
    data.status = normalizeClientStatus(statusRaw);
  }

  data.kundennummer = mapped.kundennummer?.trim() || null;
  data.anrede = mapped.anrede?.trim() || null;
  data.titel = mapped.titel?.trim() || null;
  data.telefon_2 = mapped.telefon_2?.trim() || null;
  data.mobil = mapped.mobil?.trim() || null;
  data.kostentraeger_name = mapped.kostentraeger_name?.trim() || null;
  data.kostentraeger_art = mapped.kostentraeger_art?.trim() || null;
  data.versichertennummer = mapped.versichertennummer?.trim() || null;
  data.pflegekasse = mapped.pflegekasse?.trim() || null;
  data.krankenkasse = mapped.krankenkasse?.trim() || null;
  data.beihilfe = parseBoolean(mapped.beihilfe);
  data.privatversicherung = parseBoolean(mapped.privatversicherung);
  data.entlastungsbetrag_aktiv = parseBoolean(mapped.entlastungsbetrag_aktiv);
  data.umwandlungsanspruch_aktiv = parseBoolean(mapped.umwandlungsanspruch_aktiv);
  data.jahresbudget_aktiv = parseBoolean(mapped.jahresbudget_aktiv);
  data.abrechnungsart = mapped.abrechnungsart?.trim() || null;
  data.einsatzadresse_abweichend = parseBoolean(mapped.einsatzadresse_abweichend);
  data.einsatz_strasse = mapped.einsatz_strasse?.trim() || null;
  data.einsatz_hausnummer = mapped.einsatz_hausnummer?.trim() || null;
  data.einsatz_plz = mapped.einsatz_plz?.trim() || null;
  data.einsatz_ort = mapped.einsatz_ort?.trim() || null;
  data.notfallkontakt_name = mapped.notfallkontakt_name?.trim() || null;
  data.notfallkontakt_beziehung = mapped.notfallkontakt_beziehung?.trim() || null;
  data.notfallkontakt_telefon = mapped.notfallkontakt_telefon?.trim() || null;
  data.betreuer_name = mapped.betreuer_name?.trim() || null;
  data.betreuer_telefon = mapped.betreuer_telefon?.trim() || null;
  data.betreuer_email = mapped.betreuer_email?.trim() || null;
  data.hausarzt_name = mapped.hausarzt_name?.trim() || null;
  data.hausarzt_telefon = mapped.hausarzt_telefon?.trim() || null;
  data.diagnose_hinweise = mapped.diagnose_hinweise?.trim() || null;
  data.allergien = mapped.allergien?.trim() || null;
  data.mobilitaet = mapped.mobilitaet?.trim() || null;
  data.schluessel_vorhanden = parseBoolean(mapped.schluessel_vorhanden);
  data.haustiere = mapped.haustiere?.trim() || null;
  data.besonderheiten = mapped.besonderheiten?.trim() || null;
  data.interne_notiz = mapped.interne_notiz?.trim() || null;

  const hasErrors = issues.some((i) => i.severity === 'error');
  return {
    rowNumber,
    raw: mapped,
    data,
    issues,
    isValid: !hasErrors,
    isDuplicate: false,
  };
}

function validateEmployeeRow(
  rowNumber: number,
  mapped: Record<string, string>,
  roleOptions: string[],
  allowSensitive: boolean,
): CsvValidatedRow<EmployeeImportRow> {
  const issues = [];
  const data = emptyEmployeeRow();

  if (mapped.tenant_id) {
    issues.push(
      issue(rowNumber, 'tenant_id', 'IGNORED_TENANT', 'tenant_id aus CSV wird ignoriert.', mapped.tenant_id, 'warning'),
    );
  }

  data.vorname = mapped.vorname?.trim() ?? '';
  data.nachname = mapped.nachname?.trim() ?? '';
  if (!data.vorname) issues.push(issue(rowNumber, 'vorname', 'REQUIRED', 'Pflichtfeld fehlt: Vorname.', '', 'error'));
  if (!data.nachname) issues.push(issue(rowNumber, 'nachname', 'REQUIRED', 'Pflichtfeld fehlt: Nachname.', '', 'error'));

  const dob = parseFlexibleDate(mapped.geburtsdatum ?? '');
  if (!dob) {
    issues.push(issue(rowNumber, 'geburtsdatum', 'INVALID_DATE', `Ungültiges Datumsformat in Zeile ${rowNumber}.`, mapped.geburtsdatum ?? '', 'error'));
  } else {
    data.geburtsdatum = dob;
  }

  data.email = mapped.email?.trim() ?? '';
  if (!data.email) issues.push(issue(rowNumber, 'email', 'REQUIRED', 'Pflichtfeld fehlt: E-Mail.', '', 'error'));
  else if (!isValidEmail(data.email)) issues.push(issue(rowNumber, 'email', 'INVALID_EMAIL', 'E-Mail ist ungültig.', data.email, 'error'));

  data.telefon = mapped.telefon?.trim() ?? '';
  if (!data.telefon) issues.push(issue(rowNumber, 'telefon', 'REQUIRED', 'Pflichtfeld fehlt: Telefon.', '', 'error'));

  const entry = parseFlexibleDate(mapped.eintrittsdatum ?? '');
  if (!entry) {
    issues.push(issue(rowNumber, 'eintrittsdatum', 'INVALID_DATE', 'Eintrittsdatum ist ungültig.', mapped.eintrittsdatum ?? '', 'error'));
  } else {
    data.eintrittsdatum = entry;
  }

  const role = resolveRoleTitle(mapped.rolle ?? '', roleOptions);
  if (!role.valid) {
    issues.push(issue(rowNumber, 'rolle', 'INVALID_ROLE', 'Rolle ist ungültig oder unbekannt.', mapped.rolle ?? '', 'error'));
  } else {
    data.rolle = role.value;
  }

  const employment = normalizeEmploymentType(mapped.beschaeftigungsart ?? '');
  if (!employment) {
    issues.push(issue(rowNumber, 'beschaeftigungsart', 'INVALID_EMPLOYMENT', 'Beschäftigungsart ist ungültig.', mapped.beschaeftigungsart ?? '', 'error'));
  } else {
    data.beschaeftigungsart = employment;
  }

  const statusRaw = mapped.status?.trim() || 'aktiv';
  const allowedStatus = ['aktiv', 'inaktiv', 'beurlaubt', 'ausgeschieden', 'archiviert', 'active', 'inactive', 'vacation', 'terminated', 'blocked', 'sick'];
  if (!allowedStatus.includes(statusRaw.toLowerCase())) {
    issues.push(issue(rowNumber, 'status', 'INVALID_STATUS', 'Status ist ungültig.', statusRaw, 'error'));
  } else {
    data.status = normalizeEmployeeStatus(statusRaw);
  }

  if (mapped.wochenstunden?.trim()) {
    const hours = parseNumber(mapped.wochenstunden);
    if (hours === null) issues.push(issue(rowNumber, 'wochenstunden', 'INVALID_NUMBER', 'Wochenstunden muss eine Zahl sein.', mapped.wochenstunden, 'error'));
    else data.wochenstunden = hours;
  }

  if (mapped.stundenlohn?.trim()) {
    const wage = parseNumber(mapped.stundenlohn);
    if (wage === null) issues.push(issue(rowNumber, 'stundenlohn', 'INVALID_NUMBER', 'Stundenlohn muss eine Zahl sein.', mapped.stundenlohn, 'error'));
    else {
      data.stundenlohn = wage;
      if (!allowSensitive) {
        issues.push(issue(rowNumber, 'stundenlohn', 'SENSITIVE_SKIPPED', 'Stundenlohn ohne Berechtigung nicht importiert.', mapped.stundenlohn, 'warning'));
        data.stundenlohn = null;
      }
    }
  }

  if (mapped.urlaubsanspruch?.trim()) {
    const days = parseNumber(mapped.urlaubsanspruch);
    if (days === null) issues.push(issue(rowNumber, 'urlaubsanspruch', 'INVALID_NUMBER', 'Urlaubsanspruch muss eine Zahl sein.', mapped.urlaubsanspruch, 'error'));
    else data.urlaubsanspruch = days;
  }

  if (mapped.steuer_id?.trim()) {
    if (!isValidSteuerId(mapped.steuer_id)) {
      issues.push(issue(rowNumber, 'steuer_id', 'INVALID_TAX_ID', 'Steuer-ID muss 11-stellig sein.', mapped.steuer_id, 'error'));
    } else if (!allowSensitive) {
      issues.push(issue(rowNumber, 'steuer_id', 'SENSITIVE_SKIPPED', 'Steuer-ID ohne Berechtigung nicht importiert.', mapped.steuer_id, 'warning'));
    } else {
      data.steuer_id = mapped.steuer_id.replace(/\s/g, '');
    }
  }

  if (mapped.iban?.trim()) {
    if (!isValidIban(mapped.iban)) {
      issues.push(issue(rowNumber, 'iban', 'INVALID_IBAN', 'IBAN ist formal ungültig.', mapped.iban, 'error'));
    } else if (!allowSensitive) {
      issues.push(issue(rowNumber, 'iban', 'SENSITIVE_SKIPPED', 'IBAN ohne Berechtigung nicht importiert.', mapped.iban, 'warning'));
    } else {
      data.iban = mapped.iban.replace(/\s/g, '').toUpperCase();
    }
  }

  data.personalnummer = mapped.personalnummer?.trim() || null;
  data.anrede = mapped.anrede?.trim() || null;
  data.titel = mapped.titel?.trim() || null;
  data.mobil = mapped.mobil?.trim() || null;
  data.strasse = mapped.strasse?.trim() || null;
  data.hausnummer = mapped.hausnummer?.trim() || null;
  data.plz = mapped.plz?.trim() || null;
  data.ort = mapped.ort?.trim() || null;
  data.geburtsort = mapped.geburtsort?.trim() || null;
  data.staatsangehoerigkeit = mapped.staatsangehoerigkeit?.trim() || null;
  data.sozialversicherungsnummer = mapped.sozialversicherungsnummer?.trim() || null;
  data.krankenkasse = mapped.krankenkasse?.trim() || null;
  data.bic = mapped.bic?.trim() || null;
  data.probezeit_bis = mapped.probezeit_bis?.trim() ? parseFlexibleDate(mapped.probezeit_bis) : null;
  data.austrittsdatum = mapped.austrittsdatum?.trim() ? parseFlexibleDate(mapped.austrittsdatum) : null;
  data.notfallkontakt_name = mapped.notfallkontakt_name?.trim() || null;
  data.notfallkontakt_beziehung = mapped.notfallkontakt_beziehung?.trim() || null;
  data.notfallkontakt_telefon = mapped.notfallkontakt_telefon?.trim() || null;
  data.fuehrungszeugnis_vorhanden = parseBoolean(mapped.fuehrungszeugnis_vorhanden);
  data.fuehrungszeugnis_datum = mapped.fuehrungszeugnis_datum?.trim() ? parseFlexibleDate(mapped.fuehrungszeugnis_datum) : null;
  data.qualifikation = mapped.qualifikation?.trim() || null;
  data.lg1_lg2_vorhanden = parseBoolean(mapped.lg1_lg2_vorhanden);
  data.erste_hilfe_datum = mapped.erste_hilfe_datum?.trim() ? parseFlexibleDate(mapped.erste_hilfe_datum) : null;
  data.fuehrerschein_vorhanden = parseBoolean(mapped.fuehrerschein_vorhanden);
  data.fahrzeug_vorhanden = parseBoolean(mapped.fahrzeug_vorhanden);
  data.einsatzbereiche = mapped.einsatzbereiche?.trim() || null;
  data.interne_notiz = mapped.interne_notiz?.trim() || null;

  const hasErrors = issues.some((i) => i.severity === 'error');
  return {
    rowNumber,
    raw: mapped,
    data,
    issues,
    isValid: !hasErrors,
    isDuplicate: false,
  };
}

function buildSummary<T>(rows: CsvValidatedRow<T>[]): CsvValidationSummary {
  const validRows = rows.filter((r) => r.isValid && !r.isDuplicate).length;
  const duplicateRows = rows.filter((r) => r.isDuplicate).length;
  const invalidRows = rows.filter((r) => !r.isValid).length;
  const warningRows = rows.filter((r) => r.issues.some((i) => i.severity === 'warning')).length;
  return {
    totalRows: rows.length,
    validRows,
    invalidRows,
    warningRows,
    duplicateRows,
  };
}

export type ValidateCsvInput = {
  csvContent: string;
  fileName: string;
  fileSize: number;
  importType: CsvImportType;
  manualMapping?: Record<string, string>;
  roleOptions?: string[];
  allowSensitiveEmployeeFields?: boolean;
  existingDuplicateKeys?: Set<string>;
};

export async function validateCsvImport<T extends ClientImportRow | EmployeeImportRow>(
  input: ValidateCsvInput,
): Promise<{ ok: true; data: CsvImportPreview<T> } | { ok: false; error: string }> {
  const parsed = parseCsvContent(input.csvContent);
  if (!parsed.ok) return parsed;

  const mapping = mapCsvHeaders(parsed.data.headers, input.importType, input.manualMapping);
  const required =
    input.importType === 'clients'
      ? (CLIENT_IMPORT_REQUIRED_FIELDS as readonly string[])
      : (EMPLOYEE_IMPORT_REQUIRED_FIELDS as readonly string[]);
  const missingRequired = getUnmappedRequiredFields(mapping, required);
  if (missingRequired.length > 0) {
    return {
      ok: false,
      error: `Pflichtspalten fehlen im Mapping: ${missingRequired.join(', ')}`,
    };
  }

  const objects = rowsToObjects(parsed.data.headers, parsed.data.rows);
  const ignoredTenantColumns = detectIgnoredColumns(parsed.data.headers);
  const validated: CsvValidatedRow<T>[] = objects.map((obj, index) => {
    const mapped = applyMapping(obj, mapping);
    let rowResult: CsvValidatedRow<T>;
    if (input.importType === 'clients') {
      rowResult = validateClientRow(index + 2, mapped) as CsvValidatedRow<T>;
    } else {
      rowResult = validateEmployeeRow(
        index + 2,
        mapped,
        input.roleOptions ?? [],
        input.allowSensitiveEmployeeFields ?? false,
      ) as CsvValidatedRow<T>;
    }
    for (const col of ignoredTenantColumns) {
      const rawTenant = obj[col]?.trim();
      if (rawTenant) {
        rowResult.issues.push(
          issue(
            index + 2,
            'tenant_id',
            'IGNORED_TENANT',
            'tenant_id aus CSV wird ignoriert.',
            rawTenant,
            'warning',
          ),
        );
      }
    }
    return rowResult;
  });

  const withDupes = markDuplicateRows(validated, input.importType, input.existingDuplicateKeys);
  const hintContext: CsvHintContext = {
    importType: input.importType,
    roleOptions: input.roleOptions,
    leistungsartLabels: LEISTUNGSART_CATALOG.map((e) => e.label),
  };
  const enrichedRows = withDupes.map((row) => ({
    ...row,
    issues: row.issues.map((i) => enrichCsvRowIssue(i, hintContext)),
  }));
  const summary = buildSummary(enrichedRows);
  const allIssues = enrichedRows.flatMap((r) => r.issues);

  return {
    ok: true,
    data: {
      importType: input.importType,
      fileName: input.fileName,
      fileSize: input.fileSize,
      delimiter: parsed.data.delimiter,
      columnCount: parsed.data.headers.length,
      mapping,
      summary,
      rows: enrichedRows,
      allIssues,
    },
  };
}

export function buildErrorReportCsv(issues: import('@/types/csv').CsvRowIssue[]): string {
  const headers = ['zeile', 'feld', 'wert', 'fehlercode', 'fehlermeldung', 'schweregrad', 'hinweis'];
  const rows = issues.map((i) => [
    String(i.rowNumber),
    i.fieldName ?? '',
    i.rawValue ?? '',
    i.errorCode,
    i.errorMessage,
    i.severity,
    i.hint ?? '',
  ]);
  return [headers.join(';'), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';'))].join('\n');
}
