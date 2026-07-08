import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable, type DataTableColumn } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import {
  formatWfmDurationMinutes,
  formatWfmPlanTimeRange,
  formatWfmReviewQueueIstLine,
  formatWfmReviewQueuePlannedDuration,
} from '@/lib/wfm/wfmDisplayHelpers';
import { resolveWfmOfficeTimeDisplay } from '@/lib/wfm/wfmOfficeTimeDisplayResolver';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import {
  WFM_DEVIATION_AMPEL_LABELS,
  WFM_OFFICE_TIME_STATUS_LABELS,
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

function planCell(entry: WfmOfficeTimeEntry): string {
  const display = resolveWfmOfficeTimeDisplay(entry);
  const range = formatWfmPlanTimeRange(entry.plannedStartAt, entry.plannedEndAt, entry.planDisplayStatus);
  if (display.isPlannedOnly) {
    return `${range} · ${formatWfmReviewQueuePlannedDuration(entry)}`;
  }
  return range;
}

function einsatzIstCell(entry: WfmOfficeTimeEntry): string {
  const display = resolveWfmOfficeTimeDisplay(entry);
  if (display.hasAssignmentActual) {
    return formatWfmReviewQueueIstLine(entry);
  }
  return '—';
}

function buchungCell(entry: WfmOfficeTimeEntry): string {
  const display = resolveWfmOfficeTimeDisplay(entry);
  if (display.hasTimeEntry) {
    return `${formatWfmDurationMinutes(entry.netMinutes)} netto`;
  }
  if (display.displaySource === 'assignment_actual') {
    return display.displayDurationLabel;
  }
  return '—';
}

export function WfmOfficeTimeEntryTable({ entries, selectedId, onSelect, reviewQueueMode = false }: Props) {
  const text = useAuroraAdaptiveText();

  const columns: DataTableColumn<WfmOfficeTimeEntry>[] = [
    {
      key: 'date',
      label: 'Datum',
      width: 96,
      render: (entry) => (
        <Text style={{ color: text.primary, ...typography.caption }}>{entry.workDate}</Text>
      ),
    },
    {
      key: 'employee',
      label: 'Mitarbeiter',
      flex: 1,
      minWidth: 100,
      render: (entry) => (
        <Text style={{ color: text.primary, ...typography.caption }} numberOfLines={1}>
          {entry.employeeName}
        </Text>
      ),
    },
    {
      key: 'client',
      label: 'Klient',
      flex: 1,
      minWidth: 90,
      render: (entry) => (
        <Text style={{ color: text.secondary, ...typography.caption }} numberOfLines={1}>
          {entry.clientLabel ?? entry.assignmentTitle ?? '—'}
        </Text>
      ),
    },
    {
      key: 'plan',
      label: 'Plan',
      flex: 1.2,
      minWidth: 110,
      render: (entry) => (
        <Text style={{ color: text.secondary, ...typography.caption }} numberOfLines={2}>
          {planCell(entry)}
        </Text>
      ),
    },
    {
      key: 'einsatz',
      label: 'Einsatz-Ist',
      flex: 1,
      minWidth: 100,
      render: (entry) => (
        <Text style={{ color: text.secondary, ...typography.caption }} numberOfLines={2}>
          {einsatzIstCell(entry)}
        </Text>
      ),
    },
    {
      key: 'buchung',
      label: 'Buchung',
      width: 88,
      render: (entry) => (
        <Text style={{ color: text.secondary, ...typography.caption }} numberOfLines={1}>
          {buchungCell(entry)}
        </Text>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 120,
      render: (entry) => (
        <View style={styles.statusCell}>
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
          {entry.overallAmpel ? (
            <PremiumBadge
              label={WFM_DEVIATION_AMPEL_LABELS[entry.overallAmpel]}
              variant={ampelVariant(entry.overallAmpel)}
            />
          ) : null}
        </View>
      ),
    },
    {
      key: 'action',
      label: 'Aktion',
      width: 88,
      align: 'right',
      render: (entry) => {
        const selected = selectedId === entry.id;
        return (
          <PremiumButton
            title={selected ? 'Schließen' : reviewQueueMode ? 'Prüfen' : 'Details'}
            variant={reviewQueueMode && !selected ? 'secondary' : 'ghost'}
            onPress={() => onSelect(selected ? null : entry.id)}
          />
        );
      },
    },
  ];

  return (
    <View style={styles.wrap} testID="wfm-office-time-entry-table">
      <PremiumDataTable
        columns={columns}
        data={entries}
        keyExtractor={(entry) => entry.id}
        selectedId={selectedId}
        onRowPress={(entry) => onSelect(selectedId === entry.id ? null : entry.id)}
        emptyMessage="Keine Arbeitszeiteinträge im gewählten Zeitraum."
      />
      {entries.length > 0 ? (
        <Text style={[styles.footerHint, { color: text.muted }]}>
          {entries.length} Einträge · Plan und Einsatz-Ist getrennt dargestellt
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: careSpacing.xs },
  statusCell: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  footerHint: { ...typography.caption, fontSize: 10, marginTop: 4 },
});
