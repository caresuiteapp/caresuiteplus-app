import type { RoleKey, ServiceResult } from '@/types';
import type { CsvClientExportFilters } from '@/types/csv';
import { getSystemCatalog } from '@/lib/catalogs/systemCatalogs';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { createExportLog } from './csvImportLogs';
import {
  careLevelToLabel,
  clientStatusToLabel,
  formatBooleanGerman,
  formatDateGerman,
  leistungsartToLabel,
} from './csvValueUtils';
import { buildExportFileName, triggerCsvDownload } from './csvDownload';
import { serializeCsv } from './csvParser';
import { CLIENT_IMPORT_ALL_FIELDS } from '@/types/clientImport';

const LEISTUNGSART = getSystemCatalog('leistungsart').entries.map((e) => ({ key: e.value, label: e.label }));

type ClientRow = {
  id: string;
  client_number: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  care_level: string | null;
  status: string | null;
  insurance_number: string | null;
  insurance_name: string | null;
  cost_bearer: string | null;
  allergies: string | null;
  pets: string | null;
  mobility_notes: string | null;
  diagnoses_notes: string | null;
  internal_notes: string | null;
  admission_date: string | null;
};

export async function exportClientsCsv(input: {
  tenantId: string;
  userId: string;
  filters: CsvClientExportFilters;
  actorRoleKey?: RoleKey | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  download?: boolean;
}): Promise<ServiceResult<{ csv: string; fileName: string; count: number }>> {
  const denied = enforcePermission(input.actorRoleKey, 'tenant.settings.csv.export.clients');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  let query = supabase
    .from('clients')
    .select(
      'id, client_number, first_name, last_name, date_of_birth, street, house_number, postal_code, city, phone, mobile, email, care_level, status, insurance_number, insurance_name, cost_bearer, allergies, pets, mobility_notes, diagnoses_notes, internal_notes, admission_date',
    )
    .eq('tenant_id', input.tenantId);

  if (input.filters.statusFilter === 'archived') {
    query = query.eq('status', 'archived');
  } else {
    query = query.is('deleted_at', null);
    if (input.filters.statusFilter === 'active') query = query.eq('status', 'active');
    if (input.filters.statusFilter === 'inactive') query = query.eq('status', 'inactive');
  }

  if (input.filters.careLevel) query = query.eq('care_level', input.filters.careLevel);
  if (input.filters.city) query = query.ilike('city', `%${input.filters.city}%`);
  if (input.filters.costBearer) query = query.ilike('cost_bearer', `%${input.filters.costBearer}%`);
  if (input.filters.serviceStartFrom) query = query.gte('admission_date', input.filters.serviceStartFrom);
  if (input.filters.serviceStartTo) query = query.lte('admission_date', input.filters.serviceStartTo);

  const { data, error } = await query.order('last_name', { ascending: true });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  let rows = (data ?? []) as ClientRow[];

  if (input.filters.leistungsart) {
    const { data: contexts } = await fromUnknownTable(supabase, 'client_care_contexts')
      .select('client_id')
      .eq('tenant_id', input.tenantId)
      .eq('context_key', input.filters.leistungsart);
    const allowed = new Set((contexts ?? []).map((c) => String((c as { client_id: string }).client_id)));
    rows = rows.filter((r) => allowed.has(r.id));
  }

  const scopes = new Set(input.filters.scopes);
  const includeSensitive = scopes.has('medizin') || scopes.has('notizen');
  const canSensitive = !enforcePermission(input.actorRoleKey, 'office.clients.view_sensitive');
  if (includeSensitive && !canSensitive) {
    return { ok: false, error: 'Keine Berechtigung für sensible Klient:innen-Daten im Export.' };
  }

  const headers = [...CLIENT_IMPORT_ALL_FIELDS] as string[];
  const csvRows = rows.map((row) => {
    const leistung = input.filters.leistungsart ?? '';
    return [
      row.client_number ?? '',
      '',
      '',
      row.first_name,
      row.last_name,
      formatDateGerman(row.date_of_birth),
      row.street ?? '',
      row.house_number ?? '',
      row.postal_code ?? '',
      row.city ?? '',
      row.phone ?? '',
      '',
      row.mobile ?? '',
      scopes.has('kontakt') || scopes.has('basis') ? row.email ?? '' : '',
      careLevelToLabel(row.care_level),
      '',
      leistungsartToLabel(leistung, LEISTUNGSART),
      row.cost_bearer ?? '',
      '',
      row.insurance_number ?? '',
      row.insurance_name ?? '',
      row.insurance_name ?? '',
      '',
      '',
      '',
      '',
      '',
      row.cost_bearer ?? '',
      formatDateGerman(row.admission_date),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      scopes.has('medizin') && canSensitive ? row.diagnoses_notes ?? '' : '',
      scopes.has('medizin') && canSensitive ? row.allergies ?? '' : '',
      scopes.has('medizin') && canSensitive ? row.mobility_notes ?? '' : '',
      '',
      scopes.has('medizin') && canSensitive ? row.pets ?? '' : '',
      '',
      scopes.has('notizen') && canSensitive ? row.internal_notes ?? '' : '',
      clientStatusToLabel(row.status),
    ];
  });

  const fileName = buildExportFileName('clients');
  const csv = serializeCsv(headers, csvRows, ';');

  await createExportLog({
    tenantId: input.tenantId,
    userId: input.userId,
    exportType: 'clients',
    filters: input.filters as unknown as Record<string, unknown>,
    numberOfRecords: csvRows.length,
    fileName,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    actorRoleKey: input.actorRoleKey,
  });

  if (input.download !== false) triggerCsvDownload(csv, fileName);

  return { ok: true, data: { csv, fileName, count: csvRows.length } };
}
