import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import {
  resolveWorkflowStatusLabel,
  resolveWorkflowStatusVariant,
} from '@/lib/workflow/workflowStatusPresentation';
import type { WorkflowStatus } from '@/types';
import { spacing, typography } from '@/theme';

type ModuleAssignmentListCardProps = {
  title: string;
  subtitle: string;
  meta?: string;
  status: WorkflowStatus | string;
  moduleLabel?: string;
  onPress?: () => void;
};

export function ModuleAssignmentListCard({
  title,
  subtitle,
  meta,
  status,
  moduleLabel,
  onPress,
}: ModuleAssignmentListCardProps) {
  const text = useAuroraAdaptiveText();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { marginBottom: spacing.sm },
        row: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: spacing.sm,
        },
        main: { flex: 1, gap: 2 },
        title: { ...typography.bodyStrong, color: text.primary },
        subtitle: { ...typography.caption, color: text.secondary },
        meta: { ...typography.caption, color: text.muted, marginTop: 2 },
        badges: { gap: spacing.xs, alignItems: 'flex-end' },
      }),
    [text.muted, text.primary, text.secondary],
  );

  return (
    <PremiumCard style={styles.card} onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.main}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        <View style={styles.badges}>
          {moduleLabel ? <PremiumBadge label={moduleLabel} variant="cyan" /> : null}
          <PremiumBadge
            label={resolveWorkflowStatusLabel(status)}
            variant={resolveWorkflowStatusVariant(status)}
            dot
          />
        </View>
      </View>
    </PremiumCard>
  );
}
