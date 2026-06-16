import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ConnectPreparedBanner, ConnectPrivacyWarning } from '@/components/connect';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { InfoBanner, PremiumButton, PremiumCard, SuccessState } from '@/components/ui';
import { useConnectDashboard } from '@/hooks/useConnectDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import {
  CONNECT_NO_DATA_TRANSFER,
  CONNECT_SECRETS_SERVER_SIDE,
} from '@/lib/connect';
import { maskConnectCredentialReference } from '@/lib/connect/gateway';
import { colors, spacing, typography } from '@/theme';

export function ConnectProviderConfigureScreen() {
  const { category: categoryKey, integrationKey } = useLocalSearchParams<{
    category: string;
    integrationKey: string;
  }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const { getIntegrationView } = useConnectDashboard();
  const view =
    categoryKey && integrationKey ? getIntegrationView(categoryKey, integrationKey) : null;

  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyStored, setApiKeyStored] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [oauthStatus] = useState('Nicht verbunden');
  const [saved, setSaved] = useState(false);

  if (!can('connect.configure')) {
    return (
      <ScreenShell title="Konfiguration" subtitle={roleLabel ?? 'Betrieb'}>
        <LockedActionBanner
          message={check('connect.configure').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (!view) {
    return (
      <ScreenShell title="Konfiguration" subtitle="Connect">
        <InfoBanner title="Fehler" message="Schnittstelle nicht gefunden." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  const { integration, compliance } = view;

  const handleSaveKey = () => {
    if (apiKeyInput.trim().length >= 8) {
      setApiKeyStored(true);
      setApiKeyInput('');
      setSaved(true);
    }
  };

  return (
    <ScreenShell title={`Konfiguration: ${integration.label}`} subtitle="Nur Admin">
      <ScrollView contentContainerStyle={styles.scroll}>
        <ConnectPreparedBanner />
        <ConnectPrivacyWarning compliance={compliance} />
        <InfoBanner title="Sicherheit" message={CONNECT_SECRETS_SERVER_SIDE} />
        <InfoBanner title="Datenübertragung" message={CONNECT_NO_DATA_TRANSFER} />

        {saved ? <SuccessState message="Konfiguration gespeichert (Vorbereitung — kein Live-Sync)." /> : null}

        <PremiumCard accentColor={colors.cyanSoft}>
          <Text style={styles.label}>Umgebung</Text>
          <View style={styles.row}>
            <PremiumButton
              title="Sandbox"
              size="sm"
              variant={environment === 'sandbox' ? 'primary' : 'secondary'}
              onPress={() => setEnvironment('sandbox')}
            />
            <PremiumButton
              title="Production"
              size="sm"
              variant={environment === 'production' ? 'primary' : 'secondary'}
              onPress={() => setEnvironment('production')}
              disabled
            />
          </View>
          <Text style={styles.hint}>Produktivumgebung ist derzeit gesperrt.</Text>
        </PremiumCard>

        <PremiumCard accentColor={colors.cyanSoft}>
          <Text style={styles.label}>API-Zugangsdaten</Text>
          {apiKeyStored ? (
            <Text style={styles.meta}>
              Hinterlegt: {maskConnectCredentialReference('vault/connect/stored-ref')}
            </Text>
          ) : (
            <>
              <Text style={styles.hint}>
                Schlüssel wird nur einmal übermittelt und nicht wieder angezeigt.
              </Text>
              {/* TextInput would go here — using button placeholder for RN web compat */}
              <PremiumButton
                title={apiKeyInput ? 'Schlüssel speichern' : 'Schlüssel eingeben (Demo)'}
                variant="secondary"
                onPress={() => {
                  if (!apiKeyInput) setApiKeyInput('demo-key-input');
                  else handleSaveKey();
                }}
              />
            </>
          )}
        </PremiumCard>

        <PremiumCard accentColor={colors.cyanSoft}>
          <Text style={styles.label}>OAuth</Text>
          <Text style={styles.meta}>Status: {oauthStatus}</Text>
        </PremiumCard>

        <PremiumCard accentColor={colors.cyanSoft}>
          <Text style={styles.label}>Webhook URL</Text>
          <PremiumButton
            title={webhookUrl || 'Webhook URL setzen (Vorbereitung)'}
            variant="ghost"
            size="sm"
            onPress={() => setWebhookUrl('https://caresuiteplus.app/api/connect/webhook/stub')}
          />
        </PremiumCard>

        <PremiumButton title="Testverbindung" variant="secondary" disabled />
        <PremiumButton title="Deaktivieren" variant="ghost" disabled />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  label: { ...typography.bodyStrong, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
});
