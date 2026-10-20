import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useMessagingGlassSurface } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import type { OfficeMessageThread } from '@/types/office/messaging';
import { getPortalStatusLabel } from '@/lib/office/portalofficemessageservice';

type PortalOfficeStatusCardProps = {
  thread: OfficeMessageThread;
  variant?: 'default' | 'glass';
};

export function PortalOfficeStatusCard({ thread, variant = 'default' }: PortalOfficeStatusCardProps) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const isGlass = variant === 'glass';
  const { surfaces, ink } = useMessagingGlassSurface(isGlass);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          margin: spacing.md,
          padding: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: isGlass ? surfaces.border : c.border,
          backgroundColor: isGlass ? surfaces.chip : `${c.violet}11`,
          gap: spacing.xs,
        },
        label: {
          ...typography.caption,
          color: ink?.muted ?? c.muted,
          textTransform: 'uppercase',
        },
        status: { ...typography.h3, color: ink?.primary ?? c.text },
        meta: { ...typography.caption, color: ink?.secondary ?? c.muted },
      }),
    [c, ink, isGlass, surfaces.border, surfaces.chip, typography],
  );

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Status</Text>
      <Text style={styles.status}>{getPortalStatusLabel(thread.status)}</Text>
      {thread.categoryLabel ? (
        <Text style={styles.meta}>Kategorie: {thread.categoryLabel}</Text>
      ) : null}
      {['resolved', 'closed', 'archived'].includes(thread.status) ? (
        <Text style={styles.meta}>Dieser Chat ist abgeschlossen.</Text>
      ) : null}
    </View>
  );
}
