import type { ServiceResult } from '@/types';
import type { AccessCredentialsReveal, RelativePortalCode } from '@/lib/auth/auth.types';
import { hashPortalCode, pickUniquePortalCode } from '@/lib/auth/portalCodeGenerator';
import { getServiceMode } from '@/lib/services/mode';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant } from '@/lib/clients/clientBackend';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import {
  getRelativePortalCodes,
  saveRelativePortalCode,
  setPortalCodeHash,
} from '@/lib/auth/demoAccessStore';
import { insertRelativePortalCode } from './accessManagementLiveRepository';

function createPortalCodeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function setupRelativePortalAccess(input: {
  tenantId: string;
  clientId: string;
  relativeContactId: string;
  createdBy?: string | null;
  expiresAt?: string | null;
}): Promise<ServiceResult<{ code: RelativePortalCode; credentials: AccessCredentialsReveal }>> {
  return runService(async () => {
    const plainCode = pickUniquePortalCode([]);
    const codeHash = await hashPortalCode(plainCode);

    if (getServiceMode() === 'supabase') {
      const result = await insertRelativePortalCode({
        tenantId: input.tenantId,
        clientId: input.clientId,
        relativeContactId: input.relativeContactId,
        codeHash,
        createdBy: input.createdBy ?? null,
        expiresAt: input.expiresAt ?? null,
      });
      if (!result.ok) return result;
      return {
        ok: true,
        data: {
          code: result.data,
          credentials: {
            portalCode: plainCode,
            expiresAt: result.data.expiresAt,
          },
        },
      };
    }

    const denied = assertDemoTenant(input.tenantId);
    if (denied) return denied;

    const tenantId = input.tenantId || DEMO_TENANT_ID;
    const now = new Date().toISOString();
    const code: RelativePortalCode = {
      id: createPortalCodeId('rpc'),
      tenantId,
      clientId: input.clientId,
      relativeContactId: input.relativeContactId,
      status: 'active',
      expiresAt: input.expiresAt ?? null,
      lastUsedAt: null,
      createdBy: input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
      blockedAt: null,
      blockedBy: null,
      blockedReason: null,
      regeneratedAt: null,
    };

    saveRelativePortalCode(code);
    await setPortalCodeHash(code.id, codeHash);

    return {
      ok: true,
      data: {
        code,
        credentials: {
          portalCode: plainCode,
          expiresAt: code.expiresAt,
        },
      },
    };
  }, { delayMs: getServiceMode() === 'supabase' ? 0 : 200 });
}

export async function listRelativeContactIdsForClient(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<Array<{ id: string; name: string }>>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: [] };
  }

  const { getSupabaseClient } = await import('@/lib/supabase/client');
  const { fromUnknownTable } = await import('@/lib/supabase/untypedTable');
  const { toGermanSupabaseError } = await import('@/lib/supabase/errors');

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

  const { data, error } = await fromUnknownTable(supabase, 'client_contacts')
    .select('id, first_name, last_name, contact_type')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .in('contact_type', ['angehoerige', 'relative', 'emergency_contact'])
    .order('first_name', { ascending: true });

  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
  return {
    ok: true,
    data: rows.map((row) => ({
      id: String(row.id ?? ''),
      name: `${String(row.first_name ?? '')} ${String(row.last_name ?? '')}`.trim() || 'Angehörige:r',
    })),
  };
}

export async function resolveDefaultRelativeContactId(
  tenantId: string,
  clientId: string,
): Promise<string | null> {
  const contacts = await listRelativeContactIdsForClient(tenantId, clientId);
  if (!contacts.ok || contacts.data.length === 0) return null;
  return contacts.data[0]?.id ?? null;
}

/** Demo helper — first relative code for tenant (legacy). */
export function listDemoRelativePortalCodes(tenantId: string): RelativePortalCode[] {
  return getRelativePortalCodes(tenantId);
}
