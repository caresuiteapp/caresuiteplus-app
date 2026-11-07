import { Linking, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PremiumBadge, PremiumButton } from '@/components/ui';
import { HealthOSStatusBadge } from '@/components/healthos';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import { employeePortalHomeAppointmentTitle } from '@/lib/portal/portalHomeAppointment';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { portalPremium } from '@/design/tokens/portalPremium';
import { employeePortalWorkspace as c } from './employee/employeePortalDesign';

type EmployeePortalAssignmentCardProps = {
  appointment: PortalAppointmentItem;
  tasks?: string[];
  serviceCategory?: string | null;
  notes?: string | null;
  cacheStale?: boolean;
  onPreview?: () => void;
  onNavigate?: () => void;
  onContinue?: () => void;
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

export function EmployeePortalAssignmentCard({
  appointment,
  tasks = [],
  serviceCategory,
  notes,
  cacheStale = false,
  onPreview,
  onNavigate,
  onContinue,
}: EmployeePortalAssignmentCardProps) {
  const text = portalPremium.text;
  const status = resolveStatus(appointment);

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
    <View style={styles.card} testID={`employee-assignment-card-${appointment.id}`}>
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.datePill}>
            <Ionicons name="calendar-outline" color={portalPremium.accent.blue} size={17} />
            <Text style={styles.datePillText}>{formatDate(appointment.startsAt)}</Text>
          </View>
          <HealthOSStatusBadge domain="assignment" technicalValue={String(status)} />
          {cacheStale ? <PremiumBadge label="Veraltet" variant="muted" /> : null}
        </View>

        <View style={styles.primaryRow}>
          <View style={styles.primaryCopy}>
            <Text style={[styles.title, { color: text.primary }]}>
              {appointment.id.startsWith('calendar:') ? appointment.title : employeePortalHomeAppointmentTitle(appointment)}
            </Text>
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

        <View style={styles.actions}>
          {onPreview ? (
            <PremiumButton title="Vorschau" size="sm" variant={onContinue ? "secondary" : "primary"} onPress={onPreview} />
          ) : null}
          {appointment.location ? (
            <PremiumButton title="Navigation" size="sm" variant="secondary" onPress={openMaps} />
          ) : null}
          {onContinue ? <PremiumButton title="Einsatz fortsetzen" size="sm" onPress={onContinue} /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 0, borderRadius: c.radius, borderWidth: 1, borderColor: c.line,
    marginBottom: careSpacing.sm, backgroundColor: c.surface,
  },
  inner: { padding: 14, gap: 8 },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: careSpacing.xs,
  },
  datePill: {
    minHeight: 28, paddingHorizontal: 9, borderRadius: 999,
    borderWidth: 1, borderColor: c.line,
    backgroundColor: c.subtle, flexDirection: 'row',
    alignItems: 'center', gap: 7,
  },
  datePillText: { ...careTypography.caption, color: portalPremium.accent.blueDark, fontWeight: '800' },
  primaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: careSpacing.md },
  primaryCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 190, minWidth: 0, gap: 5 },
  title: { ...careTypography.h3, flexShrink: 1, fontSize: 18, lineHeight: 24 },
  timeBlock: {
    maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
    backgroundColor: c.subtle, gap: 2,
  },
  timeRange: { color: portalPremium.text.primary, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  duration: { color: portalPremium.text.muted, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  meta: { ...careTypography.caption },
  inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  address: { ...careTypography.body, flexShrink: 1 },
  sectionLabel: { ...careTypography.caption, fontWeight: '700', marginTop: careSpacing.xs },
  taskList: { gap: 2 },
  taskItem: { ...careTypography.caption },
  notes: { ...careTypography.caption, marginTop: careSpacing.xs },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    marginTop: 2,
    paddingTop: careSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
});
