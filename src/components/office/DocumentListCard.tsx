import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { PORTAL_DOCUMENT_CATEGORY_LABELS } from '@/types/portal/documents';
import { SENSITIVITY_LABELS, VISIBILITY_LABELS } from '@/types/portal/visibility';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type DocumentListCardProps = {
  document: PortalDocumentListItem;
  onPress?: () => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusVariant(status: PortalDocumentListItem['status']) {
  switch (status) {
    case 'aktiv':
    case 'abgeschlossen':
      return 'green' as const;
    case 'fehlerhaft':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function DocumentListCard({ document, onPress }: DocumentListCardProps) {
  const inner = (
    <>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{document.title}</Text>
        <PremiumBadge
          label={PORTAL_DOCUMENT_CATEGORY_LABELS[document.category]}
          variant="muted"
        />
      </View>
      <Text style={styles.fileName}>{document.fileName}</Text>
      <Text style={styles.meta}>
        {formatFileSize(document.fileSizeBytes)} · {formatDate(document.updatedAt)}
      </Text>
      <View style={styles.badges}>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[document.status]}
          variant={statusVariant(document.status)}
          dot
        />
        <PremiumBadge label={VISIBILITY_LABELS[document.visibility]} variant="cyan" />
        <PremiumBadge
          label={SENSITIVITY_LABELS[document.sensitivity]}
          variant={document.sensitivity === 'restricted' ? 'red' : 'muted'}
        />
      </View>
    </>
  );

  if (!onPress) {
    return (
      <PremiumCard accentColor={colors.orange} style={styles.card}>
        {inner}
      </PremiumCard>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard accentColor={colors.orange} style={styles.card} onPress={onPress}>
        {inner}
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.bodyStrong,
    flex: 1,
  },
  fileName: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  meta: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
