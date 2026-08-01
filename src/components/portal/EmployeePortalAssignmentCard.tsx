import { Linking, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PremiumBadge, PremiumButton } from '@/components/ui';
import { HealthOSStatusBadge } from '@/components/healthos';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { moduleColor } from '@/design/tokens/modules';
import { withAlpha } from '@/design/tokens/motion';
import { spatialCare } from '@/design/tokens/spatialCareSuite';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import { employeePortalHomeAppointmentTitle } from '@/lib/portal/portalHomeAppointment';
import { ASSIGNMENT_STATUS_LABELS, type AssignmentStatus } from '@/types/modules/assignmentStatus';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { portalPremium } from '@/design/tokens/portalPremium';

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
  const text = portalPremium.text;
  const accent = moduleColor('assist');
  const status = resolveStatus(appointment);
  const statusLabel = ASSIGNMENT_STATUS_LABELS[status] ?? WORKFLOW_STATUS_LABELS[appointment.status] ?? status;

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
        { borderColor: withAlpha(accent, 0.44) },
        pressed && styles.pressed,
        webCursor,
      ]}
      accessibilityRole="button"
      testID={`employee-assignment-card-${appointment.id}`}
    >
      <LinearGradient
        colors={['#FFFFFF', '#F2F8FF', '#E3F1FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={[styles.accentEdge, { backgroundColor: accent }]} pointerEvents="none" />
      <View style={styles.orbitGlow} pointerEvents="none" />
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.datePill}>
            <Ionicons name="calendar-outline" color={portalPremium.accent.blue} size={17} />
            <Text style={styles.datePillText}>{formatDate(appointment.startsAt)}</Text>
          </View>
          <HealthOSStatusBadge domain="assignment" technicalValue={String(status)} />
          {cacheStale ? <PremiumBadge label="Veraltet" variant="muted" /> : null}
          <Text style={[styles.statusText, { color: text.secondary }]}>{statusLabel}</Text>
        </View>

        <View style={styles.primaryRow}>
          <View style={styles.primaryCopy}>
            <Text style={[styles.title, { color: text.primary }]}>
              {employeePortalHomeAppointmentTitle(appointment)}
            </Text>
            {appointment.clientName ? (
              <View style={styles.inlineMeta}>
                <Ionicons name="person-outline" color={portalPremium.accent.blueDark} size={16} />
                <Text style={[styles.clientName, { color: text.primary }]}>{appointment.clientName}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.timeBlock}>
            <Text style={styles.timeRange}>{formatTimeRange(appointment.startsAt, appointment.endsAt)}</Text>
            <Text style={styles.duration}>Geplant · {formatDurationMinutes(appointment.startsAt, appointment.endsAt)}</Text>
          </View>
        </View>

        {appointment.location ? (
          <View style={styles.inlineMeta}>
            <Ionicons name="location-outline" color={portalPremium.accent.blueDark} size={16} />
            <Text style={[styles.address, { color: text.secondary }]}>{appointment.location}</Text>
          </View>
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
          <Text style={[styles.notes, { color: text.secondary }]}>{notes}</Text>
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
    position: 'relative',
    borderRadius: spatialCare.radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: careSpacing.sm,
    backgroundColor: portalPremium.surface,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: portalPremium.shadow.card } as unknown as ViewStyle)
      : { shadowColor: '#002657', shadowOpacity: 0.16, shadowRadius: 18, elevation: 7 }),
  },
  pressed: { opacity: 0.96, transform: [{ scale: 0.992 }] },
  accentEdge: { position: 'absolute', left: 0, top: 18, bottom: 18, width: 4, borderRadius: 4 },
  orbitGlow: {
    position: 'absolute', right: -54, top: -72, width: 190, height: 190,
    borderRadius: 95, backgroundColor: 'rgba(53,151,255,0.10)',
  },
  inner: { padding: careSpacing.lg, paddingLeft: careSpacing.xl, gap: careSpacing.sm },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: careSpacing.xs,
  },
  datePill: {
    minHeight: 34, paddingHorizontal: 11, borderRadius: 999,
    borderWidth: 1, borderColor: portalPremium.borderStrong,
    backgroundColor: 'rgba(5,108,232,0.09)', flexDirection: 'row',
    alignItems: 'center', gap: 7,
  },
  datePillText: { ...careTypography.caption, color: portalPremium.accent.blueDark, fontWeight: '800' },
  statusText: { ...careTypography.caption, fontWeight: '600', marginLeft: 'auto' },
  primaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: careSpacing.md },
  primaryCopy: { flex: 1, minWidth: 230, gap: 7 },
  title: { ...careTypography.h3, flexShrink: 1, fontSize: 21, lineHeight: 27 },
  timeBlock: {
    minWidth: 172, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 15,
    borderWidth: 1, borderColor: portalPremium.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'flex-end', gap: 2,
  },
  timeRange: { color: portalPremium.text.primary, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  duration: { color: portalPremium.text.muted, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  metaBlock: { gap: 2 },
  meta: { ...careTypography.caption },
  inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  clientName: { ...careTypography.bodyStrong, flexShrink: 1 },
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
    paddingTop: careSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: portalPremium.borderSoft,
  },
});
