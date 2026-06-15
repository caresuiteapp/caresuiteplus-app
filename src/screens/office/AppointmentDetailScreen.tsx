import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppointmentDetailHero } from '@/components/office';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { useAppointmentDetail } from '@/hooks/useAppointmentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing, typography } from '@/theme';

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { can, roleLabel, isReadOnly } = usePermissions();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const canView = can('office.appointments.view');
  const { data: appointment, loading, error, refresh, notFound } = useAppointmentDetail(id);

  if (!canView) {
    return (
      <CareLightPageShell title="Termin" subtitle="Kein Zugriff">
        <ErrorState
          title="Zugriff verweigert"
          message={`Termine sind für ${roleLabel ?? 'Ihre Rolle'} nicht freigegeben.`}
        />
      </CareLightPageShell>
    );
  }

  if (loading) {
    return (
      <CareLightPageShell title="Termin" subtitle="Wird geladen…">
        <LoadingState message="Termindetails werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (notFound || error || !appointment) {
    return (
      <CareLightPageShell title="Termin" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Termin existiert nicht.'}
          onRetry={refresh}
        />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title={appointment.title} subtitle={appointment.clientName} scroll={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {isReadOnly ? (
          <LockedActionBanner
            title="Lesemodus"
            message="Sie können Termine einsehen, aber nicht bearbeiten."
            roleLabel={roleLabel}
          />
        ) : null}

        <AppointmentDetailHero
          appointment={appointment}
          roleKey={roleKey}
          isReadOnly={isReadOnly}
        />

        <SectionPanel title="Details" subtitle="Ort & Team">
          <SummaryRow label="Klient:in" value={appointment.clientName} />
          <SummaryRow label="Mitarbeitende:r" value={appointment.employeeName} />
          <SummaryRow label="Ort" value={appointment.location} />
          {!appointment.location && !appointment.employeeName ? (
            <EmptyState title="Keine Zusatzdetails" message="Ort und Mitarbeitende:r noch nicht hinterlegt." />
          ) : null}
        </SectionPanel>

        {appointment.notes ? (
          <SectionPanel title="Hinweis">
            <Text style={styles.hint}>{appointment.notes}</Text>
          </SectionPanel>
        ) : null}

        <PremiumButton
          title="Zurück zur Terminliste"
          variant="secondary"
          fullWidth
          onPress={() => router.back()}
        />
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  rowValue: {
    ...typography.bodyStrong,
    flex: 1,
    textAlign: 'right',
  },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
