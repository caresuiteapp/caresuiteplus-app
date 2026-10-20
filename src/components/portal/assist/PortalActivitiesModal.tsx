import { ScrollView, StyleSheet, Text } from 'react-native';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { PortalEmptyState } from '@/components/portal/assist/PortalEmptyState';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import type { PortalActivity } from '@/types/portal/assist';

type PortalActivitiesModalProps = {
  visible: boolean;
  activities: PortalActivity[];
  onClose: () => void;
};

function formatActivityDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Glass modal with the portal activity feed. */
export function PortalActivitiesModal({ visible, activities, onClose }: PortalActivitiesModalProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <PortalGlassModal visible={visible} title="Aktivitäten" onClose={onClose}>
      {activities.length === 0 ? (
        <PortalEmptyState message="Noch keine Aktivitäten im Portal — hier erscheinen Ihre letzten Portal-Ereignisse." />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {activities.map((activity) => (
            <GlassCard key={activity.id} style={styles.item}>
              <Text style={[type.body, { color: text.primary, fontWeight: '600' }]} {...noBreakTextProps}>
                {activity.title}
              </Text>
              {activity.description ? (
                <Text style={[type.caption, { color: text.secondary }]}>{activity.description}</Text>
              ) : null}
              <Text style={[type.caption, { color: text.muted }]}>
                {formatActivityDate(activity.createdAt)}
              </Text>
            </GlassCard>
          ))}
        </ScrollView>
      )}
    </PortalGlassModal>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 420,
  },
  listContent: {
    gap: careSpacing.sm,
  },
  item: {
    gap: careSpacing.xs,
  },
});
