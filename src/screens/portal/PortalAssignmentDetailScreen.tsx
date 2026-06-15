import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { PortalEmployeeAssignmentDetailHero } from '@/components/portal';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
} from '@/components/ui';
import { usePortalAppointmentDetail } from '@/hooks/usePortalAppointmentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PortalAssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canView = can('portal.employee.appointments.view');

  const { data, loading, error, refresh, notFound } = usePortalAppointmentDetail(id);

  if (!canView) {
    return (
      <CareLightPageShell title="Einsatz" subtitle={roleLabel ?? 'Portal'}>
        <LockedActionBanner
          message={check('portal.employee.appointments.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </CareLightPageShell>
    );
  }

  if (loading) {
    return (
      <CareLightPageShell title="Einsatz" subtitle="Wird geladen…">
        <LoadingState message="Einsatzdetails werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (notFound || error) {
    return (
      <CareLightPageShell title="Einsatz" subtitle="Fehler">
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Einsatz existiert nicht.'}
          onRetry={refresh}
        />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  if (!data) return null;

  return (
    <CareLightPageShell
      title={data.title}
      subtitle={`${data.clientName} · ${roleLabel ?? 'Portal'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <PortalEmployeeAssignmentDetailHero assignment={data} />

        <View style={styles.detailsCard}>
          <DetailInfoRow label="Beginn" value={formatDateTime(data.startsAt)} />
          <DetailInfoRow label="Ende" value={formatDateTime(data.endsAt)} />
          {data.location ? <DetailInfoRow label="Ort" value={data.location} /> : null}
          {data.clientPhone ? (
            <DetailInfoRow label="Kontakt Klient:in" value={data.clientPhone} />
          ) : null}
        </View>

        {data.notes ? (
          <SectionPanel title="Hinweise">
            <Text style={styles.notes}>{data.notes}</Text>
          </SectionPanel>
        ) : null}

        {data.tasks.length > 0 ? (
          <SectionPanel title="Aufgaben">
            {data.tasks.map((task) => (
              <Text key={task} style={styles.task}>
                • {task}
              </Text>
            ))}
          </SectionPanel>
        ) : (
          <EmptyState title="Keine Aufgaben" message="Für diesen Einsatz sind keine Aufgaben hinterlegt." />
        )}

        {data.canStartExecution && data.executionRoute ? (
          <PremiumButton
            title="Zur Einsatzdurchführung"
            onPress={() => router.push(data.executionRoute as never)}
          />
        ) : null}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  detailsCard: {
    gap: spacing.xs,
  },
  notes: {
    ...typography.body,
    color: colors.textSecondary,
  },
  task: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
});
