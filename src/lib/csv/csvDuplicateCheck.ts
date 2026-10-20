import type { CsvImportType, CsvValidatedRow } from '@/types/csv';
import type { ClientImportRow } from '@/types/clientImport';
import type { EmployeeImportRow } from '@/types/employeeImport';
import { issue } from './csvValueUtils';

function duplicateKeyClient(row: ClientImportRow): string[] {
  const keys: string[] = [];
  keys.push(`name:${row.vorname.toLowerCase()}|${row.nachname.toLowerCase()}|${row.geburtsdatum}`);
  if (row.kundennummer) keys.push(`client_number:${row.kundennummer.toLowerCase()}`);
  if (row.versichertennummer) keys.push(`insurance:${row.versichertennummer.toLowerCase()}`);
  if (row.email) keys.push(`email:${row.email.toLowerCase()}`);
  if (row.telefon_1) keys.push(`phone:${row.telefon_1.replace(/\D/g, '')}`);
  return keys;
}

function duplicateKeyEmployee(row: EmployeeImportRow): string[] {
  const keys: string[] = [];
  keys.push(`name:${row.vorname.toLowerCase()}|${row.nachname.toLowerCase()}|${row.geburtsdatum}`);
  if (row.personalnummer) keys.push(`employee_number:${row.personalnummer.toLowerCase()}`);
  if (row.email) keys.push(`email:${row.email.toLowerCase()}`);
  if (row.telefon) keys.push(`phone:${row.telefon.replace(/\D/g, '')}`);
  if (row.steuer_id) keys.push(`tax:${row.steuer_id}`);
  if (row.sozialversicherungsnummer) keys.push(`sv:${row.sozialversicherungsnummer.toLowerCase()}`);
  return keys;
}

export function buildDuplicateKeysFromRow(
  row: ClientImportRow | EmployeeImportRow,
  importType: CsvImportType,
): string[] {
  return importType === 'clients'
    ? duplicateKeyClient(row as ClientImportRow)
    : duplicateKeyEmployee(row as EmployeeImportRow);
}

export function markDuplicateRows<T extends ClientImportRow | EmployeeImportRow>(
  rows: CsvValidatedRow<T>[],
  importType: CsvImportType,
  existingKeys?: Set<string>,
): CsvValidatedRow<T>[] {
  const seenInFile = new Set<string>();
  const existing = existingKeys ?? new Set<string>();

  return rows.map((row) => {
    if (!row.isValid) return row;
    const keys = buildDuplicateKeysFromRow(row.data, importType);
    const matched = keys.find((k) => seenInFile.has(k) || existing.has(k));
    if (!matched) {
      keys.forEach((k) => seenInFile.add(k));
      return row;
    }
    return {
      ...row,
      isDuplicate: true,
      duplicateReason: matched.startsWith('name:') ? 'Stammdaten' : matched.split(':')[0],
      issues: [
        ...row.issues,
        issue(
          row.rowNumber,
          null,
          'DUPLICATE',
          'Diese Zeile wurde als mögliche Dublette erkannt.',
          null,
          'warning',
          'Bestehende Datensätze werden nicht überschrieben (create_only).',
        ),
      ],
    };
  });
}

export async function loadExistingDuplicateKeys(
  tenantId: string,
  importType: CsvImportType,
): Promise<Set<string>> {
  const { getSupabaseClient } = await import('@/lib/supabase/client');
  const supabase = getSupabaseClient();
  const keys = new Set<string>();
  if (!supabase) return keys;

  if (importType === 'clients') {
    const { data } = await supabase
      .from('clients')
      .select('first_name, last_name, date_of_birth, client_number, insurance_number, email, phone')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    for (const row of data ?? []) {
      if (row.first_name && row.last_name && row.date_of_birth) {
        keys.add(`name:${row.first_name.toLowerCase()}|${row.last_name.toLowerCase()}|${row.date_of_birth}`);
      }
      if (row.client_number) keys.add(`client_number:${row.client_number.toLowerCase()}`);
      if (row.insurance_number) keys.add(`insurance:${row.insurance_number.toLowerCase()}`);
      if (row.email) keys.add(`email:${row.email.toLowerCase()}`);
      if (row.phone) keys.add(`phone:${row.phone.replace(/\D/g, '')}`);
    }
  } else {
    const { data } = await supabase
      .from('employees')
      .select('first_name, last_name, date_of_birth, employee_number, email, phone')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    for (const row of data ?? []) {
      if (row.first_name && row.last_name && row.date_of_birth) {
        keys.add(`name:${row.first_name.toLowerCase()}|${row.last_name.toLowerCase()}|${row.date_of_birth}`);
      }
      if (row.employee_number) keys.add(`employee_number:${row.employee_number.toLowerCase()}`);
      if (row.email) keys.add(`email:${row.email.toLowerCase()}`);
      if (row.phone) keys.add(`phone:${row.phone.replace(/\D/g, '')}`);
    }
  }

  return keys;
}
