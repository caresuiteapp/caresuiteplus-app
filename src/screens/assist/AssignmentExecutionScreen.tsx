import { useState } from 'react';
import { createCareRecordFromExecution } from '@/lib/assist';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import type { ExecutionPhase } from '@/types/modules/assist';
import { colors, spacing, typography } from '@/theme';

const PHASE_LABELS: Record<ExecutionPhase, string> = {
  pending: 'Bereit zum Check-in',
  checked_in: 'Eingecheckt — Einsatz starten',
  in_progress: 'Einsatz läuft',
  completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen',
};

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
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const canManage = can('assist.execution.manage');
  const canCreateRecord = can('assist.records.create');
  const [activityNote, setActivityNote] = useState('');
  const [creatingRecord, setCreatingRecord] = useState(false);

  const { data: assignment, loading: assignmentLoading } = useAssignmentDetail(id);
  const {
    data: execution,
    loading: executionLoading,
    actionLoading,
    successMessage,
    checkIn,
    startWork,
    checkOut,
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

  const phase = execution.phase;

  return (
    <ScreenShell title={assignment.title} subtitle={assignment.clientName}>
      {successMessage ? <SuccessState message={successMessage} /> : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <PremiumCard accentColor={colors.amber}>
          <Text style={styles.phase}>{PHASE_LABELS[phase]}</Text>
          <PremiumBadge label={PHASE_LABELS[phase]} variant="orange" dot />
        </PremiumCard>

        <SectionPanel title="Zeiterfassung">
          <DetailInfoRow label="Check-in" value={formatDateTime(execution.checkedInAt)} />
          <DetailInfoRow label="Einsatzstart" value={formatDateTime(execution.actualStartAt)} />
          <DetailInfoRow label="Check-out" value={formatDateTime(execution.checkedOutAt)} />
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
            <DetailInfoRow label="Vor Ort" value={execution.locationNote} />
          ) : null}
        </SectionPanel>

        {phase === 'in_progress' || phase === 'checked_in' ? (
          <SectionPanel title="Tätigkeitsnotiz">
            <PremiumInput
              label="Was wurde erledigt?"
              value={activityNote}
              onChangeText={setActivityNote}
              multiline
              placeholder="Kurze Dokumentation für den Einsatz…"
            />
          </SectionPanel>
        ) : null}

        {execution.activityNote ? (
          <SectionPanel title="Dokumentation">
            <Text style={styles.note}>{execution.activityNote}</Text>
          </SectionPanel>
        ) : null}

        {!canManage ? (
          <LockedActionBanner
            message={
              check('assist.execution.manage').reason ??
              'Check-in/Check-out ist für Ihre Rolle gesperrt.'
            }
            roleLabel={roleLabel}
          />
        ) : (
          <View style={styles.actions}>
            {phase === 'pending' ? (
              <PremiumButton
                title="Check-in (vor Ort)"
                fullWidth
                loading={actionLoading}
                onPress={() => checkIn(assignment.location)}
              />
            ) : null}
            {phase === 'checked_in' ? (
              <PremiumButton
                title="Einsatz starten"
                fullWidth
                loading={actionLoading}
                onPress={() => startWork()}
              />
            ) : null}
            {phase === 'in_progress' || phase === 'checked_in' ? (
              <PremiumButton
                title="Check-out (Einsatz beenden)"
                variant="secondary"
                fullWidth
                loading={actionLoading}
                onPress={() => checkOut(activityNote || undefined)}
              />
            ) : null}
            {phase === 'completed' ? (
              <>
                {canCreateRecord ? (
                  <PremiumButton
                    title="Leistungsnachweis anlegen"
                    fullWidth
                    loading={creatingRecord}
                    onPress={async () => {
                      if (!id || !tenantId) return;
                      setCreatingRecord(true);
                      const result = await createCareRecordFromExecution(
                        id,
                        (execution.activityNote ?? activityNote) || 'Einsatz dokumentiert.',
                        execution.durationMinutes,
                        execution.locationNote ?? assignment.location,
                        tenantId,
                        profile?.roleKey,
                      );
                      setCreatingRecord(false);
                      if (result.ok) {
                        router.push(`/assist/nachweise/${result.data.id}` as never);
                      }
                    }}
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
});
