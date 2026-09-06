import { Platform } from 'react-native';
import { sensitiveAuthStorage } from '@/lib/security/sensitiveAuthStorage';
import { authenticatePortalFace } from './portalBiometricService';

export type RememberedPortalKind = 'employee' | 'client';
export type RememberedPortalLogin = {
  version: 1; kind: RememberedPortalKind; accountId: string; tenantId: string;
  username: string; secret: string;
};
export type RememberedPortalMetadata = Omit<RememberedPortalLogin, 'secret'>;
const key = (kind: RememberedPortalKind, part: string) => `caresuite.remembered-login.v1.${kind}.${part}`;
export const supportsRememberedPortalLogin = () => Platform.OS === 'android' || Platform.OS === 'ios';

export async function getRememberedPortalMetadata(kind: RememberedPortalKind): Promise<RememberedPortalMetadata | null> {
  if (!supportsRememberedPortalLogin()) return null;
  const raw = await sensitiveAuthStorage.getItem(key(kind, 'metadata'));
  if (!raw) return null;
  const item = JSON.parse(raw) as RememberedPortalMetadata;
  if (item.version !== 1 || item.kind !== kind || !item.accountId || !item.tenantId || !item.username) throw new Error('Gespeicherte Anmeldung ist unvollständig. Bitte normal anmelden.');
  return { version: 1, kind, accountId: item.accountId, tenantId: item.tenantId, username: item.username };
}
export async function saveRememberedPortalLogin(item: RememberedPortalLogin): Promise<void> {
  if (!supportsRememberedPortalLogin()) throw new Error('Speichern ist nur in der installierten App möglich.');
  if (!item.accountId || !item.tenantId || !item.username.trim() || !item.secret) throw new Error('Anmeldung ist unvollständig.');
  const authentication = await authenticatePortalFace();
  if (!authentication.ok) throw new Error(authentication.error);
  // Publish metadata only after the complete encrypted credential was written.
  await sensitiveAuthStorage.setItem(key(item.kind, 'credential'), JSON.stringify(item));
  const { secret: _secret, ...metadata } = item;
  await sensitiveAuthStorage.setItem(key(item.kind, 'metadata'), JSON.stringify(metadata));
}
export async function unlockRememberedPortalLogin(kind: RememberedPortalKind): Promise<RememberedPortalLogin> {
  if (!supportsRememberedPortalLogin()) throw new Error('Bitte normal anmelden.');
  const before = await getRememberedPortalMetadata(kind);
  if (!before) throw new Error('Keine Anmeldung gespeichert.');
  const authentication = await authenticatePortalFace();
  if (!authentication.ok) throw new Error(authentication.error);
  // Never load the secret before the operating system confirms the user.
  const raw = await sensitiveAuthStorage.getItem(key(kind, 'credential'));
  const after = await getRememberedPortalMetadata(kind);
  const item = raw ? JSON.parse(raw) as RememberedPortalLogin : null;
  if (!item || !after || after.accountId !== before.accountId || after.tenantId !== before.tenantId || item.accountId !== after.accountId || item.tenantId !== after.tenantId || item.kind !== kind || item.username !== after.username || !item.secret) throw new Error('Die gespeicherte Anmeldung hat sich geändert. Bitte normal anmelden.');
  return item;
}
export async function forgetRememberedPortalLogin(kind: RememberedPortalKind, accountId?: string): Promise<void> {
  if (!supportsRememberedPortalLogin()) return;
  if (accountId && (await getRememberedPortalMetadata(kind))?.accountId !== accountId) return;
  await sensitiveAuthStorage.removeItem(key(kind, 'metadata'));
  await sensitiveAuthStorage.removeItem(key(kind, 'credential'));
}
