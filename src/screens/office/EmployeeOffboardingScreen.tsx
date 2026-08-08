import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { CareDateInput } from '@/components/inputs';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  archiveOffboardingPersonnelFile,
  buildOffboardingIntegrationSnapshot,
  completeOffboardingFinalClearance,
  fetchOffboardingProgress,
  generateOffboardingCompletionProtocol,
  lockOffboardingPortalAccess,
  markOffboardingManualStep,
  prepareOffboardingExternalAccess,
  recordOffboardingReturn,
  refreshOffboardingChecks,
  saveOffboardingExitDetails,
  startOffboardingSession,
} from '@/lib/office/offboarding';
import {
  OFFBOARDING_STEP_LABELS,
  TERMINATION_TYPE_LABELS,
  type OffboardingStepStatus,
  type TerminationType,
} from '@/types/modules/employeeOffboarding';
import type { ServiceResult } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';

const TERMINATION_TYPES = Object.entries(TERMINATION_TYPE_LABELS) as Array<
  [TerminationType, string]
>;

const OVERALL_STATUS_LABELS = {
  not_started: 'Noch nicht begonnen',
  in_progress: 'In Bearbeitung',
  blocked: 'Blockiert',
  ready_for_clearance: 'Endfreigabe erfolgt',
  completed: 'Vollständig archiviert',
  reopened: 'Wieder geöffnet',
} as const;

const STEP_STATUS_LABELS: Record<OffboardingStepStatus, string> = {
  pending: 'Offen',
  in_progress: 'In Bearbeitung',
  completed: 'Erledigt',
  blocked: 'Blockiert',
  skipped: 'Übersprungen',
  not_applicable: 'Nicht erforderlich',
};

const MANUAL_STEPS = new Set([
  'completion_documents',
  'reference_prepared',
  'work_time_closure',
  'payroll_export_prepared',
]);

export function EmployeeOffboardingScreen({
  employeeId: employeeIdProp,
  embedded = false,
  embeddedInModal = false,
}: {
  employeeId?: string;
  embedded?: boolean;
  embeddedInModal?: boolean;
} = {}) {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const id = employeeIdProp ?? routeId;
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const canManage = can('office.employees.edit');
  const canView = can('office.employees.view');
  const [exitDate, setExitDate] = useState('');
  const [terminationType, setTerminationType] = useState<TerminationType>('voluntary');
  const [internalReason, setInternalReason] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const query = useAsyncQuery(
    async () => {
      if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
      if (!id) return { ok: false as const, error: 'Keine Mitarbeitenden-ID.' };
      return fetchOffboardingProgress(tenantId, id, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id && canView },
  );

  useEffect(() => {
    if (!query.data) return;
    setExitDate(query.data.session.exitDate ?? '');
    setTerminationType(query.data.session.terminationType ?? 'voluntary');
    setInternalReason(query.data.session.internalReason ?? '');
  }, [query.data?.session.updatedAt]);

  const runAction = async <T,>(
    key: string,
    successMessage: string,
    action: () => Promise<ServiceResult<T>>,
  ) => {
    setBusyAction(key);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await action();
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionSuccess(successMessage);
      await query.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Aktion konnte nicht ausgeführt werden.');
    } finally {
      setBusyAction(null);
    }
  };

  if (!canView) {
    const content = (
      <LockedActionBanner
        message={check('office.employees.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
    return embedded ? content : <ScreenShell title="Offboarding">{content}</ScreenShell>;
  }

  if (query.loading && !query.data) {
    const content = <LoadingState message="Offboarding-Akte wird geladen…" />;
    return embedded ? content : <ScreenShell title="Offboarding">{content}</ScreenShell>;
  }

  if (query.error && !query.data) {
    const content = <ErrorState message={query.error} onRetry={query.refresh} />;
    return embedded ? content : <ScreenShell title="Offboarding">{content}</ScreenShell>;
  }

  const progress = query.data;
  if (!progress) {
    const content = <EmptyState title="Keine Daten" message="Offboarding konnte nicht geladen werden." />;
    return embedded ? content : <ScreenShell title="Offboarding">{content}</ScreenShell>;
  }

  const integration = tenantId && id
    ? buildOffboardingIntegrationSnapshot(tenantId, id)
    : null;
  const openMaterials = integration?.workMaterials.filter((item) =>
    ['issued', 'return_pending', 'damaged', 'lost'].includes(item.status),
  ) ?? [];
  const portalLocked = progress.accessRevocations.some(
    (item) => item.kind === 'portal' && item.status === 'locked',
  );
  const externalPrepared = ['email', 'phone', 'cloud'].every((kind) =>
    progress.accessRevocations.some(
      (item) => item.kind === kind && ['prepared', 'locked'].includes(item.status),
    ),
  );
  const archived = progress.session.overallStatus === 'completed';

  const body = (
    <>
      {actionError ? (
        <InfoBanner title="Aktion nicht möglich" message={actionError} variant="danger" presentation="inline" />
      ) : null}
      {actionSuccess ? (
        <InfoBanner title="Gespeichert" message={actionSuccess} variant="success" presentation="inline" />
      ) : null}

      <SectionPanel
        title="Kündigung und Offboarding"
        subtitle={`${progress.employeeName} · ${progress.completedStepCount}/${progress.totalStepCount} Schritte erledigt`}
      >
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress.progressPercent}%` }]} />
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>
            {OVERALL_STATUS_LABELS[progress.session.overallStatus]}
          </Text>
          <Text style={styles.progressLabel}>{progress.progressPercent} %</Text>
        </View>
        {archived ? (
          <InfoBanner
            title="Ehemalige:r Mitarbeitende:r"
            message="Das Beschäftigungsverhältnis ist beendet, alle Zugänge sind gesperrt und die Personalakte ist archiviert. Der Datensatz bleibt für Nachweis- und Aufbewahrungspflichten erhalten."
            variant="success"
            presentation="inline"
          />
        ) : null}
        {progress.session.overallStatus === 'not_started' && canManage ? (
          <PremiumButton
            title="Offboarding verbindlich starten"
            loading={busyAction === 'start'}
            onPress={() =>
              tenantId && id && runAction('start', 'Offboarding wurde gestartet.', () =>
                startOffboardingSession(tenantId, id, profile?.roleKey, profile?.id),
              )
            }
          />
        ) : null}
      </SectionPanel>

      {!archived ? (
        <SectionPanel title="1. Kündigung erfassen" subtitle="Austrittsdaten und Kündigungsgrund">
          <CareDateInput
            label="Letzter Tag des Beschäftigungsverhältnisses"
            value={exitDate}
            onChange={setExitDate}
            error={!exitDate && actionError ? 'Austrittsdatum ist erforderlich.' : undefined}
            viewContext="form"
          />
          <Text style={styles.fieldLabel}>Art der Beendigung</Text>
          <View style={styles.choiceGrid}>
            {TERMINATION_TYPES.map(([key, label]) => {
              const selected = terminationType === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setTerminationType(key)}
                  style={[styles.choice, selected && styles.choiceSelected]}
                >
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <PremiumInput
            label="Interner Grund / Vermerk"
            value={internalReason}
            onChangeText={setInternalReason}
            placeholder="z. B. Kündigung eingegangen am …, Frist, Besonderheiten"
            multiline
            onLightSurface
            viewContext="form"
          />
          {canManage ? (
            <PremiumButton
              title="Kündigungsdaten speichern"
              loading={busyAction === 'exit'}
              disabled={!exitDate}
              onPress={() =>
                tenantId && id && runAction('exit', 'Kündigungsdaten wurden gespeichert.', () =>
                  saveOffboardingExitDetails(
                    tenantId,
                    id,
                    { exitDate, terminationType, internalReason },
                    profile?.roleKey,
                    profile?.id,
                  ),
                )
              }
            />
          ) : null}
        </SectionPanel>
      ) : null}

      {progress.blockers.length > 0 && !archived ? (
        <SectionPanel title="Offene Punkte" subtitle="Diese Punkte verhindern den Abschluss">
          {progress.blockers.map((blocker) => (
            <View key={blocker.checkKey} style={styles.blockerRow}>
              <Text style={styles.blockerIcon}>!</Text>
              <Text style={styles.blocker}>{blocker.message}</Text>
            </View>
          ))}
          <PremiumButton
            title="Prüfstatus aktualisieren"
            variant="secondary"
            loading={busyAction === 'refresh'}
            onPress={() =>
              tenantId && id && runAction('refresh', 'Prüfstatus wurde aktualisiert.', () =>
                refreshOffboardingChecks(tenantId, id, profile?.roleKey, profile?.id),
              )
            }
          />
        </SectionPanel>
      ) : null}

      {!archived ? (
        <SectionPanel title="2. Zugänge sperren" subtitle="Portal, E-Mail, Telefon und Cloud">
          <StatusLine label="Mitarbeitendenportal" done={portalLocked} />
          <StatusLine label="Externe Zugänge vorbereitet / gesperrt" done={externalPrepared} />
          {canManage ? (
            <View style={styles.actions}>
              <PremiumButton
                title={portalLocked ? 'Portalzugang gesperrt' : 'Portalzugang jetzt sperren'}
                variant="secondary"
                disabled={portalLocked}
                loading={busyAction === 'portal'}
                onPress={() => tenantId && id && runAction('portal', 'Portalzugang wurde gesperrt.', () =>
                  lockOffboardingPortalAccess(tenantId, id, profile?.roleKey, profile?.id),
                )}
              />
              <PremiumButton
                title={externalPrepared ? 'Externe Zugänge bearbeitet' : 'Externe Zugänge sperren / vorbereiten'}
                variant="secondary"
                disabled={externalPrepared}
                loading={busyAction === 'external'}
                onPress={() => tenantId && id && runAction('external', 'Externe Zugänge wurden bearbeitet.', () =>
                  prepareOffboardingExternalAccess(tenantId, id, profile?.roleKey, profile?.id),
                )}
              />
            </View>
          ) : null}
        </SectionPanel>
      ) : null}

      {openMaterials.length > 0 && !archived ? (
        <SectionPanel title="3. Firmeneigentum zurücknehmen" subtitle="Geräte, Schlüssel, Kleidung und Zubehör">
          {openMaterials.map((material) => (
            <View key={material.id} style={styles.returnRow}>
              <View style={styles.returnText}>
                <Text style={styles.stepLabel}>{material.itemName}</Text>
                <Text style={styles.stepStatus}>{material.category} · Rückgabe offen</Text>
              </View>
              {canManage ? (
                <PremiumButton
                  title="Rückgabe bestätigen"
                  size="sm"
                  variant="secondary"
                  loading={busyAction === `return-${material.id}`}
                  onPress={() => tenantId && id && runAction(`return-${material.id}`, `${material.itemName} wurde zurückgenommen.`, () =>
                    recordOffboardingReturn(tenantId, id, material.id, profile?.roleKey, profile?.id),
                  )}
                />
              ) : null}
            </View>
          ))}
        </SectionPanel>
      ) : null}

      <SectionPanel title="4. Checkliste" subtitle="Prüf- und Abschlussstand">
        <View style={styles.stepList}>
          {progress.steps.map((step) => {
            const done = step.status === 'completed' || step.status === 'not_applicable';
            const manual = MANUAL_STEPS.has(step.stepKey);
            return (
              <Pressable
                key={step.id}
                disabled={!canManage || !manual || archived}
                onPress={() => tenantId && id && runAction(`step-${step.stepKey}`, `${OFFBOARDING_STEP_LABELS[step.stepKey]} wurde aktualisiert.`, () =>
                  markOffboardingManualStep(
                    tenantId,
                    id,
                    step.stepKey,
                    done ? 'pending' : 'completed',
                    undefined,
                    profile?.roleKey,
                    profile?.id,
                  ),
                )}
                style={[styles.stepRow, manual && !archived && styles.stepRowAction]}
              >
                <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
                  <Text style={[styles.checkMark, done && styles.checkMarkDone]}>{done ? '✓' : '•'}</Text>
                </View>
                <Text style={styles.stepLabel}>{OFFBOARDING_STEP_LABELS[step.stepKey]}</Text>
                <Text style={[styles.stepStatus, done && styles.stepStatusDone]}>
                  {STEP_STATUS_LABELS[step.status]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SectionPanel>

      {!archived && canManage ? (
        <SectionPanel title="5. Endfreigabe und Archivierung" subtitle="Datensatz erhalten, operative Nutzung beenden">
          <InfoBanner
            title="Kein Löschen"
            message="Ehemalige Mitarbeitende werden nicht gelöscht. Nach vollständigem Offboarding wird der operative Zugriff beendet und die Personalakte dauerhaft als archiviert geführt."
            variant="warning"
            presentation="inline"
          />
          <View style={styles.actions}>
            <PremiumButton
              title={progress.clearance?.protocolGeneratedAt ? 'Abschlussprotokoll erstellt' : 'Abschlussprotokoll erstellen'}
              variant="secondary"
              disabled={!!progress.clearance?.protocolGeneratedAt}
              loading={busyAction === 'protocol'}
              onPress={() => tenantId && id && runAction('protocol', 'Abschlussprotokoll wurde erstellt.', () =>
                generateOffboardingCompletionProtocol(tenantId, id, profile?.roleKey, profile?.id),
              )}
            />
            <PremiumButton
              title={progress.clearance?.clearedAt ? 'Endfreigabe erteilt' : 'Endfreigabe erteilen'}
              variant="secondary"
              disabled={!!progress.clearance?.clearedAt}
              loading={busyAction === 'clearance'}
              onPress={() => tenantId && id && runAction('clearance', 'Endfreigabe wurde erteilt.', () =>
                completeOffboardingFinalClearance(tenantId, id, profile?.roleKey, profile?.id),
              )}
            />
            <PremiumButton
              title="Ehemalige:n Mitarbeitende:n archivieren"
              disabled={!progress.clearance?.clearedAt}
              loading={busyAction === 'archive'}
              onPress={() => tenantId && id && runAction('archive', 'Personalakte wurde archiviert.', () =>
                archiveOffboardingPersonnelFile(tenantId, id, profile?.roleKey, profile?.id),
              )}
            />
          </View>
        </SectionPanel>
      ) : null}
    </>
  );

  if (embedded) {
    return <View style={embeddedInModal ? styles.embeddedModal : styles.embedded}>{body}</View>;
  }

  return (
    <ScreenShell title="Kündigung / Offboarding" subtitle={progress.employeeName} showBack onBack={() => router.back()} scroll>
      {body}
    </ScreenShell>
  );
}

function StatusLine({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={styles.statusLineRow}>
      <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
        <Text style={[styles.checkMark, done && styles.checkMarkDone]}>{done ? '✓' : '!'}</Text>
      </View>
      <Text style={styles.stepLabel}>{label}</Text>
      <Text style={[styles.stepStatus, done && styles.stepStatusDone]}>{done ? 'Erledigt' : 'Offen'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  embedded: { gap: spacing.md, paddingBottom: spacing.xxl },
  embeddedModal: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl },
  progressTrack: { height: 10, borderRadius: 99, overflow: 'hidden', backgroundColor: '#D8E7F7' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: '#0879F5' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  statusLabel: { ...typography.label, color: '#09213F' },
  progressLabel: { ...typography.label, color: '#056CE8' },
  fieldLabel: { ...typography.label, color: '#09213F', marginBottom: spacing.xs },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  choice: { borderWidth: 1, borderColor: '#9CC8F7', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#F5FAFF' },
  choiceSelected: { borderColor: '#056CE8', backgroundColor: '#DCEEFF' },
  choiceText: { ...typography.caption, color: '#395571', fontWeight: '700' },
  choiceTextSelected: { color: '#045BBF' },
  blockerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  blockerIcon: { width: 24, height: 24, borderRadius: 12, overflow: 'hidden', textAlign: 'center', color: '#FFFFFF', backgroundColor: '#C9354D', fontWeight: '900' },
  blocker: { ...typography.body, color: '#8A1830', flex: 1, fontWeight: '600' },
  actions: { gap: spacing.sm },
  statusLineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  stepList: { gap: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#BBD5EE' },
  stepRowAction: { cursor: 'pointer' as never },
  checkCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#8AA9C8', backgroundColor: '#FFFFFF' },
  checkCircleDone: { borderColor: '#188A6B', backgroundColor: '#DDF7EF' },
  checkMark: { color: '#607A94', fontWeight: '900' },
  checkMarkDone: { color: '#08735A' },
  stepLabel: { ...typography.body, color: '#09213F', flex: 1, fontWeight: '600' },
  stepStatus: { ...typography.caption, color: '#526A84', fontWeight: '700' },
  stepStatusDone: { color: '#08735A' },
  returnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#BBD5EE' },
  returnText: { flex: 1, minWidth: 0 },
});
