import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { PremiumBadge, PremiumButton } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { moduleColor } from '@/design/tokens/modules';
import { withAlpha } from '@/design/tokens/motion';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import { ASSIGNMENT_STATUS_LABELS, type AssignmentStatus } from '@/types/modules/assignmentStatus';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { liquidColors, liquidRadius } from '@/liquid-command/foundation/tokens';

type ClientPortalAssignmentCardProps = {
  appointment: PortalAppointmentItem;
  tasks?: string[];
  serviceCategory?: string | null;
  notes?: string | null;
  cacheStale?: boolean;
  onPreview?: () => void;
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

/** Client portal assignment card — M.1 parity with employee card (read-only actions). */
export function ClientPortalAssignmentCard({
  appointment,
  tasks = [],
  serviceCategory,
  notes,
  cacheStale = false,
  onPreview,
}: ClientPortalAssignmentCardProps) {
  const text = {
    primary: liquidColors.white,
    secondary: liquidColors.white88,
    muted: liquidColors.white64,
  };
  const accent = moduleColor('assist');
  const status = resolveStatus(appointment);
  const statusLabel =
    ASSIGNMENT_STATUS_LABELS[status] ?? WORKFLOW_STATUS_LABELS[appointment.status] ?? status;
  const cardTint = 'rgba(8,39,75,0.84)';
  const serviceLabel = serviceCategory ?? appointment.title;

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
      testID={`client-assignment-card-${appointment.id}`}
    >
      <View style={[styles.statusBar, { backgroundColor: accent }]} />

      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <PremiumBadge label={statusLabel} variant="cyan" />
          {cacheStale ? <PremiumBadge label="Veraltet" variant="muted" /> : null}
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

        {appointment.employeeName ? (
          <Text style={[styles.employeeName, { color: text.primary }]}>
            Mitarbeitende: {appointment.employeeName}
          </Text>
        ) : null}

        {appointment.location ? (
          <Text style={[styles.address, { color: text.secondary }]}>{appointment.location}</Text>
        ) : null}

        {serviceLabel ? (
          <Text style={[styles.meta, { color: text.secondary }]}>Leistung: {serviceLabel}</Text>
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
          <Text style={[styles.notes, { color: text.secondary }]}>{notes}</Text>
        ) : null}

        <View style={styles.actions}>
          {onPreview ? (
            <PremiumButton title="Vorschau" size="sm" variant="secondary" onPress={onPreview} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: liquidRadius.panel,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: careSpacing.sm,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 14px 36px rgba(0,16,44,0.22)', backdropFilter: 'blur(18px)' } as unknown as ViewStyle)
      : { shadowColor: '#00132D', shadowOpacity: 0.24, shadowRadius: 16, elevation: 5 }),
  },
  pressed: { opacity: 0.92 },
  statusBar: { height: 3, width: '100%' },
  inner: { padding: careSpacing.lg, gap: careSpacing.sm },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: careSpacing.xs,
  },
  title: { ...careTypography.bodyStrong, flexShrink: 1 },
  metaBlock: { gap: 2 },
  meta: { ...careTypography.caption },
  employeeName: { ...careTypography.bodyStrong, marginTop: careSpacing.xs },
  address: { ...careTypography.body, flexShrink: 1 },
  sectionLabel: { ...careTypography.caption, fontWeight: '700', marginTop: careSpacing.xs },
  taskList: { gap: 2 },
  taskItem: { ...careTypography.caption },
  notes: { ...careTypography.caption, marginTop: careSpacing.xs },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    marginTop: careSpacing.sm,
  },
});
