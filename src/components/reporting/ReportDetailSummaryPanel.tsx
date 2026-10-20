import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { REPORT_CATEGORY_LABELS } from '@/lib/reporting/reportListStats';
import { useReportDetail } from '@/hooks/useReportDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type ReportDetailSummaryPanelProps = {
  reportId: string;
};

function statusVariant(status: string) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ReportDetailSummaryPanel({ reportId }: ReportDetailSummaryPanelProps) {
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();
  const { data: report, loading, error, refresh, notFound } = useReportDetail(reportId);

  if (loading) {
    return <LoadingState message="Bericht wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Bericht existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!report) return null;

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.cyan}>
        <Text style={styles.title}>{report.title}</Text>
        <Text style={styles.category}>{REPORT_CATEGORY_LABELS[report.category]}</Text>
        <View style={styles.badges}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[report.status]}
            variant={statusVariant(report.status)}
            dot
          />
        </View>
        <Text style={styles.hint}>{report.period}</Text>
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Berichte einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Details">
        <DetailInfoRow label="Zeitraum" value={report.period} />
        <DetailInfoRow label="Kategorie" value={REPORT_CATEGORY_LABELS[report.category]} />
        <DetailInfoRow label="Aktualisiert" value={formatDate(report.updatedAt)} />
        <DetailInfoRow label="KPIs im Bericht" value={String(report.kpiSnapshot.length)} />
      </SectionPanel>

      {report.summary ? (
        <SectionPanel title="Zusammenfassung">
          <Text style={styles.summary} numberOfLines={4}>
            {report.summary}
          </Text>
        </SectionPanel>
      ) : null}

      <PremiumButton
        title="Vollständigen Bericht öffnen"
        fullWidth
        onPress={() => router.push(`/business/reporting/${reportId}` as never)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: spacing.md, gap: spacing.md },
  title: { ...typography.h2, marginBottom: spacing.xs },
  category: { ...typography.caption, color: colors.cyan, marginBottom: spacing.sm },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  hint: { ...typography.caption, color: colors.textMuted },
  summary: { ...typography.body },
});
