import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { PremiumBadge, PremiumButton, PremiumDataTable, type DataTableColumn } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import {
  formatWfmPlanTimeRange,
  formatWfmReviewQueueBuchungLabel,
  formatWfmReviewQueueIstLine,
  formatWfmReviewQueueIstStack,
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

const REVIEW_COL = {
  date: 110,
  employee: 150,
  client: 160,
  plan: 150,
  einsatz: 180,
  buchung: 160,
  status: 170,
  action: 130,
} as const;

const REVIEW_MIN_TABLE_WIDTH =
  REVIEW_COL.date +
  REVIEW_COL.employee +
  REVIEW_COL.client +
  REVIEW_COL.plan +
  REVIEW_COL.einsatz +
  REVIEW_COL.buchung +
  REVIEW_COL.status +
  REVIEW_COL.action;

const COMPACT_ACTION_BUTTON = {
  width: 104,
  minWidth: 96,
  maxWidth: 112,
  height: 38,
  paddingHorizontal: 10,
} as const;

function ampelVariant(ampel: string | null): 'green' | 'yellow' | 'red' | 'muted' {
  if (ampel === 'green') return 'green';
  if (ampel === 'yellow') return 'yellow';
  if (ampel === 'red' || ampel === 'blue') return 'red';
  return 'muted';
}

function rowStatusLabel(entry: WfmOfficeTimeEntry, compact: boolean): string {
  if (entry.rowKind === 'planned_missing_actual' || entry.flags.includes('missing_booking')) {
    return compact ? 'Fehlt' : 'Fehlende Buchung';
  }
  if (entry.rowKind === 'unplanned_actual' || entry.flags.includes('unplanned')) {
    return compact ? 'Ungeplant' : 'Ungeplante Arbeitszeit';
  }
  if (entry.rowKind === 'manual_entry') {
    return compact ? 'Nachtrag' : 'Office-Nachtrag';
  }
  const full = WFM_OFFICE_TIME_STATUS_LABELS[entry.reviewStatus];
  if (compact && full.length > 14) return `${full.slice(0, 12)}…`;
  return full;
}

function planCellLines(entry: WfmOfficeTimeEntry): { text: string; tone?: 'primary' | 'secondary' | 'muted' }[] {
  const display = resolveWfmOfficeTimeDisplay(entry);
  const range = formatWfmPlanTimeRange(entry.plannedStartAt, entry.plannedEndAt, entry.planDisplayStatus);
  const duration = formatWfmReviewQueuePlannedDuration(entry);
  if (display.isPlannedOnly && duration !== '—') {
    return [
      { text: range, tone: 'secondary' },
      { text: duration, tone: 'muted' },
    ];
  }
  return [{ text: range, tone: 'secondary' }];
}

function planCell(entry: WfmOfficeTimeEntry): string {
  return planCellLines(entry).map((line) => line.text).join(' · ');
}

function webTitleProps(text: string) {
  return Platform.OS === 'web' ? ({ title: text } as object) : {};
}

function CellText({
  children,
  tone = 'primary',
  lines = 2,
  tooltip,
}: {
  children: string;
  tone?: 'primary' | 'secondary' | 'muted';
  lines?: number;
  tooltip?: string;
}) {
  const text = useAuroraAdaptiveText();
  const color = tone === 'primary' ? '#0F1B33' : tone === 'secondary' ? text.secondary : text.muted;
  return (
    <Text
      style={[styles.cellText, { color }, tone === 'primary' ? styles.cellTextStrong : null]}
      numberOfLines={lines}
      ellipsizeMode="tail"
      {...webTitleProps(tooltip ?? children)}
    >
      {children}
    </Text>
  );
}

function StackCell({ lines }: { lines: { text: string; tone?: 'primary' | 'secondary' | 'muted' }[] }) {
  return (
    <View style={styles.stackCell}>
      {lines.map((line, index) => (
        <CellText key={`${index}-${line.text}`} tone={line.tone ?? 'secondary'} lines={1} tooltip={line.text}>
          {line.text}
        </CellText>
      ))}
    </View>
  );
}

function WfmReviewStatusBadge({ entry, compact }: { entry: WfmOfficeTimeEntry; compact: boolean }) {
  const variant =
    entry.reviewStatus === 'approved'
      ? 'green'
      : entry.flags.includes('missing_booking') || entry.flags.includes('unplanned')
        ? 'warning'
        : 'muted';

  return (
    <View style={styles.statusBadgeWrap}>
      <PremiumBadge label={rowStatusLabel(entry, compact)} variant={variant} size="compact" style={styles.statusBadge} />
      {entry.overallAmpel ? (
        <PremiumBadge
          label={WFM_DEVIATION_AMPEL_LABELS[entry.overallAmpel]}
          variant={ampelVariant(entry.overallAmpel)}
          size="compact"
          style={styles.statusBadge}
        />
      ) : null}
    </View>
  );
}

function ReviewActionButton({
  selected,
  reviewQueueMode,
  onPress,
}: {
  selected: boolean;
  reviewQueueMode: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.actionCell}>
      <PremiumButton
        title={selected ? 'Schließen' : reviewQueueMode ? 'Prüfen' : 'Details'}
        variant={reviewQueueMode && !selected ? 'secondary' : 'ghost'}
        size="sm"
        style={COMPACT_ACTION_BUTTON}
        onPress={onPress}
      />
    </View>
  );
}

function ReviewQueueMobileCard({
  entry,
  selected,
  onSelect,
}: {
  entry: WfmOfficeTimeEntry;
  selected: boolean;
  onSelect: (entryId: string | null) => void;
}) {
  const text = useAuroraAdaptiveText();
  const istStack = formatWfmReviewQueueIstStack(entry);

  return (
    <View
      style={[
        styles.mobileCard,
        { borderColor: text.border, backgroundColor: '#FAFBFC' },
        selected ? styles.mobileCardSelected : null,
      ]}
      testID={`wfm-review-card-${entry.id}`}
    >
      <View style={styles.mobileCardHeader}>
        <Text style={[styles.mobileCardDate, { color: '#0F1B33' }]}>{entry.workDate}</Text>
        <WfmReviewStatusBadge entry={entry} compact />
      </View>
      <Text style={[styles.mobileCardPrimary, { color: '#0F1B33' }]} numberOfLines={1}>
        {entry.employeeName}
      </Text>
      <Text style={[styles.mobileCardSecondary, { color: text.secondary }]} numberOfLines={1}>
        {entry.clientLabel ?? entry.assignmentTitle ?? '—'}
      </Text>
      <Text style={[styles.mobileCardSecondary, { color: text.secondary }]} numberOfLines={2}>
        {`Plan: ${planCell(entry)}`}
      </Text>
      {istStack ? (
        <StackCell
          lines={[
            { text: `Zeit: ${istStack.zeit}`, tone: 'primary' },
            { text: `Quelle: ${istStack.quelle}` },
            ...(istStack.dauer ? [{ text: `Dauer: ${istStack.dauer}` }] : []),
          ]}
        />
      ) : (
        <CellText tone="secondary">Einsatz-Ist: —</CellText>
      )}
      <CellText tone="primary" tooltip={`Buchung: ${formatWfmReviewQueueBuchungLabel(entry)}`}>
        {`Buchung: ${formatWfmReviewQueueBuchungLabel(entry)}`}
      </CellText>
      <View style={styles.mobileCardAction}>
        <ReviewActionButton selected={selected} reviewQueueMode onPress={() => onSelect(selected ? null : entry.id)} />
      </View>
    </View>
  );
}

export function WfmOfficeTimeEntryTable({ entries, selectedId, onSelect, reviewQueueMode = false }: Props) {
  const text = useAuroraAdaptiveText();
  const { width } = useWindowDimensions();
  // Once the detail panel opens, cards keep every value readable instead of
  // squeezing a 1,264 px table into the remaining split-pane width.
  const mobileReview = reviewQueueMode && (width < 640 || Boolean(selectedId));
  const compactStatus = width < 960;

  const defaultColumns: DataTableColumn<WfmOfficeTimeEntry>[] = [
    {
      key: 'date',
      label: 'Datum',
      width: 96,
      render: (entry) => <Text style={{ color: text.primary, ...typography.caption }}>{entry.workDate}</Text>,
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
      key: 'plan',
      label: 'Plan',
      flex: 1,
      minWidth: 120,
      render: (entry) => (
        <Text style={{ color: text.secondary, ...typography.caption }} numberOfLines={2}>
          {planCell(entry)}
        </Text>
      ),
    },
    {
      key: 'ist',
      label: 'Einsatz-Ist',
      flex: 1,
      minWidth: 120,
      render: (entry) => (
        <Text style={{ color: text.secondary, ...typography.caption }} numberOfLines={2}>
          {formatWfmReviewQueueIstLine(entry)}
        </Text>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 140,
      render: (entry) => <WfmReviewStatusBadge entry={entry} compact={false} />,
    },
    {
      key: 'action',
      label: 'Aktion',
      width: 110,
      align: 'right',
      render: (entry) => {
        const selected = selectedId === entry.id;
        return (
          <ReviewActionButton
            selected={selected}
            reviewQueueMode={reviewQueueMode}
            onPress={() => onSelect(selected ? null : entry.id)}
          />
        );
      },
    },
  ];

  const reviewColumns: DataTableColumn<WfmOfficeTimeEntry>[] = [
    {
      key: 'date',
      label: 'Datum',
      width: REVIEW_COL.date,
      render: (entry) => <CellText tone="primary" lines={1}>{entry.workDate}</CellText>,
    },
    {
      key: 'employee',
      label: 'Mitarbeiter',
      width: REVIEW_COL.employee,
      render: (entry) => (
        <CellText tone="primary" lines={1} tooltip={entry.employeeName}>
          {entry.employeeName}
        </CellText>
      ),
    },
    {
      key: 'client',
      label: 'Klient',
      width: REVIEW_COL.client,
      render: (entry) => {
        const label = entry.clientLabel ?? entry.assignmentTitle ?? '—';
        return (
          <CellText tone="secondary" lines={1} tooltip={label}>
            {label}
          </CellText>
        );
      },
    },
    {
      key: 'plan',
      label: 'Plan',
      width: REVIEW_COL.plan,
      render: (entry) => <StackCell lines={planCellLines(entry)} />,
    },
    {
      key: 'einsatz',
      label: 'Einsatz-Ist',
      width: REVIEW_COL.einsatz,
      render: (entry) => {
        const stack = formatWfmReviewQueueIstStack(entry);
        if (!stack) return <CellText tone="secondary">—</CellText>;
        return (
          <StackCell
            lines={[
              { text: `Zeit: ${stack.zeit}`, tone: 'primary' },
              { text: `Quelle: ${stack.quelle}` },
              ...(stack.dauer ? [{ text: `Dauer: ${stack.dauer}` }] : []),
            ]}
          />
        );
      },
    },
    {
      key: 'buchung',
      label: 'Buchung',
      width: REVIEW_COL.buchung,
      render: (entry) => {
        const value = formatWfmReviewQueueBuchungLabel(entry);
        return <CellText tone="primary" lines={2} tooltip={value}>{value}</CellText>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: REVIEW_COL.status,
      render: (entry) => <WfmReviewStatusBadge entry={entry} compact={compactStatus} />,
    },
    {
      key: 'action',
      label: 'Aktion',
      width: REVIEW_COL.action,
      align: 'right',
      render: (entry) => {
        const selected = selectedId === entry.id;
        return (
          <ReviewActionButton
            selected={selected}
            reviewQueueMode
            onPress={() => onSelect(selected ? null : entry.id)}
          />
        );
      },
    },
  ];

  if (!reviewQueueMode) {
    return (
      <View style={styles.wrap} testID="wfm-office-time-entry-table">
        <View style={styles.tableSurface}>
          <PremiumDataTable
            columns={defaultColumns}
            data={entries}
            keyExtractor={(entry) => entry.id}
            selectedId={selectedId}
            onRowPress={(entry) => onSelect(selectedId === entry.id ? null : entry.id)}
            emptyMessage="Keine Arbeitszeiteinträge im gewählten Zeitraum."
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, styles.wrapReview]} testID="wfm-office-time-entry-table">
      {mobileReview ? (
        <View style={styles.mobileList} testID="wfm-review-queue-mobile">
          {entries.length === 0 ? (
            <Text style={{ color: text.muted, ...typography.caption }}>
              Keine Arbeitszeiteinträge im gewählten Zeitraum.
            </Text>
          ) : (
            entries.map((entry) => (
              <ReviewQueueMobileCard
                key={entry.id}
                entry={entry}
                selected={selectedId === entry.id}
                onSelect={onSelect}
              />
            ))
          )}
        </View>
      ) : (
        <View style={styles.tableSurface}>
          <PremiumDataTable
            columns={reviewColumns}
            data={entries}
            keyExtractor={(entry) => entry.id}
            selectedId={selectedId}
            onRowPress={(entry) => onSelect(selectedId === entry.id ? null : entry.id)}
            emptyMessage="Keine Arbeitszeiteinträge im gewählten Zeitraum."
            fixedLayout
            solidSurface
            minTableWidth={REVIEW_MIN_TABLE_WIDTH}
          />
        </View>
      )}
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
  wrapReview: { gap: careSpacing.sm },
  tableSurface: {
    borderRadius: 12,
    backgroundColor: '#FAFBFC',
    maxWidth: '100%',
    ...(Platform.OS === 'web'
      ? ({
          overflowX: 'auto',
          overflowY: 'hidden',
          isolation: 'isolate',
        } as object)
      : { overflow: 'hidden' }),
  },
  stackCell: { gap: 1, width: '100%' },
  cellText: { ...typography.caption, fontSize: 12, lineHeight: 16 },
  cellTextStrong: { fontWeight: '600', color: '#0F1B33' },
  statusBadgeWrap: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    overflow: 'hidden',
  },
  statusBadge: { maxWidth: '100%', alignSelf: 'flex-start' },
  actionCell: { width: '100%', alignItems: 'flex-end', justifyContent: 'center' },
  footerHint: { ...typography.caption, fontSize: 10, marginTop: 4 },
  mobileList: { gap: careSpacing.sm },
  mobileCard: { borderWidth: 1, borderRadius: 10, padding: careSpacing.sm, gap: 4 },
  mobileCardSelected: {
    borderColor: 'rgba(139, 92, 246, 0.45)',
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
  },
  mobileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: careSpacing.xs,
  },
  mobileCardDate: { ...typography.caption, fontWeight: '700', fontSize: 13 },
  mobileCardPrimary: { ...typography.caption, fontWeight: '600', fontSize: 13 },
  mobileCardSecondary: { ...typography.caption, fontSize: 12, lineHeight: 16 },
  mobileCardAction: { marginTop: careSpacing.xs, alignItems: 'flex-end' },
});
