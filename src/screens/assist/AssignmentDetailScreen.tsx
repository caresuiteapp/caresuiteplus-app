import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo, type ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useAssignmentDetail } from '@/hooks/useAssignmentDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { colors, spacing } from '@/theme';

type AssignmentDetailScreenProps = {
  assignmentId?: string;
  embedded?: boolean;
  onClose?: () => void;
};

function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '—';
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

export function AssignmentDetailScreen({
  assignmentId: assignmentIdProp,
  embedded = false,
  onClose,
}: AssignmentDetailScreenProps = {}) {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const assignmentId = assignmentIdProp ?? routeId;
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canManage = can('assist.assignments.manage');
  const { colors: themeColors, typography } = useLegacyTheme();

  const {
    data: assignment,
    loading,
    error,
    actionLoading,
    successMessage,
    refresh,
    changeStatus,
    notFound,
  } = useAssignmentDetail(assignmentId);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
        hint: { ...typography.body, marginBottom: spacing.sm, color: themeColors.textPrimary },
        notes: { ...typography.body, color: themeColors.textPrimary },
        actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
      }),
    [themeColors, typography],
  );

  const handleBack = () => {
    if (onClose) {
      onClose();
      return;
    }
    router.back();
  };

  const renderShell = (content: ReactNode, title = 'Einsatz', subtitle?: string) => {
    if (embedded) return content;
    return (
      <CareLightPageShell
        title={title}
        subtitle={subtitle}
        rightSlot={
          <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={handleBack} />
        }
      >
        {content}
      </CareLightPageShell>
    );
  };

  if (!assignmentId) {
    const message = 'Keine Einsatz-ID angegeben.';
    if (embedded) {
      return <ErrorState title="Nicht gefunden" message={message} />;
    }
    return renderShell(
      <>
        <ErrorState title="Nicht gefunden" message={message} />
        <PremiumButton title="Zur Liste" variant="secondary" onPress={handleBack} />
      </>,
      'Einsatz',
      'Fehler',
    );
  }

  if (loading) {
    if (embedded) {
      return <LoadingState message="Einsatzdetails werden geladen…" />;
    }
    return (
      <CareLightPageShell title="Einsatz" subtitle="Wird geladen…">
        <LoadingState message="Einsatzdetails werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (notFound || error) {
    const errorContent = (
      <>
        <ErrorState
          title={notFound ? 'Nicht gefunden' : 'Fehler'}
          message={error ?? 'Der Einsatz existiert nicht.'}
          onRetry={refresh}
        />
        {!embedded ? (
          <PremiumButton title="Zur Liste" variant="secondary" onPress={handleBack} />
        ) : null}
      </>
    );
    if (embedded) {
      return errorContent;
    }
    return renderShell(errorContent, 'Einsatz', 'Fehler');
  }

  if (!assignment) return null;

  const detailContent = (
    <>
      {successMessage ? <SuccessState message={successMessage} /> : null}

      <PremiumCard accentColor={colors.amber}>
        {assignment.nextActionHint ? (
          <Text style={styles.hint}>{assignment.nextActionHint}</Text>
        ) : null}
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
          <DetailInfoRow label="Ort" value={assignment.location ?? '—'} />
          {assignment.appointmentId ? (
            <DetailInfoRow label="Termin-ID" value={assignment.appointmentId} />
          ) : null}
        </SectionPanel>

        <SectionPanel title="Beteiligte">
          <DetailInfoRow label="Klient:in" value={assignment.clientName ?? '—'} />
          <DetailInfoRow label="Mitarbeitende:r" value={assignment.employeeName ?? '—'} />
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
          ) : (assignment.allowedStatusActions?.length ?? 0) === 0 ? (
            <EmptyState
              title="Keine Aktionen"
              message="Für diesen Status sind keine Wechsel möglich."
            />
          ) : (
            <View style={styles.actionGrid}>
              {assignment.allowedStatusActions?.map((status) => (
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
    </>
  );

  if (embedded) {
    return detailContent;
  }

  return renderShell(
    detailContent,
    assignment.title,
    `${assignment.clientName ?? '—'} · ${roleLabel ?? 'Assist'}`,
  );
}
