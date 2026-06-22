import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useMemo } from 'react';
import { fetchInsightDashboardStats } from '@/lib/insight/insightDashboardService';
import { useRouter } from 'expo-router';
import { CareLightModuleDashboard, CareLightScreen } from '@/components/layout';
import { CareLightEmptyState, CareLightErrorState, CareLightModuleTile, EmptyState, ErrorState, InfoBanner, LoadingState, PremiumInput } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useInsightDashboard } from '@/hooks/useInsightDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { buildInsightDashboardKpis } from '@/lib/insight/insightDashboardStats';
import { mapToCareLightKpis } from '@/lib/adaptive/careLightKpiMap';
import { wp499InsightA11y } from '@/lib/a11y/wp499-insight';
import { INSIGHT_PREPARED_MESSAGE, isInsightLiveReady } from '@/lib/insight';

export function InsightIndexScreen() {
  const router = useRouter();
  const { c } = useCareLightPalette();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        quickGrid: { gap: careSpacing.md },
        scaffoldHint: { ...careTypography.caption, color: c.muted },
        snapshotItem: { ...careTypography.body, color: c.text, marginBottom: careSpacing.xs },
        loading: {
          ...careTypography.body,
          color: c.muted,
          textAlign: 'center',
          paddingVertical: careSpacing.xl,
        },
        a11yAnchor: { height: 0, width: 0 },
      }),
    [c.muted, c.text],
  );
  const { can, roleLabel } = usePermissions();
  const insightAccent = moduleColor('insight');
  const { stats, snapshots, loading, error, refresh } = useInsightDashboard();

  if (!can('dashboard.view')) {
    return (
      <CareLightScreen>
        <CareLightEmptyState
          title="Zugriff verweigert"
          message={`InsightCenter ist für ${roleLabel ?? 'Ihre Rolle'} nicht freigegeben.`}
        />
      </CareLightScreen>
    );
  }

  if (loading && !stats) {
    return (
      <CareLightScreen>
        <Text style={styles.loading}>Dashboard wird geladen…</Text>
      </CareLightScreen>
    );
  }

  if (error && !stats) {
    return (
      <CareLightScreen>
        <CareLightErrorState message={error} onRetry={refresh} />
      </CareLightScreen>
    );
  }

  const kpis = stats ? mapToCareLightKpis(buildInsightDashboardKpis(stats, 'light')) : [];

  return (
    <CareLightScreen>
      {!isInsightLiveReady() ? (
        <InfoBanner title="Modul in Vorbereitung" message={INSIGHT_PREPARED_MESSAGE} />
      ) : null}
      <CareLightModuleDashboard
        moduleKey="insight"
        subtitle={`Mandanten-Analytics · ${roleLabel ?? 'Demo'}`}
        kpis={kpis}
        recentTitle="Gespeicherte Snapshots"
        recentSubtitle="Noch keine aktiven Datenquellen"
        recentSection={
          snapshots.length === 0 ? (
            <CareLightEmptyState
              title="Keine Snapshots"
              message="Sobald Datenquellen angebunden sind, erscheinen hier gespeicherte KPI-Snapshots."
              actionLabel="Snapshots anzeigen"
              onAction={() => router.push('/insight/snapshots' as never)}
              accentColor={insightAccent}
            />
          ) : (
            snapshots.map((item) => (
              <Pressable key={item.id} onPress={() => router.push(`/insight/snapshots/${item.id}` as never)}>
                <Text style={styles.snapshotItem}>• {item.title} ({item.moduleLabel})</Text>
              </Pressable>
            ))
          )
        }
        quickActions={
          <View style={styles.quickGrid}>
            <CareLightModuleTile icon="📊" title="Mandanten-KPIs" description="Übergreifende Kennzahlen" accentColor={insightAccent} isActive onPress={() => router.push('/insight/snapshots' as never)} />
            <CareLightModuleTile icon="📈" title="Modul-Dashboards" description="Office, Assist, Pflege …" accentColor={moduleColor('office')} isActive onPress={() => router.push('/insight/snapshots' as never)} />
            <CareLightModuleTile icon="📤" title="Geplante Exporte" description="CSV und PDF-Reports" accentColor={moduleColor('qm')} isActive onPress={() => router.push('/insight/exports' as never)} />
            <CareLightModuleTile icon="🔌" title="Datenquellen" description="Modul-KPI-Feeds und Warehouse" accentColor={moduleColor('insight')} isActive onPress={() => router.push('/insight/data-sources' as never)} />
            <CareLightModuleTile icon="📋" title="Business Reporting" description="Bestehende Report-Listen" accentColor={moduleColor('beratung')} isActive onPress={() => router.push('/business/reporting' as never)} />
            <Text style={styles.scaffoldHint}>InsightCenter ist ein ehrlicher Scaffold — keine Live-Analytics oder Warehouse-Anbindung.</Text>
          </View>
        }
      />
      <View accessible accessibilityLabel={`${wp499InsightA11y.screenLabel} · WP ${wp499InsightA11y.wpNumber}`} accessibilityRole={wp499InsightA11y.headingRole} style={styles.a11yAnchor} />
    </CareLightScreen>
  );
}
