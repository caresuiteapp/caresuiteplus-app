import type { ServiceResult } from '@/types';

export type MedicationPackageInput = {
  pzn: string;
  name: string;
  ingredient?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  packageSize?: string | null;
};

export type PhysicianInput = {
  displayName: string;
  practiceName?: string | null;
  specialty?: string | null;
  postalCode?: string | null;
  city?: string | null;
  street?: string | null;
  phone?: string | null;
  lanr?: string | null;
  bsnr?: string | null;
};

export type PhysicianImportInput = PhysicianInput & { externalId: string };
type Feed<T> = { source: string; sourceVersion: string; rows: T[] };
export type MedicationPackageFeed = Feed<MedicationPackageInput>;
export type PhysicianFeed = Feed<PhysicianImportInput>;
export const MASTER_DATA_BATCH_LIMIT = 500;
export const MASTER_DATA_FILE_LIMIT = 1_000_000;

const medicationFields = { pzn: 8, name: 400, ingredient: 2000, strength: 500, dosageForm: 200, brand: 160, manufacturer: 240, packageSize: 120 } as const;
export const PHYSICIAN_FIELD_LIMITS = { displayName: 180, practiceName: 240, specialty: 160, postalCode: 5, city: 120, street: 200, phone: 60, lanr: 9, bsnr: 9 } as const;

/** IFA PZN-8: retain leading zeros, reject remainder 10 and the unassigned zero code. */
export function isValidPzn(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[0-9]{8}$/.test(value) || value === '00000000') return false;
  const sum = [...value.slice(0, 7)].reduce((total, digit, index) => total + Number(digit) * (index + 1), 0);
  return sum % 11 === Number(value[7]);
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function validCatalogSource(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,63}$/.test(value);
}

function normalizedFields(value: unknown, fields: Record<string, number>, required: string[]): Record<string, string | null> {
  const row = record(value);
  if (!row || Object.keys(row).some(key => !Object.hasOwn(fields, key))) throw new Error('Unbekannte Felder oder ungültiger Datensatz.');
  const out: Record<string, string | null> = {};
  for (const [key, max] of Object.entries(fields)) {
    const raw = row[key];
    if (raw !== null && raw !== undefined && (typeof raw !== 'string' || /[\u0000-\u001f\u007f]/u.test(raw) || raw.length > max)) {
      throw new Error(`Feld ${key} muss Text mit höchstens ${max} Zeichen sein.`);
    }
    out[key] = typeof raw === 'string' ? raw.trim() || null : null;
    if (required.includes(key) && !out[key]) throw new Error(`Pflichtfeld ${key} fehlt.`);
  }
  return out;
}

function medication(value: unknown): MedicationPackageInput {
  const fields = normalizedFields(value, medicationFields, ['pzn', 'name']);
  if (!isValidPzn(fields.pzn)) throw new Error('Die achtstellige PZN oder ihre Prüfziffer ist ungültig.');
  return { ...fields, pzn: fields.pzn, name: fields.name! };
}

function physician(value: unknown, imported: true): PhysicianImportInput;
function physician(value: unknown, imported: false): PhysicianInput;
function physician(value: unknown, imported: boolean): PhysicianInput | PhysicianImportInput {
  const fields = normalizedFields(value, imported ? { externalId: 160, ...PHYSICIAN_FIELD_LIMITS } : PHYSICIAN_FIELD_LIMITS,
    imported ? ['externalId', 'displayName'] : ['displayName']);
  if (fields.postalCode && !/^[0-9]{5}$/.test(fields.postalCode)) throw new Error('Die Postleitzahl muss fünf Stellen haben.');
  if ((fields.lanr && !/^[0-9]{9}$/.test(fields.lanr)) || (fields.bsnr && !/^[0-9]{9}$/.test(fields.bsnr))) {
    throw new Error('LANR und BSNR müssen jeweils neun Stellen haben.');
  }
  const result = { ...fields, displayName: fields.displayName! };
  return imported ? { ...result, externalId: fields.externalId! } : result;
}

function validateFeed<T>(value: unknown, parse: (input: unknown) => T, key: (input: T) => string): ServiceResult<Feed<T>> {
  const feed = record(value);
  if (!feed || Object.keys(feed).some(key => !['source', 'sourceVersion', 'rows'].includes(key)) ||
    !validCatalogSource(feed.source) || feed.source === 'manual' || typeof feed.sourceVersion !== 'string' ||
    !feed.sourceVersion.trim() || feed.sourceVersion.length > 120 || /[\u0000-\u001f\u007f]/u.test(feed.sourceVersion) ||
    !Array.isArray(feed.rows) || feed.rows.length < 1 || feed.rows.length > MASTER_DATA_FILE_LIMIT) {
    return { ok: false, error: 'Erforderlich sind ein Quellenkürzel, ein Versionsstand und 1 bis 1.000.000 Datensätze.' };
  }
  const rows: T[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < feed.rows.length; index++) {
    try {
      const row = parse(feed.rows[index]);
      const identity = key(row);
      if (seen.has(identity)) throw new Error('Kennung kommt mehrfach vor.');
      seen.add(identity);
      rows.push(row);
    } catch (error) {
      return { ok: false, error: `Datensatz ${index + 1}: ${error instanceof Error ? error.message : 'Ungültige Daten.'}` };
    }
  }
  return { ok: true, data: { source: feed.source, sourceVersion: feed.sourceVersion.trim(), rows } };
}

export function validateMedicationPackageFeed(value: unknown): ServiceResult<MedicationPackageFeed> {
  return validateFeed(value, medication, row => row.pzn);
}

export function validatePhysicianFeed(value: unknown): ServiceResult<PhysicianFeed> {
  return validateFeed(value, row => physician(row, true), row => row.externalId);
}

export function validateManualPhysician(value: unknown): ServiceResult<PhysicianInput> {
  try { return { ok: true, data: physician(value, false) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Ungültige Praxisdaten.' }; }
}
