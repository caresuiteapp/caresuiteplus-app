import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import type { ResidentListItem } from '@/types/modules/stationaer';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { colors, spacing, typography } from '@/theme';

type ResidentListCardProps = {
  resident: ResidentListItem;
  onPress?: () => void;
  selected?: boolean;
};

function statusVariant(status: ResidentListItem['status']) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ResidentListCard({ resident, onPress, selected = false }: ResidentListCardProps) {
  const fullName = `${resident.firstName} ${resident.lastName}`;

  const inner = (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{fullName}</Text>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[resident.status]}
          variant={statusVariant(resident.status)}
          dot
        />
      </View>
      <Text style={styles.meta}>
        {resident.roomName}
        {resident.wing ? ` · ${resident.wing}` : ''}
      </Text>
      {resident.careLevel ? <Text style={styles.careLevel}>{formatCareLevel(resident.careLevel)}</Text> : null}
      <Text style={styles.date}>Aufnahme {formatDate(resident.admissionDate)}</Text>
    </>
  );

  if (!onPress) {
    return <PremiumCard style={styles.card}>{inner}</PremiumCard>;
  }

  return (
    <Pressable onPress={onPress}>
      <PremiumCard
        accentColor={colors.violet}
        style={[styles.card, selected ? styles.cardSelected : null]}
      >
        {inner}
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  cardSelected: {
    borderColor: colors.violet,
    borderWidth: 2,
    backgroundColor: 'rgba(167,139,250,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: 4,
  },
  title: { ...typography.bodyStrong, flex: 1 },
  meta: { ...typography.caption, marginBottom: 4 },
  careLevel: { ...typography.caption, color: colors.violet, marginBottom: 4 },
  date: { ...typography.caption },
});
