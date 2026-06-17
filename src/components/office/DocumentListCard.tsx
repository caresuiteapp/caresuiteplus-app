import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { buildOfficeDocumentSubtitle, formatOfficeDocumentSizeDisplay } from '@/lib/office/officeDocumentDisplay';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { PORTAL_DOCUMENT_CATEGORY_LABELS } from '@/types/portal/documents';
import { SENSITIVITY_LABELS, VISIBILITY_LABELS } from '@/types/portal/visibility';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

type DocumentListCardProps = {
  document: PortalDocumentListItem;
  selected?: boolean;
  onPress?: () => void;
};

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

export function DocumentListCard({ document, selected = false, onPress }: DocumentListCardProps) {
  const subtitle = buildOfficeDocumentSubtitle(document);
  const sizeLabel = formatOfficeDocumentSizeDisplay(document.sizeLabel, document.fileSizeBytes);

  const inner = (
    <>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{document.title}</Text>
        <PremiumBadge
          label={PORTAL_DOCUMENT_CATEGORY_LABELS[document.category]}
          variant="muted"
        />
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {sizeLabel ? <Text style={styles.meta}>{sizeLabel}</Text> : null}
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

  const cardStyle = [styles.card, selected ? styles.cardSelected : null];

  if (!onPress) {
    return (
      <PremiumCard accentColor={colors.orange} style={cardStyle}>
        {inner}
      </PremiumCard>
    );
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard accentColor={colors.orange} style={cardStyle} onPress={onPress}>
        {inner}
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  cardSelected: {
    borderColor: colors.orange,
    borderWidth: 1,
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
  subtitle: {
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
