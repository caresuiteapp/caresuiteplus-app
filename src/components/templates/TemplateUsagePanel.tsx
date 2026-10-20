import { StyleSheet, Text, View } from 'react-native';
import { PremiumCard } from '@/components/ui';
import type { CareSuiteTemplate } from '@/types/templates';
import { colors, spacing, typography } from '@/theme';

type Props = {
  template: CareSuiteTemplate;
  usageCount?: number;
};

export function TemplateUsagePanel({ template, usageCount = 0 }: Props) {
  return (
    <PremiumCard>
      <Text style={styles.title}>Nutzung</Text>
      <Text style={styles.row}>Modul: {template.moduleKey}</Text>
      <Text style={styles.row}>Typ: {template.templateType.replace(/_/g, ' ')}</Text>
      <Text style={styles.row}>Scope: {template.scope === 'system' ? 'Systemvorlage' : 'Mandant'}</Text>
      <Text style={styles.row}>Genutzt: {usageCount}×</Text>
      {template.variables.length > 0 ? (
        <View style={styles.vars}>
          <Text style={styles.sub}>Variablen:</Text>
          <Text style={styles.row}>{template.variables.join(', ')}</Text>
        </View>
      ) : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h3, marginBottom: spacing.sm },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  row: { ...typography.body, color: colors.textSecondary },
  vars: { marginTop: spacing.xs },
});
