import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ClientPortalAssignmentCard } from '@/components/portal/ClientPortalAssignmentCard';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { PremiumButton } from '@/components/ui';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePortalAppointments } from '@/hooks/usePortalAppointments';
import { groupPortalAppointmentsByTime } from '@/lib/portal/groupPortalAppointmentsByTime';

/** Read-only Einsatzhistorie on profile — kommende + vergangene Einsätze. */
export function ClientPortalProfileAssignmentsSection() {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const { items, loading, isEmpty } = usePortalAppointments();

  const groups = useMemo(() => groupPortalAppointmentsByTime(items), [items]);
  const upcoming = groups.find((g) => g.key === 'upcoming');
  const past = groups.find((g) => g.key === 'past');

  if (loading && items.length === 0) {
    return null;
  }

  if (isEmpty) {
    return (
      <GlassCard>
        <Text style={[type.caption, { color: text.muted, marginBottom: careSpacing.sm }]}>
          EINSATZHISTORIE
        </Text>
        <Text style={[type.body, { color: text.secondary }]}>
          Aktuell sind keine Einsätze in Ihrem Portal sichtbar.
        </Text>
        <PremiumButton
          title="Alle Einsätze öffnen"
          variant="secondary"
          onPress={() => router.push('/portal/client/appointments' as never)}
          style={styles.cta}
        />
      </GlassCard>
    );
  }

  return (
    <>
      {upcoming && upcoming.items.length > 0 ? (
        <GlassCard>
          <Text style={[type.caption, { color: text.muted, marginBottom: careSpacing.sm }]}>
            KOMMENDE EINSÄTZE
          </Text>
          {upcoming.items.slice(0, 3).map((appt) => (
            <ClientPortalAssignmentCard
              key={appt.id}
              appointment={appt}
              onPreview={() => router.push(`/portal/client/appointments/${appt.id}` as never)}
            />
          ))}
          {upcoming.items.length > 3 ? (
            <Text style={[type.caption, { color: text.muted }]}>
              +{upcoming.items.length - 3} weitere kommende Einsätze
            </Text>
          ) : null}
        </GlassCard>
      ) : null}

      {past && past.items.length > 0 ? (
        <GlassCard>
          <Text style={[type.caption, { color: text.muted, marginBottom: careSpacing.sm }]}>
            VERGANGENE EINSÄTZE
          </Text>
          {past.items.slice(0, 3).map((appt) => (
            <ClientPortalAssignmentCard
              key={appt.id}
              appointment={appt}
              onPreview={() => router.push(`/portal/client/appointments/${appt.id}` as never)}
            />
          ))}
          {past.items.length > 3 ? (
            <Text style={[type.caption, { color: text.muted }]}>
              +{past.items.length - 3} weitere vergangene Einsätze
            </Text>
          ) : null}
        </GlassCard>
      ) : null}

      <PremiumButton
        title="Alle Einsätze anzeigen"
        variant="secondary"
        onPress={() => router.push('/portal/client/appointments' as never)}
        fullWidth
      />
    </>
  );
}

const styles = StyleSheet.create({
  cta: {
    marginTop: careSpacing.sm,
  },
});
