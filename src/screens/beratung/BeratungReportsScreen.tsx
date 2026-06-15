import { StyleSheet, Text, View } from 'react-native';
import { BeratungReportsHero } from '@/components/beratung';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumCard, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchBeratungReportStats } from '@/lib/beratung/moduleExtensionService';
import { colors, spacing, typography } from '@/theme';

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <PremiumCard style={styles.kpi} accentColor={accent}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </PremiumCard>
  );
}

export function BeratungReportsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'counselor';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchBeratungReportStats(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Beratung-Auswertungen" subtitle="Wird geladen…">
        <LoadingState message="Kennzahlen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Beratung-Auswertungen" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const stats = query.data!;

  return (
    <ScreenShell title="Beratung-Auswertungen" subtitle={`Kennzahlen · ${roleLabel ?? 'Demo'}`}>
      <BeratungReportsHero stats={stats} roleKey={roleKey} />
      <View style={styles.grid}>
        <KpiCard label="Offene Fälle" value={stats.openCases} accent={colors.cyan} />
        <KpiCard label="Protokolle (Monat)" value={stats.protocolsThisMonth} accent={colors.success} />
        <KpiCard label="Wiedervorlagen fällig" value={stats.followUpsDue} accent={colors.warning} />
        <KpiCard label="Abgeschlossen (Monat)" value={stats.closedThisMonth} accent={colors.amber} />
        <KpiCard label="Ø Bearbeitungsdauer" value={`${stats.avgCaseDurationDays} Tage`} accent={colors.violet} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  kpi: { width: '47%', flexGrow: 1 },
  kpiValue: { ...typography.h2, marginBottom: 4 },
  kpiLabel: { ...typography.caption },
});
