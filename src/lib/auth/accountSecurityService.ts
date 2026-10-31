import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { getActivePortalSession } from './portalSessionStore';
import type { Profile, RoleKey } from '@/types';
import { mapCanonicalRoleToRoleKey } from '@/lib/permissions/workspaceRoles';
import type { CanonicalWorkspaceRoleKey } from '@/types/permissions/workspace';

export type AccountSecurityState = { active: boolean; mfaRequired: boolean; aal: string; sessionId: string };
export type AccountDevice = { id: string; label: string; platform: string; lastSeenAt: string; current: boolean; revokedAt: string | null };
export { notificationEvents, defaultNotificationPreferences } from './accountSecurityPreferences';
export type { NotificationEvent, PersonalNotificationPreferences } from './accountSecurityPreferences';
import { notificationEvents, type NotificationEvent, type PersonalNotificationPreferences } from './accountSecurityPreferences';

function client() {
  const value = getSupabaseClient();
  if (!value) throw new Error('Die sichere Kontoverbindung ist derzeit nicht verfügbar.');
  return value;
}
type RpcResult = { data: unknown; error: { message?: string } | null };
async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const api = client() as unknown as { rpc: (name: string, params: Record<string, unknown>) => PromiseLike<RpcResult> };
  const call = api.rpc.bind(api);
  const result = await call(name, params);
  if (result.error) throw new Error('Die Kontoeinstellung konnte nicht bestätigt werden. Bitte erneut versuchen.');
  return result.data as T;
}
export async function readAccountSecurityState(): Promise<AccountSecurityState> {
  const state = await rpc<AccountSecurityState>('account_security_state');
  if (!state || typeof state.active !== 'boolean' || typeof state.mfaRequired !== 'boolean'
    || typeof state.aal !== 'string' || typeof state.sessionId !== 'string') throw new Error('Der sichere Sitzungsstatus ist unvollständig.');
  return state;
}
export async function readPendingMfaBootstrap(expectedUserId: string): Promise<Profile | null> {
  const data = await rpc<{ mfaRequired: boolean; aal: string; profile: Profile } | null>('account_security_bootstrap', { p_expected_user_id: expectedUserId });
  if (!data?.mfaRequired || data.aal === 'aal2' || !data.profile?.id || !data.profile.tenantId) return null;
  const role = String(data.profile.roleKey);
  const known: RoleKey[] = ['business_admin','business_manager','billing','dispatch','nurse','caregiver','counselor','akademie_admin','employee_portal','client_portal','family_portal'];
  const roleKey = known.includes(role as RoleKey) ? role as RoleKey : mapCanonicalRoleToRoleKey(role as CanonicalWorkspaceRoleKey);
  if (!roleKey) throw new Error('Die Kontorolle konnte nicht bestätigt werden.');
  return { ...data.profile, roleKey };
}
export async function registerCurrentAccountDevice(): Promise<void> {
  await rpc('account_security_register_device', {
    p_platform: Platform.OS,
    p_label: Platform.OS === 'web' ? 'CareSuite im Browser' : `CareSuite auf ${Platform.OS === 'android' ? 'Android' : 'iOS'}`,
    p_portal_session_token: getActivePortalSession()?.sessionToken ?? null,
  });
}
export async function listAccountDevices(): Promise<AccountDevice[]> {
  const value = await rpc<AccountDevice[]>('account_security_list_devices');
  if (!Array.isArray(value)) throw new Error('Die Geräteliste konnte nicht bestätigt werden.');
  return value;
}
export async function revokeAccountDevice(id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Die Gerätekennung ist ungültig.');
  const confirmed = await rpc<boolean>('account_security_revoke_device', { p_session_id: id });
  if (confirmed !== true) throw new Error('Die Abmeldung dieses Geräts konnte nicht bestätigt werden.');
}
export async function readPersonalNotificationPreferences(): Promise<PersonalNotificationPreferences> {
  const value = await rpc<Record<string, unknown>>('account_security_notification_preferences');
  return Object.fromEntries(Object.keys(notificationEvents).map(key => [key, typeof value?.[key] === 'boolean' ? value[key] : true])) as PersonalNotificationPreferences;
}
export async function savePersonalNotificationPreference(event: NotificationEvent, enabled: boolean): Promise<PersonalNotificationPreferences> {
  if (!Object.hasOwn(notificationEvents, event) || typeof enabled !== 'boolean') throw new Error('Die Benachrichtigungseinstellung ist ungültig.');
  const value = await rpc<PersonalNotificationPreferences>('account_security_notification_preferences', { p_event: event, p_enabled: enabled });
  if (value?.[event] !== enabled) throw new Error('Die gespeicherte Einstellung konnte nicht bestätigt werden.');
  return value;
}

/** Enrollment and challenge requests retain the account that started them. */
async function isolatedMfaClient(expectedUserId: string) {
  const current = await client().auth.getSession();
  const session = current.data.session;
  if (current.error || session?.user.id !== expectedUserId) throw new Error('Das angemeldete Konto hat sich geändert.');
  const config = getSupabaseConfig();
  const isolated = createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'caresuite-mfa-ephemeral' } });
  const initialized = await isolated.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (initialized.error) throw new Error('Bitte erneut anmelden, um die Sicherheitsprüfung zu starten.');
  return isolated;
}
export async function readMfaFactors(expectedUserId: string) {
  const isolated = await isolatedMfaClient(expectedUserId);
  const result = await isolated.auth.mfa.listFactors();
  if (result.error) throw new Error('Die zusätzlichen Anmeldefaktoren konnten nicht geladen werden.');
  return result.data.totp;
}
export async function enrollMfaFactor(expectedUserId: string) {
  const isolated = await isolatedMfaClient(expectedUserId);
  const result = await isolated.auth.mfa.enroll({ factorType: 'totp', issuer: 'CareSuite HealthOS', friendlyName: `CareSuite ${new Date().toISOString()}` });
  if (result.error) throw new Error('Der Authenticator konnte nicht eingerichtet werden. Bitte erneut versuchen.');
  // The installed Auth SDK prefixes the raw SVG with a data URI; SvgXml expects XML.
  const prefix = 'data:image/svg+xml;utf-8,';
  const qr = result.data.totp.qr_code;
  return { ...result.data, totp: { ...result.data.totp, qr_code: qr.startsWith(prefix) ? qr.slice(prefix.length) : qr } };
}
export async function verifyMfaFactor(expectedUserId: string, factorId: string, code: string): Promise<void> {
  if (!/^\d{6}$/.test(code)) throw new Error('Bitte den sechsstelligen Authenticator-Code eingeben.');
  const isolated = await isolatedMfaClient(expectedUserId);
  const challenge = await isolated.auth.mfa.challenge({ factorId });
  if (challenge.error) throw new Error('Die Sicherheitsprüfung konnte nicht gestartet werden.');
  const current = await client().auth.getSession();
  if (current.data.session?.user.id !== expectedUserId) throw new Error('Das angemeldete Konto hat sich geändert.');
  // Verify against the current client's authenticated session. The server binds
  // the factor/challenge to its owner; never import an isolated response's tokens.
  const result = await client().auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
  if (result.error) throw new Error('Der Code wurde nicht bestätigt. Bitte einen aktuellen Code versuchen.');
}
