import { Linking, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { resolveHealthOSStatusDisplay } from '@/components/healthos/status/healthosStatusMapping';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import {
  employeePortalAssignmentSchedule,
  employeePortalAssignmentStatus,
  employeePortalAssignmentTitle,
} from '@/lib/portal/employee/employeePortalAssignmentDisplay';
import { EmployeePortalAgendaAction } from './employee/EmployeePortalAgendaAction';
import { employeePortalDesign as c } from './employee/employeePortalDesign';

type EmployeePortalAssignmentCardProps = {
  appointment: PortalAppointmentItem;
  tasks?: string[];
  serviceCategory?: string | null;
  notes?: string | null;
  cacheStale?: boolean;
  compact?: boolean;
  featured?: boolean;
  past?: boolean;
  onPreview?: () => void;
  onNavigate?: () => void;
  onContinue?: () => void;
};

const statusInk = {
  muted: c.muted, cyan: c.accent, green: '#C1F3DE',
  orange: c.warning, red: c.danger, purple: '#E2D5FF',
};

export function EmployeePortalAssignmentCard({
  appointment,
  tasks = [],
  serviceCategory,
  notes,
  cacheStale = false,
  compact = false,
  featured = false,
  past = false,
  onPreview,
  onNavigate,
  onContinue,
}: EmployeePortalAssignmentCardProps) {
  const schedule = employeePortalAssignmentSchedule(appointment);
  const status = resolveHealthOSStatusDisplay('assignment', employeePortalAssignmentStatus(appointment));
  const ink = statusInk[status.tone];
  const location = appointment.location?.trim();

  const openMaps = () => {
    if (onNavigate) {
      onNavigate();
      return;
    }
    if (!location) return;
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`);
  };

  return (
    <View style={[styles.card, past && styles.past, featured && styles.featured, compact && styles.cardCompact]}
      testID={`employee-assignment-card-${appointment.id}`}>
      <View style={[styles.cardTop, compact && styles.cardTopCompact]}>
        <View style={[styles.dateTile, featured && styles.featuredDate, compact && styles.dateTileCompact]}
          accessible accessibilityLabel={schedule.date}>
          {compact || !schedule.day ? (
            <>
              <Ionicons name="calendar-outline" color={c.accent} size={16} accessible={false} />
              <Text style={styles.dateMeta}>{schedule.date}</Text>
            </>
          ) : (
            <>
              <Text style={styles.dateMeta}>{schedule.weekday}</Text>
              <Text style={styles.dateDay}>{schedule.day}</Text>
              <Text style={styles.dateMeta}>{schedule.monthAndYear}</Text>
            </>
          )}
        </View>
        <View style={styles.details}>
          <View style={styles.statusRow}>
            <View style={styles.status}>
              <View style={[styles.statusDot, { backgroundColor: ink }]} />
              <Text style={[styles.statusText, { color: ink }]}>{status.label}</Text>
            </View>
            {cacheStale ? <Text style={styles.cacheLabel}>Zwischengespeichert</Text> : null}
          </View>
          <Text accessibilityRole="header" aria-level={3} style={styles.title}>{employeePortalAssignmentTitle(appointment)}</Text>
          <View style={styles.inlineMeta}>
            <Ionicons name="time-outline" color={c.accent} size={17} accessible={false} />
            <View style={styles.timeCopy}>
              <Text style={styles.time}>{schedule.time}</Text>
              {schedule.endDay ? <Text style={styles.meta}>Ende am {schedule.endDay}</Text> : null}
            </View>
            {schedule.duration ? <Text style={styles.duration}>{schedule.duration} geplant</Text> : null}
          </View>
          {location ? (
            <View style={[styles.inlineMeta, styles.addressRow]}>
              <Ionicons name="location-outline" color={c.accent} size={17} accessible={false} />
              <Text style={styles.meta}>{location}</Text>
            </View>
          ) : null}
          {serviceCategory ? <Text style={styles.meta}>Leistung: {serviceCategory}</Text> : null}
          {tasks.length > 0 ? (
            <View style={styles.taskList}>
              <Text style={styles.time}>Aufgaben</Text>
              {tasks.slice(0, 4).map(task => <Text key={task} style={styles.meta}>• {task}</Text>)}
              {tasks.length > 4 ? <Text style={styles.meta}>+{tasks.length - 4} weitere</Text> : null}
            </View>
          ) : null}
          {notes ? <Text style={styles.meta}>{notes}</Text> : null}
        </View>
      </View>
      {onPreview || location || onContinue ? (
        <View style={styles.actions}>
          {onContinue ? <EmployeePortalAgendaAction label="Einsatz fortsetzen" icon="play-outline" primary onPress={onContinue} /> : null}
          {onPreview ? <EmployeePortalAgendaAction label="Vorschau" icon="eye-outline" primary={!onContinue && featured} onPress={onPreview} /> : null}
          {location ? <EmployeePortalAgendaAction label="Navigation" icon="navigate-outline" onPress={openMaps} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  card: {
    flex: 1, minWidth: 0, padding: 16, gap: 14, borderRadius: 19,
    backgroundColor: c.panel, borderWidth: 1, borderColor: c.line,
  },
  cardCompact: { padding: 12, gap: 12 },
  past: { backgroundColor: 'rgba(220,234,248,0.06)' },
  featured: { backgroundColor: 'rgba(133,222,240,0.13)', borderColor: 'rgba(164,234,249,0.56)' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, flexGrow: 1 },
  cardTopCompact: { flexDirection: 'column', gap: 10 },
  dateTile: {
    paddingHorizontal: 9, paddingVertical: 10, minWidth: 78, maxWidth: '30%',
    borderRadius: 13, borderWidth: 1, borderColor: c.line, backgroundColor: c.control,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  dateTileCompact: { maxWidth: '100%', minWidth: 0, flexDirection: 'row', gap: 7, paddingVertical: 6 },
  featuredDate: { borderColor: 'rgba(164,234,249,0.42)', backgroundColor: 'rgba(12,39,59,0.65)' },
  dateDay: { color: c.text, fontSize: font(30), lineHeight: font(34), fontWeight: '800', fontVariant: ['tabular-nums'] },
  dateMeta: { flexShrink: 1, color: c.accent, fontSize: font(12), lineHeight: font(16), textAlign: 'center', fontWeight: '700' },
  details: { minWidth: 0, flex: 1, alignSelf: 'stretch', gap: 7 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  status: {
    maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 4, backgroundColor: c.control, borderRadius: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { flexShrink: 1, fontSize: font(11), lineHeight: font(15), fontWeight: '700' },
  cacheLabel: { flexShrink: 1, color: c.warning, fontSize: font(11), lineHeight: font(15) },
  title: { color: c.text, fontSize: font(19), lineHeight: font(24), fontWeight: '800' },
  inlineMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  addressRow: { flexWrap: 'nowrap', alignItems: 'flex-start' },
  timeCopy: { flexShrink: 1, minWidth: 0 },
  time: { color: c.text, fontSize: font(15), lineHeight: font(20), fontWeight: '800', fontVariant: ['tabular-nums'] },
  duration: { flexShrink: 1, color: c.muted, fontSize: font(12), lineHeight: font(17) },
  meta: { flexShrink: 1, minWidth: 0, color: c.muted, fontSize: font(13), lineHeight: font(19) },
  taskList: { gap: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderColor: c.line, paddingTop: 11 },
}));
