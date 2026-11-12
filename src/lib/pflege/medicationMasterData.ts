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

export * from './medicationMasterDataValidation';

type Origin = { source: string; sourceVersion: string };
export type MedicationPackageOption = Required<MedicationPackageInput> & Origin;
export type PhysicianOption = Required<PhysicianInput> & Origin & { id: string };
export type MasterDataImportResult = { imported: number };

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function str(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }

function validRow(value: unknown, name: string, optional: readonly string[]): value is Record<string, unknown> {
  const row = object(value);
  return !!row && str(row[name]) && validCatalogSource(row.source) && str(row.sourceVersion) &&
    optional.every(key => row[key] === null || str(row[key]));
}

function isPackage(value: unknown): value is MedicationPackageOption {
  return validRow(value, 'name', ['ingredient', 'strength', 'dosageForm', 'brand', 'manufacturer', 'packageSize']) && isValidPzn(value.pzn);
}

function isPhysician(value: unknown): value is PhysicianOption {
  return validRow(value, 'displayName', ['practiceName', 'specialty', 'postalCode', 'city', 'street', 'phone', 'lanr', 'bsnr']) &&
    typeof value.id === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.id);
}

function message(error: unknown): string {
  const code = object(error)?.code;
  if (code === '42501') return 'Die erforderliche Pflege- oder Mandantenberechtigung fehlt.';
  if (code === 'PGRST202' || code === '42883') return 'Die Pflege-Stammdatenbank ist noch nicht eingerichtet.';
  if (code === '23505') return 'Für dieselbe Quelle und Version sind bereits abweichende Stammdaten hinterlegt.';
  if (code === '22023' || code === '23514' || code === '22P02') return 'Die Stammdaten entsprechen nicht dem erwarteten Format.';
  return 'Die Pflege-Stammdaten konnten nicht verarbeitet werden.';
}

async function call<T>(tenantId: string, name: string, parameters: Record<string, unknown>, decode: (value: unknown) => T | null): Promise<ServiceResult<T>> {
  const blocked = guardServiceTenant(tenantId);
  if (blocked) return blocked;
  const client = getServiceMode() === 'supabase' ? getSupabaseClient() : null;
  if (!client) return { ok: false, error: 'Die produktive Pflege-Stammdatenbank ist nicht verbunden.' };
  const rpc = client as unknown as { rpc: (functionName: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
  try {
    const { data, error } = await withServiceQueryTimeout(Promise.resolve(rpc.rpc(name, { ...parameters, p_tenant: tenantId })), 'Pflege-Stammdaten', 15_000);
    if (error) return { ok: false, error: message(error) };
    const result = decode(data);
    return result === null ? { ok: false, error: 'Die Stammdaten konnten nicht eindeutig gelesen werden.' } : { ok: true, data: result };
  } catch {
    return { ok: false, error: 'Die Pflege-Stammdatenbank hat nicht geantwortet.' };
  }
}

function search<T>(tenantId: string, query: string, name: string, valid: (value: unknown) => value is T): Promise<ServiceResult<T[]>> {
  const value = query.trim();
  if (value.length < 2) return Promise.resolve({ ok: true, data: [] });
  if (value.length > 120 || /[\u0000-\u001f\u007f]/u.test(value)) return Promise.resolve({ ok: false, error: 'Suchbegriff ist ungültig oder zu lang.' });
  return call(tenantId, name, { p_query: value }, data => Array.isArray(data) && data.length <= 30 && data.every(valid) ? data : null);
}

export function searchMedicationPackages(tenantId: string, query: string): Promise<ServiceResult<MedicationPackageOption[]>> {
  return search(tenantId, query, 'search_pflege_medication_packages', isPackage);
}

export function searchPhysicians(tenantId: string, query: string): Promise<ServiceResult<PhysicianOption[]>> {
  return search(tenantId, query, 'search_pflege_physicians', isPhysician);
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
