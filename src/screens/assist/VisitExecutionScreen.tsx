import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AssistSetupHintsBanner,
  VisitProofPreviewPanel,
  VisitSignatureSection,
  VisitTasksPanel,
} from '@/components/assist';
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
import { useVisitDispositionDetail } from '@/hooks/useVisitDispositionDetail';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  buildVisitProofPreview,
  hasVisitSignature,
  updateVisitDocumentation,
  updateVisitTaskStatus,
  validateVisitCloseReadiness,
} from '@/lib/assist';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { VisitTaskStatus } from '@/lib/assist/visitTypes';
import { colors, spacing, typography } from '@/theme';

/** Primary next action per assignment status (A–H workflow). */
const PRIMARY_NEXT: Partial<Record<AssignmentStatus, AssignmentStatus>> = {
  geplant: 'unterwegs',
  bestaetigt: 'unterwegs',
  unterwegs: 'angekommen',
  angekommen: 'gestartet',
  gestartet: 'beendet',
  pausiert: 'gestartet',
  beendet: 'dokumentation_offen',
  dokumentation_offen: 'unterschrift_offen',
  unterschrift_offen: 'abgeschlossen',
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VisitExecutionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const canManage = can('assist.execution.manage');

  const {
    data: visit,
    loading,
    error,
    actionLoading,
    successMessage,
    refresh,
    changeStatus,
    notFound,
  } = useVisitDispositionDetail(id);

  const [documentationNote, setDocumentationNote] = useState('');
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);

  const docText = useMemo(
    () => documentationNote.trim() || visit?.employeeNotes?.trim() || '',
    [documentationNote, visit?.employeeNotes],
  );

  const proofPreview = useMemo(
    () => (visit ? buildVisitProofPreview(visit, docText) : null),
    [visit, docText],
  );

  const handleUpdateTask = useCallback(
    async (taskId: string, status: VisitTaskStatus, notDoneReason?: string) => {
      if (!id || !tenantId) return;
      setTaskLoading(true);
      const result = await updateVisitTaskStatus(
        id,
        taskId,
        tenantId,
        status,
        profile?.roleKey,
        notDoneReason,
      );
      setTaskLoading(false);
      if (result.ok) {
        setLocalSuccess('Aufgabe aktualisiert.');
        await refresh();
      }
    },
    [id, tenantId, profile?.roleKey, refresh],
  );

  const handleSaveDocumentation = useCallback(async () => {
    if (!id || !tenantId) return;
    setDocLoading(true);
    const result = await updateVisitDocumentation(
      id,
      tenantId,
      documentationNote,
      profile?.roleKey,
    );
    setDocLoading(false);
    if (result.ok) {
      setLocalSuccess('Dokumentation gespeichert.');
      await refresh();
    }
  }, [id, tenantId, documentationNote, profile?.roleKey, refresh]);

  const handlePrimaryTransition = useCallback(async () => {
    if (!visit) return;
    const next = PRIMARY_NEXT[visit.assignmentStatus];
    if (!next) return;

    if (next === 'abgeschlossen') {
      const validation = validateVisitCloseReadiness({
        tasks: visit.tasks,
        documentationNote: docText,
        hasSignature: hasVisitSignature(visit.id),
      });
      if (!validation.valid) {
        setLocalSuccess(null);
        setLocalError(validation.error);
        return;
      }
    }

    if (
      (next === 'dokumentation_offen' || next === 'unterschrift_offen') &&
      !docText.trim()
    ) {
      setLocalSuccess(null);
      setLocalError('Dokumentation ist vor dem nächsten Schritt erforderlich.');
      return;
    }

    setLocalError(null);
    await changeStatus(next);
  }, [visit, changeStatus, docText]);

  if (loading) {
    return (
      <ScreenShell title="Einsatz durchführen" subtitle="Wird geladen…">
        <LoadingState message="Einsatzdaten werden geladen…" />
      </ScreenShell>
    );
  }

  if (notFound || error || !visit) {
    return (
      <ScreenShell title="Einsatz durchführen" subtitle="Fehler">
        <ErrorState message={error ?? 'Einsatz nicht gefunden.'} onRetry={refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  const primaryNext = PRIMARY_NEXT[visit.assignmentStatus];
  const showDocumentation =
    visit.assignmentStatus === 'gestartet' ||
    visit.assignmentStatus === 'beendet' ||
    visit.assignmentStatus === 'dokumentation_offen' ||
    visit.assignmentStatus === 'unterschrift_offen';

  const showSignature =
    visit.assignmentStatus === 'unterschrift_offen' ||
    visit.assignmentStatus === 'dokumentation_offen' ||
    visit.assignmentStatus === 'beendet';

  const isLocked =
    visit.assignmentStatus === 'abgeschlossen' ||
    visit.assignmentStatus === 'storniert' ||
    visit.assignmentStatus === 'nicht_erschienen';

  return (
    <ScreenShell title={visit.title} subtitle={`${visit.clientName} · Durchführung`}>
      {(successMessage || localSuccess) && (
        <SuccessState message={successMessage ?? localSuccess ?? ''} />
      )}
      {localError ? <ErrorState message={localError} /> : null}

      <AssistSetupHintsBanner maxVisible={2} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PremiumCard accentColor={colors.amber}>
          <Text style={styles.phase}>{ASSIGNMENT_STATUS_LABELS[visit.assignmentStatus]}</Text>
          <PremiumBadge
            label={ASSIGNMENT_STATUS_LABELS[visit.assignmentStatus]}
            variant="orange"
            dot
          />
        </PremiumCard>

        <SectionPanel title="Zeiterfassung">
          <DetailInfoRow label="Unterwegs ab" value={formatDateTime(visit.onTheWayAt)} />
          <DetailInfoRow label="Angekommen" value={formatDateTime(visit.arrivedAt)} />
          <DetailInfoRow label="Gestartet" value={formatDateTime(visit.actualStartAt)} />
          <DetailInfoRow label="Beendet" value={formatDateTime(visit.actualEndAt)} />
          <DetailInfoRow label="Ort" value={visit.location} />
        </SectionPanel>

        {!canManage ? (
          <LockedActionBanner
            message={
              check('assist.execution.manage').reason ??
              'Statusänderungen sind für Ihre Rolle gesperrt.'
            }
            roleLabel={roleLabel}
          />
        ) : (
          <View style={styles.actions}>
            {primaryNext && !isLocked ? (
              <PremiumButton
                title={`Weiter: ${ASSIGNMENT_STATUS_LABELS[primaryNext]}`}
                fullWidth
                loading={actionLoading}
                disabled={actionLoading}
                onPress={handlePrimaryTransition}
              />
            ) : null}

            {visit.allowedStatusTransitions.includes('nicht_erschienen') ? (
              <PremiumButton
                title="Nicht angetroffen"
                variant="ghost"
                fullWidth
                loading={actionLoading}
                disabled={actionLoading}
                onPress={() => changeStatus('nicht_erschienen')}
              />
            ) : null}

            {visit.allowedStatusTransitions.includes('storniert') ? (
              <PremiumButton
                title="Absagen"
                variant="ghost"
                fullWidth
                loading={actionLoading}
                disabled={actionLoading}
                onPress={() => changeStatus('storniert')}
              />
            ) : null}
          </View>
        )}

        {(visit.assignmentStatus === 'gestartet' ||
          visit.assignmentStatus === 'pausiert' ||
          showDocumentation) &&
        canManage ? (
          <VisitTasksPanel
            visit={visit}
            disabled={isLocked}
            actionLoading={taskLoading}
            onUpdateTask={handleUpdateTask}
          />
        ) : null}

        {showDocumentation && canManage ? (
          <SectionPanel title="Dokumentation" subtitle="Freitext — Pflicht vor Abschluss">
            <PremiumInput
              label="Was wurde erledigt?"
              value={documentationNote || visit.employeeNotes || ''}
              onChangeText={setDocumentationNote}
              multiline
              placeholder="Durchführungsnotiz für den Leistungsnachweis…"
            />
            <PremiumButton
              title="Dokumentation speichern"
              variant="secondary"
              fullWidth
              loading={docLoading}
              disabled={!(documentationNote.trim() || visit.employeeNotes?.trim())}
              onPress={handleSaveDocumentation}
            />
          </SectionPanel>
        ) : null}

        {showSignature && canManage ? (
          <VisitSignatureSection
            visitId={visit.id}
            clientName={visit.clientName}
            disabled={isLocked}
            onSigned={() => setLocalSuccess('Unterschrift erfasst (Session).')}
          />
        ) : null}

        {proofPreview ? <VisitProofPreviewPanel preview={proofPreview} /> : null}

        <PremiumButton
          title="Einsatzdetails"
          variant="ghost"
          fullWidth
          onPress={() => router.push(`/assist/assignments/${visit.id}` as never)}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  phase: { ...typography.body, marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
});
