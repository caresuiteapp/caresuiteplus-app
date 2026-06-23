import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, Platform, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, SectionPanel } from '@/components/ui';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';
import {
  buildAssistDashboardCheckpoints,
  type AssistDashboardCheckpoint,
} from '@/lib/assist/assistDashboardSystemStatus';
import type { AssistDashboardStats } from '@/types/modules/assist';

type AssistDashboardCheckpointsProps = {
  stats: AssistDashboardStats;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

export function AssistDashboardCheckpoints({ stats }: AssistDashboardCheckpointsProps) {
  const router = useRouter();
  const content = useAdaptiveContentStyles();
  const accent = moduleColor('assist');
  const checkpoints = buildAssistDashboardCheckpoints(stats);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { gap: careSpacing.sm },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: careSpacing.xs,
          gap: careSpacing.sm,
        },
        label: { ...content.body, flex: 1 },
        badge: {
          minWidth: 28,
          paddingHorizontal: careSpacing.sm,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: `${accent}22`,
          alignItems: 'center',
        },
        badgeText: {
          ...content.label,
          color: accent,
        },
      }),
    [accent, content],
  );

  const handlePress = (item: AssistDashboardCheckpoint) => {
    router.push(item.navigationTarget as never);
  };

  return (
    <SectionPanel
      title="Prüfpunkte"
      subtitle="Offene Schritte in Einsätzen und Nachweisen"
    >
      {checkpoints.length === 0 ? (
        <EmptyState
          title="Keine offenen Prüfpunkte"
          message="Alle Prüfpunkte für heute sind erledigt."
        />
      ) : (
        <View style={styles.list}>
          {checkpoints.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.row, webCursor]}
              onPress={() => handlePress(item)}
              accessibilityRole="button"
            >
              <Text style={styles.label}>{item.label}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.count}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </SectionPanel>
  );
}
