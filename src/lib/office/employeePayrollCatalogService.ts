import type { ServiceResult } from '@/types';
import type { CatalogType } from '@/types/templates';
import { EMPLOYEE_PAYROLL_CATALOGS } from '@/data/demo/templates/catalogs/employeePayroll';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { formatGermanCatalogKey } from '@/lib/formatters/germanLabelFormatters';

export type PayrollCatalogOption = { key: string; label: string };

const demoLabelMaps = new Map<CatalogType, Map<string, string>>();

function ensureDemoMaps(): void {
  if (demoLabelMaps.size > 0) return;
  for (const entry of EMPLOYEE_PAYROLL_CATALOGS) {
    const map = demoLabelMaps.get(entry.catalogType) ?? new Map<string, string>();
    map.set(entry.valueKey, entry.label);
    demoLabelMaps.set(entry.catalogType, map);
  }
}

export function resolvePayrollCatalogLabel(
  catalogType: CatalogType,
  key: string | null | undefined,
): string {
  if (!key?.trim()) return '—';
  ensureDemoMaps();
  return demoLabelMaps.get(catalogType)?.get(key.trim()) ?? formatGermanCatalogKey(key);
}

export async function fetchEmployeePayrollCatalogOptions(
  catalogType: CatalogType,
): Promise<ServiceResult<PayrollCatalogOption[]>> {
  ensureDemoMaps();
  const demoOptions = [...(demoLabelMaps.get(catalogType)?.entries() ?? [])].map(([key, label]) => ({
    key,
    label,
  }));

  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: demoOptions };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  const { data, error } = await fromUnknownTable(supabase, 'catalog_entries')
    .select('value_key, label')
    .is('tenant_id', null)
    .eq('catalog_type', catalogType)
    .eq('is_system', true)
    .order('sort_order', { ascending: true });

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: demoOptions };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data || data.length === 0) {
    return { ok: true, data: demoOptions };
  }

  return {
    ok: true,
    data: data.map((row) => ({
      key: String((row as { value_key: string }).value_key),
      label: String((row as { label: string }).label),
    })),
  };
}

export const EMPLOYEE_SALUTATION_OPTIONS: PayrollCatalogOption[] = [
  { key: 'herr', label: 'Herr' },
  { key: 'frau', label: 'Frau' },
  { key: 'divers', label: 'Divers' },
];

export const COMPENSATION_TYPE_OPTIONS: PayrollCatalogOption[] = [
  { key: 'salary', label: 'Gehalt' },
  { key: 'hourly', label: 'Stundenlohn' },
];

export const PAYOUT_INTERVAL_OPTIONS: PayrollCatalogOption[] = [
  { key: 'monthly', label: 'Monatlich' },
  { key: 'biweekly', label: 'Zweiwöchentlich' },
  { key: 'weekly', label: 'Wöchentlich' },
];

export const PAYOUT_METHOD_OPTIONS: PayrollCatalogOption[] = [
  { key: 'transfer', label: 'Überweisung' },
  { key: 'cash', label: 'Barauszahlung' },
];

export const INSURANCE_TYPE_OPTIONS: PayrollCatalogOption[] = [
  { key: 'statutory', label: 'Gesetzlich versichert' },
  { key: 'private', label: 'Privat versichert' },
];

export const WORK_DAY_LABELS: Record<string, string> = {
  mon: 'Montag',
  tue: 'Dienstag',
  wed: 'Mittwoch',
  thu: 'Donnerstag',
  fri: 'Freitag',
  sat: 'Samstag',
  sun: 'Sonntag',
};
