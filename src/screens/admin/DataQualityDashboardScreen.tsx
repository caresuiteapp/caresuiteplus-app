import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DataQualityDashboardHero } from '@/components/admin/DataQualityDashboardHero';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ModuleTile,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchDataQualityOverview, buildDataQualityOverview } from '@/lib/admin/dataQualityService';
import { spacing, colors } from '@/theme';

export function DataQualityDashboardScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return Promise.resolve({ ok: true as const, data: fetchDataQualityOverview(tenantId) });
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Datenqualität" subtitle="Wird geladen…" scroll>
        <LoadingState message="Stammdatenqualität wird geprüft…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Datenqualität" subtitle="Fehler" scroll>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const overview = query.data;
  if (!overview) {
    return (
      <ScreenShell title="Datenqualität" scroll>
        <EmptyState title="Keine Daten" message="Datenqualitätsübersicht nicht verfügbar." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Datenqualität" subtitle="Mehr → Verwaltung → Datenqualität" scroll>
      <DataQualityDashboardHero overview={overview} />

      <SectionPanel title="Bereiche" subtitle="Pflichtdaten je Stammdatenbereich">
        <View style={styles.grid}>
          {overview.areas.map((area) => (
            <ModuleTile
              key={area.areaKey}
              icon="📋"
              title={area.label}
              description={`${area.issueCount} Hinweise · ${area.blockingCount} Blocker · Status: ${area.status}`}
              accentColor={colors.orange}
              isActive
              onPress={() => router.push(area.route as never)}
            />
          ))}
        </View>
      </SectionPanel>

      <PremiumButton
        title="Neu validieren"
        onPress={() => {
          if (tenantId) buildDataQualityOverview(tenantId);
          query.refresh();
        }}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.sm },
});
