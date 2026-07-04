import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumButton } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { formatWfmDurationMinutes, formatWfmTime } from '@/lib/wfm/wfmDisplayHelpers';
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
};

function ampelVariant(ampel: string | null): 'green' | 'yellow' | 'red' | 'muted' {
  if (ampel === 'green') return 'green';
  if (ampel === 'yellow') return 'yellow';
  if (ampel === 'red' || ampel === 'blue') return 'red';
  return 'muted';
}

export function WfmOfficeTimeEntryTable({ entries, selectedId, onSelect }: Props) {
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
              </Text>
              <Text style={{ color: text.secondary, ...typography.caption }}>
                {WFM_OFFICE_WORK_KIND_LABELS[entry.workKind]} ·{' '}
                {formatWfmTime(entry.actualStartAt)} – {formatWfmTime(entry.actualEndAt)} ·{' '}
                {formatWfmDurationMinutes(entry.netMinutes)}
              </Text>
              <Text style={{ color: text.secondary, ...typography.caption }}>
                Plan: {formatWfmTime(entry.plannedStartAt)} – {formatWfmTime(entry.plannedEndAt)}
              </Text>
            </View>
            <View style={styles.badges}>
              <PremiumBadge
                label={WFM_OFFICE_TIME_STATUS_LABELS[entry.reviewStatus]}
                variant={entry.reviewStatus === 'approved' ? 'green' : 'muted'}
              />
              {entry.overallAmpel ? (
                <PremiumBadge
                  label={`Gesamt ${WFM_DEVIATION_AMPEL_LABELS[entry.overallAmpel]}`}
                  variant={ampelVariant(entry.overallAmpel)}
                />
              ) : null}
              {entry.hasOpenOfficeMessage ? (
                <PremiumBadge label="Office-Meldung" variant="yellow" />
              ) : null}
            </View>
            <PremiumButton
              title={selected ? 'Schließen' : 'Details'}
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
