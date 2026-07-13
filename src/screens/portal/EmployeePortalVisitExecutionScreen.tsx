import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmployeePortalLocationConsentBanner,
  EmployeePortalVisitBottomBar,
  EmployeePortalVisitCompletionPanel,
  EmployeePortalVisitDocumentationPanel,
  type EmployeePortalVisitDocumentationPanelHandle,
  EmployeePortalVisitDocumentationAiModal,
  EmployeePortalVisitFabMenu,
  EmployeePortalVisitLiveDashboard,
  EmployeePortalVisitMoreMenu,
  EmployeePortalVisitPhotoModal,
  EmployeePortalVisitVoiceNoteModal,
  EmployeePortalVisitSignaturePanel,
  EmployeePortalVisitStickyHeader,
  EmployeePortalVisitSummaryPanel,
  EmployeePortalVisitTasksPanel,
} from '@/components/portal';
import { buildDocumentationAiSourceFromTasks, resolveDocumentationAiSourceText } from '@/lib/portal/buildDocumentationAiSourceText';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
  CachedDataBanner,
} from '@/components/ui';
import { useEmployeePortalVisitExecution } from '@/hooks/useEmployeePortalVisitExecution';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAuth } from '@/lib/auth/context';
import { WfmVisitDeviationJustificationModal } from '@/components/wfm/WfmVisitDeviationJustificationModal';
import {
  checkVisitDeviationGate,
  submitVisitDeviationJustification,
} from '@/lib/wfm/wfmOfficeTimekeepingService';
import { evaluateVisitTimeDeviation } from '@/lib/wfm/wfmVisitDeviationAmpelService';
import type { WfmDeviationPhase } from '@/types/modules/wfmOfficeTimekeeping';
import { usePermissions } from '@/hooks/usePermissions';
import { useWorkflowPersistence } from '@/hooks/useWorkflowPersistence';
import { isVisitExecutionRoute, visitExecutionRouteMatchesSnapshot } from '@/lib/portal/visitExecutionRoute';
import { resolveVisitExecutionUiState } from '@/lib/portal/resolveVisitExecutionUiState';
import {
  resolveVisitExecutionPhase,
  showCompactProgress,
  showLiveBottomBar,
} from '@/lib/portal/resolveVisitExecutionPhase';
import { resolvePortalScreenSubtitle } from '@/lib/portal/portalDisplayLabels';
import { releaseSignatureCaptureEnvironment } from '@/lib/dom/releaseSignatureCaptureEnvironment';
import {
  ASSIST_WORKFLOW_ACTION_LABELS,
  primaryAllowedAction,
  type AssistWorkflowAllowedAction,
} from '@/features/assistWorkflow/resolveAllowedActions';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import { colors, spacing, typography } from '@/theme';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDurationMinutes(startIso: string, endIso: string): string {
  const mins = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h} Std. ${m} Min.`;
  return `${m} Min.`;
}

export function EmployeePortalVisitExecutionScreen() {
  const { id: rawId, step: rawStep } = useLocalSearchParams<{ id: string; step?: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const urlStep = Array.isArray(rawStep) ? rawStep[0] : rawStep;
  const pathname = usePathname();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canExecute = can('assist.execution.manage');
  const workflowPersistence = useWorkflowPersistence(id);

  const {
    data: visit,
    allowedActions,
    liveContext,
    tracking,
    timers,
    consent,
    gpsPermission,
    loading,
    error,
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
    finalizeVisitDeferred,
    reportNoShow,
    requestLocationPermission,
    setGeofenceOverride,
    openRoute,
    effectiveStatus: hookEffectiveStatus,
    consistencyStatus,
    nextActionHint,
    notFound,
    isServiceEnded,
    readOnlyExecution,
    fromCache,
    cachedAt,
    partialDetail,
    executionContext,
  } = useEmployeePortalVisitExecution(id);

  const { tenantId: portalTenantId, employeeId: portalEmployeeId } = usePortalActor();
  const { user, profile } = useAuth();
  const actorId = user?.id ?? profile?.id ?? portalEmployeeId ?? '';

  const effectiveStatus: AssignmentStatus =
    hookEffectiveStatus ?? visit?.status ?? 'geplant';

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
  const [deviationModal, setDeviationModal] = useState<{
    phase: WfmDeviationPhase;
    pendingAction: 'start_service' | 'end_service';
  } | null>(null);
  const [deviationSubmitting, setDeviationSubmitting] = useState(false);
  const [deviationError, setDeviationError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const docPanelRef = useRef<EmployeePortalVisitDocumentationPanelHandle>(null);
  const signatureSectionY = useRef(0);
  const [signatureCaptureRequest, setSignatureCaptureRequest] = useState(0);
  const [closeSignatureCaptureRequest, setCloseSignatureCaptureRequest] = useState(0);
  const restoredRef = useRef(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [documentationOpen, setDocumentationOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [docLastSavedAt, setDocLastSavedAt] = useState<string | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [photoReferences, setPhotoReferences] = useState<string[]>([]);
  const [documentationDraftText, setDocumentationDraftText] = useState('');
  const [documentationSpecialNotes, setDocumentationSpecialNotes] = useState('');
  const [aiHelpRequest, setAiHelpRequest] = useState(0);
  const [aiHelpStandaloneOpen, setAiHelpStandaloneOpen] = useState(false);

  const assistVisitId = executionContext?.assistVisitId ?? null;

  const documentationAiSourceText = useMemo(
    () =>
      resolveDocumentationAiSourceText(
        documentationDraftText,
        documentationSpecialNotes,
        visit ? buildDocumentationAiSourceFromTasks(visit.tasks) : '',
      ),
    [documentationDraftText, documentationSpecialNotes, visit],
  );

  const appendDocumentationNote = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setDocumentationSpecialNotes((prev) => (prev.trim() ? `${prev.trim()}\n${trimmed}` : trimmed));
    setDocumentationOpen(true);
  }, []);

  useEffect(() => {
    if (!id || !visit || restoredRef.current || !isVisitExecutionRoute(pathname)) return;
    const snapshot = workflowPersistence.restore();
    restoredRef.current = true;
    workflowPersistence.markHydrated();

    const snapshotMatchesRoute = visitExecutionRouteMatchesSnapshot(pathname, snapshot?.route);

    if (snapshotMatchesRoute && snapshot?.awaitingSignature) setAwaitingSignature(true);
    if (snapshotMatchesRoute && snapshot?.showNoShowForm) setShowNoShowForm(true);

    const step = urlStep ?? (snapshotMatchesRoute ? snapshot?.step : null);
    if (step === 'signature') {
      setAwaitingSignature(true);
      setSignatureCaptureRequest((n) => n + 1);
    } else if (step) {
      workflowPersistence.setStep(step);
    }

    if (snapshot?.signatureModalOpen) {
      workflowPersistence.persist({ signatureModalOpen: false });
    }
  }, [id, visit, urlStep, pathname, workflowPersistence]);

  const isLocked = useMemo(
    () =>
      visit?.status === 'storniert' ||
      visit?.status === 'nicht_erschienen' ||
      Boolean(visit?.isLocked),
    [visit],
  );

  const primaryAction = primaryAllowedAction(allowedActions, effectiveStatus);
  const primaryActionResolved =
    primaryAction ??
    (effectiveStatus === 'angekommen' && !isLocked && canExecute ? 'start_service' : null);
  const primaryLabel = primaryActionResolved
    ? ASSIST_WORKFLOW_ACTION_LABELS[primaryActionResolved]
    : undefined;

  const insets = useSafeAreaInsets();

  useEffect(() => {
    releaseSignatureCaptureEnvironment();
  }, []);

  const uiState = useMemo(() => {
    if (!visit) return null;
    return resolveVisitExecutionUiState({
      visit,
      effectiveStatus,
      consistencyStatus,
      allowedActions,
      awaitingSignature,
      hasServiceEnded: isServiceEnded,
    });
  }, [
    visit,
    effectiveStatus,
    consistencyStatus,
    allowedActions,
    awaitingSignature,
    isServiceEnded,
  ]);

  const phase = useMemo(() => {
    if (!visit) return 'preview' as const;
    return resolveVisitExecutionPhase({
      effectiveStatus,
      uiState,
      isLocked: Boolean(isLocked),
    });
  }, [visit, effectiveStatus, uiState, isLocked]);

  const statusBlocksDoc = uiState?.statusBlocksDoc ?? false;
  const showTasks = uiState?.showTasks ?? false;
  const documentationSubmitted = uiState?.documentationSubmitted ?? false;
  const signatureCaptured = uiState?.signatureCaptured ?? false;
  const signatureDeferred = uiState?.signatureDeferred ?? false;
  const showDocumentationForm = uiState?.showDocumentationForm ?? false;
  const showSignature = uiState?.showSignature ?? false;
  const showFinalize = uiState?.showFinalize ?? false;
  const canFinalizeDeferred = uiState?.canFinalizeDeferred ?? false;

  useEffect(() => {
    if (
      visit?.requiresSignature &&
      documentationSubmitted &&
      !signatureCaptured &&
      !signatureDeferred &&
      allowedActions.includes('capture_signature') &&
      !allowedActions.includes('finalize_visit_deferred_signature')
    ) {
      setAwaitingSignature(true);
    }
  }, [
    visit?.requiresSignature,
    documentationSubmitted,
    signatureCaptured,
    signatureDeferred,
    allowedActions,
  ]);

  const scrollToSignatureSection = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(signatureSectionY.current - 16, 0), animated: true });
    workflowPersistence.setStep('signature');
  }, [workflowPersistence]);

  const openSignatureCapture = useCallback(() => {
    scrollToSignatureSection();
    setSignatureCaptureRequest((n) => n + 1);
  }, [scrollToSignatureSection]);

  const releaseSignatureUi = useCallback(() => {
    releaseSignatureCaptureEnvironment();
    setAwaitingSignature(false);
    workflowPersistence.setStep(null);
  }, [workflowPersistence]);

  const handleFinalizeDeferredSignature = useCallback(async () => {
    try {
      releaseSignatureUi();
      setCloseSignatureCaptureRequest((n) => n + 1);
      const r = await finalizeVisitDeferred();
      if (r.ok) {
        releaseSignatureCaptureEnvironment();
        setCloseSignatureCaptureRequest((n) => n + 1);
        setLocalSuccess(
          'Einsatz abgeschlossen — Unterschrift wurde ans Klient:innenportal gesendet.',
        );
      } else {
        setLocalError(r.error ?? 'Abschluss ohne Unterschrift fehlgeschlagen.');
      }
    } catch (error) {
      releaseSignatureCaptureEnvironment();
      setCloseSignatureCaptureRequest((n) => n + 1);
      setLocalError(
        error instanceof Error
          ? error.message
          : 'Abschluss ohne Unterschrift fehlgeschlagen — bitte erneut versuchen.',
      );
    }
  }, [finalizeVisitDeferred, releaseSignatureUi]);

  useEffect(() => {
    if (signatureDeferred) {
      releaseSignatureUi();
    }
  }, [signatureDeferred, releaseSignatureUi]);

  const handleSignatureModalOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        workflowPersistence.setStep('signature');
        return;
      }
      releaseSignatureCaptureEnvironment();
      workflowPersistence.setStep(null);
    },
    [workflowPersistence],
  );

  useEffect(() => {
    if (phase !== 'completed') return;
    releaseSignatureCaptureEnvironment();
    setCloseSignatureCaptureRequest((n) => n + 1);
  }, [phase]);

  useEffect(() => {
    if (!id || !visit) return;
    workflowPersistence.persist({
      step: urlStep ?? null,
      awaitingSignature,
      signatureModalOpen: false,
      showNoShowForm,
      documentationSubmitted,
      signatureCaptured,
    });
  }, [
    id,
    visit,
    urlStep,
    awaitingSignature,
    showNoShowForm,
    documentationSubmitted,
    signatureCaptured,
    workflowPersistence,
  ]);

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

  const resolveDeviationCheck = useCallback(
    (phaseKey: WfmDeviationPhase) => {
      const ctx = executionContext;
      if (!ctx) return null;
      const planned = phaseKey === 'start' ? ctx.detail.plannedStartAt : ctx.detail.plannedEndAt;
      const actual = new Date().toISOString();
      const gate = checkVisitDeviationGate(
        ctx.tenantId,
        ctx.employeeId,
        ctx.assistVisitId,
        phaseKey,
        planned,
        actual,
      );
      const evaluation = evaluateVisitTimeDeviation(planned, actual, phaseKey);
      return { gate, evaluation, planned, actual };
    },
    [executionContext],
  );

  const proceedAfterDeviation = useCallback(
    async (action: 'start_service' | 'end_service') => {
      if (action === 'start_service') {
        const r = await startService();
        if (!r.ok) setLocalError(r.error ?? 'Einsatz konnte nicht gestartet werden.');
        else setLocalSuccess('Einsatz gestartet.');
        return;
      }
      const r = await endService();
      if (!r.ok) setLocalError(r.error ?? 'Einsatz konnte nicht beendet werden.');
      else setLocalSuccess('Einsatz beendet — Dokumentation erforderlich.');
    },
    [startService, endService],
  );

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
        const check = resolveDeviationCheck('start');
        if (check?.gate.needsJustification && check.gate.blocked) {
          setDeviationError(null);
          setDeviationModal({ phase: 'start', pendingAction: 'start_service' });
          return;
        }
        if (check?.evaluation.ampel === 'yellow') {
          setLocalWarning('Leichte Abweichung zur geplanten Startzeit.');
        }
        await proceedAfterDeviation('start_service');
        return;
      }
      if (action === 'end_pause') {
        const r = await endPause();
        if (!r.ok) setLocalError(r.error ?? 'Fortsetzen fehlgeschlagen.');
        else setLocalSuccess('Einsatz fortgesetzt.');
        return;
      }
      if (action === 'end_service') {
        const check = resolveDeviationCheck('end');
        if (check?.gate.needsJustification && check.gate.blocked) {
          setDeviationError(null);
          setDeviationModal({ phase: 'end', pendingAction: 'end_service' });
          return;
        }
        if (check?.evaluation.ampel === 'yellow') {
          setLocalWarning('Leichte Abweichung zur geplanten Endzeit.');
        }
        await proceedAfterDeviation('end_service');
        return;
      }
      if (action === 'save_documentation') {
        setDocumentationOpen(true);
        await docPanelRef.current?.submit();
        return;
      }
      if (action === 'capture_signature') {
        openSignatureCapture();
        return;
      }
      if (action === 'finalize_visit') {
        const r = await finalizeVisit();
        if (r.ok) setLocalSuccess('Einsatz abgeschlossen — Leistungsnachweis erstellt.');
        else setLocalError(r.error ?? 'Abschluss fehlgeschlagen.');
        return;
      }
      if (action === 'finalize_visit_deferred_signature') {
        await handleFinalizeDeferredSignature();
      }
    },
    [
      handleStartDrive,
      handleArrived,
      proceedAfterDeviation,
      resolveDeviationCheck,
      endPause,
      openSignatureCapture,
      finalizeVisit,
      finalizeVisitDeferred,
      handleFinalizeDeferredSignature,
      releaseSignatureUi,
    ],
  );

  const handlePrimary = useCallback(async () => {
    if (!visit || !primaryActionResolved) return;
    await runAllowedAction(primaryActionResolved);
  }, [visit, primaryActionResolved, runAllowedAction]);

  const handleNoShow = useCallback(async () => {
    if (!noShowNote.trim()) {
      setLocalError('Begründung für „Nicht angetroffen“ ist erforderlich.');
      return;
    }
    const r = await reportNoShow(noShowNote.trim());
    if (!r.ok) setLocalError(r.error ?? 'Status konnte nicht gespeichert werden.');
    else setLocalSuccess('Als nicht angetroffen gemeldet.');
    setShowNoShowForm(false);
    setMoreOpen(false);
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

  const handleCall = useCallback(() => {
    const phone = visit?.emergencyContact?.trim();
    if (!phone) {
      setLocalError('Keine Telefonnummer hinterlegt.');
      return;
    }
    void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  }, [visit?.emergencyContact]);

  const shellTitle = visit?.title ?? (loading ? 'Einsatz wird geladen…' : 'Einsatz durchführen');

  const trackingActive =
    effectiveStatus === 'unterwegs' &&
    Boolean(tracking?.trackingActive || liveContext?.trackingSessionActive);

  const primaryButtonLabel =
    trackingActive &&
    effectiveStatus === 'unterwegs' &&
    primaryActionResolved === 'mark_arrived' &&
    !allowedActions.includes('start_service')
      ? 'Anfahrt läuft — Angekommen'
      : primaryLabel;
  const primaryButtonLoading =
    primaryActionResolved === 'start_service'
      ? startServiceLoading
      : actionLoading || driveLoading;
  const primaryButtonDisabled =
    readOnlyExecution ||
    (primaryActionResolved === 'start_service'
      ? startServiceLoading || driveLoading
      : actionLoading || driveLoading);

  const serviceDurationLabel =
    visit?.actualStartAt && visit?.actualEndAt
      ? formatDurationMinutes(visit.actualStartAt, visit.actualEndAt)
      : timers?.serviceSeconds
        ? formatDurationMinutes(
            visit?.actualStartAt ?? visit.plannedStartAt,
            new Date(
              new Date(visit?.actualStartAt ?? visit?.plannedStartAt).getTime() +
                (timers.serviceSeconds ?? 0) * 1000,
            ).toISOString(),
          )
        : undefined;

  const bottomBarVisible = showLiveBottomBar(phase) && !isLocked && canExecute;

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
  const bottomPadding = bottomBarVisible ? spacing.xxl + 96 + insets.bottom : spacing.xxl + 32 + insets.bottom;

  const renderPhaseContent = () => {
    if (phase === 'completed') {
      return (
        <EmployeePortalVisitSummaryPanel
          visit={visit}
          onBack={() => router.replace('/portal/employee/assignments' as never)}
        />
      );
    }

    if (phase === 'preview') {
      return (
        <PremiumCard style={styles.phaseCard}>
          <Text style={styles.phaseTitle}>Einsatzvorschau</Text>
          <DetailInfoRow label="Klient:in" value={visit.clientName} />
          <DetailInfoRow label="Adresse" value={visit.locationAddress} />
          <DetailInfoRow
            label="Einsatzzeit"
            value={`${formatTime(visit.plannedStartAt)} – ${formatTime(visit.plannedEndAt)}`}
          />
          <DetailInfoRow
            label="Geplante Dauer"
            value={formatDurationMinutes(visit.plannedStartAt, visit.plannedEndAt)}
          />
          {visit.emergencyContact ? (
            <DetailInfoRow label="Telefon" value={visit.emergencyContact} />
          ) : null}
          {visit.notesForEmployee ? (
            <DetailInfoRow label="Hinweise" value={visit.notesForEmployee} />
          ) : null}
          <View style={styles.phaseActions}>
            <PremiumButton title="Navigation starten" variant="secondary" fullWidth onPress={handleOpenMap} />
            {visit.emergencyContact ? (
              <PremiumButton title="Anrufen" variant="ghost" fullWidth onPress={handleCall} />
            ) : null}
            {primaryButtonLabel && !isLocked ? (
              <PremiumButton
                title={primaryButtonLabel}
                fullWidth
                loading={primaryButtonLoading}
                disabled={primaryButtonDisabled}
                onPress={handlePrimary}
              />
            ) : null}
          </View>
        </PremiumCard>
      );
    }

    if (phase === 'en_route') {
      return (
        <PremiumCard style={styles.phaseCard}>
          <Text style={styles.phaseTitle}>Unterwegs</Text>
          <DetailInfoRow label="Ziel" value={visit.locationAddress} />
          <DetailInfoRow label="Einsatzbeginn geplant" value={formatTime(visit.plannedStartAt)} />
          {visit.emergencyContact ? (
            <DetailInfoRow label="Telefon" value={visit.emergencyContact} />
          ) : null}
          <View style={styles.phaseActions}>
            <PremiumButton title="Navigation" variant="secondary" fullWidth onPress={handleOpenMap} />
            {primaryButtonLabel && !isLocked ? (
              <PremiumButton
                title={primaryButtonLabel}
                fullWidth
                loading={primaryButtonLoading}
                disabled={primaryButtonDisabled}
                onPress={handlePrimary}
              />
            ) : null}
          </View>
        </PremiumCard>
      );
    }

    if (phase === 'arrived') {
      return (
        <PremiumCard style={styles.phaseCard}>
          <Text style={styles.phaseTitle}>Angekommen</Text>
          <Text style={styles.phaseHint}>
            Die Leistungszeit beginnt erst mit dem Einsatzstart.
          </Text>
          <DetailInfoRow label="Klient:in" value={visit.clientName} />
          <DetailInfoRow label="Adresse" value={visit.locationAddress} />
          {primaryButtonLabel && !isLocked ? (
            <PremiumButton
              title={primaryButtonLabel}
              fullWidth
              loading={primaryButtonLoading}
              disabled={primaryButtonDisabled}
              onPress={handlePrimary}
            />
          ) : null}
        </PremiumCard>
      );
    }

    if (phase === 'live' || phase === 'post_service') {
      return (
        <View style={styles.liveWrap}>
          <EmployeePortalVisitLiveDashboard
            tasks={visit.tasks}
            documentationStatus={visit.documentationStatus}
            documentationLastSavedAt={docLastSavedAt}
            signatureCaptured={signatureCaptured || signatureDeferred}
            requiresSignature={visit.requiresSignature}
            signatureEnabled={isServiceEnded}
            serviceSeconds={timers?.serviceSeconds ?? null}
            attachmentCount={photoReferences.length}
            onOpenTasks={() => setTasksOpen(true)}
            onOpenDocumentation={() => setDocumentationOpen(true)}
            onOpenSignature={openSignatureCapture}
            onOpenAttachments={() => setPhotoModalOpen(true)}
          />

          {phase === 'live' && primaryButtonLabel && !isLocked && !statusBlocksDoc ? (
            <PremiumButton
              title={primaryButtonLabel}
              fullWidth
              loading={primaryButtonLoading}
              disabled={primaryButtonDisabled}
              onPress={handlePrimary}
            />
          ) : null}

          {phase === 'live' && allowedActions.includes('start_pause') && !isLocked ? (
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

          {(showFinalize || canFinalizeDeferred) && !isLocked ? (
            <EmployeePortalVisitCompletionPanel
              tasks={visit.tasks}
              documentationSubmitted={documentationSubmitted}
              signatureCaptured={signatureCaptured}
              signatureDeferred={signatureDeferred}
              requiresSignature={visit.requiresSignature}
              serviceDurationLabel={serviceDurationLabel}
              loading={actionLoading}
              deferredLoading={actionLoading}
              canFinalizeDeferred={canFinalizeDeferred}
              onFinalize={async () => {
                const r = await finalizeVisit();
                if (r.ok) setLocalSuccess('Einsatz abgeschlossen — Leistungsnachweis erstellt.');
                else setLocalError(r.error ?? 'Abschluss fehlgeschlagen.');
              }}
              onFinalizeDeferred={() => {
                void handleFinalizeDeferredSignature();
              }}
            />
          ) : null}
        </View>
      );
    }

    return (
      <PremiumCard style={styles.phaseCard}>
        <Text style={styles.phaseTitle}>{ASSIGNMENT_STATUS_LABELS[effectiveStatus]}</Text>
        {primaryButtonLabel && !isLocked ? (
          <PremiumButton
            title={primaryButtonLabel}
            fullWidth
            loading={primaryButtonLoading}
            disabled={primaryButtonDisabled}
            onPress={handlePrimary}
          />
        ) : null}
      </PremiumCard>
    );
  };

  return (
    <ScreenShell title={visit.title} subtitle={`${visit.clientName} · Mitarbeiterportal`} scroll={false}>
      <EmployeePortalVisitStickyHeader
        clientName={visit.clientName}
        plannedStartAt={visit.plannedStartAt}
        plannedEndAt={visit.plannedEndAt}
        effectiveStatus={effectiveStatus}
        timers={timers}
        requiresSignature={visit.requiresSignature}
        signatureCaptured={signatureCaptured || signatureDeferred}
        showProgress={showCompactProgress(phase)}
      />

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
      <CachedDataBanner
        visible={fromCache || readOnlyExecution}
        cachedAt={cachedAt}
        readOnly={readOnlyExecution}
        partialDetail={partialDetail}
      />
      {readOnlyExecution ? (
        <InfoBanner
          variant="warning"
          title="Nur Ansicht"
          message="Offline oder zwischengespeichert — Workflow-Aktionen sind deaktiviert."
        />
      ) : null}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <EmployeePortalLocationConsentBanner
          consent={consent}
          onAccept={handleGrantConsent}
          loading={consentLoading}
        />

        {!canExecute ? (
          <LockedActionBanner
            message={check('assist.execution.manage').reason ?? 'Statusänderungen gesperrt.'}
            roleLabel={roleLabel}
          />
        ) : null}

        {!consent?.granted || gpsPermission !== 'granted' ? (
          <View style={styles.hiddenSetup}>
            {consent?.granted && gpsPermission !== 'granted' ? (
              <PremiumButton
                title="Standortberechtigung anfragen"
                variant="secondary"
                fullWidth
                onPress={handleRequestPermission}
              />
            ) : null}
          </View>
        ) : null}

        {showGeofenceOverride ? (
          <SectionPanel title="Geofence-Hinweis">
            <PremiumInput
              label="Begründung (optional)"
              value={geofenceOverride}
              onChangeText={setGeofenceOverrideInput}
            />
          </SectionPanel>
        ) : null}

        {tracking?.warnings.map((w) => (
          <InfoBanner key={w} variant="warning" message={w} />
        ))}

        {renderPhaseContent()}

        {documentationSubmitted && visit.requiresSignature && !signatureCaptured && !signatureDeferred ? (
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
              modalOnly={phase === 'live' || phase === 'post_service'}
              compact={phase !== 'live' && phase !== 'post_service'}
              openCaptureRequest={signatureCaptureRequest}
              closeCaptureRequest={closeSignatureCaptureRequest}
              visitId={id}
              onModalOpenChange={handleSignatureModalOpenChange}
              onCapture={async (sig) => {
                const r = await saveSignature(sig);
                if (r.ok) {
                  setAwaitingSignature(false);
                  workflowPersistence.setStep(null);
                  const proofOk = r.data && 'proofGenerated' in r.data && r.data.proofGenerated;
                  setLocalSuccess(
                    proofOk
                      ? 'Unterschrift gespeichert — Leistungsnachweis erstellt. Einsatz kann abgeschlossen werden.'
                      : 'Unterschrift gespeichert — Einsatz kann abgeschlossen werden.',
                  );
                } else {
                  setLocalError(r.error ?? 'Die Unterschrift konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.');
                }
                return r;
              }}
            />
          </View>
        ) : null}

        <PremiumButton title="Zurück zur Übersicht" variant="ghost" fullWidth onPress={() => router.back()} />
      </ScrollView>

      {showTasks && visit.tasks.length > 0 ? (
        <EmployeePortalVisitTasksPanel
          tasks={visit.tasks}
          disabled={isLocked}
          loading={taskSaving}
          visible={tasksOpen}
          onClose={() => setTasksOpen(false)}
          onUpdateTask={saveTask}
        />
      ) : null}

      {showDocumentationForm && !isLocked ? (
        <EmployeePortalVisitDocumentationPanel
          ref={docPanelRef}
          loading={actionLoading}
          tenantId={portalTenantId}
          visible={documentationOpen}
          onClose={() => setDocumentationOpen(false)}
          lastSavedAt={docLastSavedAt}
          initialShortDescription={documentationDraftText}
          initialSpecialNotes={documentationSpecialNotes}
          photoReferences={photoReferences}
          openAiRequest={aiHelpRequest}
          onSubmit={async (doc) => {
            setLocalError(null);
            const r = await saveDocumentation(doc);
            if (r.ok) {
              setDocLastSavedAt(new Date().toISOString());
              const needsSignature =
                visit.requiresSignature ||
                (r.data && 'nextStep' in r.data && r.data.nextStep === 'signature');
              const signatureReady = needsSignature && isServiceEnded;
              setLocalSuccess(
                signatureReady
                  ? 'Dokumentation gespeichert — Unterschrift erforderlich.'
                  : isServiceEnded
                    ? 'Dokumentation gespeichert — Einsatz kann abgeschlossen werden.'
                    : 'Dokumentation gespeichert — Arbeitszeit läuft weiter.',
              );
              if (signatureReady) {
                setAwaitingSignature(true);
                if (!allowedActions.includes('finalize_visit_deferred_signature')) {
                  setTimeout(() => openSignatureCapture(), 150);
                }
              }
              setDocumentationOpen(false);
            } else {
              setLocalError(r.error ?? 'Dokumentation fehlgeschlagen.');
            }
            return r;
          }}
        />
      ) : null}

      {bottomBarVisible ? (
        <EmployeePortalVisitBottomBar
          actions={[
            {
              key: 'tasks',
              label: 'Aufgaben',
              icon: '☑',
              active: tasksOpen,
              onPress: () => setTasksOpen(true),
            },
            {
              key: 'documentation',
              label: 'Doku',
              icon: '📝',
              active: documentationOpen,
              onPress: () => setDocumentationOpen(true),
            },
            {
              key: 'photo',
              label: 'Foto',
              icon: '📷',
              onPress: () => setPhotoModalOpen(true),
            },
            {
              key: 'more',
              label: 'Mehr',
              icon: '⋯',
              active: moreOpen,
              onPress: () => setMoreOpen(true),
            },
          ]}
        />
      ) : null}

      {bottomBarVisible ? (
        <EmployeePortalVisitFabMenu
          actions={[
            { key: 'note', label: 'Kurze Notiz', onPress: () => setDocumentationOpen(true) },
            { key: 'photo', label: 'Foto aufnehmen', onPress: () => setPhotoModalOpen(true) },
            { key: 'voice', label: 'Sprachnotiz', onPress: () => setVoiceModalOpen(true) },
            { key: 'doc', label: 'Dokument hinzufügen', onPress: () => setPhotoModalOpen(true) },
            {
              key: 'ai',
              label: 'KI-Hilfe',
              onPress: () => {
                if (showDocumentationForm) {
                  setDocumentationOpen(true);
                  setAiHelpRequest((n) => n + 1);
                } else {
                  setAiHelpStandaloneOpen(true);
                }
              },
            },
          ]}
        />
      ) : null}

      <EmployeePortalVisitPhotoModal
        visible={photoModalOpen}
        tenantId={portalTenantId}
        visitId={assistVisitId}
        existingReferences={photoReferences}
        onClose={() => setPhotoModalOpen(false)}
        onUploaded={(paths) => {
          setPhotoReferences(paths);
          setLocalSuccess('Foto gespeichert — wird mit der Dokumentation übernommen.');
        }}
      />

      <EmployeePortalVisitVoiceNoteModal
        visible={voiceModalOpen}
        tenantId={portalTenantId}
        visitId={assistVisitId}
        onClose={() => setVoiceModalOpen(false)}
        onAppendText={appendDocumentationNote}
        onAudioUploaded={(storagePath) => {
          setPhotoReferences((prev) => [...prev, storagePath]);
        }}
      />

      <EmployeePortalVisitDocumentationAiModal
        visible={aiHelpStandaloneOpen}
        tenantId={portalTenantId}
        sourceText={documentationAiSourceText}
        onClose={() => setAiHelpStandaloneOpen(false)}
        onAccept={(textValue) => {
          setDocumentationDraftText(textValue);
          setAiHelpStandaloneOpen(false);
          setDocumentationOpen(true);
        }}
      />

      {moreOpen ? (
        <EmployeePortalVisitMoreMenu
          visible={moreOpen}
          onClose={() => setMoreOpen(false)}
          onOpenMap={() => {
            setMoreOpen(false);
            void handleOpenMap();
          }}
          onCall={visit.emergencyContact ? handleCall : undefined}
          canReportNoShow={allowedActions.includes('report_no_show') && !isLocked}
          showNoShowForm={showNoShowForm}
          noShowNote={noShowNote}
          onNoShowNoteChange={setNoShowNote}
          onOpenNoShowForm={() => setShowNoShowForm(true)}
          onSubmitNoShow={() => void handleNoShow()}
          noShowLoading={actionLoading}
        />
      ) : null}

      {deviationModal && executionContext ? (
        <WfmVisitDeviationJustificationModal
          visible
          phase={deviationModal.phase}
          evaluation={
            resolveDeviationCheck(deviationModal.phase)?.evaluation ?? {
              ampel: 'red',
              deviationMinutes: 0,
              direction: 'unknown',
              plannedAt: null,
              actualAt: null,
              requiresJustification: true,
              blocksUntilJustification: true,
              noPlannedTime: false,
            }
          }
          loading={deviationSubmitting}
          error={deviationError}
          onCancel={() => {
            setDeviationModal(null);
            setDeviationError(null);
          }}
          onSubmit={async (justification) => {
            const check = resolveDeviationCheck(deviationModal.phase);
            if (!check) return;
            setDeviationSubmitting(true);
            setDeviationError(null);
            const result = await submitVisitDeviationJustification(
              executionContext.tenantId,
              executionContext.employeeId,
              actorId,
              {
                visitId: executionContext.assistVisitId,
                assignmentId: executionContext.assignmentId,
                clientLabel: executionContext.detail.clientName,
                phase: deviationModal.phase,
                plannedAt: check.planned,
                actualAt: check.actual,
                justification,
              },
            );
            setDeviationSubmitting(false);
            if (!result.ok) {
              setDeviationError(result.error);
              return;
            }
            const pending = deviationModal.pendingAction;
            setDeviationModal(null);
            await proceedAfterDeviation(pending);
          }}
        />
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  phaseCard: { padding: spacing.md, gap: spacing.sm },
  phaseTitle: { ...typography.h3, color: colors.textPrimary },
  phaseHint: { ...typography.body, color: colors.textSecondary },
  phaseActions: { gap: spacing.sm, marginTop: spacing.sm },
  liveWrap: { gap: spacing.md },
  hiddenSetup: { gap: spacing.sm },
  dismissibleError: { gap: spacing.xs, paddingHorizontal: spacing.md },
  dismissText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
});
