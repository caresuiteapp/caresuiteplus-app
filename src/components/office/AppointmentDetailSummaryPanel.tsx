import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { LockedActionBanner } from '@/components/permissions';
import { useAppointmentDetail } from '@/hooks/useAppointmentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { colors, spacing, typography } from '@/theme';

export type AppointmentDetailSummaryPanelProps = {
  appointmentId: string;
  onOpenFullRecord?: () => void;
};

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusVariant(status: string) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function AppointmentDetailSummaryPanel({
  appointmentId,
}: AppointmentDetailSummaryPanelProps) {
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();
  const { data: appointment, loading, error, refresh, notFound } =
    useAppointmentDetail(appointmentId);

  if (loading) {
    return <LoadingState message="Termin wird geladen…" />;
  }

  if (notFound || error) {
    return (
      <View style={styles.panel}>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Datensatz existiert nicht.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!appointment) return null;

  return (
    <View style={styles.panel}>
      <PremiumCard accentColor={colors.violet}>
        <Text style={styles.title}>{appointment.title}</Text>
        <View style={styles.badgeRow}>
          <PremiumBadge
            label={WORKFLOW_STATUS_LABELS[appointment.status]}
            variant={statusVariant(appointment.status)}
            dot
          />
        </View>
        <Text style={styles.client}>{appointment.clientName}</Text>
      </PremiumCard>

      {isReadOnly ? (
        <LockedActionBanner
          title="Lesemodus"
          message="Sie können Termine einsehen, aber nicht bearbeiten."
          roleLabel={roleLabel}
        />
      ) : null}

      <SectionPanel title="Termindetails" subtitle="Zeit & Ort">
        <SummaryRow label="Beginn" value={formatDateTime(appointment.startsAt)} />
        <SummaryRow label="Ende" value={formatDateTime(appointment.endsAt)} />
        <SummaryRow label="Ort" value={appointment.location} />
        <SummaryRow label="Mitarbeitende:r" value={appointment.employeeName} />
        {!appointment.location && !appointment.employeeName ? (
          <EmptyState title="Keine Zusatzdetails" message="Ort und Mitarbeitende:r noch nicht hinterlegt." />
        ) : null}
      </SectionPanel>

      {appointment.notes ? (
        <PremiumCard accentColor={colors.amber}>
          <Text style={styles.hintLabel}>Hinweis</Text>
          <Text style={styles.hint}>{appointment.notes}</Text>
        </PremiumCard>
      ) : null}

      <View style={styles.actions}>
        <PremiumButton
          title="Vollständigen Termin öffnen"
          variant="primary"
          fullWidth
          onPress={() => router.push(`/office/appointments/${appointment.id}` as never)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  client: {
    ...typography.caption,
    color: colors.textMuted,
  },
  row: {
    marginBottom: spacing.sm,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 2,
  },
  rowValue: {
    ...typography.body,
  },
  hintLabel: {
    ...typography.label,
    color: colors.violet,
    marginBottom: spacing.xs,
  },
  hint: {
    ...typography.body,
  },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
});
