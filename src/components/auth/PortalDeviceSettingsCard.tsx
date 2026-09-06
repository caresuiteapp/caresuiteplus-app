import { useEffect, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PremiumButton } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { forgetRememberedPortalLogin, getRememberedPortalMetadata } from '@/lib/auth/rememberedPortalLogin';
import { ensurePortalPushRegistration } from '@/lib/portal/portalPushNotifications';
import { portalPremium } from '@/design/tokens/portalPremium';
export function PortalDeviceSettingsCard() {
  const { portalSession } = useAuth();
  const { pushUpdate } = useLocalSearchParams<{ pushUpdate?: string }>();
  const kind = portalSession?.roleKey === 'employee_portal' ? 'employee' : 'client';
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { let active = true; void getRememberedPortalMetadata(kind).then(value => { if (active) setSaved(value?.accountId === portalSession?.accountId); }).catch(() => {}); return () => { active = false; }; }, [kind, portalSession?.accountId]);
  if (Platform.OS === 'web' || !portalSession) return null;
  return <View style={{ gap: 12, padding: 18, backgroundColor: '#FFF', borderColor: portalPremium.borderStrong, borderWidth: 1, borderRadius: 18 }}>
    <Text style={{ color: portalPremium.text.primary, fontSize: 20, lineHeight: 28, fontWeight: '800' }}>Anmeldung und Benachrichtigungen</Text>
    <Text style={{ color: portalPremium.text.secondary, fontSize: 16, lineHeight: 24 }}>Neue Einsätze, Nachrichten, Dokumente und offene Unterschriften: Erlauben Sie CareSuite die Benachrichtigungen in den Geräteeinstellungen.</Text>
    <PremiumButton title="Benachrichtigungen einrichten / prüfen" loading={busy} onPress={() => { if (busy) return; setBusy(true); void ensurePortalPushRegistration(true).then(result => setMessage(result.ok ? 'Dieses Gerät ist für Benachrichtigungen registriert.' : result.error)).finally(() => setBusy(false)); }} />
    <PremiumButton title="App-Einstellungen öffnen" variant="secondary" onPress={() => { void Linking.openSettings().catch(() => setMessage('Geräteeinstellungen konnten nicht geöffnet werden.')); }} />
    {saved ? <PremiumButton title="Gespeicherte Anmeldung von diesem Gerät entfernen" variant="secondary" onPress={() => { void forgetRememberedPortalLogin(kind, portalSession.accountId).then(() => { setSaved(false); setMessage('Gespeicherte Anmeldung entfernt. Ihr Konto bleibt bestehen.'); }).catch(() => setMessage('Entfernen fehlgeschlagen. Bitte erneut versuchen.')); }} /> : <Text style={{ color: portalPremium.text.secondary }}>Zum Speichern wählen Sie bei der nächsten Anmeldung „Anmeldung auf diesem Gerät geschützt speichern“.</Text>}
    {pushUpdate ? <Text style={{ color: portalPremium.text.primary }}>Ein App-Update wurde angekündigt. Prüfen Sie in Google Play, ob es für Ihr Gerät verfügbar ist.</Text> : null}
    {Platform.OS === 'android' ? <PremiumButton title="CareSuite in Google Play öffnen" variant="secondary" onPress={() => { void Linking.openURL('https://play.google.com/store/apps/details?id=app.caresuitehealthos').catch(() => setMessage('Google Play konnte nicht geöffnet werden.')); }} /> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: portalPremium.text.primary }}>{message}</Text> : null}
  </View>;
}
