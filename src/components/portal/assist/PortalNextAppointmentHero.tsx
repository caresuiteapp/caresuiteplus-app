import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { PremiumButton } from '@/components/ui';
import { ClientPortalArtwork } from '@/components/portal/client/ClientPortalArtwork';
import { clientPortalDesign as c } from '@/components/portal/client/clientPortalDesign';
import type { PortalNextAppointment } from '@/types/portal/assist';

type Props = { appointment: PortalNextAppointment | null; onRequestChange?: () => void; onRequestExtra?: () => void; emptyActionLabel?: string };
export function clientNextAppointmentParts(appointment: PortalNextAppointment) {
  const start = new Date(appointment.startsAt);
  const end = appointment.endsAt ? new Date(appointment.endsAt) : null;
  if (!Number.isFinite(start.getTime())) return { weekday: 'Termin', day: '–', month: '', time: 'Uhrzeit wird noch abgestimmt', endDate: null };
  const formatTime = (date: Date) => date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const validEnd = end && Number.isFinite(end.getTime()) && end >= start ? end : null;
  return {
    weekday: start.toLocaleDateString('de-DE', { weekday: 'short' }), day: start.toLocaleDateString('de-DE', { day: '2-digit' }),
    month: start.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' }),
    time: `${formatTime(start)}${validEnd ? ` – ${formatTime(validEnd)}` : ''} Uhr`,
    endDate: validEnd && start.toLocaleDateString('de-DE') !== validEnd.toLocaleDateString('de-DE')
      ? `Ende am ${validEnd.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}` : null,
  };
}
export function PortalNextAppointmentHero({ appointment, onRequestChange, onRequestExtra, emptyActionLabel = 'Einsatz anfragen' }: Props) {
  const router = useRouter();
  const { isPhone, width } = useDeviceClass();
  const compact = isPhone || width < 760;
  const parts = appointment ? clientNextAppointmentParts(appointment) : null;
  return <View testID="client-next-appointment-card" style={[styles.card, compact && styles.cardPhone]}>
    <View style={styles.headingRow}><View style={styles.headingCopy}><Text style={styles.eyebrow}>IHR NÄCHSTER EINSATZ</Text><Text accessibilityRole="header" style={styles.heading}>Wir sind für Sie da.</Text></View></View>
    {appointment && parts ? <View style={[styles.appointmentBody, compact && styles.appointmentBodyPhone]}>
      <View style={styles.dateTile}><Text style={styles.dateWeekday}>{parts.weekday}</Text><Text style={styles.dateDay}>{parts.day}</Text><Text style={styles.dateMonth}>{parts.month}</Text></View>
      <View style={styles.appointmentCopy}><Text style={styles.appointmentTitle}>{appointment.title}</Text>
        <View style={styles.line}><Ionicons name="time-outline" size={18} color={c.accent.blue} /><Text style={styles.body}>{parts.time}</Text></View>
        {parts.endDate ? <Text style={styles.body}>{parts.endDate}</Text> : null}
        {appointment.location ? <View style={styles.line}><Ionicons name="location-outline" size={18} color={c.accent.blue} /><Text style={styles.body}>{appointment.location}</Text></View> : null}
      </View>
      {!compact ? <ClientPortalArtwork id="appointments" label="Nächster Einsatz" size={112} /> : null}
    </View> : <View style={styles.emptyBody}><ClientPortalArtwork id="appointments" label="Meine Einsätze" size={compact ? 68 : 96} />
      <View style={styles.appointmentCopy}><Text style={styles.appointmentTitle}>Aktuell ist kein weiterer Einsatz geplant.</Text>
        <Text style={styles.body}>{onRequestExtra ? 'Wenn Sie Unterstützung benötigen, können Sie direkt einen neuen Einsatz anfragen.' : 'Sobald ein weiterer Einsatz geplant ist, sehen Sie ihn hier. Bei Fragen wenden Sie sich an Ihr Betreuungsteam.'}</Text>
      </View>
    </View>}
    <View style={styles.actions}>
      {appointment ? <PremiumButton title="Einsatz ansehen" onPress={() => router.push(`/portal/client/appointments/${encodeURIComponent(appointment.id)}` as never)} /> : null}
      {appointment && onRequestChange ? <PremiumButton title="Änderung mitteilen" variant="secondary" onPress={onRequestChange} /> : null}
      {!appointment && onRequestExtra ? <PremiumButton title={emptyActionLabel} onPress={onRequestExtra} /> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create(withCareSuiteTypography({
  card: { minWidth: 0, padding: 23, borderWidth: 1, borderColor: c.border, borderRadius: 22, backgroundColor: c.surface, gap: 19 },
  cardPhone: { padding: 19, borderRadius: 20 }, headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, headingCopy: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: { color: c.accent.blue, fontSize: font(13), lineHeight: font(19), fontWeight: '700' }, heading: { color: c.text.primary, fontSize: font(22), lineHeight: font(29), fontWeight: '700' },
  appointmentBody: { flexDirection: 'row', alignItems: 'center', gap: 17, minWidth: 0, flexWrap: 'wrap' }, appointmentBodyPhone: { gap: 13 },
  dateTile: { width: 78, minHeight: 106, padding: 9, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 15, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dateWeekday: { color: c.accent.blue, fontSize: font(14), lineHeight: font(20) }, dateDay: { color: c.text.primary, fontSize: font(33), lineHeight: font(40), fontWeight: '700' }, dateMonth: { color: c.accent.blue, fontSize: font(13), lineHeight: font(18), textAlign: 'center' },
  appointmentCopy: { flex: 1, minWidth: 0, flexBasis: 170, gap: 8 }, appointmentTitle: { color: c.text.primary, fontSize: font(18), lineHeight: font(25), fontWeight: '700', flexShrink: 1 },
  body: { color: c.text.secondary, fontSize: font(16), lineHeight: font(23), flexShrink: 1 }, line: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  emptyBody: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, minWidth: 0 },
}));
