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
import { EmployeePortalAgendaCard, EmployeePortalAgendaStatus } from './employee/EmployeePortalAgendaCard';
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
    <EmployeePortalAgendaCard date={schedule} title={employeePortalAssignmentTitle(appointment)}
      compact={compact} tone={featured ? 'featured' : past ? 'past' : undefined}
      testID={`employee-assignment-card-${appointment.id}`}
      status={<>
        <EmployeePortalAgendaStatus label={status.label} tone={status.tone} />
        {cacheStale ? <Text style={styles.cacheLabel}>Zwischengespeichert</Text> : null}
      </>}
      actions={onPreview || location || onContinue ? <>
        {onContinue ? <EmployeePortalAgendaAction label="Einsatz fortsetzen" icon="play-outline" primary onPress={onContinue} /> : null}
        {onPreview ? <EmployeePortalAgendaAction label="Vorschau" icon="eye-outline" primary={!onContinue && featured} onPress={onPreview} /> : null}
        {location ? <EmployeePortalAgendaAction label="Navigation" icon="navigate-outline" onPress={openMaps} /> : null}
      </> : null}>
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
    </EmployeePortalAgendaCard>
  );
}

const styles = StyleSheet.create(withCareSuiteTypography({
  cacheLabel: { flexShrink: 1, color: c.warning, fontSize: font(11), lineHeight: font(15) },
  inlineMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  addressRow: { flexWrap: 'nowrap', alignItems: 'flex-start' },
  timeCopy: { flexShrink: 1, minWidth: 0 },
  time: { color: c.text, fontSize: font(15), lineHeight: font(20), fontWeight: '800', fontVariant: ['tabular-nums'] },
  duration: { flexShrink: 1, color: c.muted, fontSize: font(12), lineHeight: font(17) },
  meta: { flexShrink: 1, minWidth: 0, color: c.muted, fontSize: font(13), lineHeight: font(19) },
  taskList: { gap: 3 },
}));
