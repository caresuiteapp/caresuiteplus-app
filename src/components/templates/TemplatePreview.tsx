import { StyleSheet, Text } from 'react-native';
import { renderTemplateWithVariables } from '@/lib/templates';
import { colors, spacing, typography } from '@/theme';

type Props = {
  content: string;
  variables?: Record<string, string>;
};

export function TemplatePreview({ content, variables = {} }: Props) {
  const rendered = renderTemplateWithVariables(content, variables);
  return <Text style={styles.preview}>{rendered || '—'}</Text>;
}

const styles = StyleSheet.create({
  preview: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.bgPanel,
    padding: spacing.md,
    borderRadius: 8,
  },
});
