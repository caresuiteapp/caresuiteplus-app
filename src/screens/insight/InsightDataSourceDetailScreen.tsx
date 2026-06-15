import { StyleSheet, Text, View } from 'react-native';
import { InsightDataSourceDetailHero } from '@/components/insight';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumCard,
} from '@/components/ui';
import { useInsightDataSourceDetail } from '@/hooks/useInsightDataSourceDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { wp499InsightA11y } from '@/lib/a11y/wp499-insight';
import { INSIGHT_PREPARED_MESSAGE, isInsightLiveReady } from '@/lib/insight';
import { colors, spacing, typography } from '@/theme';

type InsightDataSourceDetailScreenProps = {
  sourceId: string;
};

export function InsightDataSourceDetailScreen({ sourceId }: InsightDataSourceDetailScreenProps) {
  const { profile } = useAuth();
  const { can, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { source, loading, error, refresh } = useInsightDataSourceDetail(sourceId);

  if (!can('dashboard.view')) {
    return (
      <ScreenShell title="Datenquelle" subtitle="Kein Zugriff" showBack>
        <EmptyState title="Zugriff verweigert" message="InsightCenter ist nicht freigegeben." />
      </ScreenShell>
    );
  }

  if (loading && !source) {
    return (
      <ScreenShell title="Datenquelle" subtitle="InsightCenter" showBack>
        <LoadingState message="Datenquelle wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !source) {
    return (
      <ScreenShell title="Datenquelle" subtitle="Fehler" showBack>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  if (!source) {
    return (
      <ScreenShell title="Datenquelle" subtitle="Nicht gefunden" showBack>
        <EmptyState title="Datenquelle nicht gefunden" message="Die angeforderte KPI-Quelle existiert nicht." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={source.label}
      subtitle={`${source.moduleKey} · ${roleLabel ?? 'Demo'}`}
      showBack
      a11yMeta={wp499InsightA11y}
    >
      <InsightDataSourceDetailHero source={source} roleKey={roleKey} />

      {!isInsightLiveReady() ? (
        <InfoBanner title="Modul in Vorbereitung" message={INSIGHT_PREPARED_MESSAGE} />
      ) : null}

      <PremiumCard style={styles.detailCard}>
        <Text style={styles.sectionTitle}>Quellen-Details</Text>
        <Text style={styles.row}>Modul: {source.moduleKey}</Text>
        <Text style={styles.row}>Status: {source.connectionStatus}</Text>
        <Text style={styles.row}>Warehouse: {source.warehouseTable ?? '—'}</Text>
        <Text style={styles.row}>KPI-Feeds: {source.kpiFeedCount}</Text>
        <Text style={styles.row}>
          Letzter Sync: {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleString('de-DE') : 'Noch nie'}
        </Text>
        <Text style={styles.description}>{source.description}</Text>
      </PremiumCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  detailCard: { marginTop: spacing.md, gap: spacing.xs },
  sectionTitle: { ...typography.bodyStrong, marginBottom: spacing.xs },
  row: { ...typography.body, color: colors.textSecondary },
  description: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
