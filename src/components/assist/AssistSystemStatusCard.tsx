import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { useAuroraGlassCardStyle } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';
import { buildAssistDashboardSystemStatus } from '@/lib/assist/assistDashboardSystemStatus';
import { radius } from '@/theme';

/** Compact “Systemstatus Assist” card — replaces dominant setup hint banners on dashboard. */
export function AssistSystemStatusCard() {
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
      }),
    [accent, content],
  );

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
