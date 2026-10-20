import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '@/components/ui';
import type { QmDocument } from '@/lib/qm';
import { colors, spacing, typography } from '@/theme';

type Props = {
  documents: QmDocument[];
  selectedIds: string[];
  onToggle?: (id: string) => void;
};

export function MdDocumentSelector({ documents, selectedIds, onToggle }: Props) {
  return (
    <View style={styles.wrap}>
      {documents.map((doc) => {
        const selected = selectedIds.includes(doc.id);
        return (
          <PremiumCard
            key={doc.id}
            accentColor={selected ? colors.success : colors.cyan}
            onPress={onToggle ? () => onToggle(doc.id) : undefined}
          >
            <Text style={styles.number}>{doc.documentNumber}</Text>
            <Text style={styles.title}>{doc.title}</Text>
            {selected && <Text style={styles.selected}>✓ Ausgewählt</Text>}
          </PremiumCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  number: { ...typography.caption, color: colors.textMuted },
  title: { ...typography.bodyStrong },
  selected: { ...typography.caption, color: colors.success, marginTop: spacing.xs },
});
