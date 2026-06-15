import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { TIConnectionStatusBadge, TISecurityNotice, TIProviderSettingsHero } from '@/components/ti';
import { ErrorState, LoadingState, PremiumButton, PremiumCard } from '@/components/ui';
import { useTIProviders } from '@/hooks/ti';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';

export function TIProviderSettingsScreen() {
  const { can, check, roleLabel } = usePermissions();
  const { providers, loading, error, refresh, checkingId, checkMessage, runConnectionCheck } =
    useTIProviders();

  if (!can('ti.view')) {
    return (
      <CareLightPageShell title="TI-Provider">
        <LockedActionBanner message={check('ti.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }

  if (loading && providers.length === 0) {
    return (
      <CareLightPageShell title="TI-Provider">
        <LoadingState message="Provider werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (error && providers.length === 0) {
    return (
      <CareLightPageShell title="TI-Provider">
        <ErrorState message={error} onRetry={refresh} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title="TI-Provider" subtitle="Konfiguration & Verbindung">
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.cyan} />}
        contentContainerStyle={styles.scroll}
      >
        <TIProviderSettingsHero
          providerCount={providers.length}
          connectedCount={providers.filter((p) =>
            ['provider_connected', 'ti_verified', 'kim_active'].includes(p.connectionStatus),
          ).length}
        />
        <TISecurityNotice compact />
        {checkMessage ? <Text style={styles.checkMsg}>{checkMessage}</Text> : null}
        {providers.map((p) => (
          <PremiumCard key={p.id} accentColor={colors.cyan}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.kind}>Typ: {p.kind.toUpperCase()}</Text>
            <TIConnectionStatusBadge status={p.connectionStatus} />
            {p.secretReference ? (
              <Text style={styles.secret}>Secret: {p.secretReference}</Text>
            ) : (
              <Text style={styles.secret}>Kein Secret konfiguriert</Text>
            )}
            {p.endpointUrl ? <Text style={styles.endpoint}>{p.endpointUrl}</Text> : null}
            {p.lastError ? <Text style={styles.error}>{p.lastError}</Text> : null}
            <PremiumButton
              title={checkingId === p.id ? 'Prüfe…' : 'Verbindung prüfen'}
              variant="secondary"
              disabled={!can('ti.provider.manage') || checkingId === p.id}
              onPress={() => runConnectionCheck(p.id)}
            />
          </PremiumCard>
        ))}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  name: { ...typography.bodyStrong },
  kind: { ...typography.caption, color: colors.textSecondary, marginVertical: spacing.xs },
  secret: { ...typography.caption, color: colors.cyan, marginTop: spacing.xs },
  endpoint: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.error },
  checkMsg: { ...typography.body, color: colors.success },
});
