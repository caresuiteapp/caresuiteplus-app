import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CareDocumentationListItem } from '@/lib/pflege/careDocumentationTypes';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type CareDocumentationListCardProps = {
  item: CareDocumentationListItem;
  onPress?: () => void;
};

function statusVariant(status: CareDocumentationListItem['status']) {
  switch (status) {
    case 'abgeschlossen':
      return 'green' as const;
    case 'in_bearbeitung':
      return 'orange' as const;
    case 'fehlerhaft':
      return 'red' as const;
    default:
      return 'muted' as const;
  }
}

export function CareDocumentationListCard({ item, onPress }: CareDocumentationListCardProps) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <PremiumCard style={styles.card} accentColor={colors.cyan}>
        <View style={styles.header}>
          <Text style={styles.title}>{item.title}</Text>
          <PremiumBadge label={WORKFLOW_STATUS_LABELS[item.status]} variant={statusVariant(item.status)} dot />
        </View>
        <Text style={styles.client}>{item.clientName}</Text>
        <Text style={styles.meta}>{item.employeeName}</Text>
        <Text style={styles.preview} numberOfLines={2}>
          {item.contentPreview}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.time}>
            {new Date(item.recordedAt).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {item.hasSignature ? (
            <PremiumBadge label="Signiert" variant="green" />
          ) : (
            <PremiumBadge label="Offen" variant="orange" />
          )}
        </View>
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.h3, flex: 1, marginRight: spacing.sm },
  client: { ...typography.bodyStrong, marginBottom: 2 },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: 4 },
  preview: { ...typography.body, marginBottom: spacing.xs },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: { ...typography.caption, color: colors.cyan },
});
