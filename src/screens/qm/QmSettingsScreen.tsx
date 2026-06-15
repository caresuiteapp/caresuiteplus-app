import { ScrollView, StyleSheet, Text } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { QmSettingsHero } from '@/components/qm';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumCard } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchQmSettingsSnapshot } from '@/lib/qm/qmSettingsService';
import { colors, spacing, typography } from '@/theme';

export function QmSettingsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchQmSettingsSnapshot(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (!can('qm.manage_settings')) {
    return (
      <CareLightPageShell title="QM-Einstellungen" showBack>
        <LockedActionBanner message={check('qm.manage_settings').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="QM-Einstellungen" showBack>
        <LoadingState message="Einstellungen werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="QM-Einstellungen" showBack>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  const settings = query.data;

  if (!settings) {
    return (
      <CareLightPageShell title="QM-Einstellungen" showBack>
        <EmptyState title="Keine Einstellungen" message="QM-Konfiguration konnte nicht geladen werden." />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title="QM-Einstellungen" subtitle="Mandanten-Konfiguration" showBack>
      <ScrollView contentContainerStyle={styles.scroll}>
        <QmSettingsHero roleKey={roleKey} />
        <PremiumCard accentColor={colors.cyan}>
          <Text style={styles.title}>Review-Zyklus</Text>
          <Text style={styles.body}>Standard: {settings.reviewCycleMonths} Monate für Verfahrensanweisungen</Text>
        </PremiumCard>
        <PremiumCard accentColor={colors.cyan}>
          <Text style={styles.title}>Freigabe-Workflow</Text>
          <Text style={styles.body}>{settings.approvalWorkflow}</Text>
        </PremiumCard>
        <PremiumCard accentColor={colors.cyan}>
          <Text style={styles.title}>MD-Freigabe</Text>
          <Text style={styles.body}>Token-Gültigkeit: {settings.mdTokenDays} Tage (Standard)</Text>
        </PremiumCard>
      </ScrollView>
    </CareLightPageShell>
  );
}

void fetchQmSettingsSnapshot;

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  body: { ...typography.body, color: colors.textSecondary },
});
