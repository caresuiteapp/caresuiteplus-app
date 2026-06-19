import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type PortalEmptyStateProps = {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

/** Glass-friendly empty state — no white surfaces. */
export function PortalEmptyState({
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}: PortalEmptyStateProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <View style={[styles.container, compact && styles.compact]}>
      {title ? (
        <Text style={[type.caption, { color: text.muted, fontWeight: '600' }]}>{title}</Text>
      ) : null}
      <Text style={[compact ? type.caption : type.body, { color: text.secondary }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.cta}>
          <Text style={[type.caption, { color: '#FF9500', fontWeight: '700' }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.xs,
    marginTop: careSpacing.xs,
  },
  compact: {
    marginTop: 0,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: careSpacing.xs,
  },
});
