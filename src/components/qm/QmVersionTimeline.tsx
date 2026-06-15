import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '@/components/ui';
import type { QmDocumentVersion } from '@/lib/qm';
import { QmStatusBadge } from './QmStatusBadge';
import { colors, spacing, typography } from '@/theme';

type Props = { versions: QmDocumentVersion[] };

export function QmVersionTimeline({ versions }: Props) {
  const sorted = [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <View style={styles.wrap}>
      {sorted.map((v) => (
        <PremiumCard key={v.id} accentColor={colors.cyan}>
          <View style={styles.row}>
            <Text style={styles.version}>v{v.versionNumber}</Text>
            <QmStatusBadge kind="document" status={v.status} />
          </View>
          <Text style={styles.summary}>{v.changeSummary}</Text>
          {v.approvedBy && (
            <Text style={styles.meta}>Freigegeben von {v.approvedBy}</Text>
          )}
        </PremiumCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  version: { ...typography.bodyStrong },
  summary: { ...typography.body, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted },
});
