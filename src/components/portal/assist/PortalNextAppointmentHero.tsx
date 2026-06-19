import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import type { PortalNextAppointment } from '@/types/portal/assist';
import { PortalEmptyState } from './PortalEmptyState';

type PortalNextAppointmentHeroProps = {
  appointment: PortalNextAppointment | null;
  onRequestChange?: () => void;
  onRequestExtra?: () => void;
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Hero card for next Assist appointment with glass empty state. */
export function PortalNextAppointmentHero({
  appointment,
  onRequestChange,
  onRequestExtra,
}: PortalNextAppointmentHeroProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const router = useRouter();

  return (
    <GlassCard glow accentColor="#4CC9F0" style={styles.card}>
      <Text style={[type.caption, styles.eyebrow, { color: text.muted }]} {...noBreakTextProps}>
        NÄCHSTER TERMIN
      </Text>
      {appointment ? (
        <>
          <Text style={[type.cardTitle, { color: text.primary }]} {...noBreakTextProps}>
            {appointment.title}
          </Text>
          <Text style={[type.body, { color: text.secondary }]} {...noBreakTextProps}>
            {formatDateTime(appointment.startsAt)}
            {appointment.location ? ` · ${appointment.location}` : ''}
          </Text>
          <View style={styles.actions}>
            <Text
              style={[type.caption, styles.link]}
              onPress={() => router.push(`/portal/client/appointments/${appointment.id}` as never)}
            >
              Details anzeigen
            </Text>
            {onRequestChange ? (
              <Text style={[type.caption, styles.link]} onPress={onRequestChange}>
                Termin ändern
              </Text>
            ) : null}
          </View>
        </>
      ) : (
        <PortalEmptyState
          message="Noch kein Assist-Termin geplant."
          actionLabel="Zusatztermin anfragen"
          onAction={onRequestExtra}
        />
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 140,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.md,
    marginTop: careSpacing.sm,
  },
  link: {
    color: '#4CC9F0',
    fontWeight: '700',
  },
});
