import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { PremiumButton, PremiumDataTable, type DataTableColumn } from '@/components/ui';
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

const TABLE_TEXT = {
  primary: '#0F172A',
  secondary: '#334155',
  muted: '#64748B',
  border: '#CBD5E1',
} as const;

type BadgeTone = 'green' | 'yellow' | 'red' | 'blue' | 'warning' | 'muted';

const BADGE_COLORS: Record<BadgeTone, { text: string; background: string; border: string }> = {
  green: { text: '#166534', background: '#DCFCE7', border: '#86EFAC' },
  yellow: { text: '#854D0E', background: '#FEF9C3', border: '#FDE047' },
  red: { text: '#B91C1C', background: '#FEE2E2', border: '#FCA5A5' },
  blue: { text: '#1D4ED8', background: '#DBEAFE', border: '#93C5FD' },
  warning: { text: '#9A3412', background: '#FFEDD5', border: '#FDBA74' },
  muted: { text: '#334155', background: '#E2E8F0', border: '#94A3B8' },
};

function ampelVariant(ampel: string | null): BadgeTone {
  if (ampel === 'green') return 'green';
  if (ampel === 'yellow') return 'yellow';
  if (ampel === 'red') return 'red';
  if (ampel === 'blue') return 'blue';
  return 'muted';
}

function ReadableStatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  const palette = BADGE_COLORS[tone];
  return (
    <View style={[styles.statusBadge, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <Text style={[styles.statusBadgeText, { color: palette.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function rowStatusLabel(entry: WfmOfficeTimeEntry, compact: boolean): string {
  if (entry.rowKind === 'planned_upcoming') {
    return 'Geplant';
  }
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
  const color =
    tone === 'primary'
      ? TABLE_TEXT.primary
      : tone === 'secondary'
        ? TABLE_TEXT.secondary
        : TABLE_TEXT.muted;
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
      <ReadableStatusBadge label={rowStatusLabel(entry, compact)} tone={variant} />
      {entry.overallAmpel ? (
        <ReadableStatusBadge
          label={WFM_DEVIATION_AMPEL_LABELS[entry.overallAmpel]}
          tone={ampelVariant(entry.overallAmpel)}
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
        title={reviewQueueMode ? 'Prüfen' : selected ? 'Schließen' : 'Details'}
        variant={reviewQueueMode && !selected ? 'secondary' : 'ghost'}
        size="sm"
        style={COMPACT_ACTION_BUTTON}
        onPress={onPress}
        onDarkSurface={false}
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
  const istStack = formatWfmReviewQueueIstStack(entry);

  return (
    <View
      style={[
        styles.mobileCard,
        { borderColor: TABLE_TEXT.border, backgroundColor: '#FAFBFC' },
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
      <Text style={[styles.mobileCardSecondary, { color: TABLE_TEXT.secondary }]} numberOfLines={1}>
        {entry.clientLabel ?? entry.assignmentTitle ?? '—'}
      </Text>
      <Text style={[styles.mobileCardSecondary, { color: TABLE_TEXT.secondary }]} numberOfLines={2}>
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
  const { width } = useWindowDimensions();
  // The office navigation consumes a substantial part of the browser width.
  // Cards keep every value readable on regular desktop displays instead of
  // forcing a 1,264 px table into the remaining workspace.
  const mobileReview = reviewQueueMode && width < 1760;
  const compactStatus = width < 960;

  const defaultColumns: DataTableColumn<WfmOfficeTimeEntry>[] = [
    {
      key: 'date',
      label: 'Datum',
      width: 96,
      render: (entry) => <Text style={{ color: TABLE_TEXT.primary, ...typography.body }}>{entry.workDate}</Text>,
    },
    {
      key: 'employee',
      label: 'Mitarbeiter',
      flex: 1,
      minWidth: 100,
      render: (entry) => (
        <Text style={{ color: TABLE_TEXT.primary, ...typography.body }} numberOfLines={1}>
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
        <Text style={{ color: TABLE_TEXT.secondary, ...typography.body }} numberOfLines={2}>
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
        <Text style={{ color: TABLE_TEXT.secondary, ...typography.body }} numberOfLines={2}>
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
            <Text style={{ color: TABLE_TEXT.muted, ...typography.body }}>
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
        <Text style={[styles.footerHint, { color: TABLE_TEXT.muted }]}>
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20,120,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.94)',
    maxWidth: '100%',
    shadowColor: '#173B70',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    ...(Platform.OS === 'web'
      ? ({
          overflowX: 'auto',
          overflowY: 'hidden',
          isolation: 'isolate',
        } as object)
      : { overflow: 'hidden' }),
  },
  stackCell: { gap: 1, width: '100%' },
  cellText: { ...typography.body, fontSize: 14, lineHeight: 20 },
  cellTextStrong: { fontWeight: '600', color: '#0F1B33' },
  statusBadgeWrap: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    overflow: 'hidden',
  },
  statusBadge: {
    maxWidth: '100%',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: { fontSize: 11, lineHeight: 15, fontWeight: '700', flexShrink: 1 },
  actionCell: { width: '100%', alignItems: 'flex-end', justifyContent: 'center' },
  footerHint: { ...typography.body, fontSize: 13, lineHeight: 18, marginTop: 6, paddingHorizontal: 4 },
  mobileList: { gap: careSpacing.md },
  mobileCard: { borderWidth: 1, borderRadius: 14, padding: careSpacing.md, gap: 8, backgroundColor: '#FFFFFF' },
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
  mobileCardDate: { ...typography.body, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  mobileCardPrimary: { ...typography.body, fontWeight: '700', fontSize: 15, lineHeight: 21 },
  mobileCardSecondary: { ...typography.body, fontSize: 14, lineHeight: 20 },
  mobileCardAction: { marginTop: careSpacing.xs, alignItems: 'flex-end' },
});
