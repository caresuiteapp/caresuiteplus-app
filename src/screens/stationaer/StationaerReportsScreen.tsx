import { StyleSheet, Text, View } from 'react-native';
import { StationaerReportsHero } from '@/components/stationaer';
import { ModuleExtensionNavStrip } from '@/components/navigation/ModuleExtensionNavStrip';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumCard, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchStationaerReportStats } from '@/lib/stationaer/moduleExtensionService';
import { colors, spacing, typography } from '@/theme';

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <PremiumCard style={styles.kpi} accentColor={accent}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </PremiumCard>
  );
}

export function StationaerReportsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const pageTitle = 'Auswertungen';
  const roleKey = profile?.roleKey ?? 'nurse';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchStationaerReportStats(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title={pageTitle} subtitle="Wird geladen…">
        <LoadingState message="Kennzahlen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title={pageTitle} subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const stats = query.data!;

  return (
    <ScreenShell title={pageTitle} subtitle={`Kennzahlen · ${roleLabel ?? 'Demo'}`}>
      <StationaerReportsHero stats={stats} roleKey={roleKey} />
      <ModuleExtensionNavStrip productKey="stationaer" currentPath="/stationaer/auswertungen" />
      <View style={styles.grid}>
        <KpiCard label="Belegung" value={`${stats.occupancyPercent} %`} accent={colors.violet} />
        <KpiCard label="Aktive Bewohner:innen" value={stats.activeResidents} accent={colors.success} />
        <KpiCard label="Übergaben (Woche)" value={stats.handoversThisWeek} accent={colors.amber} />
        <KpiCard label="Offene Risiken" value={stats.openRisks} accent={colors.danger} />
        <KpiCard label="Neuaufnahmen (Monat)" value={stats.newAdmissionsMonth} accent={colors.cyan} />
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
