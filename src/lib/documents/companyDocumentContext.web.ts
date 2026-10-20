import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

type Client = NonNullable<ReturnType<typeof getSupabaseClient>>;
type Row = Record<string, unknown>;
const missingSchema = (error: { code?: string } | null) => Boolean(error && ['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error.code ?? ''));

/** Never take a random account when several accounts have no unique default. */
export function selectCompanyDocumentPrimary<T extends { isPrimary?: boolean }>(rows: readonly T[]): T | undefined {
  const primary = rows.filter(row => row.isPrimary);
  return primary.length === 1 ? primary[0] : primary.length === 0 && rows.length === 1 ? rows[0] : undefined;
}

export async function loadCanonicalCompanyDocumentData(client: Client, tenantId: string): Promise<ServiceResult<{
  settings: Row;
  representativeName?: string;
  brandingAvailable: boolean;
}>> {
  const [banks, representatives, branding] = await Promise.all([
    fromUnknownTable(client, 'tenant_bank_accounts').select('id,account_holder,bank_name,iban,bic,is_primary').eq('tenant_id', tenantId).order('sort_order').order('id'),
    fromUnknownTable(client, 'tenant_representatives').select('id,first_name,last_name,is_primary').eq('tenant_id', tenantId).order('sort_order').order('id'),
    fromUnknownTable(client, 'tenant_branding').select('logo_url').eq('tenant_id', tenantId).maybeSingle(),
  ]);
  for (const result of [banks, representatives, branding]) {
    if (result.error && !missingSchema(result.error)) return { ok: false, error: toGermanSupabaseError(result.error) };
  }
  const bankRows = (banks.data ?? []) as Row[];
  const bank = selectCompanyDocumentPrimary<Row & { isPrimary: boolean }>(bankRows.map(row => ({ ...row, isPrimary: row.is_primary === true })));
  const names = ((representatives.data ?? []) as Row[]).map(row => [row.first_name, row.last_name].filter(Boolean).join(' ').trim()).filter(Boolean);
  return { ok: true, data: {
    // An existing empty canonical list deliberately clears old duplicated fields.
    settings: {
      ...(banks.error ? {} : { account_holder: bank?.account_holder ?? '', bank_name: bank?.bank_name ?? '', iban: bank?.iban ?? '', bic: bank?.bic ?? '' }),
      ...(!branding.error && branding.data ? { logo_url: branding.data.logo_url ?? '' } : {}),
    },
    ...(representatives.error ? {} : { representativeName: names.join(', ') }),
    brandingAvailable: !branding.error && Boolean(branding.data),
  } };
}

/** Only document-enabled, visible scalar values are allowed into a frozen document. */
export async function loadCompanyDocumentCustomValues(client: Client, tenantId: string, requestedKeys?: readonly string[], modules?: readonly string[]): Promise<ServiceResult<Record<string, string>>> {
  if (requestedKeys && !requestedKeys.length) return { ok: true, data: {} };
  const definitions = await fromUnknownTable(client, 'tenant_custom_field_definitions')
    .select('id,field_key,data_type,function_key,module_key,visibility,is_active').eq('tenant_id', tenantId).eq('is_active', true).order('sort_order').order('id');
  if (definitions.error) return { ok: false, error: toGermanSupabaseError(definitions.error) };
  const allowed = ((definitions.data ?? []) as Row[]).filter(row => {
    const visibility = row.visibility && typeof row.visibility === 'object' ? row.visibility as Row : {};
    return typeof row.field_key === 'string' && /^[a-z][a-z0-9_]*$/.test(row.field_key)
      && row.is_active === true && visibility.office === true
      && visibility.protected !== true && visibility.sensitive !== true && visibility.private !== true
      && (!row.function_key || row.function_key === 'documents')
      && (!requestedKeys || requestedKeys.includes(row.field_key))
      && (!row.module_key || Boolean(modules?.includes(String(row.module_key))));
  });
  if (!allowed.length) return { ok: true, data: {} };
  const values = await fromUnknownTable(client, 'tenant_custom_field_values').select('definition_id,value').eq('tenant_id', tenantId).in('definition_id', allowed.map(row => String(row.id)));
  if (values.error) return { ok: false, error: toGermanSupabaseError(values.error) };
  const byId = new Map(((values.data ?? []) as Row[]).map(row => [row.definition_id, row.value]));
  const result: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const row of allowed) {
    const value = byId.get(row.id);
    if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) result[String(row.field_key)] = String(value);
    else if (typeof value === 'boolean') result[String(row.field_key)] = value ? 'Ja' : 'Nein';
  }
  return { ok: true, data: result };
}
