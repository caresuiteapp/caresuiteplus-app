import { StyleSheet, Text, View } from 'react-native';
import { AkademieReportsHero } from '@/components/akademie';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumCard, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchAkademieReportStats } from '@/lib/akademie/moduleExtensionService';
import { colors, spacing, typography } from '@/theme';

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <PremiumCard style={styles.kpi} accentColor={accent}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </PremiumCard>
  );
}

export function AkademieReportsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'akademie_admin';

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchAkademieReportStats(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Akademie-Auswertungen" subtitle="Wird geladen…">
        <LoadingState message="Kennzahlen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Akademie-Auswertungen" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const stats = query.data!;

  return (
    <ScreenShell title="Akademie-Auswertungen" subtitle={`Kennzahlen · ${roleLabel ?? 'Demo'}`}>
      <AkademieReportsHero stats={stats} roleKey={roleKey} />
      <View style={styles.grid}>
        <KpiCard label="Aktive Kurse" value={stats.activeCourses} accent="#FFD166" />
        <KpiCard label="Offene Teilnahmen" value={stats.enrollmentsOpen} accent={colors.cyan} />
        <KpiCard label="Abschlüsse (Monat)" value={stats.completionsThisMonth} accent={colors.success} />
        <KpiCard label="Zertifikate ablaufend" value={stats.certificatesExpiring} accent={colors.warning} />
        <KpiCard label="Pflicht-Compliance" value={`${stats.mandatoryCompliancePercent} %`} accent={colors.violet} />
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
