import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SectionPanel } from '@/components/ui';
import { DOCUMENT_TEXT_SNIPPETS, insertSnippetIntoHtml } from '@/lib/documents';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  htmlTemplate: string;
  onInsert: (nextHtml: string) => void;
  readOnly?: boolean;
};

export function DocumentTextSnippetPicker({ htmlTemplate, onInsert, readOnly }: Props) {
  if (readOnly) return null;

  return (
    <SectionPanel title="Textbausteine">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {DOCUMENT_TEXT_SNIPPETS.map((snippet) => (
          <Pressable
            key={snippet.key}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            onPress={() => onInsert(insertSnippetIntoHtml(htmlTemplate, snippet.html))}
          >
            <Text style={styles.chipLabel}>{snippet.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipPressed: { backgroundColor: colors.bgElevated },
  chipLabel: { ...typography.caption },
});
