import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';

export function useWoundRecordStyles() {
  const { c } = useCareLightPalette();
  return useMemo(() => StyleSheet.create({
    stack: { gap: spacing.md, minWidth: 0 },
    hidden: { display: 'none' },
    tight: { gap: spacing.sm, minWidth: 0 },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm, minWidth: 0 },
    field: { flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 },
    galleryCard: { flexGrow: 1, flexShrink: 1, flexBasis: 292, minWidth: 0 },
    toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
      gap: spacing.sm, minWidth: 0 },
    text: { ...typography.body, color: c.text, flexShrink: 1 },
    muted: { ...typography.caption, color: c.muted, flexShrink: 1 },
    title: { ...typography.h3, color: c.text, flexShrink: 1, fontWeight: '700' },
    value: { ...typography.h2, color: c.text, flexShrink: 1, fontWeight: '700' },
    panel: { gap: spacing.sm, borderColor: c.border, borderWidth: 1, borderRadius: 16,
      padding: spacing.md, backgroundColor: c.surfaceAlt, minWidth: 0 },
    tile: { gap: spacing.xs, borderColor: c.border, borderWidth: 1, borderRadius: 13,
      padding: spacing.sm, minWidth: 106, flexGrow: 1, flexBasis: 130, backgroundColor: c.surface },
    image: { width: '100%', height: 340, backgroundColor: c.surfaceAlt, borderRadius: 12 },
    divider: { height: 1, backgroundColor: c.border },
    barTrack: { height: 10, borderRadius: 5, backgroundColor: c.surfaceAlt, minWidth: 0 },
    bar: { height: 10, borderRadius: 5, backgroundColor: c.cyan },
    tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chart: { width: '100%', maxWidth: 680, height: 170 },
  }), [c]);
}
