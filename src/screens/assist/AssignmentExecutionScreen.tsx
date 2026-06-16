import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VoiceFlowPanel } from '@/components/brand';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useAssignmentDetail } from '@/hooks/useAssignmentDetail';
import { useAssignmentExecution } from '@/hooks/useAssignmentExecution';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { startVoiceRecordingPrepared } from '@/features/communication/communication.voice';
import { resolveVoiceFlowVisibility } from '@/lib/ui/voiceFlowVisibility';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import { colors, spacing, typography } from '@/theme';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AssignmentExecutionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();
  const serviceTenantId = useServiceTenantId();
  const { can, check, roleLabel, roleKey } = usePermissions();
  const canManage = can('assist.execution.manage');
  const canCreateRecord = can('assist.records.create');

  const [documentationNotes, setDocumentationNotes] = useState('');
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});

  const { data: assignment, loading: assignmentLoading } = useAssignmentDetail(id);
  const {
    data: execution,
    loading: executionLoading,
    actionLoading,
    successMessage,
    markOnTheWay,
    markArrived,
    markStarted,
    markPaused,
    markFinished,
    submitDocumentation,
    completeAssignment,
    updateTask,
  } = useAssignmentExecution(id);

  const loading = assignmentLoading || executionLoading;

  if (loading) {
    return (
      <ScreenShell title="Einsatz durchführen" subtitle="Wird geladen…">
        <LoadingState message="Einsatzdaten werden geladen…" />
      </ScreenShell>
    );
  }

  if (!assignment || !execution) {
    return (
      <ScreenShell title="Einsatz durchführen" subtitle="Fehler">
        <ErrorState message="Einsatz nicht gefunden." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  const status = execution.status;
  const statusLabel = ASSIGNMENT_STATUS_LABELS[status];
  const inDocumentationContext =
    status === 'beendet' || status === 'dokumentation_offen' || status === 'unterschrift_offen';
  const voiceFlow = resolveVoiceFlowVisibility({
    isAuthenticated: Boolean(user),
    roleKey: roleKey ?? profile?.roleKey ?? null,
    assignmentId: id,
    tenantId: assignment.tenantId,
    sessionTenantId: profile?.tenantId ?? serviceTenantId,
    documentationAllowed: inDocumentationContext && canManage,
  });

  return (
    <ScreenShell title={assignment.title} subtitle={assignment.clientName}>
      {successMessage ? <SuccessState message={successMessage} /> : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <PremiumCard accentColor={colors.amber}>
          <Text style={styles.phase}>{statusLabel}</Text>
          <PremiumBadge label={statusLabel} variant="orange" dot />
        </PremiumCard>

        <SectionPanel title="Zeiterfassung">
          <DetailInfoRow label="Geplant" value={formatDateTime(execution.plannedStartAt)} />
          <DetailInfoRow label="Unterwegs" value={formatDateTime(execution.onTheWayAt)} />
          <DetailInfoRow label="Angekommen" value={formatDateTime(execution.arrivedAt)} />
          <DetailInfoRow label="Gestartet" value={formatDateTime(execution.actualStartAt)} />
          <DetailInfoRow label="Beendet" value={formatDateTime(execution.finishedAt)} />
          <DetailInfoRow
            label="Dauer"
            value={
              execution.durationMinutes != null
                ? `${execution.durationMinutes} Minuten`
                : '—'
            }
          />
        </SectionPanel>

        <SectionPanel title="Ort">
          <DetailInfoRow label="Geplant" value={assignment.location} />
          {execution.locationNote ? (
            <DetailInfoRow label="Einsatzort" value={execution.locationNote} />
          ) : null}
        </SectionPanel>

        {execution.tasks.length > 0 ? (
          <SectionPanel title="Aufgaben">
            {execution.tasks.map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <Text style={styles.taskTitle}>
                  {task.title}
                  {task.isRequired ? ' *' : ''}
                </Text>
                <Text style={styles.taskStatus}>{task.status}</Text>
                {canManage && status !== 'abgeschlossen' && status !== 'storniert' ? (
                  <View style={styles.taskActions}>
                    <PremiumButton
                      title="Erledigt"
                      variant="ghost"
                      onPress={() => updateTask(task.id, 'done')}
                    />
                    <PremiumButton
                      title="Nicht erledigt"
                      variant="ghost"
                      onPress={() =>
                        updateTask(task.id, 'not_done', taskNotes[task.id] || undefined)
                      }
                    />
                    {task.requiresNoteIfNotDone ? (
                      <PremiumInput
                        label="Begründung bei Abweichung"
                        value={taskNotes[task.id] ?? ''}
                        onChangeText={(value) =>
                          setTaskNotes((prev) => ({ ...prev, [task.id]: value }))
                        }
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))}
          </SectionPanel>
        ) : null}

        {inDocumentationContext ? (
          <SectionPanel title="Dokumentation (Pflicht)">
            {voiceFlow.showPanel ? (
              <VoiceFlowPanel
                compact
                onStart={
                  voiceFlow.showStartButton
                    ? () => {
                        void startVoiceRecordingPrepared();
                      }
                    : undefined
                }
              />
            ) : null}
            <PremiumInput
              label="Leistungsdokumentation"
              value={documentationNotes || execution.documentationNotes || ''}
              onChangeText={setDocumentationNotes}
              multiline
              placeholder="Was wurde erbracht? Abweichungen dokumentieren…"
            />
          </SectionPanel>
        ) : null}

        {execution.documentationNotes ? (
          <SectionPanel title="Gespeicherte Dokumentation">
            <Text style={styles.note}>{execution.documentationNotes}</Text>
          </SectionPanel>
        ) : null}

        {!canManage ? (
          <LockedActionBanner
            message={
              check('assist.execution.manage').reason ??
              'Einsatzdurchführung ist für Ihre Rolle gesperrt.'
            }
            roleLabel={roleLabel}
          />
        ) : (
          <View style={styles.actions}>
            {status === 'geplant' || status === 'bestaetigt' ? (
              <PremiumButton
                title="Unterwegs melden"
                fullWidth
                loading={actionLoading}
                onPress={() => markOnTheWay()}
              />
            ) : null}
            {status === 'unterwegs' ? (
              <PremiumButton
                title="Angekommen"
                fullWidth
                loading={actionLoading}
                onPress={() => markArrived()}
              />
            ) : null}
            {status === 'angekommen' ? (
              <PremiumButton
                title="Einsatz starten"
                fullWidth
                loading={actionLoading}
                onPress={() => markStarted()}
              />
            ) : null}
            {status === 'gestartet' ? (
              <>
                <PremiumButton
                  title="Pause"
                  variant="secondary"
                  fullWidth
                  loading={actionLoading}
                  onPress={() => markPaused()}
                />
                <PremiumButton
                  title="Einsatz beenden"
                  fullWidth
                  loading={actionLoading}
                  onPress={() => markFinished()}
                />
              </>
            ) : null}
            {status === 'pausiert' ? (
              <>
                <PremiumButton
                  title="Fortsetzen"
                  fullWidth
                  loading={actionLoading}
                  onPress={() => markStarted()}
                />
                <PremiumButton
                  title="Einsatz beenden"
                  variant="secondary"
                  fullWidth
                  loading={actionLoading}
                  onPress={() => markFinished()}
                />
              </>
            ) : null}
            {status === 'beendet' ? (
              <PremiumButton
                title="Dokumentation speichern"
                fullWidth
                loading={actionLoading}
                onPress={() => submitDocumentation(documentationNotes)}
              />
            ) : null}
            {status === 'dokumentation_offen' ? (
              <PremiumButton
                title="Einsatz abschließen"
                fullWidth
                loading={actionLoading}
                onPress={() => completeAssignment()}
              />
            ) : null}
            {status === 'unterschrift_offen' && execution.serviceRecordId ? (
              <PremiumButton
                title="Zur Unterschrift"
                fullWidth
                loading={actionLoading}
                onPress={() =>
                  router.push(`/assist/nachweise/${execution.serviceRecordId}` as never)
                }
              />
            ) : null}
            {status === 'abgeschlossen' ? (
              <>
                {canCreateRecord && execution.serviceRecordId ? (
                  <PremiumButton
                    title="Leistungsnachweis öffnen"
                    fullWidth
                    onPress={() =>
                      router.push(`/assist/nachweise/${execution.serviceRecordId}` as never)
                    }
                  />
                ) : null}
                <PremiumButton
                  title="Zurück zur Übersicht"
                  variant="secondary"
                  fullWidth
                  onPress={() => router.replace('/assist/durchfuehrung' as never)}
                />
              </>
            ) : null}
          </View>
        )}

        <PremiumButton
          title="Einsatzdetails"
          variant="ghost"
          fullWidth
          onPress={() => router.push(`/assist/assignments/${id}` as never)}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  phase: { ...typography.body, marginBottom: spacing.sm },
  note: { ...typography.body },
  actions: { gap: spacing.sm },
  taskRow: { marginBottom: spacing.md, gap: spacing.xs },
  taskTitle: { ...typography.body },
  taskStatus: { ...typography.caption, color: colors.textMuted },
  taskActions: { gap: spacing.xs },
});
