import type { CsvFieldMapping, CsvImportType } from '@/types/csv';
import type { ClientImportRow } from '@/types/clientImport';
import { CLIENT_IMPORT_ALL_FIELDS } from '@/types/clientImport';
import type { EmployeeImportRow } from '@/types/employeeImport';
import { EMPLOYEE_IMPORT_ALL_FIELDS } from '@/types/employeeImport';

const UMLAUT_MAP: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  Ä: 'ae',
  Ö: 'oe',
  Ü: 'ue',
};

export function normalizeHeaderKey(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/[äöüßÄÖÜ]/g, (ch) => UMLAUT_MAP[ch] ?? ch);
  value = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return value;
}

const CLIENT_SYNONYMS: Record<string, keyof ClientImportRow> = {
  vorname: 'vorname',
  first_name: 'vorname',
  nachname: 'nachname',
  last_name: 'nachname',
  name: 'nachname',
  geburtsdatum: 'geburtsdatum',
  geburtstag: 'geburtsdatum',
  dob: 'geburtsdatum',
  strasse: 'strasse',
  str: 'strasse',
  hausnummer: 'hausnummer',
  hnr: 'hausnummer',
  plz: 'plz',
  postleitzahl: 'plz',
  ort: 'ort',
  stadt: 'ort',
  telefon: 'telefon_1',
  telefon_1: 'telefon_1',
  telefonnummer: 'telefon_1',
  telefon_2: 'telefon_2',
  mobil: 'mobil',
  handy: 'mobil',
  email: 'email',
  e_mail: 'email',
  mail: 'email',
  pflegegrad: 'pflegegrad',
  pg: 'pflegegrad',
  leistungsart: 'leistungsart',
  kundennummer: 'kundennummer',
  client_number: 'kundennummer',
  versichertennummer: 'versichertennummer',
  krankenkasse: 'krankenkasse',
  pflegekasse: 'pflegekasse',
  kostentraeger_name: 'kostentraeger_name',
  kostentraeger: 'kostentraeger_name',
  status: 'status',
};

const EMPLOYEE_SYNONYMS: Record<string, keyof EmployeeImportRow> = {
  vorname: 'vorname',
  nachname: 'nachname',
  geburtsdatum: 'geburtsdatum',
  email: 'email',
  e_mail: 'email',
  mail: 'email',
  telefon: 'telefon',
  telefonnummer: 'telefon',
  mobil: 'mobil',
  handy: 'mobil',
  personalnummer: 'personalnummer',
  mitarbeiternummer: 'personalnummer',
  personal_nr: 'personalnummer',
  eintrittsdatum: 'eintrittsdatum',
  eintritt: 'eintrittsdatum',
  rolle: 'rolle',
  job_title: 'rolle',
  beschaeftigungsart: 'beschaeftigungsart',
  beschaeftigung: 'beschaeftigungsart',
  status: 'status',
};

function detectIgnoredColumns(headers: string[]): string[] {
  return headers.filter((h) => normalizeHeaderKey(h) === 'tenant_id');
}

function resolveSynonym<T extends string>(
  normalized: string,
  synonyms: Record<string, T>,
  allFields: readonly T[],
): { field: T | null; confidence: 'recognized' | 'uncertain' | 'unmapped' } {
  if (synonyms[normalized]) {
    return { field: synonyms[normalized], confidence: 'recognized' };
  }
  if ((allFields as readonly string[]).includes(normalized)) {
    return { field: normalized as T, confidence: 'recognized' };
  }
  for (const field of allFields) {
    if (normalized.includes(field) || field.includes(normalized)) {
      return { field, confidence: 'uncertain' };
    }
  }
  return { field: null, confidence: 'unmapped' };
}

export function mapCsvHeaders(
  headers: string[],
  importType: CsvImportType,
  manualOverrides?: Record<string, string>,
): CsvFieldMapping[] {
  const synonyms = importType === 'clients' ? CLIENT_SYNONYMS : EMPLOYEE_SYNONYMS;
  const allFields =
    importType === 'clients'
      ? (CLIENT_IMPORT_ALL_FIELDS as readonly string[])
      : (EMPLOYEE_IMPORT_ALL_FIELDS as readonly string[]);

  return headers.map((header) => {
    const normalized = normalizeHeaderKey(header);
    const override = manualOverrides?.[header] ?? manualOverrides?.[normalized];
    if (override) {
      return {
        csvColumn: header,
        systemField: override,
        confidence: 'recognized' as const,
      };
    }
    const resolved = resolveSynonym(normalized, synonyms, allFields);
    return {
      csvColumn: header,
      systemField: resolved.field,
      confidence: resolved.confidence,
    };
  });
}

export function applyMapping(
  row: Record<string, string>,
  mapping: CsvFieldMapping[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const map of mapping) {
    if (!map.systemField) continue;
    const value = row[map.csvColumn]?.trim() ?? '';
    if (value) out[map.systemField] = value;
  }
  return out;
}

export { detectIgnoredColumns };

export function getUnmappedRequiredFields(
  mapping: CsvFieldMapping[],
  requiredFields: readonly string[],
): string[] {
  const mapped = new Set(mapping.map((m) => m.systemField).filter(Boolean));
  return requiredFields.filter((field) => !mapped.has(field));
}
