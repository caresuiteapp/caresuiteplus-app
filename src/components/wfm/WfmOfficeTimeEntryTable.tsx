import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumButton } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import {
  formatWfmPlanTimeRange,
  formatWfmReviewQueueGesamtLabel,
  formatWfmReviewQueueIstLine,
  formatWfmReviewQueuePlannedDuration,
  formatWfmReviewQueueStartLabel,
  formatWfmReviewQueueEndLabel,
} from '@/lib/wfm/wfmDisplayHelpers';
import { resolveWfmOfficeTimeDisplay } from '@/lib/wfm/wfmOfficeTimeDisplayResolver';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import {
  WFM_DEVIATION_AMPEL_LABELS,
  WFM_OFFICE_TIME_STATUS_LABELS,
  WFM_OFFICE_WORK_KIND_LABELS,
} from '@/types/modules/wfmOfficeTimekeeping';
import { typography } from '@/theme';

type Props = {
  entries: WfmOfficeTimeEntry[];
  selectedId: string | null;
  onSelect: (entryId: string | null) => void;
  reviewQueueMode?: boolean;
};

function ampelVariant(ampel: string | null): 'green' | 'yellow' | 'red' | 'muted' {
  if (ampel === 'green') return 'green';
  if (ampel === 'yellow') return 'yellow';
  if (ampel === 'red' || ampel === 'blue') return 'red';
  return 'muted';
}

function rowStatusLabel(entry: WfmOfficeTimeEntry): string {
  if (entry.rowKind === 'planned_missing_actual' || entry.flags.includes('missing_booking')) {
    return 'Fehlende Buchung';
  }
  if (entry.rowKind === 'unplanned_actual' || entry.flags.includes('unplanned')) {
    return 'Ungeplante Arbeitszeit';
  }
  if (entry.rowKind === 'manual_entry') {
    return 'Office-Nachtrag';
  }
  return WFM_OFFICE_TIME_STATUS_LABELS[entry.reviewStatus];
}

export function WfmOfficeTimeEntryTable({ entries, selectedId, onSelect, reviewQueueMode = false }: Props) {
  const text = useAuroraAdaptiveText();

  if (entries.length === 0) {
    return (
      <Text style={{ color: text.secondary, ...typography.body }}>
        Keine Arbeitszeiteinträge im gewählten Zeitraum.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      {entries.map((entry) => {
        const selected = selectedId === entry.id;
        const display = resolveWfmOfficeTimeDisplay(entry);
        return (
          <View
            key={entry.id}
            style={[
              styles.row,
              { borderColor: selected ? text.primary : text.border },
            ]}
          >
            <View style={styles.main}>
              <Text style={{ color: text.primary, ...typography.bodyMedium }}>
                {entry.workDate} · {entry.employeeName}
                {entry.clientLabel || entry.assignmentTitle
                  ? ` · ${entry.clientLabel ?? entry.assignmentTitle}`
                  : ''}
              </Text>
              <Text style={{ color: text.secondary, ...typography.caption }}>
                {WFM_OFFICE_WORK_KIND_LABELS[entry.workKind]} · {formatWfmReviewQueueIstLine(entry)}
              </Text>
              <Text style={{ color: text.secondary, ...typography.caption }}>
                Plan: {formatWfmPlanTimeRange(entry.plannedStartAt, entry.plannedEndAt, entry.planDisplayStatus)}
                {display.isPlannedOnly
                  ? ` · Geplante Dauer: ${formatWfmReviewQueuePlannedDuration(entry)}`
                  : ''}
              </Text>
              {display.displaySource === 'assignment_actual' ? (
                <Text style={{ color: text.secondary, ...typography.caption }}>
                  {display.displayDurationLabel}
                </Text>
              ) : null}
              <Text style={{ color: text.secondary, ...typography.caption }}>
                {formatWfmReviewQueueStartLabel(entry, entry.startAmpel)} ·{' '}
                {formatWfmReviewQueueEndLabel(entry, entry.endAmpel)} ·{' '}
                {formatWfmReviewQueueGesamtLabel(entry)}
              </Text>
            </View>
            <View style={styles.badges}>
              <PremiumBadge
                label={rowStatusLabel(entry)}
                variant={
                  entry.reviewStatus === 'approved'
                    ? 'green'
                    : entry.flags.includes('missing_booking') || entry.flags.includes('unplanned')
                      ? 'orange'
                      : 'muted'
                }
              />
              {display.displaySource === 'assignment_actual' ? (
                <PremiumBadge label="Fehlende Buchung" variant="orange" />
              ) : null}
              {entry.overallAmpel ? (
                <PremiumBadge
                  label={`Gesamt ${WFM_DEVIATION_AMPEL_LABELS[entry.overallAmpel]}`}
                  variant={ampelVariant(entry.overallAmpel)}
                />
              ) : null}
              {entry.hasOpenOfficeMessage ? (
                <PremiumBadge label="Office-Meldung" variant="orange" />
              ) : null}
            </View>
            <PremiumButton
              title={selected ? 'Schließen' : reviewQueueMode ? 'Prüfen' : 'Details'}
              variant="ghost"
              onPress={() => onSelect(selected ? null : entry.id)}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: careSpacing.sm },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: careSpacing.md,
    gap: careSpacing.sm,
  },
  main: { gap: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.xs },
});
