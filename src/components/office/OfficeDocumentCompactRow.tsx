import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge } from '@/components/ui';

import type { PortalDocumentListItem } from '@/types/portal/documents';
import { PORTAL_DOCUMENT_CATEGORY_LABELS } from '@/types/portal/documents';
import { colors, spacing, typography } from '@/theme';

type OfficeDocumentCompactRowProps = {
  document: PortalDocumentListItem;
  selected?: boolean;
  onPress?: () => void;
};

export function OfficeDocumentCompactRow({
  document,
  selected = false,
  onPress,
}: OfficeDocumentCompactRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, selected ? styles.rowSelected : null]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {document.title}
        </Text>
        {document.clientName?.trim() ? (
          <Text style={styles.meta} numberOfLines={1}>
            {document.clientName.trim()}
          </Text>
        ) : null}
      </View>
      <PremiumBadge label={PORTAL_DOCUMENT_CATEGORY_LABELS[document.category]} variant="muted" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.bgBase,
    minHeight: 56,
  },
  rowSelected: {
    backgroundColor: colors.bgElevated,
    borderLeftWidth: 3,
    borderLeftColor: colors.orange,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.bodyStrong,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
