import type { RoleKey, ServiceResult } from '@/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { fetchClientEditData } from '@/lib/clients/clientEditService';
import { mapClientEditLoadToIntakeForm } from '@/lib/clients/clientIntakeFormMappers';
import { mergeIntakeFormWithDefaults } from '@/lib/clients/clientIntakeDraftStorage';
import { isDemoClientBackend } from '@/lib/clients/clientBackend';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

async function fetchAmbulatoryHomeAccess(
  tenantId: string,
  clientId: string,
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = await fromUnknownTable(supabase, 'client_ambulatory_details')
    .select('home_access')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!data || typeof data !== 'object' || !('home_access' in data)) return null;
  const value = (data as { home_access?: string | null }).home_access;
  return typeof value === 'string' ? value : null;
}

/** Loads an existing client into intake wizard form defaults for edit mode. */
export async function fetchClientIntakeEditData(
  clientId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ClientIntakeFormData>> {
  if (isDemoClientBackend()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDemoClientIntakeRecord } = require('@/data/demo/clients/intakeRecords');
    const demoRecord = getDemoClientIntakeRecord(clientId);
    if (demoRecord) {
      return { ok: true, data: mergeIntakeFormWithDefaults(demoRecord) };
    }
  }

  const editResult = await fetchClientEditData(clientId, tenantId, actorRoleKey);
  if (!editResult.ok) return editResult;

  const ambulatoryHomeAccess = isDemoClientBackend()
    ? null
    : await fetchAmbulatoryHomeAccess(tenantId, clientId);

  return {
    ok: true,
    data: mapClientEditLoadToIntakeForm({
      ...editResult.data,
      ambulatoryHomeAccess,
    }),
  };
}
