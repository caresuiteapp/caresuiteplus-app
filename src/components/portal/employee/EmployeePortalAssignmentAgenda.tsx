import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EmployeePortalAssignmentCard } from '@/components/portal/EmployeePortalAssignmentCard';
import { CachedDataBanner } from '@/components/ui/CachedDataBanner';
import { InfoBanner } from '@/components/ui/InfoBanner';
import { ListFilterSelect } from '@/components/ui/ListFilterSelect';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import type { usePortalAppointments } from '@/hooks/usePortalAppointments';
import type { CachedPortalAppointmentItem } from '@/lib/offline/types';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import {
  employeePortalAssignmentSchedule,
  employeePortalAssignmentStatus,
  employeePortalAssignmentTitle,
} from '@/lib/portal/employee/employeePortalAssignmentDisplay';
import { groupPortalPastAppointmentsByMonth, type PortalAppointmentTimeGroup } from '@/lib/portal/groupPortalAppointmentsByTime';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { EmployeePortalAgendaAction, agendaFocusRing } from './EmployeePortalAgendaAction';
import {
  EmployeePortalAgendaBoard,
  EmployeePortalAgendaHero,
  EmployeePortalAgendaSection,
  EmployeePortalAgendaToolbar,
  useEmployeePortalAgendaLayout,
} from './EmployeePortalAgendaLayout';
import { employeePortalDesign as c } from './employeePortalDesign';

type Props = {
  groups: PortalAppointmentTimeGroup[];
  state: Pick<ReturnType<typeof usePortalAppointments>,
    'isEmpty' | 'error' | 'refresh' | 'refreshing' | 'refreshError' | 'showSuccess' | 'fromCache' | 'cachedAt'>;
  loadingMessage?: string;
  onPreview: (id: string) => void;
  continuationAction: (appointment: PortalAppointmentItem) => (() => void) | undefined;
};

const filters = [
  { key: 'all', label: 'Alle' },
  { key: 'upcoming', label: 'Kommend' },
  { key: 'past', label: 'Vergangen', compactLabel: 'Verlauf' },
] as const;
type AgendaFilter = (typeof filters)[number]['key'];

const scheduledStatuses = new Set<AssignmentStatus>([
  'geplant', 'bestaetigt', 'unterwegs', 'angekommen', 'gestartet', 'pausiert',
]);

export function EmployeePortalAssignmentAgenda({ groups, state, loadingMessage, onPreview, continuationAction }: Props) {
  const layout = useEmployeePortalAgendaLayout();
  const { compact } = layout;

  const [filter, setFilter] = useState<AgendaFilter>('all');
  const [historyMonth, setHistoryMonth] = useState('all');
  const upcoming = groups.find(group => group.key === 'upcoming')?.items ?? [];
  const past = groups.find(group => group.key === 'past')?.items ?? [];
  const counts = { all: upcoming.length + past.length, upcoming: upcoming.length, past: past.length };
  const visibleGroups = groups.filter(group => filter === 'all' || group.key === filter);
  const months = filter === 'past' ? groupPortalPastAppointmentsByMonth(past) : [];
  const selectedMonth = months.find(month => month.key === historyMonth);
  const next = upcoming.find(appointment => Number.isFinite(Date.parse(appointment.startsAt))
    && scheduledStatuses.has(employeePortalAssignmentStatus(appointment)));
  const nextSchedule = next && filter !== 'past' ? employeePortalAssignmentSchedule(next) : null;
  const loadError = !loadingMessage && counts.all === 0 ? state.error : null;
  const { refresh, refreshing } = state;

  return (
    <EmployeePortalAgendaBoard layout={layout}>
      <EmployeePortalAgendaHero layout={layout} artwork="assignments" kicker="Einsatzplan" title="Meine Einsätze"
        subtitle="Planung, Durchführung und Verlauf" testID="employee-assignments-hero">
      {next && nextSchedule ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Vorschau öffnen. ${employeePortalAssignmentTitle(next)}, ${nextSchedule.date}, ${nextSchedule.time}`}
          onPress={() => onPreview(next.id)} testID="employee-assignments-next"
          style={({ pressed, focused, hovered }: { pressed: boolean; focused?: boolean; hovered?: boolean }) => [
            styles.next, hovered && styles.hovered, focused && styles.focused, pressed && styles.pressed,
          ]}>
          {!compact ? <View style={styles.nextIcon}><Ionicons name="calendar-outline" size={22} color={c.accent} accessible={false} /></View> : null}
          <View style={styles.nextCopy}>
            <View style={styles.nextKicker}>
              <Text style={styles.kicker}>{Date.parse(next.startsAt) > Date.now() ? 'Als Nächstes' : 'Aktuell im Plan'}</Text>
              {compact ? <Ionicons name="chevron-forward" size={15} color={c.accent} accessible={false} /> : null}
            </View>
            <Text style={styles.nextTitle}>{employeePortalAssignmentTitle(next)}</Text>
            <View style={styles.nextMeta}>
              <Text style={styles.subtitle}>{nextSchedule.date}</Text>
              <Text style={styles.subtitle}>{nextSchedule.time}</Text>
            </View>
            {nextSchedule.endDay ? <Text style={styles.subtitle}>Ende am {nextSchedule.endDay}</Text> : null}
          </View>
          {!compact ? <Ionicons name="chevron-forward" size={17} color={c.accent} accessible={false} /> : null}
        </Pressable>
      ) : null}
      </EmployeePortalAgendaHero>

      <EmployeePortalAgendaToolbar layout={layout} active={filter} onSelect={setFilter}
        filters={filters.map(option => ({ ...option, count: counts[option.key] }))}
        refresh={refresh} refreshing={refreshing} />

      {state.showSuccess ? <InfoBanner variant="success" presentation="inline" onDarkSurface message="Einsätze aktualisiert." /> : null}
      {state.refreshError && !loadError ? (
        <InfoBanner variant="error" presentation="inline" onDarkSurface title="Aktualisieren nicht möglich"
          message={state.refreshError} actionLabel="Erneut versuchen" onAction={refresh} />
      ) : null}
      <CachedDataBanner visible={state.fromCache} cachedAt={state.cachedAt} onDarkSurface />

      {months.length > 0 ? (
        <ListFilterSelect label="Monat der Einsatzhistorie" value={selectedMonth?.key ?? 'all'}
          options={[{ key: 'all', label: 'Alle Monate' }, ...months.map(({ key, label }) => ({ key, label }))]}
          onChange={setHistoryMonth} style={styles.monthFilter} grow={false} onDarkSurface />
      ) : null}

      {loadingMessage ? (
        <View accessibilityRole="progressbar" accessibilityLabel={loadingMessage} style={styles.notice}>
          <ActivityIndicator color={c.accent} />
          <Text style={styles.subtitle}>{loadingMessage}</Text>
        </View>
      ) : loadError ? (
        <InfoBanner variant="error" presentation="inline" onDarkSurface title="Einsätze konnten nicht geladen werden"
          message={loadError} actionLabel="Erneut versuchen" onAction={refresh} />
      ) : visibleGroups.length === 0 ? (
        <View style={styles.notice}>
          <Ionicons name="calendar-outline" color={c.accent} size={25} accessible={false} />
          <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>
            {state.isEmpty ? 'Keine Einsätze geplant' : filter === 'past' ? 'Keine vergangenen Einsätze' : 'Keine kommenden Einsätze'}
          </Text>
          <Text style={styles.subtitle}>In diesem Zeitraum sind keine Einsätze eingetragen.</Text>
          {filter !== 'all' ? (
            <EmployeePortalAgendaAction label="Alle Einsätze anzeigen" icon="list-outline" onPress={() => setFilter('all')} />
          ) : null}
        </View>
      ) : visibleGroups.map(group => {
        const isPast = group.key === 'past';
        const entries = isPast && selectedMonth ? selectedMonth.items : group.items;
        return (
          <EmployeePortalAgendaSection key={group.key} layout={layout} icon={isPast ? 'time-outline' : 'calendar-outline'}
            title={isPast && selectedMonth ? selectedMonth.label : group.label} count={entries.length} muted={isPast}>
            {entries.map(appointment => (
              <EmployeePortalAssignmentCard key={appointment.id} appointment={appointment}
                compact={compact} past={isPast} featured={appointment.id === next?.id}
                cacheStale={state.fromCache || (appointment as CachedPortalAppointmentItem).cacheStale}
                onPreview={() => onPreview(appointment.id)} onContinue={continuationAction(appointment)} />
            ))}
          </EmployeePortalAgendaSection>
        );
      })}
    </EmployeePortalAgendaBoard>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  kicker: { color: c.accent, fontSize: font(10), lineHeight: font(15), letterSpacing: 1.1, fontWeight: '800', textTransform: 'uppercase' },
  subtitle: { color: c.muted, fontSize: font(13), lineHeight: font(19), flexShrink: 1 },
  next: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(188,238,255,0.30)', backgroundColor: c.control, padding: 10, minHeight: 70, maxWidth: 550,
  },
  nextIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: c.selected, alignItems: 'center', justifyContent: 'center' },
  nextCopy: { flex: 1, minWidth: 0, gap: 2 },
  nextKicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  nextMeta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 0 },
  nextTitle: { color: c.text, fontSize: font(16), lineHeight: font(20), fontWeight: '800' },
  monthFilter: { width: '100%', maxWidth: 360, minWidth: 0 },
  sectionTitle: { color: c.text, flexShrink: 1, minWidth: 0, fontSize: font(18), lineHeight: font(24), fontWeight: '800' },
  notice: { gap: 10, alignItems: 'flex-start', padding: 16, borderRadius: 17, borderWidth: 1, borderColor: c.line, backgroundColor: c.panel },
  hovered: { backgroundColor: c.selected },
  focused: { borderColor: c.accent, ...agendaFocusRing },
  pressed: { opacity: 0.8 },
}));
