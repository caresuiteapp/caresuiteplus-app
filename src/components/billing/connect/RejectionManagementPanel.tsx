import { StyleSheet, Text, View } from 'react-native';
import type { RejectionManagementCase } from '@/types/connect/billing';
import { EmptyState } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  cases: RejectionManagementCase[];
};

const CASE_LABELS: Record<RejectionManagementCase['caseType'], string> = {
  ruecklaeufer: 'Rückläufer',
  absetzung: 'Absetzung',
};

export function RejectionManagementPanel({ cases }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Rückläufer / Absetzung (vorbereitet)</Text>
      {cases.length === 0 ? (
        <EmptyState
          title="Keine Fälle"
          message="Rückläufer und Absetzungen können nach Exportvorbereitung erfasst werden."
        />
      ) : (
        cases.map((entry) => (
          <View key={entry.id} style={styles.row}>
            <Text style={styles.label}>{CASE_LABELS[entry.caseType]}</Text>
            <Text style={styles.meta}>Status: {entry.status}</Text>
            <Text style={styles.reason}>{entry.reasonText}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  title: { ...typography.bodyStrong, color: colors.textPrimary },
  row: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bgSurface,
    gap: spacing.xs,
  },
  label: { ...typography.bodyStrong, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
  reason: { ...typography.caption, color: colors.textSecondary },
});
