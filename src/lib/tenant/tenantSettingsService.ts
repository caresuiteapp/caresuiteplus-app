import type { RoleKey, ServiceResult } from '@/types';
import type { TenantSettingsForm, TenantSettingsSnapshot } from '@/types/tenant/tenantSettings';
import { EMPTY_TENANT_SETTINGS_FORM } from '@/types/tenant/tenantSettings';
import {
  demoTenant,
  demoTenantAddress,
  DEMO_TENANT_ID,
} from '@/data/demo/tenant';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant, isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { TENANT_SETTINGS_PERMISSION } from './tenantSettingsRoute';
import {
  resolveTenantLogoUrlForSave,
  type TenantLogoValue,
} from './tenantLogoService';
import {
  formatHourlyRateDocumentAmount,
  parseHourlyRateEuro,
} from '@/lib/formatters/numberFormatters';

const DEMO_STORE = new Map<string, TenantSettingsSnapshot>();

const TENANT_COLUMNS =
  'id, name, legal_name, legal_form, street, house_number, postal_code, city, country, phone, email, website, updated_at';

function parseDemoStreet(streetLine: string): { street: string; houseNumber: string } {
  const match = streetLine.trim().match(/^(.+?)\s+(\d+\w*)$/);
  if (!match) {
    return { street: streetLine.trim(), houseNumber: '' };
  }
  return { street: match[1].trim(), houseNumber: match[2].trim() };
}

function buildDemoSnapshot(tenantId: string, overrides?: Partial<TenantSettingsForm>): TenantSettingsSnapshot {
  const parsedStreet = parseDemoStreet(demoTenantAddress.street);
  const base: TenantSettingsSnapshot = {
    tenantId,
    name: demoTenant.name,
    legalName: demoTenant.name,
    street: parsedStreet.street,
    houseNumber: parsedStreet.houseNumber,
    zip: demoTenantAddress.zip,
    city: demoTenantAddress.city,
    country: demoTenantAddress.country,
    phone: demoTenant.phone ?? '',
    email: demoTenant.email ?? '',
    website: demoTenant.website ?? '',
    logoUrl: tenantId === DEMO_TENANT_ID ? 'https://example.com/demo-logo.png' : '',
    assistDefaultHourlyRate: '38,00',
    updatedAt: demoTenant.updatedAt,
  };

  if (overrides) {
    return { ...base, ...overrides, tenantId, updatedAt: new Date().toISOString() };
  }
  return base;
}

function ensureDemoSnapshot(tenantId: string): TenantSettingsSnapshot {
  if (!DEMO_STORE.has(tenantId)) {
    DEMO_STORE.set(tenantId, buildDemoSnapshot(tenantId));
  }
  return DEMO_STORE.get(tenantId)!;
}

function mapRowToSnapshot(
  tenantId: string,
  row: {
    name: string;
    legal_name: string | null;
    street: string | null;
    house_number: string | null;
    postal_code: string | null;
    city: string | null;
    country: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    updated_at: string;
  },
  logoUrl: string | null,
  defaultHourlyRate: string | null,
): TenantSettingsSnapshot {
  return {
    tenantId,
    name: row.name ?? '',
    legalName: (row.legal_name?.trim() || row.name) ?? '',
    street: row.street ?? '',
    houseNumber: row.house_number ?? '',
    zip: row.postal_code ?? '',
    city: row.city ?? '',
    country: row.country ?? 'Deutschland',
    phone: row.phone ?? '',
    email: row.email ?? '',
    website: row.website ?? '',
    logoUrl: logoUrl ?? '',
    assistDefaultHourlyRate: defaultHourlyRate ?? '',
    updatedAt: row.updated_at,
  };
}

function mapFormToTenantPatch(form: TenantSettingsForm): Database['public']['Tables']['tenants']['Update'] {
  return {
    name: form.name.trim(),
    legal_name: form.legalName.trim() || form.name.trim(),
    street: form.street.trim() || null,
    house_number: form.houseNumber.trim() || null,
    postal_code: form.zip.trim() || null,
    city: form.city.trim() || null,
    country: form.country.trim() || 'Deutschland',
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    website: form.website.trim() || null,
  };
}

async function fetchBillingSettings(
  tenantId: string,
): Promise<{ defaultHourlyRate: string | null; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { defaultHourlyRate: null, error: 'Supabase ist nicht konfiguriert.' };
  }

  const { data, error } = await client
    .from('tenant_billing_settings')
    .select('default_hourly_rate')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    return { defaultHourlyRate: null, error: toGermanSupabaseError(error) };
  }

  return {
    defaultHourlyRate: data?.default_hourly_rate != null
      ? formatHourlyRateDocumentAmount(data.default_hourly_rate)
      : null,
  };
}

async function saveBillingSettings(
  tenantId: string,
  assistDefaultHourlyRate: string,
): Promise<ServiceResult<null>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  }

  const parsedRate = parseHourlyRateEuro(assistDefaultHourlyRate);
  const { error } = await client
    .from('tenant_billing_settings')
    .upsert(
      {
        tenant_id: tenantId,
        default_hourly_rate: parsedRate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' },
    );

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: null };
}

async function fetchFromSupabase(tenantId: string): Promise<ServiceResult<TenantSettingsSnapshot>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  }

  const { data, error } = await client
    .from('tenants')
    .select(TENANT_COLUMNS)
    .eq('id', tenantId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }
  if (!data) {
    return { ok: false, error: 'Mandant nicht gefunden.' };
  }

  const { data: branding } = await client
    .from('tenant_branding')
    .select('logo_url')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const billing = await fetchBillingSettings(tenantId);
  if (billing.error) {
    return { ok: false, error: billing.error };
  }

  return {
    ok: true,
    data: mapRowToSnapshot(
      tenantId,
      data,
      branding?.logo_url ?? null,
      billing.defaultHourlyRate,
    ),
  };
}

async function saveToSupabase(
  tenantId: string,
  form: TenantSettingsForm,
  logo: TenantLogoValue,
): Promise<ServiceResult<TenantSettingsSnapshot>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  }

  const patch = mapFormToTenantPatch(form);
  const { data, error } = await client
    .from('tenants')
    .update(patch)
    .eq('id', tenantId)
    .select(TENANT_COLUMNS)
    .maybeSingle();

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }
  if (!data) {
    return { ok: false, error: 'Mandant konnte nicht gespeichert werden.' };
  }

  const logoResult = await resolveTenantLogoUrlForSave(
    tenantId,
    logo,
    form.logoUrl,
    true,
  );
  if (!logoResult.ok) return logoResult;

  const billingResult = await saveBillingSettings(tenantId, form.assistDefaultHourlyRate);
  if (!billingResult.ok) return billingResult;

  const logoUrl = logoResult.data;
  if (!logo.pending && !logo.removed) {
    const brandingResult = await client
      .from('tenant_branding')
      .upsert({ tenant_id: tenantId, logo_url: logoUrl }, { onConflict: 'tenant_id' });

    if (brandingResult.error) {
      return { ok: false, error: toGermanSupabaseError(brandingResult.error) };
    }
  }

  return {
    ok: true,
    data: mapRowToSnapshot(
      tenantId,
      data,
      logoUrl,
      formatHourlyRateDocumentAmount(parseHourlyRateEuro(form.assistDefaultHourlyRate)),
    ),
  };
}

export async function fetchTenantSettings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantSettingsSnapshot>> {
  const denied = enforcePermission<TenantSettingsSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (isLiveServiceMode()) {
    return fetchFromSupabase(tenantId);
  }

  return { ok: true, data: ensureDemoSnapshot(tenantId) };
}

export async function saveTenantSettings(
  tenantId: string,
  form: TenantSettingsForm,
  actorRoleKey?: RoleKey | null,
  logo?: TenantLogoValue,
): Promise<ServiceResult<TenantSettingsSnapshot>> {
  const denied = enforcePermission<TenantSettingsSnapshot>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!form.name.trim()) {
    return { ok: false, error: 'Firmenname ist erforderlich.' };
  }

  const logoState = logo ?? {
    displayUri: form.logoUrl.trim() || null,
    pending: null,
    removed: false,
  };

  if (isLiveServiceMode()) {
    return saveToSupabase(tenantId, form, logoState);
  }

  let logoUrl = form.logoUrl.trim();
  if (logoState.removed) {
    logoUrl = '';
  } else if (logoState.pending) {
    logoUrl = logoState.pending.localUri;
  } else if (logoState.displayUri?.trim()) {
    logoUrl = logoState.displayUri.trim();
  }

  const next: TenantSettingsSnapshot = {
    tenantId,
    ...form,
    logoUrl,
    updatedAt: new Date().toISOString(),
  };
  DEMO_STORE.set(tenantId, next);
  return { ok: true, data: next };
}

export function toTenantSettingsForm(snapshot: TenantSettingsSnapshot): TenantSettingsForm {
  const { tenantId: _tenantId, updatedAt: _updatedAt, ...form } = snapshot;
  return { ...EMPTY_TENANT_SETTINGS_FORM, ...form };
}

/** Nur für Tests — Demo-Store zurücksetzen. */
export function resetTenantSettingsStore(): void {
  DEMO_STORE.clear();
}

export function seedTenantSettingsForTest(
  tenantId: string,
  overrides?: Partial<TenantSettingsForm>,
): TenantSettingsSnapshot {
  const snapshot = buildDemoSnapshot(tenantId, overrides);
  DEMO_STORE.set(tenantId, snapshot);
  return snapshot;
}
