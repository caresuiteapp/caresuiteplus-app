import type { PermissionKey, ServiceResult } from '@/types';
import type { PermissionCatalogEntry } from '@/types/permissions/rbac';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  buildPermissionCatalogEntries,
  PERMISSION_MODULE_LABELS,
} from './permissionCatalogSeedData';

let cachedCatalog: PermissionCatalogEntry[] | null = null;

function getFallbackCatalog(): PermissionCatalogEntry[] {
  if (!cachedCatalog) {
    cachedCatalog = buildPermissionCatalogEntries();
  }
  return cachedCatalog;
}

function mapRow(row: Record<string, unknown>): PermissionCatalogEntry {
  return {
    key: row.key as PermissionKey,
    module: String(row.module),
    category: String(row.category),
    label: String(row.label),
    description: (row.description as string | null) ?? null,
    riskLevel: row.risk_level as PermissionCatalogEntry['riskLevel'],
    requiresAudit: Boolean(row.requires_audit),
  };
}

export async function fetchPermissionCatalog(): Promise<ServiceResult<PermissionCatalogEntry[]>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: getFallbackCatalog() };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const { data, error } = await fromUnknownTable(supabase, 'permission_catalog')
    .select('key, module, category, label, description, risk_level, requires_audit')
    .order('module')
    .order('category')
    .order('label');

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      return { ok: true, data: getFallbackCatalog() };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data?.length) {
    return { ok: true, data: getFallbackCatalog() };
  }

  return { ok: true, data: data.map((row) => mapRow(row as Record<string, unknown>)) };
}

export type GroupedPermissionCatalog = {
  module: string;
  moduleLabel: string;
  categories: Array<{
    category: string;
    entries: PermissionCatalogEntry[];
  }>;
};

export function groupPermissionCatalog(entries: PermissionCatalogEntry[]): GroupedPermissionCatalog[] {
  const byModule = new Map<string, PermissionCatalogEntry[]>();
  for (const entry of entries) {
    const list = byModule.get(entry.module) ?? [];
    list.push(entry);
    byModule.set(entry.module, list);
  }

  return [...byModule.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'de'))
    .map(([module, moduleEntries]) => {
      const byCategory = new Map<string, PermissionCatalogEntry[]>();
      for (const entry of moduleEntries) {
        const list = byCategory.get(entry.category) ?? [];
        list.push(entry);
        byCategory.set(entry.category, list);
      }
      return {
        module,
        moduleLabel: PERMISSION_MODULE_LABELS[module] ?? module,
        categories: [...byCategory.entries()].map(([category, catEntries]) => ({
          category,
          entries: catEntries.sort((a, b) => a.label.localeCompare(b.label, 'de')),
        })),
      };
    });
}

export function filterCatalogByModulePrefix(
  entries: PermissionCatalogEntry[],
  prefixes: string[],
): PermissionCatalogEntry[] {
  if (!prefixes.length) return entries;
  return entries.filter((entry) => prefixes.some((prefix) => entry.key.startsWith(`${prefix}.`)));
}

export function getCatalogLabel(key: PermissionKey, catalog?: PermissionCatalogEntry[]): string {
  const fromCatalog = catalog?.find((e) => e.key === key);
  if (fromCatalog) return fromCatalog.label;
  const fallback = getFallbackCatalog().find((e) => e.key === key);
  return fallback?.label ?? key;
}
