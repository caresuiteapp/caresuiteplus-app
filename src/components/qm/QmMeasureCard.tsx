import { StyleSheet, Text } from 'react-native';
import { PremiumCard } from '@/components/ui';
import type { QmMeasure } from '@/lib/qm';
import { colors, spacing, typography } from '@/theme';

type Props = { measure: QmMeasure; onPress?: () => void };

export function QmMeasureCard({ measure, onPress }: Props) {
  return (
    <PremiumCard accentColor={colors.cyan} onPress={onPress}>
      <Text style={styles.title}>{measure.title}</Text>
      <Text style={styles.status}>Status: {measure.status}</Text>
      <Text style={styles.due}>Fällig: {new Date(measure.dueAt).toLocaleDateString('de-DE')}</Text>
      <Text style={styles.assignee}>Zuständig: {measure.assignedTo}</Text>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  status: { ...typography.caption, color: colors.textMuted },
  due: { ...typography.caption, color: colors.textMuted },
  assignee: { ...typography.caption, color: colors.textMuted },
});
