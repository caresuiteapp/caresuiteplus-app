import { MfaSettingsCard } from './MfaSettingsCard';
export { MfaSettingsCard } from './MfaSettingsCard';
import { accountSecurityStyles as styles } from './accountSecurityStyles';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { confirmAction } from '@/lib/platform/confirmAction';
import {
  registerCurrentAccountDevice, listAccountDevices, revokeAccountDevice,
  notificationEvents, readPersonalNotificationPreferences, savePersonalNotificationPreference,
  type AccountDevice, type NotificationEvent, type PersonalNotificationPreferences,
} from '@/lib/auth/accountSecurityService';
import { DeviceSyncStatusCard } from './DeviceSyncStatusCard';
import { DevicePermissionsCard } from './DevicePermissionsCard';

const message = (error: unknown) => error instanceof Error ? error.message : 'Die Aktion konnte nicht bestätigt werden. Bitte erneut versuchen.';

function AccountDevicesCard() {
  const { signOut } = useAuth();
  const active = useRef(true), lock = useRef(false);
  const [items, setItems] = useState<AccountDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { await registerCurrentAccountDevice(); const value = await listAccountDevices(); if (active.current) { setItems(value); setError(null); } }
    catch (cause) { if (active.current) setError(message(cause)); }
  }, []);
  useEffect(() => { active.current = true; void refresh(); return () => { active.current = false; }; }, [refresh]);
  return <View style={styles.card}>
    <Text style={styles.title}>Angemeldete Geräte</Text>
    <Text style={styles.text}>Beenden Sie den Zugang eines verlorenen oder nicht mehr verwendeten Geräts. Die Gerätebezeichnung stammt aus der jeweiligen Anmeldung.</Text>
    {items.map(item => <View key={item.id} style={styles.item}>
      <Text style={styles.label}>{item.label}{item.current ? ' · Dieses Gerät' : ''}</Text>
      <Text style={styles.text}>{item.platform} · Zuletzt aktiv: {new Date(item.lastSeenAt).toLocaleString('de-DE')}</Text>
      {item.revokedAt ? <Text style={styles.text}>Zugang beendet</Text> : <PremiumButton title={item.current ? 'Dieses Gerät abmelden' : 'Gerät abmelden'} variant="secondary" disabled={busy} onPress={() => {
        if (lock.current) return; lock.current = true; setBusy(true); setError(null);
        void (async () => {
          try {
            if (!await confirmAction({ title: 'Gerät abmelden', message: 'Die Anmeldung auf diesem Gerät wird beendet. Nicht übertragene lokale Eingaben können dort erst nach erneuter Anmeldung bearbeitet werden.', confirmLabel: 'Gerät abmelden', cancelLabel: 'Abbrechen' })) return;
            if (!active.current) return;
            await revokeAccountDevice(item.id);
            if (!active.current) return;
            if (item.current) await signOut(); else await refresh();
          } catch (cause) { if (active.current) setError(message(cause)); }
          finally { lock.current = false; if (active.current) setBusy(false); }
        })();
      }} />}
    </View>)}
    {!items.length && !error ? <Text style={styles.text}>Für dieses Konto sind noch keine Geräte bestätigt.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <PremiumButton title="Geräteliste aktualisieren" variant="secondary" disabled={busy} onPress={() => void refresh()} />
  </View>;
}
function PersonalNotificationsCard() {
  const active = useRef(true), lock = useRef(false);
  const [settings, setSettings] = useState<PersonalNotificationPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { const value = await readPersonalNotificationPreferences(); if (active.current) { setSettings(value); setError(null); } }
    catch (cause) { if (active.current) setError(message(cause)); }
  }, []);
  useEffect(() => { active.current = true; void refresh(); return () => { active.current = false; }; }, [refresh]);
  return <View style={styles.card}>
    <Text style={styles.title}>Ihre Benachrichtigungen</Text>
    <Text style={styles.text}>Wählen Sie die Ereignisse für dieses Konto. Zusätzlich gelten die Freigaben Ihres Unternehmens und die Benachrichtigungseinstellung Ihres Geräts. Inhalte bleiben in CareSuite verfügbar.</Text>
    {(Object.entries(notificationEvents) as [NotificationEvent, string][]).map(([event, title]) => <View key={event} style={styles.preference}>
      <Text style={[styles.text, styles.grow]}>{title}</Text>
      <Switch accessibilityLabel={title} value={settings?.[event] ?? false} disabled={!settings || busy} onValueChange={enabled => {
        if (lock.current) return; lock.current = true; setBusy(true); setError(null);
        void savePersonalNotificationPreference(event, enabled).then(value => { if (active.current) setSettings(value); })
          .catch(cause => { if (active.current) setError(message(cause)); })
          .finally(() => { lock.current = false; if (active.current) setBusy(false); });
      }} />
    </View>)}
    {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><PremiumButton title="Benachrichtigungseinstellungen erneut laden" variant="secondary" onPress={() => void refresh()} /></> : null}
  </View>;
}
export function AccountSecurityCenter() {
  const { user, profile, portalSession } = useAuth();
  if (!user) return null;
  return <View key={`${user.id}:${profile?.tenantId}:${portalSession?.accountId}`} style={styles.stack}>
    <MfaSettingsCard />
    <AccountDevicesCard />
    <PersonalNotificationsCard />
    <DevicePermissionsCard />
    <DeviceSyncStatusCard />
  </View>;
}
