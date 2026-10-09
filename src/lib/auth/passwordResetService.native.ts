import type { ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
export { readBusinessRecoveryToken } from './businessRecoveryToken';
export async function fetchPasswordResetInfo() { return { ok: true as const, data: { channel: 'supabase_email' as const, message: 'Die Wiederherstellung erfolgt mit einer einmaligen CareSuite-Systemmail für Ihr Verwaltungskonto.' } }; }
export async function requestBusinessPasswordReset(contact: string): Promise<ServiceResult<{ message: string; bridgePath?: string }>> {
  const email = contact.trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254) return { ok: false, error: 'Bitte eine gültige Verwaltungs-E-Mail eingeben.' };
  if (getServiceMode() !== 'supabase') return { ok: false, error: 'Die Wiederherstellung ist momentan nicht verfügbar. Bitte nutzen Sie den öffentlichen Support.' };
  const result = await invokeEdgeFunction<{ message: string }>('business-password-recovery', { action: 'request', email, delivery: 'native' });
  if (!result.ok) return result;
  if (typeof result.data.message !== 'string') return { ok: false, error: 'Die Anfrage konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.' };
  return { ok: true, data: { message: result.data.message, bridgePath: '/auth/reset-password' } };
}
export async function completeBusinessPasswordReset(tokenHash: string, password: string, confirmPassword: string): Promise<ServiceResult<null>> {
  if (!/^[a-zA-Z0-9_-]{32,128}$/.test(tokenHash) || password.length < 10 || password.length > 128 || password !== confirmPassword) return { ok: false, error: 'Bitte zwei übereinstimmende Passwörter mit 10 bis 128 Zeichen eingeben.' };
  const result = await invokeEdgeFunction<{ ok: boolean }>('business-password-recovery', { action: 'complete', tokenHash, password, confirmPassword });
  if (!result.ok) return result;
  return result.data.ok === true ? { ok: true, data: null } : { ok: false, error: 'Die Passwortänderung konnte nicht bestätigt werden. Bitte fordern Sie einen neuen Link an.' };
}
