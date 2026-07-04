import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumAvatar, PremiumBadge } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import {
  formatWfmDurationMinutes,
  formatWfmTime,
} from '@/lib/wfm/wfmDisplayHelpers';
import type { WfmTeamTodayRow } from '@/types/modules/wfm';
import { typography } from '@/theme';

type Props = {
  row: WfmTeamTodayRow;
  selected: boolean;
  onPress: () => void;
};

function statusBadgeVariant(
  row: WfmTeamTodayRow,
): 'green' | 'orange' | 'red' | 'muted' | 'cyan' {
  if (row.absence) {
    if (row.absence.absenceType === 'vacation') return 'cyan';
    if (row.absence.absenceType === 'sick_leave' || row.absence.absenceType === 'child_sick_leave') {
      return 'orange';
    }
    return 'muted';
  }
  if (row.isOnline) return 'green';
  if (row.session?.status === 'ended') return 'muted';
  return 'muted';
}

export function WfmTeamTodayEmployeeCard({ row, selected, onPress }: Props) {
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('office');

  const detailParts = [
    row.workTypeLabel,
    row.startedAt ? `Start ${formatWfmTime(row.startedAt)}` : null,
    row.endedAt ? `Ende ${formatWfmTime(row.endedAt)}` : null,
    row.breakMinutes > 0 ? `Pause ${formatWfmDurationMinutes(row.breakMinutes)}` : null,
    row.totalMinutes > 0 ? `Gesamt ${formatWfmDurationMinutes(row.totalMinutes)}` : null,
    row.lastEventSourceLabel ? `Quelle ${row.lastEventSourceLabel}` : null,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, selected ? styles.cardSelected : null]}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <PremiumAvatar
          name={row.employeeName}
          imageUri={row.avatarUrl ?? undefined}
          size="sm"
          accentColor={accent}
          showOnline={row.isOnline}
        />
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: text.primary }]} numberOfLines={1}>
            {row.employeeName}
          </Text>
          <PremiumBadge label={row.statusLabel} variant={statusBadgeVariant(row)} dot={row.isOnline} />
        </View>
      </View>

      {detailParts.length > 0 ? (
        <Text style={[styles.detailLine, { color: text.secondary }]} numberOfLines={2}>
          {detailParts.join(' · ')}
        </Text>
      ) : (
        <Text style={[styles.detailLine, { color: text.secondary }]}>
          {row.absence
            ? 'Abwesenheit heute — keine Arbeitszeit erfasst'
            : 'Noch keine Zeiterfassung heute'}
        </Text>
      )}

      {row.warnings.length > 0 ? (
        <Text style={styles.warning} numberOfLines={2}>
          {row.warnings[0]}
          {row.warnings.length > 1 ? ` (+${row.warnings.length - 1})` : ''}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  cardSelected: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  headerText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: careSpacing.sm,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
    flexShrink: 1,
  },
  detailLine: {
    ...typography.caption,
    marginTop: careSpacing.xs,
    marginLeft: 40,
  },
  warning: {
    ...typography.caption,
    color: '#b54708',
    marginTop: 4,
    marginLeft: 40,
  },
});
