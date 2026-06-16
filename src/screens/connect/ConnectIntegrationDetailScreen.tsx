import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ConnectPreparedBanner,
  ConnectPrivacyWarning,
  ConnectSandboxBanner,
} from '@/components/connect';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  InfoBanner,
  PremiumButton,
  SegmentedTabs,
  type TabOption,
} from '@/components/ui';
import { useConnectDashboard } from '@/hooks/useConnectDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import {
  CONNECT_DISPLAY_STATUS_LABELS,
  canActivateConnectIntegration,
  isConnectDisplayedAsActive,
} from '@/lib/connect/connectPresentation';
import {
  CONNECT_NO_DATA_TRANSFER,
  CONNECT_NOT_CONNECTED_LABEL,
  CONNECT_SECRETS_SERVER_SIDE,
  isConnectIntegrationExecutable,
} from '@/lib/connect';
import { maskConnectCredentialReference } from '@/lib/connect/gateway';
import { getActionAvailability } from '@/lib/ui/actionAvailability';
import { colors, spacing, typography } from '@/theme';

const DETAIL_TABS: TabOption[] = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'capabilities', label: 'Funktionen' },
  { key: 'config', label: 'Konfiguration' },
  { key: 'permissions', label: 'Datenfreigaben' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'sync', label: 'Synchronisation' },
  { key: 'audit', label: 'Audit' },
  { key: 'privacy', label: 'Datenschutz' },
  { key: 'costs', label: 'Kosten' },
];

export function ConnectIntegrationDetailScreen() {
  const { category: categoryKey, integrationKey } = useLocalSearchParams<{
    category: string;
    integrationKey: string;
  }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const { getIntegrationView } = useConnectDashboard();
  const [activeTab, setActiveTab] = useState('overview');
  const view =
    categoryKey && integrationKey ? getIntegrationView(categoryKey, integrationKey) : null;

  if (!can('connect.view')) {
    return (
      <ScreenShell title="Connect" subtitle={roleLabel ?? 'Betrieb'}>
        <LockedActionBanner
          message={check('connect.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (!view) {
    return (
      <ScreenShell title="Connect" subtitle="Schnittstelle">
        <EmptyState title="Nicht gefunden" message="Diese Connect-Schnittstelle existiert nicht." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  const { integration, placeholder, displayStatus, compliance } = view;
  const canConfigure = can('connect.configure');
  const activatable = canActivateConnectIntegration(integration, canConfigure);
  const activateAvailability = getActionAvailability('connect.activate', {
    isComingSoon: integration.readiness === 'coming_soon',
    hasProvider: activatable,
    canExecute: false,
  });
  const maskedVault = maskConnectCredentialReference(placeholder?.vaultReference);

  return (
    <ScreenShell
      title={integration.label}
      subtitle={CONNECT_DISPLAY_STATUS_LABELS[displayStatus]}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <ConnectPreparedBanner />
        <ConnectSandboxBanner status={displayStatus} />
        <ConnectPrivacyWarning compliance={compliance} />

        <SegmentedTabs tabs={DETAIL_TABS} activeKey={activeTab} onSelect={setActiveTab} />

        {activeTab === 'overview' ? (
          <View style={styles.panel}>
            <InfoBanner
              variant="warning"
              title="Anbindungsstatus"
              message={
                isConnectDisplayedAsActive(displayStatus)
                  ? CONNECT_DISPLAY_STATUS_LABELS[displayStatus]
                  : `${CONNECT_NOT_CONNECTED_LABEL} · ${CONNECT_DISPLAY_STATUS_LABELS[displayStatus]}`
              }
            />
            <Text style={styles.description}>{integration.description}</Text>
            <DetailInfoRow label="Vault-Referenz" value={maskedVault} />
            <DetailInfoRow label="Audit vorbereitet" value={integration.auditPrepared ? 'Ja' : 'Nein'} />
          </View>
        ) : null}

        {activeTab === 'capabilities' ? (
          <View style={styles.panel}>
            <Text style={styles.panelText}>
              Funktionen sind im Connect-Gateway vorbereitet. Keine produktive Ausführung ohne
              Freischaltung.
            </Text>
            <DetailInfoRow label="Ausführbar" value={isConnectIntegrationExecutable(integration) ? 'Ja' : 'Nein'} />
          </View>
        ) : null}

        {activeTab === 'config' ? (
          <View style={styles.panel}>
            {canConfigure ? (
              <>
                <InfoBanner title="Admin-Konfiguration" message={CONNECT_SECRETS_SERVER_SIDE} />
                <PremiumButton
                  title="Konfiguration öffnen"
                  variant="secondary"
                  onPress={() =>
                    router.push(
                      `/business/connect/${categoryKey}/${integrationKey}/configure` as never,
                    )
                  }
                />
              </>
            ) : (
              <LockedActionBanner
                message={check('connect.configure').reason ?? 'Nur für Administratoren.'}
                roleLabel={roleLabel}
              />
            )}
          </View>
        ) : null}

        {activeTab === 'permissions' ? (
          <View style={styles.panel}>
            <Text style={styles.panelText}>
              Datenfreigaben werden mandantenspezifisch pro Kategorie festgelegt. Derzeit keine
              aktiven Freigaben.
            </Text>
            <ConnectPrivacyWarning compliance={compliance} compact />
          </View>
        ) : null}

        {activeTab === 'webhooks' ? (
          <View style={styles.panel}>
            <Text style={styles.panelText}>Webhook-Empfang ist vorbereitet (payload_hash only).</Text>
            <DetailInfoRow label="Eingehende Events" value="0" />
          </View>
        ) : null}

        {activeTab === 'sync' ? (
          <View style={styles.panel}>
            <DetailInfoRow label="Letzte Synchronisation" value="Keine" />
            <DetailInfoRow label="Sync-Jobs" value="0" />
          </View>
        ) : null}

        {activeTab === 'audit' ? (
          <View style={styles.panel}>
            <Text style={styles.panelText}>
              Audit-Ereignisse werden über connect_audit_events protokolliert (Vorbereitung).
            </Text>
          </View>
        ) : null}

        {activeTab === 'privacy' ? (
          <View style={styles.panel}>
            <ConnectPrivacyWarning compliance={compliance} />
            <InfoBanner title="Datenübertragung" message={CONNECT_NO_DATA_TRANSFER} />
            {compliance.requiresAvv ? (
              <InfoBanner title="AVV" message="Auftragsverarbeitungsvertrag vor produktiver Nutzung erforderlich." />
            ) : null}
          </View>
        ) : null}

        {activeTab === 'costs' ? (
          <View style={styles.panel}>
            <Text style={styles.panelText}>
              Kosten- und Provisionsmodelle werden im Partner-Marktplatz gepflegt — derzeit nicht
              aktiv.
            </Text>
          </View>
        ) : null}

        {integration.moduleHref ? (
          <PremiumButton
            title="Zum CareSuite+ Modul"
            variant="secondary"
            onPress={() => router.push(integration.moduleHref as never)}
          />
        ) : null}

        <PremiumButton
          title="Aktivieren"
          variant={activateAvailability.isPreparedOnly ? 'prepared' : 'primary'}
          disabled={!activateAvailability.enabled}
        />
        {activateAvailability.disabledReason ? (
          <Text style={styles.hint}>{activateAvailability.disabledReason}</Text>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  panel: { gap: spacing.sm },
  panelText: { ...typography.body, color: colors.textSecondary },
  description: { ...typography.body, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
