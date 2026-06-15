import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import type { AssignmentSuggestion } from '@/features/communication/communication.assignments';

type MessageAssignmentPanelProps = {
  suggestions: AssignmentSuggestion[];
  onAssign?: (suggestion: AssignmentSuggestion) => void;
  loading?: boolean;
};

export function MessageAssignmentPanel({ suggestions, onAssign, loading }: MessageAssignmentPanelProps) {
  if (suggestions.length === 0) {
    return <Text style={styles.empty}>Keine Zuordnungsvorschläge.</Text>;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Zuordnen</Text>
      {suggestions.map((s) => (
        <View key={`${s.targetType}-${s.targetId}`} style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.label}>{s.label}</Text>
            <Text style={styles.meta}>
              {Math.round(s.confidence * 100)}% Vorschlag · {s.targetType}
            </Text>
          </View>
          <PremiumButton
            title="Zuordnen"
            size="sm"
            loading={loading}
            onPress={() => onAssign?.(s)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.cyan },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.bgPanel,
    borderRadius: 12,
  },
  info: { flex: 1 },
  label: { ...typography.body, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textMuted },
  empty: { ...typography.body, color: colors.textSecondary },
});
