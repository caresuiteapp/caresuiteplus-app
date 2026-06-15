import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchAssignmentDetail } from '@/lib/assist/assignmentDetailService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton, PremiumCard, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAssignmentDetail } from '@/hooks/useAssignmentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
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

function statusVariant(status: string) {
  switch (status) {
    case 'aktiv':
      return 'green' as const;
    case 'fehlerhaft':
    case 'gesperrt':
      return 'red' as const;
    case 'in_bearbeitung':
    case 'entwurf':
      return 'orange' as const;
    default:
      return 'muted' as const;
  }
}

export function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canManage = can('assist.assignments.manage');

  const {
    data: assignment,
    loading,
    error,
    actionLoading,
    successMessage,
    refresh,
    changeStatus,
    notFound,
  } = useAssignmentDetail(id);

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
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  if (!assignment) return null;

  return (
    <CareLightPageShell
      title={assignment.title}
      subtitle={`${assignment.clientName} · ${roleLabel ?? 'Demo'}`}
      rightSlot={
        <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()} />
      }
    >
      {successMessage ? <SuccessState message={successMessage} /> : null}

      <PremiumCard accentColor={colors.amber}>
        <Text style={styles.hint}>{assignment.nextActionHint}</Text>
        <PremiumBadge
          label={WORKFLOW_STATUS_LABELS[assignment.status]}
          variant={statusVariant(assignment.status)}
          dot
        />
      </PremiumCard>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SectionPanel title="Zeit & Ort">
          <DetailInfoRow label="Beginn" value={formatDateTime(assignment.scheduledStart)} />
          <DetailInfoRow label="Ende" value={formatDateTime(assignment.scheduledEnd)} />
          <DetailInfoRow label="Ort" value={assignment.location} />
          {assignment.appointmentId ? (
            <DetailInfoRow label="Termin-ID" value={assignment.appointmentId} />
          ) : null}
        </SectionPanel>

        <SectionPanel title="Beteiligte">
          <DetailInfoRow label="Klient:in" value={assignment.clientName} />
          <DetailInfoRow label="Mitarbeitende:r" value={assignment.employeeName} />
        </SectionPanel>

        {assignment.notes ? (
          <SectionPanel title="Notizen">
            <Text style={styles.notes}>{assignment.notes}</Text>
          </SectionPanel>
        ) : null}

        {can('assist.execution.view') ? (
          <SectionPanel title="Vor-Ort-Durchführung" subtitle="Check-in, Zeiterfassung, Check-out">
            <PremiumButton
              title="Einsatz durchführen"
              fullWidth
              onPress={() => router.push(`/assist/assignments/${assignment.id}/execute` as never)}
            />
          </SectionPanel>
        ) : null}

        <SectionPanel title="Status ändern" subtitle="Erlaubte Workflow-Übergänge">
          {!canManage ? (
            <LockedActionBanner
              message={
                check('assist.assignments.manage').reason ??
                'Statusänderungen sind für Ihre Rolle gesperrt.'
              }
              roleLabel={roleLabel}
            />
          ) : assignment.allowedStatusActions.length === 0 ? (
            <EmptyState
              title="Keine Aktionen"
              message="Für diesen Status sind keine Wechsel möglich."
            />
          ) : (
            <View style={styles.actionGrid}>
              {assignment.allowedStatusActions.map((status) => (
                <PremiumButton
                  key={status}
                  title={WORKFLOW_STATUS_LABELS[status]}
                  variant="secondary"
                  size="sm"
                  loading={actionLoading}
                  onPress={() => changeStatus(status)}
                />
              ))}
            </View>
          )}
        </SectionPanel>
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  hint: { ...typography.body, marginBottom: spacing.sm },
  notes: { ...typography.body },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
