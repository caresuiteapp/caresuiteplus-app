import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import type { PortalNextAppointment } from '@/types/portal/assist';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type PortalNextAppointmentHeroProps = {
  appointment: PortalNextAppointment | null;
  onRequestChange?: () => void;
  onRequestExtra?: () => void;
  emptyActionLabel?: string;
};

type AppointmentParts = {
  weekday: string;
  day: string;
  month: string;
  time: string;
};

const breakLongWords = Platform.OS === 'web'
  ? ({ overflowWrap: 'anywhere', wordBreak: 'break-word' } as unknown as TextStyle)
  : null;

function formatAppointmentParts(iso: string): AppointmentParts {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { weekday: 'Termin', day: '–', month: '', time: iso };
  }
  return {
    weekday: date.toLocaleDateString('de-DE', { weekday: 'long' }),
    day: date.toLocaleDateString('de-DE', { day: '2-digit' }),
    month: date.toLocaleDateString('de-DE', { month: 'short' }).replace('.', ''),
    time: date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  };
}

function AppointmentButton({
  icon,
  label,
  primary = false,
  onPress,
}: {
  icon: IoniconName;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} color={primary ? '#FFFFFF' : '#075DC7'} size={18} />
      <Text style={[styles.buttonText, primary ? styles.buttonTextPrimary : styles.buttonTextSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Premium appointment card: compact, readable and identical across desktop, tablet and phone. */
export function PortalNextAppointmentHero({
  appointment,
  onRequestChange,
  onRequestExtra,
  emptyActionLabel = 'Einsatz anfragen',
}: PortalNextAppointmentHeroProps) {
  const router = useRouter();
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const compact = isPhone || width < 760;
  const parts = appointment ? formatAppointmentParts(appointment.startsAt) : null;

  return (
    <View style={[styles.card, compact && styles.cardPhone]} testID="client-next-appointment-card">
      <LinearGradient
        colors={['#FFFFFF', '#F4F9FF', '#E5F1FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.glow} pointerEvents="none" />
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}>
          <Ionicons name="calendar-clear-outline" color="#075DC7" size={21} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[type.caption, styles.eyebrow]}>IHR NÄCHSTER EINSATZ</Text>
          <Text style={[type.cardTitle, styles.heading, breakLongWords]}>Gut vorbereitet für den nächsten Termin</Text>
        </View>
      </View>

      {appointment && parts ? (
        <View style={[styles.appointmentBody, compact && styles.appointmentBodyPhone]}>
          <View style={[styles.dateTile, compact && styles.dateTilePhone]}>
            <Text style={styles.dateWeekday}>{parts.weekday}</Text>
            <View style={styles.dateRow}>
              <Text style={styles.dateDay}>{parts.day}</Text>
              <Text style={styles.dateMonth}>{parts.month}</Text>
            </View>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" color="#075DC7" size={17} />
              <Text style={styles.dateTime}>{parts.time} Uhr</Text>
            </View>
          </View>

          <View style={styles.appointmentCopy}>
            <Text style={[type.cardTitle, styles.appointmentTitle, breakLongWords]}>{appointment.title}</Text>
            {appointment.location ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" color="#45627C" size={18} />
                <Text style={[type.body, styles.location]}>{appointment.location}</Text>
              </View>
            ) : (
              <Text style={[type.body, styles.location]}>Die Einzelheiten finden Sie in Ihrem Einsatz.</Text>
            )}
            <View style={[styles.actions, compact && styles.actionsPhone]}>
              <AppointmentButton
                icon="arrow-forward-circle-outline"
                label="Einsatz ansehen"
                primary
                onPress={() => router.push(`/portal/client/appointments/${appointment.id}` as never)}
              />
              {onRequestChange ? (
                <AppointmentButton
                  icon="create-outline"
                  label="Änderung mitteilen"
                  onPress={onRequestChange}
                />
              ) : null}
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.emptyBody, compact && styles.emptyBodyPhone]}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" color="#075DC7" size={28} />
          </View>
          <View style={[styles.emptyCopy, compact && styles.emptyCopyPhone]}>
            <Text style={[type.bodyStrong, styles.emptyTitle]}>Aktuell ist kein weiterer Einsatz geplant.</Text>
            <Text style={[type.body, styles.emptyMessage]}>Wenn Sie Unterstützung benötigen, können Sie direkt einen neuen Einsatz anfragen.</Text>
          </View>
          {onRequestExtra ? (
            <AppointmentButton
              icon="add-circle-outline"
              label={emptyActionLabel}
              primary
              onPress={onRequestExtra}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const premiumShadow = Platform.OS === 'web'
  ? ({ boxShadow: '0 22px 58px rgba(0,24,58,0.24)' } as unknown as ViewStyle)
  : ({ shadowColor: '#001B42', shadowOpacity: 0.2, shadowRadius: 22, shadowOffset: { width: 0, height: 13 }, elevation: 8 } as ViewStyle);

const styles = StyleSheet.create({
  card: {
    minHeight: 320,
    position: 'relative',
    overflow: 'hidden',
    padding: 21,
    borderWidth: 1,
    borderColor: 'rgba(112,181,255,0.62)',
    borderRadius: 21,
    gap: 18,
    ...premiumShadow,
  },
  cardPhone: {
    minHeight: 0,
    padding: 17,
    borderRadius: 19,
  },
  glow: {
    position: 'absolute',
    right: -80,
    bottom: -130,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: 'rgba(53,151,255,0.15)',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  headingIcon: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: 'rgba(5,108,232,0.22)',
    borderRadius: 13,
    backgroundColor: 'rgba(5,108,232,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eyebrow: {
    color: '#075DC7',
    fontWeight: '900',
    letterSpacing: 0.85,
  },
  heading: {
    color: '#061B35',
    fontWeight: '900',
  },
  appointmentBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 18,
  },
  appointmentBodyPhone: {
    flexDirection: 'column',
    gap: 13,
  },
  dateTile: {
    width: 152,
    minHeight: 178,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(5,108,232,0.22)',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.78)',
    justifyContent: 'center',
    gap: 5,
  },
  dateTilePhone: {
    width: '100%',
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateWeekday: {
    color: '#45627C',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  dateDay: {
    color: '#061B35',
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: -1,
  },
  dateMonth: {
    color: '#075DC7',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateTime: {
    color: '#075DC7',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  appointmentCopy: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    justifyContent: 'center',
    gap: 10,
  },
  appointmentTitle: {
    color: '#061B35',
    fontWeight: '900',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  location: {
    flex: 1,
    color: '#365672',
  },
  actions: {
    marginTop: 7,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionsPhone: {
    flexDirection: 'column',
  },
  button: {
    minHeight: 46,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  buttonPrimary: {
    borderColor: '#056CE8',
    backgroundColor: '#056CE8',
  },
  buttonSecondary: {
    borderColor: 'rgba(5,108,232,0.28)',
    backgroundColor: 'rgba(255,255,255,0.74)',
  },
  buttonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: '#075DC7',
  },
  emptyBody: {
    flex: 1,
    minHeight: 178,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(5,108,232,0.18)',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: careSpacing.md,
  },
  emptyBodyPhone: {
    minHeight: 0,
    padding: 14,
    alignItems: 'flex-start',
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(5,108,232,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    flex: 1,
    minWidth: 210,
    gap: 4,
  },
  emptyCopyPhone: {
    flexBasis: '70%',
    minWidth: 0,
  },
  emptyTitle: {
    color: '#061B35',
    fontWeight: '900',
  },
  emptyMessage: {
    color: '#365672',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.988 }],
  },
});
