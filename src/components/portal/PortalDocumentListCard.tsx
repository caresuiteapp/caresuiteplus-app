import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
import { lightSurfaceText } from '@/design/tokens/auroraGlass';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { moduleColor } from '@/design/tokens/modules';
import { withAlpha } from '@/design/tokens/motion';
import { PremiumBadge } from '@/components/ui';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import { PORTAL_DOCUMENT_CATEGORY_LABELS } from '@/types/portal/documents';
import { SENSITIVITY_LABELS, VISIBILITY_LABELS } from '@/types/portal/visibility';

type PortalDocumentListCardProps = {
  document: PortalDocumentListItem;
  metaLine: string;
  onPress?: () => void;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

/** M.1 document list row — opaque light card, WCAG-readable text. */
export function PortalDocumentListCard({ document, metaLine, onPress }: PortalDocumentListCardProps) {
  const text = lightSurfaceText;
  const accent = moduleColor('assist');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed, webCursor]}
      accessibilityRole="button"
      testID={`portal-document-card-${document.id}`}
    >
      <GlassCard
        style={[
          styles.card,
          {
            backgroundColor: careLightColors.surface,
            borderColor: withAlpha(accent, 0.22),
          },
        ]}
      >
        <View style={[styles.statusBar, { backgroundColor: accent }]} />
        <View style={styles.inner}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: text.primary }]}>{document.title}</Text>
            <PremiumBadge label={PORTAL_DOCUMENT_CATEGORY_LABELS[document.category]} variant="muted" />
          </View>
          {document.displayFileName ? (
            <Text style={[styles.secondary, { color: text.secondary }]}>{document.displayFileName}</Text>
          ) : null}
          <Text style={[styles.meta, { color: text.muted }]}>{metaLine}</Text>
          <View style={styles.badges}>
            <PremiumBadge label={VISIBILITY_LABELS[document.visibility]} variant="cyan" />
            <PremiumBadge
              label={SENSITIVITY_LABELS[document.sensitivity]}
              variant={document.sensitivity === 'restricted' ? 'red' : 'muted'}
            />
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    padding: 0,
  },
  pressed: { opacity: 0.92 },
  statusBar: { height: 3, width: '100%' },
  inner: { padding: careSpacing.md, gap: careSpacing.xs },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
  },
  title: { ...careTypography.bodyStrong, flex: 1, minWidth: 0 },
  secondary: { ...careTypography.body },
  meta: { ...careTypography.caption },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
    marginTop: careSpacing.xs,
  },
});
