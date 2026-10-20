import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '@/components/ui';
import type { QmHandbookChapter } from '@/lib/qm';
import { QmStatusBadge } from './QmStatusBadge';
import { colors, spacing, typography } from '@/theme';

type Props = {
  chapters: QmHandbookChapter[];
  onSelect?: (chapter: QmHandbookChapter) => void;
};

export function QmChapterTree({ chapters, onSelect }: Props) {
  const sorted = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <View style={styles.wrap}>
      {sorted.map((chapter) => (
        <PremiumCard
          key={chapter.id}
          accentColor={colors.cyan}
          onPress={onSelect ? () => onSelect(chapter) : undefined}
        >
          <View style={styles.row}>
            <Text style={styles.order}>{chapter.sortOrder}.</Text>
            <View style={styles.content}>
              <Text style={styles.title}>{chapter.title}</Text>
              <Text style={styles.version}>v{chapter.version}</Text>
            </View>
            <QmStatusBadge kind="document" status={chapter.status} />
          </View>
        </PremiumCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  order: { ...typography.caption, color: colors.textMuted, width: 24 },
  content: { flex: 1 },
  title: { ...typography.bodyStrong },
  version: { ...typography.caption, color: colors.textMuted },
});
