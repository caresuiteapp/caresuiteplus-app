import type { ServiceResult } from '@/types/core/base';
import { getServiceMode } from '@/lib/services/mode';
import { platformRpc } from './platformSupabaseClient';
import { validatePlatformReason } from './platformCapabilities';
import type { PlatformAccountAccessAction, PlatformTenantAccessAction } from './platformAccessLifecycle';

type AccessRequest = { tenantId: string; expectedStatus: string; expectedUpdatedAt: string; confirmation?: string; reason: string };
type AccessResult = { message: string; status: string };
async function changeAccess(fn: string, input: AccessRequest, action: string, tenantUserId?: string): Promise<ServiceResult<AccessResult>> {
  const reasonError = validatePlatformReason(input.reason);
  if (reasonError) return { ok: false, error: reasonError };
  if (input.reason.trim().length > 1000) return { ok: false, error: 'Die Begründung darf höchstens 1.000 Zeichen enthalten.' };
  if (!input.expectedStatus || !input.expectedUpdatedAt || Number.isNaN(Date.parse(input.expectedUpdatedAt))) {
    return { ok: false, error: 'Der aktuelle Datenstand fehlt. Bitte die Akte neu laden.' };
  }
  if (getServiceMode() === 'demo') return { ok: false, error: 'In der Vorschau werden keine Unternehmen oder Konten verändert.' };
  let response;
  try { response = await platformRpc<AccessResult>(fn, {
    p_tenant_id: input.tenantId, ...(tenantUserId ? { p_tenant_user_id: tenantUserId } : {}),
    p_action: action, p_expected_status: input.expectedStatus, p_expected_updated_at: input.expectedUpdatedAt,
    p_confirmation: input.confirmation ?? null, p_reason: input.reason.trim(),
  }); } catch { return { ok: false, error: 'Die Verbindung wurde unterbrochen. Bitte vor einer erneuten Aktion die Akte neu laden.' }; }
  const { data, error } = response;
  if (error) return { ok: false, error: error.message };
  if (!data || typeof data.message !== 'string' || typeof data.status !== 'string') {
    return { ok: false, error: 'Die Änderung wurde nicht bestätigt. Bitte vor einer erneuten Aktion die Akte neu laden.' };
  }
  return { ok: true, data };
}
export function managePlatformTenantAccess(input: AccessRequest & { action: PlatformTenantAccessAction }) {
  return changeAccess('platform_manage_tenant_access', input, input.action);
}
export function managePlatformAccountAccess(input: AccessRequest & { tenantUserId: string; action: PlatformAccountAccessAction }) {
  return changeAccess('platform_manage_account_access', input, input.action, input.tenantUserId);
}
