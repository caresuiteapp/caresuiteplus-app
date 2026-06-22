import type { CsvRowIssue } from '@/types/csv';

const DATE_PATTERNS = [
  /^(\d{2})\.(\d{2})\.(\d{4})$/,
  /^(\d{4})-(\d{2})-(\d{2})$/,
  /^(\d{2})\/(\d{2})\/(\d{4})$/,
];

export function parseFlexibleDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  for (const pattern of DATE_PATTERNS) {
    const match = value.match(pattern);
    if (!match) continue;
    let day: string;
    let month: string;
    let year: string;
    if (pattern.source.startsWith('^(\\d{4})')) {
      year = match[1] ?? '';
      month = match[2] ?? '';
      day = match[3] ?? '';
    } else {
      day = match[1] ?? '';
      month = match[2] ?? '';
      year = match[3] ?? '';
    }
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() !== Number(year)) return null;
    return iso;
  }
  return null;
}

export function formatDateGerman(iso: string | null | undefined): string {
  if (!iso) return '';
  const parts = iso.slice(0, 10).split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function parseBoolean(raw: string | null | undefined): boolean | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return null;
  if (['ja', 'yes', 'true', '1', 'x', 'j'].includes(value)) return true;
  if (['nein', 'no', 'false', '0', 'n'].includes(value)) return false;
  return null;
}

export function formatBooleanGerman(value: boolean | null | undefined): string {
  if (value === true) return 'ja';
  if (value === false) return 'nein';
  return '';
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

export function normalizeCareLevel(raw: string): string | null {
  const value = raw.trim().toUpperCase().replace(/\s+/g, '');
  const match = value.match(/^PG?([1-5])$/);
  if (!match) return null;
  return `pg${match[1]}`;
}

export function careLevelToLabel(enumValue: string | null | undefined): string {
  if (!enumValue) return '';
  const m = enumValue.match(/^pg([1-5])$/i);
  return m ? `PG${m[1]}` : enumValue;
}

export function normalizeClientStatus(raw: string): string {
  const value = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    aktiv: 'active',
    active: 'active',
    inaktiv: 'inactive',
    inactive: 'inactive',
    warteliste: 'lead',
    lead: 'lead',
    archiviert: 'archived',
    archived: 'archived',
    pausiert: 'paused',
    paused: 'paused',
  };
  return map[value] ?? 'active';
}

export function clientStatusToLabel(status: string | null | undefined): string {
  const map: Record<string, string> = {
    active: 'aktiv',
    inactive: 'inaktiv',
    lead: 'warteliste',
    archived: 'archiviert',
    paused: 'inaktiv',
    blocked: 'inaktiv',
    deceased: 'archiviert',
  };
  return map[String(status ?? '').toLowerCase()] ?? 'aktiv';
}

export function normalizeEmployeeStatus(raw: string): string {
  const value = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    aktiv: 'active',
    active: 'active',
    inaktiv: 'inactive',
    inactive: 'inactive',
    beurlaubt: 'vacation',
    urlaub: 'vacation',
    vacation: 'vacation',
    ausgeschieden: 'terminated',
    terminated: 'terminated',
    archiviert: 'blocked',
    blocked: 'blocked',
    krank: 'sick',
    sick: 'sick',
  };
  return map[value] ?? 'active';
}

export function employeeStatusToLabel(status: string | null | undefined): string {
  const map: Record<string, string> = {
    active: 'aktiv',
    inactive: 'inaktiv',
    vacation: 'beurlaubt',
    terminated: 'ausgeschieden',
    blocked: 'archiviert',
    sick: 'beurlaubt',
    draft: 'inaktiv',
  };
  return map[String(status ?? '').toLowerCase()] ?? 'aktiv';
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  vollzeit: 'full_time',
  full_time: 'full_time',
  teilzeit: 'part_time',
  part_time: 'part_time',
  minijob: 'mini_job',
  mini_job: 'mini_job',
  werkstudent: 'intern',
  praktikum: 'intern',
  intern: 'intern',
  honorarkraft: 'freelancer',
  freelancer: 'freelancer',
  ehrenamt: 'other',
  sonstige: 'other',
  other: 'other',
  temporary: 'temporary',
};

export function normalizeEmploymentType(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_');
  return EMPLOYMENT_TYPE_MAP[key] ?? null;
}

export function employmentTypeToLabel(value: string | null | undefined): string {
  const map: Record<string, string> = {
    full_time: 'Vollzeit',
    part_time: 'Teilzeit',
    mini_job: 'Minijob',
    intern: 'Praktikum',
    freelancer: 'Honorarkraft',
    temporary: 'Sonstige',
    other: 'Sonstige',
  };
  return map[String(value ?? '')] ?? String(value ?? '');
}

export function isValidGermanZip(raw: string): boolean {
  return /^\d{5}$/.test(raw.trim());
}

export function isValidSteuerId(raw: string): boolean {
  return /^\d{11}$/.test(raw.replace(/\s/g, ''));
}

export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (!/^DE\d{20}$/.test(iban) && !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) {
    return false;
  }
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = Number(String(remainder) + numeric.slice(i, i + 7)) % 97;
  }
  return remainder === 1;
}

export function parseNumber(raw: string): number | null {
  const normalized = raw.replace(',', '.').trim();
  if (!normalized) return null;
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

export function issue(
  rowNumber: number,
  fieldName: string | null,
  errorCode: string,
  errorMessage: string,
  rawValue: string | null,
  severity: CsvRowIssue['severity'] = 'error',
  hint?: string,
): CsvRowIssue {
  return { rowNumber, fieldName, errorCode, errorMessage, rawValue, severity, hint };
}

export function resolveLeistungsartKey(
  raw: string,
  catalogLabels: Array<{ key: string; label: string }>,
): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  for (const entry of catalogLabels) {
    if (entry.key.toLowerCase() === value) return entry.key;
    if (entry.label.toLowerCase() === value) return entry.key;
  }

  const alias: Record<string, string> = {
    alltagsbegleitung: 'daily_assistance',
    betreuung: 'support_care',
    begleitung: 'companionship',
    'ambulante pflege': 'ambulatory_care',
    'stationäre pflege': 'stationary_care',
    beratung: 'consulting',
  };
  return alias[value] ?? null;
}

export function leistungsartToLabel(
  key: string | null | undefined,
  catalogLabels: Array<{ key: string; label: string }>,
): string {
  if (!key) return '';
  const found = catalogLabels.find((e) => e.key === key);
  return found?.label ?? key;
}

export function resolveRoleTitle(
  raw: string,
  roleOptions: string[],
): { valid: boolean; value: string } {
  const value = raw.trim();
  if (!value) return { valid: false, value: '' };
  const lower = value.toLowerCase();
  const match = roleOptions.find((r) => r.toLowerCase() === lower);
  if (match) return { valid: true, value: match };
  if (roleOptions.length === 0) return { valid: true, value };
  return { valid: false, value };
}
