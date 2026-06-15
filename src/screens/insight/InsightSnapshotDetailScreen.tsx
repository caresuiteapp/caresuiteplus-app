import { StyleSheet, Text, View } from 'react-native';
import { InsightSnapshotDetailHero } from '@/components/insight';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumCard,
} from '@/components/ui';
import { useInsightSnapshotDetail } from '@/hooks/useInsightSnapshotDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { wp499InsightA11y } from '@/lib/a11y/wp499-insight';
import { INSIGHT_PREPARED_MESSAGE, isInsightLiveReady } from '@/lib/insight';
import { colors, spacing, typography } from '@/theme';

type InsightSnapshotDetailScreenProps = {
  snapshotId: string;
};

export function InsightSnapshotDetailScreen({ snapshotId }: InsightSnapshotDetailScreenProps) {
  const { profile } = useAuth();
  const { can, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { snapshot, loading, error, refresh } = useInsightSnapshotDetail(snapshotId);

  if (!can('dashboard.view')) {
    return (
      <ScreenShell title="Snapshot" subtitle="Kein Zugriff" showBack>
        <EmptyState title="Zugriff verweigert" message="InsightCenter ist nicht freigegeben." />
      </ScreenShell>
    );
  }

  if (loading && !snapshot) {
    return (
      <ScreenShell title="Snapshot" subtitle="InsightCenter" showBack>
        <LoadingState message="Snapshot wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !snapshot) {
    return (
      <ScreenShell title="Snapshot" subtitle="Fehler" showBack>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  if (!snapshot) {
    return (
      <ScreenShell title="Snapshot" subtitle="Nicht gefunden" showBack>
        <EmptyState title="Snapshot nicht gefunden" message="Der angeforderte KPI-Snapshot existiert nicht." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={snapshot.title}
      subtitle={`${snapshot.moduleLabel} · ${roleLabel ?? 'Demo'}`}
      showBack
      a11yMeta={wp499InsightA11y}
    >
      <InsightSnapshotDetailHero snapshot={snapshot} roleKey={roleKey} />

      {!isInsightLiveReady() ? (
        <InfoBanner title="Modul in Vorbereitung" message={INSIGHT_PREPARED_MESSAGE} />
      ) : null}

      <PremiumCard style={styles.detailCard}>
        <Text style={styles.sectionTitle}>Snapshot-Details</Text>
        <Text style={styles.row}>Modul: {snapshot.moduleLabel}</Text>
        <Text style={styles.row}>Zeitraum: {snapshot.periodLabel}</Text>
        <Text style={styles.row}>KPIs: {snapshot.kpiCount}</Text>
        <Text style={styles.row}>
          Aktualisiert: {new Date(snapshot.updatedAt).toLocaleString('de-DE')}
        </Text>
        <Text style={styles.hint}>
          Keine Live-KPI-Werte — Snapshot ist ein ehrlicher Scaffold ohne Warehouse-Anbindung.
        </Text>
      </PremiumCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  detailCard: { marginTop: spacing.md },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  row: { ...typography.body, marginBottom: spacing.xs },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
