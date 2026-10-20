import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SectionPanel } from '@/components/ui';
import { DOCUMENT_EDITOR_BLOCKS, insertBlockIntoHtml } from '@/lib/documents';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  htmlTemplate: string;
  onInsert: (nextHtml: string) => void;
  readOnly?: boolean;
};

export function DocumentBlockPicker({ htmlTemplate, onInsert, readOnly }: Props) {
  if (readOnly) return null;

  return (
    <SectionPanel title="Blöcke einfügen" subtitle="Drag-and-Drop vorbereitet">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {DOCUMENT_EDITOR_BLOCKS.map((block) => (
          <Pressable
            key={block.key}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            onPress={() => onInsert(insertBlockIntoHtml(htmlTemplate, block.html))}
          >
            <Text style={styles.chipLabel}>{block.label}</Text>
            <Text style={styles.chipHint}>{block.dragDropReady ? 'D&D bereit' : 'vorbereitet'}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    minWidth: 120,
    gap: 2,
  },
  chipPressed: { backgroundColor: colors.bgElevated },
  chipLabel: { ...typography.bodyStrong },
  chipHint: { ...typography.caption, color: colors.textMuted },
});
