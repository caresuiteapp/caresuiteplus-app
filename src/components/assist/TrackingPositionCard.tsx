import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import type { VehiclePosition } from '@/types/modules/assist';
import { colors, spacing, typography } from '@/theme';

type TrackingPositionCardProps = {
  position: VehiclePosition;
  selected?: boolean;
  onPress?: () => void;
};

export function TrackingPositionCard({
  position,
  selected = false,
  onPress,
}: TrackingPositionCardProps) {
  return (
    <PremiumCard
      accentColor={position.insideGeofence ? colors.success : colors.amber}
      onPress={onPress}
      style={selected ? styles.cardSelected : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{position.employeeName}</Text>
        <PremiumBadge
          label={position.insideGeofence ? 'Im Einsatzgebiet' : 'Außerhalb'}
          variant={position.insideGeofence ? 'green' : 'orange'}
          dot
        />
      </View>
      <Text style={styles.meta}>
        {position.assignmentTitle ?? 'Kein Einsatz'} · {position.speedKmh} km/h {position.heading}
      </Text>
      <Text style={styles.coords}>
        {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
      </Text>
      <Text style={styles.updated}>
        Aktualisiert {new Date(position.updatedAt).toLocaleTimeString('de-DE')}
      </Text>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  cardSelected: {
    borderColor: colors.amber,
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    ...typography.bodyStrong,
    flex: 1,
  },
  meta: {
    ...typography.caption,
    marginTop: 4,
  },
  coords: {
    ...typography.caption,
    color: colors.cyan,
    marginTop: spacing.xs,
  },
  updated: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
});
