import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MedicationListItem } from '@/data/demo/medications';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type MedicationListCardProps = {
  item: MedicationListItem;
  onPress?: () => void;
};

export function MedicationListCard({ item, onPress }: MedicationListCardProps) {
  const variant =
    item.status === 'aktiv' ? 'green' : item.status === 'in_bearbeitung' ? 'orange' : 'muted';

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <PremiumCard style={styles.card} accentColor={colors.cyan}>
        <View style={styles.header}>
          <Text style={styles.title}>{item.medicationName}</Text>
          <PremiumBadge label={item.status} variant={variant} />
        </View>
        <Text style={styles.client}>{item.clientName}</Text>
        <Text style={styles.meta}>
          {item.dosage} · {item.schedule} · {item.route}
        </Text>
        <Text style={styles.meta}>Verordnet von {item.prescribedBy}</Text>
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.h3, flex: 1, marginRight: spacing.sm },
  client: { ...typography.bodyStrong, marginBottom: 4 },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
});
