import type { RoleKey, ServiceResult } from '@/types';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { enforceQmPermission, QM_VIEW } from './qmPermissions';
import { fetchQmHandbook } from './qmHandbookService';
import { HANDBOOK_LIVE_SELECT_COLUMNS, mapHandbookRowToDetail, type QmHandbookLiveRow } from './qmHandbookMapper';
import type { QmHandbook } from './qm.types';

/** A successful empty SELECT is a normal unconfigured handbook, not a connection error. */
export async function fetchOptionalQmHandbook(tenantId: string, role: RoleKey | null): Promise<ServiceResult<QmHandbook | null>> {
  const denied = enforceQmPermission<QmHandbook | null>(role, QM_VIEW);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() === 'demo') return fetchQmHandbook(tenantId, role);
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: 'Die Verbindung zum QM-Handbuch ist nicht verfügbar.' };
  const { data, error } = await fromUnknownTable(client, 'qm_handbooks').select(HANDBOOK_LIVE_SELECT_COLUMNS)
    .eq('tenant_id', tenantId).eq('status', 'active').order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  if (data === null) return { ok: true, data: null };
  return mapHandbookRowToDetail(data as QmHandbookLiveRow);
}
