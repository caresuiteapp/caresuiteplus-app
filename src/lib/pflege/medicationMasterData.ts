import type { ServiceResult } from '@/types';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { getSupabaseClient } from '@/lib/supabase/client';
import {
  isValidPzn, MASTER_DATA_BATCH_LIMIT, validCatalogSource, validateManualPhysician,
  validateMedicationPackageFeed, validatePhysicianFeed,
  type MedicationPackageInput, type PhysicianInput,
} from './medicationMasterDataValidation';
import { addReviewedPracticeContact } from './medicationPracticeContactReview';

export * from './medicationMasterDataValidation';

type Origin = { source: string; sourceVersion: string };
export type MedicationPackageOption = Required<MedicationPackageInput> & Origin;
export type AuthorizedMedicine = {
  id: string; source: 'ema-article57'; sourceVersion: string; name: string;
  activeSubstance: string | null; authorizationHolder: string | null; authorizationScope: 'DE' | 'EU';
};
export type PhysicianOption = Required<PhysicianInput> & Origin & { id: string };
export type PracticeLocationOption = Origin & { id: string; displayName: string; practiceName: string | null; specialty: string | null;
  postalCode: string | null; city: string | null; street: string | null; phone: string | null; sourceUpdatedAt: string | null;
  stateCode?: string | null; stateName?: string | null; contactSourceUrl?: string };
export type CatalogPage<T> = { rows: T[]; nextCursor: string | null; limited?: true };
export type PracticeLocationPage = CatalogPage<PracticeLocationOption>;
export type PhysicianDraft = Record<'displayName' | 'practiceName' | 'specialty' | 'postalCode' | 'city' | 'street' | 'phone', string>;

/** A place can supply work contact details, but does not identify the person who issued the order. */
export function practiceLocationToPhysicianDraft(practice: PracticeLocationOption): PhysicianDraft {
  return {
    displayName: '',
    practiceName: practice.practiceName ?? practice.displayName,
    specialty: practice.specialty ?? '',
    postalCode: practice.postalCode ?? '',
    city: practice.city ?? '',
    street: practice.street ?? '',
    phone: practice.phone ?? '',
  };
}
export const PRACTICE_STATES = [
  ['DE-BW', 'Baden-Württemberg'], ['DE-BY', 'Bayern'], ['DE-BE', 'Berlin'], ['DE-BB', 'Brandenburg'],
  ['DE-HB', 'Bremen'], ['DE-HH', 'Hamburg'], ['DE-HE', 'Hessen'], ['DE-MV', 'Mecklenburg-Vorpommern'],
  ['DE-NI', 'Niedersachsen'], ['DE-NW', 'Nordrhein-Westfalen'], ['DE-RP', 'Rheinland-Pfalz'], ['DE-SL', 'Saarland'],
  ['DE-SN', 'Sachsen'], ['DE-ST', 'Sachsen-Anhalt'], ['DE-SH', 'Schleswig-Holstein'], ['DE-TH', 'Thüringen'],
] as const;
export type MasterDataImportResult = { imported: number };

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function str(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function uuid(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value); }

function validRow(value: unknown, name: string, optional: readonly string[]): value is Record<string, unknown> {
  const row = object(value);
  return !!row && str(row[name]) && validCatalogSource(row.source) && str(row.sourceVersion) &&
    optional.every(key => row[key] === null || str(row[key]));
}

function isPackage(value: unknown): value is MedicationPackageOption {
  return validRow(value, 'name', ['ingredient', 'strength', 'dosageForm', 'brand', 'manufacturer', 'packageSize']) && isValidPzn(value.pzn);
}

function isAuthorizedMedicine(value: unknown): value is AuthorizedMedicine {
  return validRow(value, 'name', ['activeSubstance', 'authorizationHolder']) && value.source === 'ema-article57' &&
    (value.authorizationScope === 'DE' || value.authorizationScope === 'EU') &&
    typeof value.id === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.id);
}

function isPhysician(value: unknown): value is PhysicianOption {
  return validRow(value, 'displayName', ['practiceName', 'specialty', 'postalCode', 'city', 'street', 'phone', 'lanr', 'bsnr']) &&
    typeof value.id === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.id);
}

function isPracticeLocationSource(value: unknown, source: string): value is PracticeLocationOption {
  return validRow(value, 'displayName', ['practiceName', 'specialty', 'postalCode', 'city', 'street', 'phone']) &&
    value.source === source && uuid(value.id) &&
    value.contactSourceUrl === undefined && // Only supplements reviewed in the app can set the external link.
    (value.sourceUpdatedAt === null || (typeof value.sourceUpdatedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.sourceUpdatedAt)));
}

function message(error: unknown): string {
  const code = object(error)?.code;
  if (code === '42501') return 'Die erforderliche Pflege- oder Mandantenberechtigung fehlt.';
  if (code === 'PGRST202' || code === '42883') return 'Die Pflege-Stammdatenbank ist noch nicht eingerichtet.';
  if (code === '23505') return 'Für dieselbe Quelle und Version sind bereits abweichende Stammdaten hinterlegt.';
  if (code === '22023' || code === '23514' || code === '22P02') return 'Die Stammdaten entsprechen nicht dem erwarteten Format.';
  return 'Die Pflege-Stammdaten konnten nicht verarbeitet werden.';
}

function isMissingRpc(error: unknown): boolean {
  const code = object(error)?.code;
  return code === 'PGRST202' || code === '42883';
}

async function call<T>(tenantId: string, name: string, parameters: Record<string, unknown>, decode: (value: unknown) => T | null,
  missing?: () => Promise<ServiceResult<T>>, errorMessage = message): Promise<ServiceResult<T>> {
  const blocked = guardServiceTenant(tenantId);
  if (blocked) return blocked;
  const client = getServiceMode() === 'supabase' ? getSupabaseClient() : null;
  if (!client) return { ok: false, error: 'Die produktive Pflege-Stammdatenbank ist nicht verbunden.' };
  const rpc = client as unknown as { rpc: (functionName: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
  try {
    const { data, error } = await withServiceQueryTimeout(Promise.resolve(rpc.rpc(name, { ...parameters, p_tenant: tenantId })), 'Pflege-Stammdaten', 15_000);
    if (error) return missing && isMissingRpc(error) ? await missing() : { ok: false, error: errorMessage(error) };
    const result = decode(data);
    return result === null ? { ok: false, error: 'Die Stammdaten konnten nicht eindeutig gelesen werden.' } : { ok: true, data: result };
  } catch {
    return { ok: false, error: 'Die Pflege-Stammdatenbank hat nicht geantwortet.' };
  }
}

function search<T>(tenantId: string, query: string, name: string, valid: (value: unknown) => value is T, extra: Record<string, unknown> = {}): Promise<ServiceResult<T[]>> {
  const value = query.trim();
  if (value.length < 2) return Promise.resolve({ ok: true, data: [] });
  if (value.length > 120 || /[\u0000-\u001f\u007f]/u.test(value)) return Promise.resolve({ ok: false, error: 'Suchbegriff ist ungültig oder zu lang.' });
  return call(tenantId, name, { ...extra, p_query: value }, data => Array.isArray(data) && data.length <= 30 && data.every(valid) ? data : null);
}

export function searchMedicationPackages(tenantId: string, query: string): Promise<ServiceResult<MedicationPackageOption[]>> {
  return search(tenantId, query, 'search_pflege_medication_packages', isPackage);
}

export function searchAuthorizedMedicines(tenantId: string, query: string): Promise<ServiceResult<AuthorizedMedicine[]>> {
  return search(tenantId, query, 'search_pflege_authorized_medicines', isAuthorizedMedicine);
}

export function searchPhysicians(tenantId: string, query: string): Promise<ServiceResult<PhysicianOption[]>> {
  return search(tenantId, query, 'search_pflege_physicians', isPhysician);
}

export function searchPracticeLocations(tenantId: string, query: string): Promise<ServiceResult<PracticeLocationOption[]>> {
  return search(tenantId, query, 'search_pflege_practice_locations', (value): value is PracticeLocationOption => isPracticeLocationSource(value, 'rvr-ruhr-praxis'));
}

function isNationalPractice(value: unknown, state: string | null): value is PracticeLocationOption {
  return isPracticeLocationSource(value, 'osm-de-praxis') &&
    PRACTICE_STATES.some(([code, name]) => code === value.stateCode && name === value.stateName) && (!state || value.stateCode === state);
}

export async function searchNationalPracticeLocations(tenantId: string, query: string, state: string | null): Promise<ServiceResult<PracticeLocationOption[]>> {
  if (state !== null && !PRACTICE_STATES.some(([code]) => code === state)) return { ok: false, error: 'Bundesland ist ungültig.' };
  const result = await search(tenantId, query, 'search_pflege_osm_practice_locations',
    (value): value is PracticeLocationOption => isNationalPractice(value, state), { p_state: state });
  return result.ok ? { ok: true, data: result.data.map(addReviewedPracticeContact) } : result;
}

const CATALOG_PAGE_SIZE = 30;
const idCursor = <T extends { id: string }>(row: T) => row.id.toLowerCase();
const packageCursor = (row: MedicationPackageOption) => `${row.source}:${row.pzn}`;
const validPackageCursor = (cursor: unknown): cursor is string => {
  if (typeof cursor !== 'string') return false;
  const [source, pzn, unexpected] = cursor.split(':');
  return unexpected === undefined && validCatalogSource(source) && source !== 'manual' && isValidPzn(pzn);
};

function decodeCatalogPage<T>(data: unknown, after: string | null, valid: (value: unknown) => value is T,
  makeCursor: (row: T) => string, validCursor: (value: unknown) => value is string): CatalogPage<T> | null {
  const envelope = object(data);
  if (!envelope || !Array.isArray(envelope.rows) || envelope.rows.length > CATALOG_PAGE_SIZE || !envelope.rows.every(valid)) return null;
  const rows = envelope.rows;
  const cursor = envelope.nextCursor;
  const ids = new Set(rows.map(makeCursor));
  if (ids.size !== rows.length || (after !== null && ids.has(after.toLowerCase())) ||
      (cursor !== null && (!validCursor(cursor) || rows.length !== CATALOG_PAGE_SIZE || cursor !== makeCursor(rows[rows.length - 1])))) return null;
  return { rows, nextCursor: cursor };
}

function searchCatalogPage<T>(tenantId: string, query: string, name: string, after: string | null,
  valid: (value: unknown) => value is T, legacy: () => Promise<ServiceResult<T[]>>,
  makeCursor: (row: T) => string, validCursor: (value: unknown) => value is string,
  extra: Record<string, unknown> = {}): Promise<ServiceResult<CatalogPage<T>>> {
  const value = query.trim();
  if (value.length < 2) return Promise.resolve({ ok: true, data: { rows: [], nextCursor: null } });
  if (value.length > 120 || /[\u0000-\u001f\u007f]/u.test(value)) return Promise.resolve({ ok: false, error: 'Suchbegriff ist ungültig oder zu lang.' });
  if (after !== null && !validCursor(after)) return Promise.resolve({ ok: false, error: 'Suchposition ist ungültig. Bitte suchen Sie erneut.' });
  return call(tenantId, name, { ...extra, p_query: value, p_after: after }, data => decodeCatalogPage(data, after, valid, makeCursor, validCursor),
    after !== null ? undefined : async () => {
      const result = await legacy();
      return result.ok ? { ok: true, data: { rows: result.data, nextCursor: null,
        ...(result.data.length === CATALOG_PAGE_SIZE ? { limited: true } : {}) } } : result;
    }, error => after !== null && object(error)?.code === '22023' ? 'Suchposition ist nicht mehr gültig. Bitte suchen Sie erneut.' : message(error));
}

export function searchMedicationPackagesPage(tenantId: string, query: string, after: string | null = null): Promise<ServiceResult<CatalogPage<MedicationPackageOption>>> {
  return searchCatalogPage(tenantId, query, 'search_pflege_medication_packages_page', after, isPackage,
    () => searchMedicationPackages(tenantId, query), packageCursor, validPackageCursor);
}

export function searchAuthorizedMedicinesPage(tenantId: string, query: string, after: string | null = null): Promise<ServiceResult<CatalogPage<AuthorizedMedicine>>> {
  return searchCatalogPage(tenantId, query, 'search_pflege_authorized_medicines_page', after, isAuthorizedMedicine,
    () => searchAuthorizedMedicines(tenantId, query), idCursor, uuid);
}

export function searchPracticeLocationsPage(tenantId: string, query: string, after: string | null = null): Promise<ServiceResult<PracticeLocationPage>> {
  return searchCatalogPage(tenantId, query, 'search_pflege_practice_locations_page', after,
    (value): value is PracticeLocationOption => isPracticeLocationSource(value, 'rvr-ruhr-praxis'),
    () => searchPracticeLocations(tenantId, query), idCursor, uuid);
}

export async function searchNationalPracticeLocationsPage(tenantId: string, query: string, state: string | null, after: string | null = null): Promise<ServiceResult<PracticeLocationPage>> {
  if (state !== null && !PRACTICE_STATES.some(([code]) => code === state)) return { ok: false, error: 'Bundesland ist ungültig.' };
  const result = await searchCatalogPage(tenantId, query, 'search_pflege_osm_practice_locations_page', after,
    (value): value is PracticeLocationOption => isNationalPractice(value, state),
    () => searchNationalPracticeLocations(tenantId, query, state), idCursor, uuid, { p_state: state });
  return result.ok ? { ok: true, data: { ...result.data, rows: result.data.rows.map(addReviewedPracticeContact) } } : result;
}

export async function saveManualPhysician(tenantId: string, input: PhysicianInput): Promise<ServiceResult<PhysicianOption>> {
  const validated = validateManualPhysician(input);
  if (!validated.ok) return validated;
  return call(tenantId, 'save_pflege_manual_physician', { p_row: validated.data }, data => isPhysician(data) ? data : null);
}

function importBatch<T>(tenantId: string, name: string, validated: ServiceResult<{ source: string; sourceVersion: string; rows: T[] }>): Promise<ServiceResult<MasterDataImportResult>> {
  if (!validated.ok) return Promise.resolve(validated);
  const { source, sourceVersion, rows } = validated.data;
  if (rows.length > MASTER_DATA_BATCH_LIMIT) return Promise.resolve({ ok: false, error: `Pro Verarbeitungsschritt sind höchstens ${MASTER_DATA_BATCH_LIMIT} Datensätze möglich.` });
  return call(tenantId, name, { p_source: source, p_version: sourceVersion, p_rows: rows }, data => data === rows.length ? { imported: rows.length } : null);
}

export function importMedicationPackages(tenantId: string, input: unknown): Promise<ServiceResult<MasterDataImportResult>> {
  return importBatch(tenantId, 'import_pflege_medication_packages', validateMedicationPackageFeed(input));
}

export function importPhysicians(tenantId: string, input: unknown): Promise<ServiceResult<MasterDataImportResult>> {
  return importBatch(tenantId, 'import_pflege_physicians', validatePhysicianFeed(input));
}
