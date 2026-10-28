import { AccountSecurityCenter } from './AccountSecurityCenter';
import { portalBackgroundRefreshStatus } from '@/lib/offline/portalBackgroundRefresh';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PremiumButton } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import {
  forgetRememberedPortalLogin,
  getRememberedPortalMetadata,
} from '@/lib/auth/rememberedPortalLogin';
import { ensurePortalPushRegistration, toPortalPushUserMessage } from '@/lib/portal/portalPushNotifications';
import { portalPremium } from '@/design/tokens/portalPremium';
export function PortalDeviceSettingsCard() {
  const { portalSession } = useAuth();
  return <PortalDeviceSettingsContent key={JSON.stringify([portalSession?.tenantId, portalSession?.accountId, portalSession?.roleKey])} />;
}

function PortalDeviceSettingsContent() {
  const registrationLock = useRef(false);
  const { portalSession } = useAuth();
  const { pushUpdate } = useLocalSearchParams<{ pushUpdate?: string }>();
  const kind = portalSession?.roleKey === 'employee_portal' ? 'employee' : 'client';
  const [background, setBackground] = useState<'available' | 'restricted' | 'unsupported'>(
    'unsupported',
  );
  useEffect(() => {
    let active = true;
    void portalBackgroundRefreshStatus().then((value) => {
      if (active) setBackground(value);
    }).catch(() => { if (active) setBackground('restricted'); });
    return () => {
      active = false;
    };
  }, []);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getRememberedPortalMetadata(kind)
      .then((value) => {
        if (active) setSaved(value?.accountId === portalSession?.accountId);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [kind, portalSession?.accountId]);
  if (!portalSession) return null;
  if (Platform.OS === 'web') return <AccountSecurityCenter />;
  return (
    <View
      style={{
        gap: 12,
        padding: 18,
        backgroundColor: '#FFF',
        borderColor: portalPremium.borderStrong,
        borderWidth: 1,
        borderRadius: 18,
      }}
    >
      <Text
        style={{
          color: portalPremium.text.primary,
          fontSize: 20,
          lineHeight: 28,
          fontWeight: '800',
        }}
      >
        Anmeldung und Benachrichtigungen
      </Text>
      <Text style={{ color: portalPremium.text.secondary, fontSize: 16, lineHeight: 24 }}>
        Neue Einsätze, Nachrichten, Dokumente und offene Unterschriften: Erlauben Sie CareSuite die
        Benachrichtigungen in den Geräteeinstellungen.
      </Text>
      <PremiumButton
        title="Benachrichtigungen einrichten / prüfen"
        loading={busy}
        onPress={() => {
          if (registrationLock.current) return;
          registrationLock.current = true;
          setBusy(true);
          void ensurePortalPushRegistration(true)
            .then((result) =>
              setMessage(
                result.ok ? 'Dieses Gerät ist für Benachrichtigungen registriert.' : result.error,
              ),
            )
            .catch((cause) => setMessage(toPortalPushUserMessage(cause)))
            .finally(() => { registrationLock.current = false; setBusy(false); });
        }}
      />
      <PremiumButton
        title="App-Einstellungen öffnen"
        variant="secondary"
        onPress={() => {
          void Linking.openSettings().catch(() =>
            setMessage('Geräteeinstellungen konnten nicht geöffnet werden.'),
          );
        }}
      />
      {saved ? (
        <PremiumButton
          title="Gespeicherte Anmeldung von diesem Gerät entfernen"
          variant="secondary"
          onPress={() => {
            void forgetRememberedPortalLogin(kind, portalSession.accountId)
              .then(() => {
                setSaved(false);
                setMessage('Gespeicherte Anmeldung entfernt. Ihr Konto bleibt bestehen.');
              })
              .catch(() => setMessage('Entfernen fehlgeschlagen. Bitte erneut versuchen.'));
          }}
        />
      ) : (
        <Text style={{ color: portalPremium.text.secondary }}>
          Zum Speichern wählen Sie bei der nächsten Anmeldung „Anmeldung auf diesem Gerät geschützt
          speichern“.
        </Text>
      )}
      {pushUpdate ? (
        <Text style={{ color: portalPremium.text.primary }}>
          Ein App-Update wurde angekündigt. Prüfen Sie in Google Play, ob es für Ihr Gerät verfügbar
          ist.
        </Text>
      ) : null}
      {Platform.OS === 'android' ? (
        <PremiumButton
          title="CareSuite in Google Play öffnen"
          variant="secondary"
          onPress={() => {
            void Linking.openURL(
              'https://play.google.com/store/apps/details?id=app.caresuitehealthos',
            ).catch(() => setMessage('Google Play konnte nicht geöffnet werden.'));
          }}
        />
      ) : null}
      <AccountSecurityCenter />
      <Text style={{ color: portalPremium.text.primary, fontSize: 18, fontWeight: '700' }}>
        Einsätze schneller öffnen
      </Text>
      <Text style={{ color: portalPremium.text.secondary, fontSize: 16, lineHeight: 24 }}>
        Geladene Einsätze werden auf diesem Gerät geschützt gespeichert und beim Öffnen im
        Hintergrund aktualisiert. Eigene Entwürfe bleiben erhalten.
      </Text>
      <Text style={{ color: portalPremium.text.secondary }}>
        {background === 'available'
          ? 'Aktualisierungen bei geschlossener App sind eingerichtet. Android bestimmt den Zeitpunkt abhängig von Verbindung und Akku.'
          : 'Aktualisierung beim Öffnen ist aktiv. Hintergrundaufgaben können durch die Geräteeinstellungen eingeschränkt sein.'}
      </Text>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={{ color: portalPremium.text.primary }}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}
