import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import type { PortalNextAppointment } from '@/types/portal/assist';
import { PORTAL_MOBILE_CTA_GOLD } from '@/components/portal/assist/MobilePortalKpiCard';
import { PortalEmptyState } from './PortalEmptyState';

type PortalNextAppointmentHeroProps = {
  appointment: PortalNextAppointment | null;
  onRequestChange?: () => void;
  onRequestExtra?: () => void;
  /** Override empty-state CTA label (mobile uses „Termin anfragen →“). */
  emptyActionLabel?: string;
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
  gold = false,
}: {
  label: string;
  onPress: () => void;
  gold?: boolean;
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
      <Text style={[type.caption, gold ? styles.linkGold : styles.link]}>{label}</Text>
    </Pressable>
  );
}

/** Hero card for next Assist appointment with glass empty state. */
export function PortalNextAppointmentHero({
  appointment,
  onRequestChange,
  onRequestExtra,
  emptyActionLabel,
}: PortalNextAppointmentHeroProps) {
  const text = useAuroraAdaptiveText();
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const router = useRouter();

  return (
    <GlassCard
      glow
      accentColor="#7B61FF"
      style={[
        styles.card,
        isPhone && styles.cardPhone,
        isPhone && styles.cardPhoneGlow,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          {appointment ? (
            <>
              <Text style={[type.cardTitle, { color: text.primary }]} {...noBreakTextProps} numberOfLines={2}>
                {appointment.title}
              </Text>
              <Text style={[type.body, { color: text.secondary }]} {...noBreakTextProps} numberOfLines={2}>
                {formatDateTime(appointment.startsAt)}
                {appointment.location ? ` · ${appointment.location}` : ''}
              </Text>
            </>
          ) : (
            <PortalEmptyState
              message="Noch kein Assist-Termin geplant."
              actionLabel={emptyActionLabel ?? 'Zusatztermin anfragen'}
              onAction={onRequestExtra}
              ctaColor={isPhone ? 'gold' : '#FF9500'}
              ctaSuffix={isPhone ? ' →' : ''}
            />
          )}
        </View>
        {isPhone ? (
          <View style={styles.calendarIconWrap}>
            <Text style={styles.calendarIcon}>📅</Text>
          </View>
        ) : null}
      </View>
      {appointment ? (
        <View style={[styles.actions, isPhone && styles.actionsPhone]}>
          <HeroLink
            label="Details anzeigen"
            onPress={() => router.push(`/portal/client/appointments/${appointment.id}` as never)}
            gold={isPhone}
          />
          {onRequestChange ? (
            <HeroLink label="Termin ändern" onPress={onRequestChange} gold={isPhone} />
          ) : null}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 120,
  },
  cardPhone: {
    minHeight: 0,
    backgroundColor: 'rgba(20,27,40,0.85)',
  },
  cardPhoneGlow: {
    borderColor: 'rgba(123,97,255,0.45)',
    shadowColor: '#7B61FF',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: careSpacing.sm,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  calendarIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(123,97,255,0.45)',
    backgroundColor: 'rgba(123,97,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  calendarIcon: {
    fontSize: 20,
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
  linkGold: {
    color: PORTAL_MOBILE_CTA_GOLD,
    fontWeight: '700',
  },
});
