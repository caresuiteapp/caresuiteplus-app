import type { ServiceResult } from '@/types';
import type { TIConsent } from '@/types/modules/ti';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';

const TABLE = 'ti_consents';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function mapRow(row: Record<string, unknown>): TIConsent {
  const ts = String(row.updated_at ?? row.created_at ?? new Date().toISOString());
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    scope: row.scope as TIConsent['scope'],
    status: row.status as TIConsent['status'],
    version: Number(row.version ?? 1),
    grantedAt: row.granted_at ? String(row.granted_at) : null,
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    grantedBy: row.granted_by ? String(row.granted_by) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    legalBasis: String(row.legal_basis ?? 'Art. 9 Abs. 2 lit. h DSGVO'),
    description: String(row.description ?? ''),
    createdAt: String(row.created_at ?? ts),
    updatedAt: ts,
  };
}

export const tiConsentsSupabaseRepository = {
  async list(tenantId: string): Promise<ServiceResult<TIConsent[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });

    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)) };
  },

  async updateStatus(
    tenantId: string,
    consentId: string,
    patch: Partial<Pick<TIConsent, 'status' | 'grantedAt' | 'grantedBy'>>,
  ): Promise<ServiceResult<TIConsent>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await supabase
      .from(TABLE)
      .update({
        status: patch.status,
        granted_at: patch.grantedAt,
        granted_by: patch.grantedBy,
      })
      .eq('tenant_id', tenantId)
      .eq('id', consentId)
      .select('*')
      .single();

    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: mapRow(data as Record<string, unknown>) };
  },
};
