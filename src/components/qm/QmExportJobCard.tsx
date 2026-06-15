import { StyleSheet, Text } from 'react-native';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { PremiumCard } from '@/components/ui';
import type { QmExportJob } from '@/lib/qm';
import { QmStatusBadge } from './QmStatusBadge';
import { colors, spacing, typography } from '@/theme';

type Props = { job: QmExportJob };

export function QmExportJobCard({ job }: Props) {
  return (
    <PremiumCard accentColor={colors.cyan}>
      {job.preparedOnly && (
        <PreparedModeBanner hint="Export ist P-READY — kein echter PDF-Download verfügbar." />
      )}
      <Text style={styles.title}>Export {job.format.toUpperCase()}</Text>
      <QmStatusBadge kind="export" status={job.status} />
      <Text style={styles.meta}>{job.documentIds.length} Dokumente</Text>
      {job.completedAt && (
        <Text style={styles.date}>
          Abgeschlossen: {new Date(job.completedAt).toLocaleString('de-DE')}
        </Text>
      )}
      {job.errorMessage && <Text style={styles.error}>{job.errorMessage}</Text>}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  date: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.orange, marginTop: spacing.xs },
});
