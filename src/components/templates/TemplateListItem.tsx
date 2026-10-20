import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CareSuiteTemplate } from '@/types/templates';
import { TemplateModuleBadge } from './TemplateModuleBadge';
import { TemplateStatusBadge } from './TemplateStatusBadge';
import { colors, spacing, typography } from '@/theme';

type Props = {
  template: CareSuiteTemplate;
  onPress?: () => void;
};

export function TemplateListItem({ template, onPress }: Props) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.main}>
        <Text style={styles.title}>{template.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {template.scope === 'system' ? 'System · ' : 'Mandant · '}
          {template.templateType.replace(/_/g, ' ')}
        </Text>
      </View>
      <View style={styles.badges}>
        <TemplateModuleBadge moduleKey={template.moduleKey} />
        <TemplateStatusBadge status={template.status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: spacing.sm,
  },
  main: { flex: 1 },
  title: { ...typography.body, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textMuted },
  badges: { alignItems: 'flex-end', gap: spacing.xs },
});
