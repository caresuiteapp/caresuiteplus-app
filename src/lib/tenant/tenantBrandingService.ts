import type { ServiceResult } from '@/types';
import type { TenantBrandingProfile } from '@/types/tenant/tenantCenter';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import {
  persistTenantLogoUrl,
  resolveTenantLogoUrlForSave,
  type TenantLogoValue,
} from '@/lib/tenant/tenantLogoService';
import { guardServiceTenant, isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { enforcePermission } from '@/lib/permissions';
import type { RoleKey } from '@/types';
import { TENANT_SETTINGS_PERMISSION } from './tenantSettingsRoute';

const logoUrlByTenantId = new Map<string, string>();

export function getCachedTenantBrandingLogoUrl(tenantId: string): string | undefined {
  return logoUrlByTenantId.get(tenantId);
}

export function setCachedTenantBrandingLogoUrl(tenantId: string, logoUrl: string): void {
  logoUrlByTenantId.set(tenantId, logoUrl.trim());
}

export async function saveTenantBrandingProfile(
  tenantId: string,
  profile: TenantBrandingProfile,
  logo: TenantLogoValue,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantBrandingProfile>> {
  const denied = enforcePermission<TenantBrandingProfile>(actorRoleKey, TENANT_SETTINGS_PERMISSION);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const logoResult = await resolveTenantLogoUrlForSave(
    tenantId,
    logo,
    profile.logoUrl,
    isLiveServiceMode(),
  );
  if (!logoResult.ok) return logoResult;

  const nextLogoUrl = logoResult.data;

  if (!isLiveServiceMode()) {
    setCachedTenantBrandingLogoUrl(tenantId, nextLogoUrl ?? '');
    return {
      ok: true,
      data: {
        ...profile,
        logoUrl: nextLogoUrl ?? '',
      },
    };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase ist nicht konfiguriert.' };

  const { error } = await client.from('tenant_branding').upsert(
    {
      tenant_id: tenantId,
      logo_url: nextLogoUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id' },
  );

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  if (nextLogoUrl !== profile.logoUrl.trim()) {
    await persistTenantLogoUrl(tenantId, nextLogoUrl);
  }

  setCachedTenantBrandingLogoUrl(tenantId, nextLogoUrl ?? '');

  return {
    ok: true,
    data: {
      ...profile,
      logoUrl: nextLogoUrl ?? '',
    },
  };
}

export async function fetchTenantBrandingLogoUrl(tenantId: string): Promise<string> {
  const cached = logoUrlByTenantId.get(tenantId);
  if (cached !== undefined) return cached;

  const client = getSupabaseClient();
  if (!client) return '';

  const { data } = await client.from('tenant_branding').select('logo_url').eq('tenant_id', tenantId).maybeSingle();
  const logoUrl = (data?.logo_url ?? '').trim();
  logoUrlByTenantId.set(tenantId, logoUrl);
  return logoUrl;
}
