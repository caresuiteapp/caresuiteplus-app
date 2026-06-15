import { StyleSheet, Text } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { DetailInfoRow } from '@/components/detail';
import { ErrorState, LoadingState, PremiumCard, PremiumKpiCard } from '@/components/ui';
import { useReportDetail } from '@/hooks/useReportDetail';
import { wp501A11y } from '@/lib/a11y/wp501-reporting';
import { spacing, typography } from '@/theme';

type ReportDetailScreenProps = { reportId: string };

/** WP505 — Detailansicht Bericht */
export function ReportDetailScreen({ reportId }: ReportDetailScreenProps) {
  const { data, loading, error, refresh } = useReportDetail(reportId);

  if (loading && !data) {
    return (
      <ScreenShell title="Bericht" subtitle="WP 505" a11yMeta={wp501A11y}>
        <LoadingState message="Bericht wird geladen…" />
      </ScreenShell>
    );
  }

  if (error || !data) {
    return (
      <ScreenShell title="Bericht" subtitle="Fehler" a11yMeta={wp501A11y}>
        <ErrorState title="Bericht" message={error ?? 'Nicht gefunden.'} onRetry={refresh} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={data.title} subtitle={`${data.category} · WP 505`} a11yMeta={wp501A11y}>
      <PremiumCard>
        <DetailInfoRow label="Zeitraum" value={data.period} />
        <DetailInfoRow label="Status" value={data.status} />
        <DetailInfoRow label="Aktualisiert" value={new Date(data.updatedAt).toLocaleDateString('de-DE')} />
      </PremiumCard>
      <PremiumCard>
        <Text style={styles.summary}>{data.summary}</Text>
      </PremiumCard>
      {data.kpiSnapshot.map((kpi) => (
        <PremiumKpiCard
          key={kpi.id}
          label={kpi.label}
          value={kpi.value}
          subValue={kpi.subValue}
          icon={kpi.icon}
          accentColor={kpi.accentColor}
          trend={kpi.trend}
          trendValue={kpi.trendValue}
        />
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  summary: { ...typography.body },
});
