import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, ListFilterSelect, PremiumBadge, PremiumButton, PremiumCard, SectionPanel, SegmentedTabs } from '@/components/ui';
import { resolveAssignmentCardBadge } from '@/lib/assist/assignmentCardPresentation';
import { groupClientAssignmentsByMonth, partitionClientAssignments, type ClientAssignmentHistoryView } from '@/lib/clients/clientAssignmentHistory';
import { formatDate, formatDateTime, formatDurationMinutes, formatTimeRange } from '@/lib/formatters/dateTimeFormatters';
import type { AssignmentListItem } from '@/types/modules/assist';
import { colors, spacing, typography } from '@/theme';

type Props = {
  assignments: AssignmentListItem[];
  onOpenAssignment: (assignment: AssignmentListItem) => void;
  onRefresh: () => void;
  refreshing?: boolean;
};

function countLabel(count: number): string {
  return `${count} Einsatz${count === 1 ? '' : 'e'}`;
}

function ClientShiftCard({ assignment, onOpen }: { assignment: AssignmentListItem; onOpen: () => void }) {
  const badge = resolveAssignmentCardBadge(assignment);
  const plannedMinutes = Math.max(0, Math.round((Date.parse(assignment.scheduledEnd) - Date.parse(assignment.scheduledStart)) / 60_000));
  const actualMinutes = assignment.actualStartAt && assignment.actualEndAt
    ? Math.round((Date.parse(assignment.actualEndAt) - Date.parse(assignment.actualStartAt)) / 60_000)
    : null;
  return (
    <PremiumCard style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{assignment.title}</Text>
        <PremiumBadge label={badge.label} variant={badge.variant} dot />
      </View>
      <Text style={styles.meta}>
        {formatDate(assignment.scheduledStart)} · {formatTimeRange(assignment.scheduledStart, assignment.scheduledEnd)}
      </Text>
      <Text style={styles.meta}>
        {assignment.employeeName || 'Noch nicht zugewiesen'}
        {Number.isFinite(plannedMinutes) && plannedMinutes > 0 ? ` · ${formatDurationMinutes(plannedMinutes)} geplant` : ''}
      </Text>
      {actualMinutes != null && Number.isFinite(actualMinutes) && actualMinutes > 0 ? (
        <Text style={styles.meta}>Tatsächliche Dauer: {formatDurationMinutes(actualMinutes)}</Text>
      ) : null}
      {assignment.location ? <Text style={styles.secondary}>{assignment.location}</Text> : null}
      <View style={styles.cardFooter}>
        <Text style={styles.updated}>Aktualisiert {formatDateTime(assignment.updatedAt)}</Text>
        <PremiumButton title="Einsatz ansehen" size="sm" variant="secondary" onPress={onOpen}
          accessibilityLabel={`Einsatz ansehen: ${assignment.title}, ${formatDate(assignment.scheduledStart)}`} />
      </View>
    </PremiumCard>
  );
}

export function ClientAssignmentHistoryPanel({ assignments, onOpenAssignment, onRefresh, refreshing = false }: Props) {
  const [view, setView] = useState<ClientAssignmentHistoryView>('upcoming');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const { upcoming, past } = partitionClientAssignments(assignments);
  const scopeItems = view === 'upcoming' ? upcoming : view === 'past' ? past : assignments;
  const groups = groupClientAssignmentsByMonth(scopeItems, view === 'upcoming' ? 'asc' : 'desc');
  const effectiveMonth = selectedMonth === 'all' || groups.some((group) => group.key === selectedMonth)
    ? selectedMonth : 'all';
  const visibleGroups = effectiveMonth === 'all' ? groups : groups.filter((group) => group.key === effectiveMonth);
  const visibleCount = visibleGroups.reduce((count, group) => count + group.assignments.length, 0);
  const monthOptions = [
    { key: 'all', label: `Alle Monate (${scopeItems.length})` },
    ...groups.map((group) => ({ key: group.key, label: `${group.label} (${group.assignments.length})` })),
  ];

  return (
    <SectionPanel title="Einsätze" subtitle={`${countLabel(assignments.length)} · ${past.length} vergangen`}>
      <SegmentedTabs layout="wrap" activeKey={view} onSelect={(key) => {
        if (key !== 'upcoming' && key !== 'past' && key !== 'all') return;
        setView(key);
        setSelectedMonth('all');
      }} tabs={[
        { key: 'upcoming', label: `Aktuell & geplant (${upcoming.length})` },
        { key: 'past', label: `Vergangene Einsätze (${past.length})` },
        { key: 'all', label: `Alle Einsätze (${assignments.length})` },
      ]} />
      <View style={styles.toolbar}>
        <ListFilterSelect label="Monat" value={effectiveMonth} options={monthOptions}
          onChange={setSelectedMonth} style={styles.monthSelect} />
        <PremiumButton title="Aktualisieren" size="sm" variant="secondary" onPress={onRefresh} loading={refreshing} />
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.resultCount}>
        {countLabel(visibleCount)}{effectiveMonth === 'all' ? ` in ${groups.length} Monat${groups.length === 1 ? '' : 'en'}` : ''}
      </Text>
      {visibleCount === 0 ? (
        <EmptyState
          title={view === 'past' ? 'Keine vergangenen Einsätze' : view === 'upcoming' ? 'Keine aktuellen oder geplanten Einsätze' : 'Keine Einsätze'}
          message={view === 'past'
            ? 'Vergangene Einsätze erscheinen hier nach Monat, auch wenn Dokumentation oder Unterschrift noch offen sind.'
            : view === 'upcoming'
              ? 'Frühere Termine finden Sie unter „Vergangene Einsätze“. Mit „Alle Einsätze“ sehen Sie die vollständige Übersicht.'
              : 'Für diese Klientenakte sind noch keine Einsätze gespeichert.'}
        />
      ) : visibleGroups.map((group) => (
        <View key={group.key} style={styles.monthGroup} testID={`client-assignment-month-${group.key}`}>
          <View style={styles.monthHeader}>
            <Text accessibilityRole="header" style={styles.monthTitle}>{group.label}</Text>
            <PremiumBadge label={countLabel(group.assignments.length)} variant="muted" />
          </View>
          {group.assignments.map((assignment) => (
            <ClientShiftCard key={assignment.id} assignment={assignment} onOpen={() => onOpenAssignment(assignment)} />
          ))}
        </View>
      ))}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.sm },
  monthSelect: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 0, maxWidth: 420 },
  resultCount: { ...typography.caption, color: colors.textMuted, marginVertical: spacing.xs },
  monthGroup: { gap: spacing.sm, marginBottom: spacing.md, minWidth: 0 },
  monthHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  monthTitle: { ...typography.label, flexShrink: 1 },
  card: { minWidth: 0 },
  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.xs },
  cardTitle: { ...typography.label, flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  secondary: { ...typography.caption, marginTop: spacing.xs },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
  updated: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
});
