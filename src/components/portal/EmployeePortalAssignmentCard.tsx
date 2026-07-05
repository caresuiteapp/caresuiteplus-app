import { Linking, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PremiumBadge, PremiumButton } from '@/components/ui';
import { HealthOSStatusBadge } from '@/components/healthos';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { moduleColor } from '@/design/tokens/modules';
import { withAlpha } from '@/design/tokens/motion';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import { ASSIGNMENT_STATUS_LABELS, type AssignmentStatus } from '@/types/modules/assignmentStatus';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';

type EmployeePortalAssignmentCardProps = {
  appointment: PortalAppointmentItem;
  tasks?: string[];
  serviceCategory?: string | null;
  notes?: string | null;
  cacheStale?: boolean;
  onPreview?: () => void;
  onNavigate?: () => void;
  onStartTrip?: () => void;
  onStartAssignment?: () => void;
  canStart?: boolean;
  startBlockedReason?: string | null;
};

function resolveStatus(appt: PortalAppointmentItem): AssignmentStatus {
  return appt.assignmentStatus ?? remoteStatusToAssignment(appt.status);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTimeRange(start: string, end: string): string {
  const s = new Date(start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const e = new Date(end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${s} – ${e}`;
}

function formatDurationMinutes(start: string, end: string): string {
  const mins = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  if (mins < 60) return `${mins} Min.`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} Std. ${m} Min.` : `${h} Std.`;
}

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

export function EmployeePortalAssignmentCard({
  appointment,
  tasks = [],
  serviceCategory,
  notes,
  cacheStale = false,
  onPreview,
  onNavigate,
  onStartTrip,
  onStartAssignment,
  canStart = false,
  startBlockedReason,
}: EmployeePortalAssignmentCardProps) {
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('assist');
  const status = resolveStatus(appointment);
  const statusLabel = ASSIGNMENT_STATUS_LABELS[status] ?? WORKFLOW_STATUS_LABELS[appointment.status] ?? status;
  const cardTint = withAlpha(accent, 0.08);

  const openMaps = () => {
    if (onNavigate) {
      onNavigate();
      return;
    }
    if (!appointment.location?.trim()) return;
    const encoded = encodeURIComponent(appointment.location);
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`);
  };

  return (
    <Pressable
      onPress={onPreview}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cardTint, borderColor: withAlpha(accent, 0.25) },
        pressed && styles.pressed,
        webCursor,
      ]}
      accessibilityRole="button"
      testID={`employee-assignment-card-${appointment.id}`}
    >
      <View style={[styles.statusBar, { backgroundColor: accent }]} />

      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <HealthOSStatusBadge domain="assignment" technicalValue={String(status)} />
          {cacheStale ? <PremiumBadge label="Veraltet" variant="muted" /> : null}
          <Text style={[styles.statusText, { color: text.secondary }]}>{statusLabel}</Text>
        </View>

        <Text style={[styles.title, { color: text.primary }]}>{appointment.title}</Text>

        <View style={styles.metaBlock}>
          <Text style={[styles.meta, { color: text.secondary }]}>
            {formatDate(appointment.startsAt)} · {formatTimeRange(appointment.startsAt, appointment.endsAt)}
          </Text>
          <Text style={[styles.meta, { color: text.muted }]}>
            Geplante Dauer: {formatDurationMinutes(appointment.startsAt, appointment.endsAt)}
          </Text>
        </View>

        {appointment.clientName ? (
          <Text style={[styles.clientName, { color: text.primary }]}>{appointment.clientName}</Text>
        ) : null}

        {appointment.location ? (
          <Text style={[styles.address, { color: text.secondary }]}>{appointment.location}</Text>
        ) : null}

        {serviceCategory ? (
          <Text style={[styles.meta, { color: text.secondary }]}>Leistung: {serviceCategory}</Text>
        ) : null}

        {tasks.length > 0 ? (
          <View style={styles.taskList}>
            <Text style={[styles.sectionLabel, { color: text.muted }]}>Aufgaben</Text>
            {tasks.slice(0, 4).map((task) => (
              <Text key={task} style={[styles.taskItem, { color: text.secondary }]}>
                • {task}
              </Text>
            ))}
            {tasks.length > 4 ? (
              <Text style={[styles.meta, { color: text.muted }]}>+{tasks.length - 4} weitere</Text>
            ) : null}
          </View>
        ) : null}

        {notes ? (
          <Text style={[styles.notes, { color: text.secondary }]} numberOfLines={4}>
            {notes}
          </Text>
        ) : null}

        {startBlockedReason && !canStart ? (
          <Text style={[styles.blockedHint, { color: text.muted }]}>{startBlockedReason}</Text>
        ) : null}

        <View style={styles.actions}>
          {onPreview ? (
            <PremiumButton title="Vorschau" size="sm" variant="secondary" onPress={onPreview} />
          ) : null}
          {appointment.location ? (
            <PremiumButton title="Navigation" size="sm" variant="secondary" onPress={openMaps} />
          ) : null}
          {onStartTrip && ['bestaetigt', 'geplant'].includes(status) ? (
            <PremiumButton title="Fahrt starten" size="sm" onPress={onStartTrip} />
          ) : null}
          {onStartAssignment && canStart ? (
            <PremiumButton title="Einsatz starten" size="sm" onPress={onStartAssignment} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: careSpacing.sm,
  },
  pressed: { opacity: 0.92 },
  statusBar: { height: 3, width: '100%' },
  inner: { padding: careSpacing.md, gap: careSpacing.xs },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: careSpacing.xs,
  },
  statusText: { ...careTypography.caption, fontWeight: '600', marginLeft: 'auto' },
  title: { ...careTypography.bodyStrong, flexShrink: 1 },
  metaBlock: { gap: 2 },
  meta: { ...careTypography.caption },
  clientName: { ...careTypography.bodyStrong, marginTop: careSpacing.xs },
  address: { ...careTypography.body, flexShrink: 1 },
  sectionLabel: { ...careTypography.caption, fontWeight: '700', marginTop: careSpacing.xs },
  taskList: { gap: 2 },
  taskItem: { ...careTypography.caption },
  notes: { ...careTypography.caption, marginTop: careSpacing.xs },
  blockedHint: { ...careTypography.caption, fontStyle: 'italic' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    marginTop: careSpacing.sm,
  },
});
