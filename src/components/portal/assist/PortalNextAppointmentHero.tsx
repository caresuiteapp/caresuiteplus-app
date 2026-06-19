import { Pressable, StyleSheet, Text, View } from 'react-native';
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

function HeroLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <Pressable
      onPress={onPress}
      style={styles.linkButton}
      accessibilityRole="button"
      hitSlop={8}
    >
      <Text style={[type.caption, styles.link]}>{label}</Text>
    </Pressable>
  );
}

/** Hero card for next Assist appointment with glass empty state. */
export function PortalNextAppointmentHero({
  appointment,
  onRequestChange,
  onRequestExtra,
}: PortalNextAppointmentHeroProps) {
  const text = useAuroraAdaptiveText();
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const router = useRouter();

  return (
    <GlassCard glow accentColor="#4CC9F0" style={[styles.card, isPhone && styles.cardPhone]}>
      <Text style={[type.caption, styles.eyebrow, { color: text.muted }]} {...noBreakTextProps}>
        NÄCHSTER TERMIN
      </Text>
      {appointment ? (
        <>
          <Text style={[type.cardTitle, { color: text.primary }]} {...noBreakTextProps} numberOfLines={2}>
            {appointment.title}
          </Text>
          <Text style={[type.body, { color: text.secondary }]} {...noBreakTextProps} numberOfLines={2}>
            {formatDateTime(appointment.startsAt)}
            {appointment.location ? ` · ${appointment.location}` : ''}
          </Text>
          <View style={[styles.actions, isPhone && styles.actionsPhone]}>
            <HeroLink
              label="Details anzeigen"
              onPress={() => router.push(`/portal/client/appointments/${appointment.id}` as never)}
            />
            {onRequestChange ? (
              <HeroLink label="Termin ändern" onPress={onRequestChange} />
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
    minHeight: 120,
  },
  cardPhone: {
    minHeight: 0,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    marginTop: careSpacing.sm,
  },
  actionsPhone: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: careSpacing.xs,
  },
  linkButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: careSpacing.xs,
  },
  link: {
    color: '#4CC9F0',
    fontWeight: '700',
  },
});
