import { StyleSheet, Text, View } from 'react-native';
import { PremiumBadge, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import {
  formatWfmDurationMinutes,
  formatWfmEventTypeLabel,
  formatWfmTime,
} from '@/lib/wfm/wfmDisplayHelpers';
import {
  WFM_ABSENCE_TYPE_LABELS,
  WFM_ABSENCE_STATUS_LABELS,
} from '@/types/modules/wfm';
import type { WfmTeamTodayRow } from '@/types/modules/wfm';
import { typography } from '@/theme';

type Props = {
  row: WfmTeamTodayRow;
  workDate: string;
};

function formatWorkDateLabel(workDate: string): string {
  const date = new Date(`${workDate}T12:00:00`);
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

export function WfmTeamTodayDetailPanel({ row, workDate }: Props) {
  const text = useAuroraAdaptiveText();

  return (
    <SectionPanel
      title={`${row.employeeName} — ${formatWorkDateLabel(workDate)}`}
      subtitle="Tagesdetails"
    >
      <View style={styles.summaryRow}>
        <PremiumBadge label={row.statusLabel} variant={row.isOnline ? 'green' : 'muted'} />
        {row.workTypeLabel ? (
          <PremiumBadge label={row.workTypeLabel} variant="cyan" />
        ) : null}
      </View>

      {row.session ? (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: text.primary }]}>Arbeitszeit</Text>
          <Text style={{ color: text.secondary, ...typography.caption }}>
            Start {formatWfmTime(row.startedAt)} · Ende {formatWfmTime(row.endedAt)} · Pause{' '}
            {formatWfmDurationMinutes(row.breakMinutes)} · Gesamt{' '}
            {formatWfmDurationMinutes(row.totalMinutes)}
          </Text>
          {row.lastEventSourceLabel ? (
            <Text style={{ color: text.secondary, ...typography.caption, marginTop: 4 }}>
              Letzte Quelle: {row.lastEventSourceLabel}
            </Text>
          ) : null}
        </View>
      ) : null}

      {row.absence ? (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: text.primary }]}>Abwesenheit</Text>
          <Text style={{ color: text.secondary, ...typography.caption }}>
            {WFM_ABSENCE_TYPE_LABELS[row.absence.absenceType]} ·{' '}
            {WFM_ABSENCE_STATUS_LABELS[row.absence.status]}
          </Text>
          <Text style={{ color: text.secondary, ...typography.caption, marginTop: 4 }}>
            {new Date(row.absence.startsAt).toLocaleDateString('de-DE')} –{' '}
            {new Date(row.absence.endsAt).toLocaleDateString('de-DE')}
          </Text>
          {row.absence.employeeNote ? (
            <Text style={{ color: text.secondary, ...typography.caption, marginTop: 4 }}>
              Anmerkung: {row.absence.employeeNote}
            </Text>
          ) : null}
        </View>
      ) : null}

      {row.events.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: text.primary }]}>Ereignisse</Text>
          {row.events.map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <Text style={{ color: text.primary, ...typography.caption, fontWeight: '600' }}>
                {formatWfmTime(event.occurredAt)}
              </Text>
              <Text style={{ color: text.secondary, ...typography.caption, flex: 1 }}>
                {formatWfmEventTypeLabel(event.eventType)}
                {event.note ? ` — ${event.note}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {row.warnings.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: text.primary }]}>Hinweise</Text>
          {row.warnings.map((warning) => (
            <Text key={warning} style={styles.warning}>
              {warning}
            </Text>
          ))}
        </View>
      ) : null}

      {!row.session && !row.absence ? (
        <Text style={{ color: text.secondary, ...typography.caption }}>
          Für heute liegen keine Erfassungen oder Abwesenheiten vor.
        </Text>
      ) : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
    marginBottom: careSpacing.sm,
  },
  block: {
    marginTop: careSpacing.sm,
    paddingTop: careSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  blockTitle: {
    ...typography.caption,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventRow: {
    flexDirection: 'row',
    gap: careSpacing.sm,
    marginTop: 4,
  },
  warning: {
    ...typography.caption,
    color: '#b54708',
    marginTop: 4,
  },
});
