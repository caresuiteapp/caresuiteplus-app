import { StyleSheet, Text, View } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import { PremiumBadge, SectionPanel } from '@/components/ui';
import type { EmployeePortalLiveTimers } from '@/types/modules/employeePortalTracking';
import { colors, spacing, typography } from '@/theme';

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type EmployeePortalLiveTimersPanelProps = {
  timers: EmployeePortalLiveTimers | null;
};

export function EmployeePortalLiveTimersPanel({ timers }: EmployeePortalLiveTimersPanelProps) {
  if (!timers) return null;

  const activeLabel =
    timers.activeTimer === 'drive'
      ? 'Anfahrt läuft'
      : timers.activeTimer === 'service'
        ? 'Einsatz läuft'
        : timers.activeTimer === 'pause'
          ? 'Pause'
          : null;

  return (
    <SectionPanel title="Live-Zeiterfassung" subtitle="Aus Status & Zeitstempeln rekonstruiert">
      {activeLabel ? (
        <View style={styles.activeRow}>
          <PremiumBadge label={activeLabel} variant="orange" dot />
        </View>
      ) : null}
      <DetailInfoRow label="Anfahrt" value={formatDuration(timers.driveSeconds)} />
      <DetailInfoRow label="Einsatz" value={formatDuration(timers.serviceSeconds)} />
      <DetailInfoRow label="Pause gesamt" value={formatDuration(timers.pauseSeconds)} />
      <Text style={styles.hint}>
        Persistente Zeit-Events (assist_time_events) fehlen im Schema — Werte sind sessionbasiert.
      </Text>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  activeRow: { marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
