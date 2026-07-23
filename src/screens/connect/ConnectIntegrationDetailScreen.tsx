import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ConnectPreparedBanner } from '@/components/connect';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, InfoBanner, PremiumButton } from '@/components/ui';
import { useConnectCatalog } from '@/hooks/useConnectCatalog';
import { usePermissions } from '@/hooks/usePermissions';
import {
  CONNECT_NO_DATA_TRANSFER,
  CONNECT_NOT_CONNECTED_LABEL,
  CONNECT_REQUIRES_PROVIDER,
  CONNECT_SECRETS_SERVER_SIDE,
  isConnectIntegrationExecutable,
} from '@/lib/connect';
import { CONNECT_READINESS_LABELS } from '@/types/modules/connect';
import { colors, spacing, typography } from '@/theme';

export function ConnectIntegrationDetailScreen() {
  const { category: categoryKey, integrationKey } = useLocalSearchParams<{
    category: string;
    integrationKey: string;
  }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const { getCategory, getIntegration } = useConnectCatalog();
  const category = categoryKey ? getCategory(categoryKey) : undefined;
  const integration =
    categoryKey && integrationKey ? getIntegration(categoryKey, integrationKey) : undefined;

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

  if (!category || !integration) {
    return (
      <ScreenShell title="Connect" subtitle="Schnittstelle">
        <EmptyState title="Nicht gefunden" message="Diese Connect-Schnittstelle existiert nicht." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={integration.label}
      subtitle={category.label}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <ConnectPreparedBanner />

        <InfoBanner
          variant="warning"
          title="Status"
          message={`${CONNECT_READINESS_LABELS[integration.readiness]} · ${CONNECT_NOT_CONNECTED_LABEL}`}
        />

        <Text style={styles.description}>{integration.description}</Text>

        <DetailInfoRow label="Kategorie" value={category.label} />
        <DetailInfoRow label="Anbindungsstatus" value={CONNECT_NOT_CONNECTED_LABEL} />
        <DetailInfoRow label="Reifegrad" value={CONNECT_READINESS_LABELS[integration.readiness]} />
        <DetailInfoRow label="Audit vorbereitet" value={integration.auditPrepared ? 'Ja' : 'Nein'} />

        {integration.requiresProvider ? (
          <InfoBanner title="Anbieter erforderlich" message={CONNECT_REQUIRES_PROVIDER} />
        ) : null}

        <InfoBanner title="Datenschutz" message={CONNECT_NO_DATA_TRANSFER} />
        <InfoBanner title="Sicherheit" message={CONNECT_SECRETS_SERVER_SIDE} />

        {integration.moduleHref ? (
          <PremiumButton
            title={integration.key === 'google_workspace' ? 'Google Workspace verwalten' : 'Zum CareSuite+ Modul'}
            variant="secondary"
            onPress={() => router.push(integration.moduleHref as never)}
          />
        ) : null}

        {integration.requiresProvider && can('connect.configure') ? (
          <PremiumButton
            title="Anbieter-Konfiguration (Admin)"
            variant="secondary"
            onPress={() => router.push('/business/connect/providers' as never)}
          />
        ) : null}

        {isConnectIntegrationExecutable(integration) ? (
          <Text style={styles.hint}>Ausführbar — Live-Freischaltung aktiv.</Text>
        ) : (
          <Text style={styles.hint}>
            Diese Schnittstelle kann derzeit nicht aktiviert oder verbunden werden.
          </Text>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  description: { ...typography.body, color: colors.textSecondary },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
