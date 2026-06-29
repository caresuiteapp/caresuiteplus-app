import { StyleSheet, Text, View } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import { PremiumBadge, SectionPanel } from '@/components/ui';
import { isAssistTrackingPersistenceActive } from '@/lib/assist/gpsTrackingConfig';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { EmployeePortalLiveTimers } from '@/types/modules/employeePortalTracking';
import { colors, spacing, typography } from '@/theme';

function formatDuration(seconds: number | null, emptyLabel: string): string {
  if (seconds == null) return emptyLabel;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type EmployeePortalLiveTimersPanelProps = {
  timers: EmployeePortalLiveTimers | null;
  assignmentStatus?: AssignmentStatus;
};

export function EmployeePortalLiveTimersPanel({
  timers,
  assignmentStatus,
}: EmployeePortalLiveTimersPanelProps) {
  if (!timers) return null;

  const activeLabel =
    timers.activeTimer === 'drive'
      ? 'Anfahrt läuft'
      : timers.activeTimer === 'service'
        ? 'Einsatz läuft'
        : timers.activeTimer === 'pause'
          ? 'Pause'
          : null;

  const driveEmpty =
    assignmentStatus === 'unterwegs' ? '0:00' : 'Noch nicht gestartet';
  const serviceEmpty =
    assignmentStatus === 'gestartet' || assignmentStatus === 'pausiert'
      ? '0:00'
      : 'Noch nicht gestartet';
  const pauseEmpty = 'Keine Pause erfasst';

  return (
    <SectionPanel title="Live-Zeiterfassung" subtitle="Aus Status & Zeitstempeln rekonstruiert">
      {activeLabel ? (
        <View style={styles.activeRow}>
          <PremiumBadge label={activeLabel} variant="orange" dot />
        </View>
      ) : null}
      <DetailInfoRow label="Anfahrt" value={formatDuration(timers.driveSeconds, driveEmpty)} />
      <DetailInfoRow label="Einsatz" value={formatDuration(timers.serviceSeconds, serviceEmpty)} />
      <DetailInfoRow label="Pause gesamt" value={formatDuration(timers.pauseSeconds, pauseEmpty)} />
      {!isAssistTrackingPersistenceActive() ? (
        <Text style={styles.hint}>
          Persistente Zeit-Events (assist_time_events) fehlen im Schema — Werte sind sessionbasiert.
        </Text>
      ) : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  activeRow: { marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
