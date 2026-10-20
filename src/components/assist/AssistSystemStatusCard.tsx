import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { useAuroraGlassCardStyle } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';
import { buildAssistDashboardSystemStatus } from '@/lib/assist/assistDashboardSystemStatus';
import { radius } from '@/theme';

type AssistSystemStatusCardProps = {
  /** Smaller variant for sidebar placement under Schnellzugriff. */
  compact?: boolean;
};

/** Compact “Systemstatus Assist” card — replaces dominant setup hint banners on dashboard. */
export function AssistSystemStatusCard({ compact = false }: AssistSystemStatusCardProps) {
  const content = useAdaptiveContentStyles();
  const glassCardStyle = useAuroraGlassCardStyle({ intensity: 'default' });
  const accent = moduleColor('assist');
  const items = buildAssistDashboardSystemStatus();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: `${accent}33`,
          padding: careSpacing.md,
          gap: careSpacing.sm,
        },
        heading: {
          ...content.bodyStrong,
          fontSize: 14,
        },
        row: {
          flexDirection: 'row',
          gap: careSpacing.sm,
          alignItems: 'flex-start',
        },
        dot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: accent,
          marginTop: 6,
        },
        textCol: {
          flex: 1,
          gap: 2,
        },
        title: {
          ...content.label,
          color: content.primary.color,
        },
        detail: {
          ...content.caption,
        },
        compactCard: {
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: `${accent}22`,
          padding: careSpacing.sm,
          gap: careSpacing.xs,
        },
        compactHeading: {
          ...content.label,
          fontSize: 12,
          color: content.muted.color,
        },
        compactLine: {
          ...content.caption,
          fontSize: 11,
          lineHeight: 15,
        },
      }),
    [accent, content],
  );

  if (compact) {
    return (
      <View style={[styles.compactCard, glassCardStyle]}>
        <Text style={styles.compactHeading}>Systemstatus</Text>
        {items.map((item) => (
          <Text key={item.id} style={styles.compactLine} numberOfLines={2}>
            {item.title} — {item.detail}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.card, glassCardStyle]}>
      <Text style={styles.heading}>Systemstatus Assist</Text>
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.dot} />
          <View style={styles.textCol}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.detail}>{item.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
