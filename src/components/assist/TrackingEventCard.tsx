import { StyleSheet, Text } from 'react-native';
import { PremiumCard } from '@/components/ui';
import type { GeofenceEvent } from '@/types/modules/assist';
import { colors, spacing, typography } from '@/theme';

type TrackingEventCardProps = {
  event: GeofenceEvent;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TrackingEventCard({ event }: TrackingEventCardProps) {
  return (
    <PremiumCard accentColor={event.type === 'enter' ? colors.success : colors.cyan}>
      <Text style={styles.title}>
        {event.type === 'enter' ? 'Eintritt' : 'Austritt'}: {event.label}
      </Text>
      <Text style={styles.meta}>
        {event.employeeName} · {formatTime(event.timestamp)}
      </Text>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.bodyStrong,
  },
  meta: {
    ...typography.caption,
    marginTop: 4,
  },
});
