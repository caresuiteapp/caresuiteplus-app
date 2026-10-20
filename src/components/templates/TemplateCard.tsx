import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import type { CareSuiteTemplate } from '@/types/templates';
import { TemplateCategoryBadge } from './TemplateCategoryBadge';
import { TemplateModuleBadge } from './TemplateModuleBadge';
import { TemplateStatusBadge } from './TemplateStatusBadge';
import { colors, spacing, typography } from '@/theme';

type Props = {
  template: CareSuiteTemplate;
  onPress?: () => void;
  usageCount?: number;
};

export function TemplateCard({ template, onPress, usageCount }: Props) {
  return (
    <PremiumCard style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.title}>{template.title}</Text>
        <TemplateStatusBadge status={template.status} />
      </View>
      {template.description ? <Text style={styles.desc}>{template.description}</Text> : null}
      <Text style={styles.preview} numberOfLines={2}>
        {template.content}
      </Text>
      <View style={styles.badges}>
        <TemplateModuleBadge moduleKey={template.moduleKey} />
        <TemplateCategoryBadge categoryKey={template.categoryKey} />
        {template.scope === 'system' ? (
          <PremiumBadge label="System" variant="cyan" />
        ) : null}
      </View>
      {usageCount != null ? (
        <Text style={styles.meta}>{usageCount}× genutzt</Text>
      ) : (
        <Text style={styles.meta}>{template.templateType.replace(/_/g, ' ')}</Text>
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  title: { ...typography.h3, flex: 1 },
  desc: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  preview: { ...typography.body, color: colors.textSecondary, marginVertical: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
