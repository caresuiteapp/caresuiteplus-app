import { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmployeePortalLiveTimersPanel,
  EmployeePortalLocationConsentBanner,
  EmployeePortalVisitDocumentationPanel,
  EmployeePortalVisitSignaturePanel,
  EmployeePortalVisitTasksPanel,
  EmployeePortalVisitWorkflowTimeline,
} from '@/components/portal';
import { ScreenShell } from '@/components/layout';
import { OrientationGate } from '@/components/layout/OrientationGate';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useEmployeePortalVisitExecution } from '@/hooks/useEmployeePortalVisitExecution';
import { usePermissions } from '@/hooks/usePermissions';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import {
  ASSIST_WORKFLOW_ACTION_LABELS,
  primaryAllowedAction,
  type AssistWorkflowAllowedAction,
} from '@/features/assistWorkflow/resolveAllowedActions';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import { colors, spacing, typography } from '@/theme';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function trackingStatusLabel(
  trackingActive: boolean,
  gpsPermission: string,
  errorCode: string | null,
): string {
  if (errorCode) return 'Fehler';
  if (trackingActive) return 'Aktiv';
  if (gpsPermission === 'granted') return 'Bereit';
  return 'Inaktiv';
}

export function EmployeePortalVisitExecutionScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canExecute = can('assist.execution.manage');

  const {
    data: visit,
    workflowStep,
    allowedActions,
    liveContext,
    tracking,
    timers,
    consent,
    gpsPermission,
    loading,
    error,
    errorCode,
    liveContextError,
    queryError,
    hasAssignment,
    actionLoading,
    startServiceLoading,
    refetchWarning,
    taskSaving,
    taskSaveError,
    refresh,
    grantConsent,
    startDriveTracking,
    markArrived,
    startService,
    startPause,
    endPause,
    endService,
    saveTask,
    saveDocumentation,
    saveSignature,
    finalizeVisit,
    reportNoShow,
    requestLocationPermission,
    setGeofenceOverride,
    openRoute,
    derivedStatus,
    consistencyStatus,
    nextActionHint,
    notFound,
  } = useEmployeePortalVisitExecution(id);

  const effectiveStatus: AssignmentStatus = derivedStatus ?? visit?.status ?? 'geplant';

  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [localWarning, setLocalWarning] = useState<string | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [geofenceOverride, setGeofenceOverrideInput] = useState('');
  const [showGeofenceOverride, setShowGeofenceOverride] = useState(false);
  const [noShowNote, setNoShowNote] = useState('');
  const [showNoShowForm, setShowNoShowForm] = useState(false);
  const [awaitingSignature, setAwaitingSignature] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const signatureSectionY = useRef(0);
  const [signaturePanelOpenRequest, setSignaturePanelOpenRequest] = useState(0);

  const primaryAction = primaryAllowedAction(allowedActions, effectiveStatus);
  const primaryLabel = primaryAction ? ASSIST_WORKFLOW_ACTION_LABELS[primaryAction] : undefined;
  const insets = useSafeAreaInsets();

  const isLocked = useMemo(
    () =>
      visit?.status === 'abgeschlossen' ||
      visit?.status === 'storniert' ||
      visit?.status === 'nicht_erschienen' ||
      visit?.isLocked,
    [visit],
  );

  const trackingActive = Boolean(tracking?.trackingActive || liveContext?.trackingSessionActive);

  const statusBlocksDoc =
    consistencyStatus === 'repairable' &&
    ['beendet', 'dokumentation_offen', 'unterschrift_offen'].includes(visit?.status ?? '');

  const showTasks =
    visit &&
    ['gestartet', 'pausiert', 'beendet', 'dokumentation_offen', 'unterschrift_offen'].includes(
      effectiveStatus,
    ) &&
    !statusBlocksDoc;
  const documentationSubmitted = visit?.documentationStatus === 'submitted';
  const signatureCaptured = visit?.signatureStatus === 'captured';
  const showDocumentationForm =
    visit &&
    !statusBlocksDoc &&
    !documentationSubmitted &&
    ['beendet', 'dokumentation_offen', 'unterschrift_offen'].includes(effectiveStatus);
  const showSignature =
    visit &&
    visit.requiresSignature &&
    !statusBlocksDoc &&
    documentationSubmitted &&
    !signatureCaptured &&
    (awaitingSignature ||
      ['dokumentation_offen', 'unterschrift_offen'].includes(effectiveStatus));
  const showFinalize =
    visit &&
    !statusBlocksDoc &&
    documentationSubmitted &&
    (effectiveStatus === 'unterschrift_offen' ||
      (!visit.requiresSignature && effectiveStatus === 'dokumentation_offen'));

  const scrollToSignature = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(signatureSectionY.current - 16, 0), animated: true });
    setSignaturePanelOpenRequest((n) => n + 1);
  }, []);

  const handleGrantConsent = useCallback(async () => {
    setConsentLoading(true);
    setLocalError(null);
    setLocalSuccess(null);
    const result = await grantConsent();
    if (!result.ok) setLocalError(result.error ?? 'Einwilligung konnte nicht gespeichert werden.');
    else setLocalSuccess('Einwilligung gespeichert.');
    setConsentLoading(false);
  }, [grantConsent]);

  const handleRequestPermission = useCallback(async () => {
    setLocalError(null);
    const status = await requestLocationPermission();
    if (status === 'granted') setLocalSuccess('Standortberechtigung erteilt.');
    else if (status === 'denied') {
      setLocalError(
        Platform.OS === 'ios'
          ? 'Standortberechtigung abgelehnt — bitte in Safari-Einstellungen freigeben.'
          : 'Standortberechtigung nicht erteilt.',
      );
    }
  }, [requestLocationPermission]);

  const handleStartDrive = useCallback(async () => {
    setDriveLoading(true);
    setLocalError(null);
    if (!consent?.granted) {
      setLocalError('Bitte zuerst Standort-Einwilligung bestätigen.');
      setDriveLoading(false);
      return;
    }
    const result = await startDriveTracking();
    if (!result.ok) setLocalError(result.error ?? 'Tracking konnte nicht gestartet werden.');
    else setLocalSuccess('Anfahrt gestartet — Tracking aktiv.');
    setDriveLoading(false);
  }, [consent, startDriveTracking]);

  const handleArrived = useCallback(async () => {
    setLocalError(null);
    setLocalWarning(null);
    if (tracking?.geofence?.warning && !tracking.geofence.overridden && !geofenceOverride.trim()) {
      setShowGeofenceOverride(true);
      setLocalWarning(tracking.geofence.warning);
      return;
    }
    if (geofenceOverride.trim()) setGeofenceOverride(geofenceOverride.trim());
    const result = await markArrived();
    if (!result.ok) setLocalError(result.error ?? 'Ankunft konnte nicht gespeichert werden.');
    else {
      setLocalSuccess('Angekommen — Anfahrt-Timer gestoppt.');
      if (result.arrivalWarning) setLocalWarning(result.arrivalWarning);
    }
  }, [markArrived, tracking, geofenceOverride, setGeofenceOverride]);

  const runAllowedAction = useCallback(
    async (action: AssistWorkflowAllowedAction) => {
      setLocalError(null);
      setLocalSuccess(null);

      if (action === 'start_en_route') {
        await handleStartDrive();
        return;
      }
      if (action === 'mark_arrived') {
        await handleArrived();
        return;
      }
      if (action === 'start_service') {
        const r = await startService();
        if (!r.ok) setLocalError(r.error ?? 'Einsatz konnte nicht gestartet werden.');
        else setLocalSuccess('Einsatz gestartet.');
        return;
      }
      if (action === 'end_pause') {
        const r = await endPause();
        if (!r.ok) setLocalError(r.error ?? 'Fortsetzen fehlgeschlagen.');
        else setLocalSuccess('Einsatz fortgesetzt.');
        return;
      }
      if (action === 'end_service') {
        const r = await endService();
        if (!r.ok) setLocalError(r.error ?? 'Einsatz konnte nicht beendet werden.');
        else setLocalSuccess('Einsatz beendet — Dokumentation erforderlich.');
        return;
      }
      if (action === 'capture_signature') {
        scrollToSignature();
        return;
      }
      if (action === 'finalize_visit') {
        const r = await finalizeVisit();
        if (r.ok) setLocalSuccess('Einsatz abgeschlossen — Leistungsnachweis erstellt.');
        else setLocalError(r.error ?? 'Abschluss fehlgeschlagen.');
      }
    },
    [handleStartDrive, handleArrived, startService, endPause, endService, scrollToSignature, finalizeVisit],
  );

  const handlePrimary = useCallback(async () => {
    if (!visit || !primaryAction) return;
    await runAllowedAction(primaryAction);
  }, [visit, primaryAction, runAllowedAction]);

  const handleNoShow = useCallback(async () => {
    if (!noShowNote.trim()) {
      setLocalError('Begründung für „Nicht angetroffen“ ist erforderlich.');
      return;
    }
    const r = await reportNoShow(noShowNote.trim());
    if (!r.ok) setLocalError(r.error ?? 'Status konnte nicht gespeichert werden.');
    else setLocalSuccess('Als nicht angetroffen gemeldet.');
  }, [noShowNote, reportNoShow]);

  const handleOpenMap = useCallback(async () => {
    setLocalError(null);
    const route = await openRoute();
    if (route.ok && route.data.mapUrl) {
      await Linking.openURL(route.data.mapUrl);
      setLocalSuccess('Route in Google Maps geöffnet.');
    } else {
      setLocalError(route.ok ? 'Keine Karten-URL.' : route.error);
    }
  }, [openRoute]);

  const shellTitle = visit?.title ?? (loading ? 'Einsatz wird geladen…' : 'Einsatz durchführen');

  if (!can('portal.employee.appointments.view')) {
    return (
      <ScreenShell title={shellTitle} subtitle={resolvePortalScreenSubtitle(roleLabel, 'employee')}>
        <LockedActionBanner
          message={check('portal.employee.appointments.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading) {
    return (
      <ScreenShell title={shellTitle} subtitle="Wird geladen…">
        <LoadingState message="Einsatz wird geladen…" />
      </ScreenShell>
    );
  }

  if (queryError && !hasAssignment) {
    return (
      <ScreenShell title={shellTitle} subtitle="Datenbankfehler">
        <ErrorState message={queryError} onRetry={refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (notFound || !visit) {
    return (
      <ScreenShell title={shellTitle} subtitle="Fehler">
        <ErrorState message={error ?? 'Einsatz nicht gefunden.'} onRetry={refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  const showSuccess = localSuccess && !localError;
  const arrivalProofLabel =
    tracking?.arrivalProof === 'without_gps'
      ? 'Ohne GPS'
      : tracking?.arrivalProof === 'manual'
        ? 'Manuell'
        : tracking?.arrivalProof === 'gps'
          ? 'Mit GPS'
          : '—';
  const primaryButtonLabel =
    trackingActive && effectiveStatus === 'unterwegs' && primaryAction === 'mark_arrived'
      ? 'Anfahrt läuft — Angekommen'
      : primaryLabel;
  const primaryButtonLoading =
    primaryAction === 'start_service'
      ? startServiceLoading
      : actionLoading || driveLoading;
  const primaryButtonDisabled =
    primaryAction === 'start_service'
      ? startServiceLoading || driveLoading
      : actionLoading || driveLoading;

  return (
    <ScreenShell title={visit.title} subtitle={`${visit.clientName} · Mitarbeiterportal`}>
      <OrientationGate screenKey="visitExecution">
      {showSuccess ? <SuccessState message={localSuccess!} /> : null}
      {localError ? (
        <View style={styles.dismissibleError}>
          <ErrorState message={localError} />
          <TouchableOpacity onPress={() => setLocalError(null)} accessibilityRole="button">
            <Text style={styles.dismissText}>Schließen</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {taskSaveError ? (
        <View style={styles.dismissibleError}>
          <ErrorState message={taskSaveError} />
        </View>
      ) : null}
      {localWarning ? <InfoBanner variant="warning" message={localWarning} /> : null}
      {liveContextError && !queryError ? (
        <InfoBanner variant="warning" message={`Live-Kontext: ${liveContextError}`} />
      ) : null}

      {consistencyStatus === 'repairable' && nextActionHint ? (
        <InfoBanner variant="info" message={nextActionHint} />
      ) : null}
      {refetchWarning ? <InfoBanner variant="warning" message={refetchWarning} /> : null}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxl + 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <EmployeePortalLocationConsentBanner
          consent={consent}
          onAccept={handleGrantConsent}
          loading={consentLoading}
        />

        <PremiumCard accentColor={colors.amber}>
          <Text style={styles.phase}>{ASSIGNMENT_STATUS_LABELS[effectiveStatus]}</Text>
          <PremiumBadge label={ASSIGNMENT_STATUS_LABELS[effectiveStatus]} variant="orange" dot />
          {workflowStep ? (
            <EmployeePortalVisitWorkflowTimeline
              status={effectiveStatus}
              requiresSignature={visit.requiresSignature}
            />
          ) : null}
        </PremiumCard>

        <SectionPanel title="Live-Status" subtitle="Einsatz · GPS · Tracking">
          <DetailInfoRow label="Klient:in" value={visit.clientName} />
          <DetailInfoRow label="Adresse" value={visit.locationAddress} />
          <DetailInfoRow label="Geplant" value={formatDateTime(visit.plannedStartAt)} />
          <DetailInfoRow label="GPS-Berechtigung" value={gpsPermission} />
          <DetailInfoRow label="Ankunftsnachweis" value={arrivalProofLabel} />
          <DetailInfoRow
            label="Tracking"
            value={trackingStatusLabel(trackingActive, gpsPermission, errorCode)}
          />
          {errorCode ? <Text style={styles.errorCode}>Support-Code: {errorCode}</Text> : null}
        </SectionPanel>

        <EmployeePortalLiveTimersPanel timers={timers} assignmentStatus={effectiveStatus} />

        {tracking?.warnings.map((w) => (
          <InfoBanner key={w} variant="warning" message={w} />
        ))}

        {showGeofenceOverride ? (
          <SectionPanel title="Geofence-Hinweis">
            <PremiumInput
              label="Begründung (optional)"
              value={geofenceOverride}
              onChangeText={setGeofenceOverrideInput}
            />
          </SectionPanel>
        ) : null}

        {!canExecute ? (
          <LockedActionBanner
            message={check('assist.execution.manage').reason ?? 'Statusänderungen gesperrt.'}
            roleLabel={roleLabel}
          />
        ) : (
          <View style={styles.actions}>
            {!consent?.granted ? null : gpsPermission !== 'granted' ? (
              <PremiumButton
                title="Standortberechtigung anfragen"
                variant="secondary"
                fullWidth
                onPress={handleRequestPermission}
              />
            ) : null}

            <PremiumButton title="Karte / Route" variant="secondary" fullWidth onPress={handleOpenMap} />

            {primaryButtonLabel && !isLocked && !statusBlocksDoc ? (
              <PremiumButton
                title={primaryButtonLabel}
                fullWidth
                loading={primaryButtonLoading}
                disabled={primaryButtonDisabled}
                onPress={handlePrimary}
              />
            ) : null}

            {allowedActions.includes('start_pause') && !isLocked && !statusBlocksDoc ? (
              <PremiumButton
                title="Pause"
                variant="ghost"
                fullWidth
                loading={actionLoading}
                onPress={async () => {
                  const r = await startPause();
                  if (r.ok) setLocalSuccess('Pause gestartet.');
                  else setLocalError(r.error ?? 'Pause fehlgeschlagen.');
                }}
              />
            ) : null}

            {allowedActions.includes('report_no_show') && !isLocked ? (
              <>
                {!showNoShowForm ? (
                  <PremiumButton
                    title="Nicht angetroffen"
                    variant="ghost"
                    fullWidth
                    onPress={() => setShowNoShowForm(true)}
                  />
                ) : (
                  <SectionPanel title="Nicht angetroffen">
                    <PremiumInput
                      label="Begründung *"
                      value={noShowNote}
                      onChangeText={setNoShowNote}
                      multiline
                    />
                    <PremiumButton
                      title="Melden"
                      fullWidth
                      loading={actionLoading}
                      onPress={handleNoShow}
                    />
                  </SectionPanel>
                )}
              </>
            ) : null}
          </View>
        )}

        {showTasks && visit.tasks.length > 0 ? (
          <EmployeePortalVisitTasksPanel
            tasks={visit.tasks}
            disabled={isLocked}
            loading={taskSaving}
            onUpdateTask={saveTask}
          />
        ) : null}

        {showDocumentationForm && !isLocked ? (
          <EmployeePortalVisitDocumentationPanel
            loading={actionLoading}
            onSubmit={async (doc) => {
              setLocalError(null);
              const r = await saveDocumentation(doc);
              if (r.ok) {
                const needsSignature =
                  visit.requiresSignature ||
                  (r.data && 'nextStep' in r.data && r.data.nextStep === 'signature');
                setLocalSuccess(
                  needsSignature
                    ? 'Dokumentation gespeichert — Unterschrift erforderlich.'
                    : 'Dokumentation gespeichert — Einsatz kann abgeschlossen werden.',
                );
                if (needsSignature) {
                  setAwaitingSignature(true);
                  setTimeout(() => scrollToSignature(), 150);
                }
              } else {
                setLocalError(r.error ?? 'Dokumentation fehlgeschlagen.');
              }
              return r;
            }}
          />
        ) : null}

        {documentationSubmitted && visit.requiresSignature && !signatureCaptured ? (
          <InfoBanner variant="info" message="Dokumentation gespeichert — bitte Unterschrift erfassen." />
        ) : null}

        {showSignature && !isLocked ? (
          <View
            onLayout={(event) => {
              signatureSectionY.current = event.nativeEvent.layout.y;
            }}
          >
            <EmployeePortalVisitSignaturePanel
              clientName={visit.clientName}
              loading={actionLoading}
              openRequest={signaturePanelOpenRequest}
              onCapture={async (sig) => {
                const r = await saveSignature(sig);
                if (r.ok) {
                  setAwaitingSignature(false);
                  const proofOk = r.data && 'proofGenerated' in r.data && r.data.proofGenerated;
                  setLocalSuccess(
                    proofOk
                      ? 'Unterschrift gespeichert — Leistungsnachweis erstellt. Einsatz kann abgeschlossen werden.'
                      : 'Unterschrift gespeichert — Einsatz kann abgeschlossen werden.',
                  );
                } else {
                  setLocalError(r.error ?? 'Signatur fehlgeschlagen.');
                }
                return r;
              }}
            />
          </View>
        ) : null}

        {showFinalize && !isLocked ? (
          <PremiumButton
            title="Einsatz abschließen"
            fullWidth
            loading={actionLoading}
            onPress={async () => {
              const r = await finalizeVisit();
              if (r.ok) setLocalSuccess('Einsatz abgeschlossen — Leistungsnachweis erstellt.');
              else setLocalError(r.error ?? 'Abschluss fehlgeschlagen.');
            }}
          />
        ) : null}

        <PremiumButton title="Zurück zur Übersicht" variant="ghost" fullWidth onPress={() => router.back()} />
      </ScrollView>
      </OrientationGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl + 32, gap: spacing.md },
  phase: { ...typography.body, marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
  errorCode: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  dismissibleError: { gap: spacing.xs },
  dismissText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
});
