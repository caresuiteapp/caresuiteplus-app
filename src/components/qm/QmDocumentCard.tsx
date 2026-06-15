import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '@/components/ui';
import type { QmDocument } from '@/lib/qm';
import { QmStatusBadge, QmTypeLabel } from './QmStatusBadge';
import { colors, spacing, typography } from '@/theme';

type Props = {
  document: QmDocument;
  onPress?: () => void;
};

export function QmDocumentCard({ document, onPress }: Props) {
  return (
    <PremiumCard accentColor={colors.cyan} onPress={onPress}>
      <View style={styles.row}>
        <Text style={styles.number}>{document.documentNumber}</Text>
        <QmStatusBadge kind="document" status={document.status} />
      </View>
      <Text style={styles.title}>{document.title}</Text>
      <View style={styles.meta}>
        <QmTypeLabel type={document.documentType} />
        {document.tags.length > 0 && (
          <Text style={styles.tags}>{document.tags.join(' · ')}</Text>
        )}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  number: { ...typography.caption, color: colors.textMuted },
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  meta: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  tags: { ...typography.caption, color: colors.textMuted },
});
