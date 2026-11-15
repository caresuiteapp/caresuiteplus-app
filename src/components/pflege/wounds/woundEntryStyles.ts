import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';

export function useWoundEntryStyles() {
  const { c } = useCareLightPalette();
  return useMemo(() => StyleSheet.create({
    content: { width: '100%', maxWidth: 1440, alignSelf: 'center', gap: spacing.md, minWidth: 0, paddingBottom: spacing.md },
    formWidth: { maxWidth: 1100 },
    columns: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.md },
    mainColumn: { flexBasis: 450, flexGrow: 1.25, flexShrink: 1, minWidth: 0, gap: spacing.md },
    mapColumn: { flexBasis: 380, flexGrow: 1, flexShrink: 1, minWidth: 0 },
    formColumn: { flexBasis: 345, flexGrow: 1, flexShrink: 1, minWidth: 0, gap: spacing.md },
    panel: {
      minWidth: 0, gap: spacing.md, padding: spacing.md, backgroundColor: c.surface,
      borderRadius: 16, borderWidth: 1, borderColor: c.border,
    },
    sectionHeading: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 4 },
    sectionBody: { gap: spacing.md, minWidth: 0 },
    fact: { flexBasis: 210, flexGrow: 1, minWidth: 0, gap: 4, padding: spacing.sm,
      backgroundColor: c.surfaceAlt, borderRadius: 10 },
    narrativeFact: { flexBasis: 440 },
    stack: { gap: spacing.sm, minWidth: 0 },
    toolbar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: spacing.sm, minWidth: 0,
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm,
      minWidth: 0, maxWidth: '100%', flexShrink: 1 },
    title: { ...typography.h3, color: c.text, fontWeight: '700', flexShrink: 1 },
    headingRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
    body: { ...typography.body, color: c.text, flexShrink: 1 },
    muted: { ...typography.caption, color: c.muted, flexShrink: 1 },
    empty: {
      alignItems: 'flex-start', gap: spacing.xs, padding: spacing.md, minWidth: 0,
      borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceAlt,
    },
    list: { borderWidth: 1, borderColor: c.border, borderRadius: 12, overflow: 'hidden' },
    record: {
      flexDirection: 'row', alignItems: 'center', minHeight: 66, gap: spacing.sm, padding: spacing.sm,
      backgroundColor: c.surface, flexWrap: 'wrap',
    },
    recordActive: { backgroundColor: c.surfaceAlt },
    pickerRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      padding: spacing.sm, backgroundColor: c.surface },
    divider: { borderTopWidth: 1, borderTopColor: c.border },
    identity: { flexBasis: 172, flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 },
    badge: {
      backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
      paddingVertical: 4, paddingHorizontal: 8, borderRadius: 9,
    },
  }), [c]);
}
