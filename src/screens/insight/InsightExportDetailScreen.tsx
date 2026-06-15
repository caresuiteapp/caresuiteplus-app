import { StyleSheet, Text, View } from 'react-native';
import { InsightExportDetailHero } from '@/components/insight';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumCard,
} from '@/components/ui';
import { useInsightExportDetail } from '@/hooks/useInsightExportDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { wp499InsightA11y } from '@/lib/a11y/wp499-insight';
import { INSIGHT_PREPARED_MESSAGE, isInsightLiveReady } from '@/lib/insight';
import { colors, spacing, typography } from '@/theme';

type InsightExportDetailScreenProps = {
  exportId: string;
};

export function InsightExportDetailScreen({ exportId }: InsightExportDetailScreenProps) {
  const { profile } = useAuth();
  const { can, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const { exportItem, loading, error, refresh } = useInsightExportDetail(exportId);

  if (!can('dashboard.view')) {
    return (
      <ScreenShell title="Export" subtitle="Kein Zugriff" showBack>
        <EmptyState title="Zugriff verweigert" message="InsightCenter ist nicht freigegeben." />
      </ScreenShell>
    );
  }

  if (loading && !exportItem) {
    return (
      <ScreenShell title="Export" subtitle="InsightCenter" showBack>
        <LoadingState message="Export wird geladen…" />
      </ScreenShell>
    );
  }

  if (error && !exportItem) {
    return (
      <ScreenShell title="Export" subtitle="Fehler" showBack>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenShell>
    );
  }

  if (!exportItem) {
    return (
      <ScreenShell title="Export" subtitle="Nicht gefunden" showBack>
        <EmptyState title="Export nicht gefunden" message="Der angeforderte Export existiert nicht." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={exportItem.title}
      subtitle={`${exportItem.format.toUpperCase()} · ${roleLabel ?? 'Demo'}`}
      showBack
      a11yMeta={wp499InsightA11y}
    >
      <InsightExportDetailHero exportItem={exportItem} roleKey={roleKey} />

      {!isInsightLiveReady() ? (
        <InfoBanner title="Modul in Vorbereitung" message={INSIGHT_PREPARED_MESSAGE} />
      ) : null}

      <PremiumCard style={styles.detailCard}>
        <Text style={styles.sectionTitle}>Export-Konfiguration</Text>
        <Text style={styles.row}>Format: {exportItem.format.toUpperCase()}</Text>
        <Text style={styles.row}>Zeitplan: {exportItem.scheduleLabel}</Text>
        <Text style={styles.row}>Empfänger: {exportItem.recipientLabel}</Text>
        <Text style={styles.row}>Spalten: {exportItem.columnsLabel}</Text>
        <Text style={styles.row}>Letzter Lauf: {exportItem.lastRunLabel}</Text>
        <Text style={styles.row}>
          Aktualisiert: {new Date(exportItem.updatedAt).toLocaleString('de-DE')}
        </Text>
        <Text style={styles.hint}>
          Kein Live-Scheduler — Export ist ein ehrlicher Scaffold ohne Cron-Anbindung.
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
