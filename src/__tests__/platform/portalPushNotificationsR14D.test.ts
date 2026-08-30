import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('R14-D native portal push', () => {
  it('configures Android notification permission, plugin, icon and channel', () => {
    const config = read('app.config.ts');
    expect(config).toContain("'POST_NOTIFICATIONS'");
    expect(config).toContain("'expo-notifications'");
    expect(config).toContain("icon: './assets/android-icon-monochrome.png'");
    expect(config).toContain("defaultChannel: 'caresuite-important'");
    expect(config).toContain("googleServicesFile: './google-services.json'");
  });

  it('uses the immutable EAS project id to obtain an Expo token', () => {
    const service = read('src/lib/portal/portalPushNotifications.ts');
    expect(service).toContain('Constants.expoConfig?.extra?.eas?.projectId');
    expect(service).toContain('Constants.easConfig?.projectId');
    expect(service).toContain('Notifications.getExpoPushTokenAsync({ projectId: easProjectId })');
  });

  it('makes permission mandatory while keeping protected content off the lock screen', () => {
    const gate = read('src/components/portal/PortalPushRegistrationGate.tsx');
    const sender = read('supabase/functions/office-push-send/index.ts');
    expect(gate).toContain('Benachrichtigungen erforderlich');
    expect(gate).toContain('App-Einstellungen öffnen');
    expect(sender).toContain('Öffnen Sie CareSuite, um die geschützte Nachricht anzuzeigen.');
    expect(sender).not.toContain('body: broadcast.');
  });

  it('never exposes raw Firebase or Expo diagnostics in the portal UI', () => {
    const service = read('src/lib/portal/portalPushNotifications.ts');
    const gate = read('src/components/portal/PortalPushRegistrationGate.tsx');
    expect(service).toContain('toPortalPushUserMessage');
    expect(service).toContain("normalized.includes('firebaseapp')");
    expect(gate).not.toContain('Push-Verbindung wird wiederhergestellt');
    expect(gate).toContain('Benachrichtigungen werden eingerichtet');
  });

  it('registers tokens only after validating the active portal identity', () => {
    const fn = read('supabase/functions/portal-push-register/index.ts');
    expect(fn).toContain(".eq('auth_user_id', user.id)");
    expect(fn).toContain(".from('employee_portal_accounts')");
    expect(fn).toContain(".from('client_portal_access')");
    expect(fn).toContain(".from('relative_portal_codes')");
    expect(fn).toContain("{ onConflict: 'expo_push_token' }");
  });

  it('deactivates the device before destroying the authenticated session', () => {
    const auth = read('src/lib/auth/AuthProvider.tsx');
    const unregister = auth.indexOf('await unregisterPortalPushDeviceBeforeLogout()');
    const signOut = auth.indexOf('await supabaseSignOut()');
    expect(unregister).toBeGreaterThan(-1);
    expect(signOut).toBeGreaterThan(unregister);
  });

  it('lets Office opt in to push and exposes ticket results', () => {
    const modal = read('src/components/office/officebroadcastmodal.tsx');
    const service = read('src/lib/office/broadcastservice.ts');
    expect(modal).toContain('Zusätzlich als App-Push senden');
    expect(modal).toContain('System-Push:');
    expect(service).toContain("invokeEdgeFunction<{");
    expect(service).toContain("}>('office-push-send', { broadcastId })");
  });

  it('chunks sending, retries transient failures and records tickets', () => {
    const sender = read('supabase/functions/office-push-send/index.ts');
    expect(sender).toContain('chunks(devices, 100)');
    expect(sender).toContain('response.status !== 429');
    expect(sender).toContain(".from('office_push_deliveries')");
    expect(sender).toContain("'DeviceNotRegistered'");
  });

  it('reconciles Expo receipts and invalidates stale device tokens', () => {
    const receipts = read('supabase/functions/office-push-receipts/index.ts');
    expect(receipts).toContain('/api/v2/push/getReceipts');
    expect(receipts).toContain('15 * 60_000');
    expect(receipts).toContain("receipt_status: receipt.status");
    expect(receipts).toContain("enabled: false");
  });
});
