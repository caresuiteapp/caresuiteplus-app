import { StyleSheet, Text, View } from 'react-native';
import type { CareAssessmentTopic } from '@/types/modules/careAssessment';
import { colors, radius, spacing, typography } from '@/theme';

export function AssessmentPlanTopicContext({ topic }: { topic: CareAssessmentTopic }) {
  const fields = [
    { label: 'Pflegeprobleme und Unterstützungsbedarf', value: topic.impairments },
    { label: 'Erhaltene Fähigkeiten und Ressourcen', value: topic.resources },
    { label: 'Wünsche und Prioritäten der Person', value: topic.wishes },
  ];
  return (
    <View style={styles.context}>
      {fields.map(field => (
        <View key={field.label} style={styles.field}>
          <Text style={styles.label}>{field.label}</Text>
          <Text style={styles.value}>{field.value.trim() ? field.value : 'Offen'}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  context: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  field: {
    flexGrow: 1, flexBasis: 170, gap: spacing.xs, padding: spacing.sm,
    borderRadius: radius.md, backgroundColor: 'rgba(27,108,192,0.08)',
  },
  label: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },
  value: { ...typography.body, color: colors.textPrimary },
});
