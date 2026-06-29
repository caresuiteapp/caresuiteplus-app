import { useCallback, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { getPrimaryWorkflowAction } from '@/features/assistWorkflow';
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
    notFound,
  } = useEmployeePortalVisitExecution(id);

  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [geofenceOverride, setGeofenceOverrideInput] = useState('');
  const [showGeofenceOverride, setShowGeofenceOverride] = useState(false);
  const [noShowNote, setNoShowNote] = useState('');
  const [showNoShowForm, setShowNoShowForm] = useState(false);

  const primaryNext = visit ? getPrimaryWorkflowAction(visit.status) : undefined;
  const trackingActive = Boolean(tracking?.trackingActive || liveContext?.trackingSessionActive);

  const isLocked = useMemo(
    () =>
      visit?.status === 'abgeschlossen' ||
      visit?.status === 'storniert' ||
      visit?.status === 'nicht_erschienen' ||
      visit?.isLocked,
    [visit],
  );

  const showTasks = visit && ['gestartet', 'pausiert', 'beendet', 'dokumentation_offen', 'unterschrift_offen'].includes(visit.status);
  const showDocumentation = visit && ['beendet', 'dokumentation_offen', 'unterschrift_offen'].includes(visit.status);
  const showSignature = visit && visit.requiresSignature && ['dokumentation_offen', 'unterschrift_offen'].includes(visit.status);
  const showFinalize = visit && visit.status === 'unterschrift_offen';

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
    if (tracking?.geofence?.warning && !tracking.geofence.overridden && !geofenceOverride.trim()) {
      setShowGeofenceOverride(true);
      setLocalError(tracking.geofence.warning);
      return;
    }
    if (geofenceOverride.trim()) setGeofenceOverride(geofenceOverride.trim());
    const result = await markArrived();
    if (!result.ok) setLocalError(result.error ?? 'Ankunft konnte nicht gespeichert werden.');
    else setLocalSuccess('Angekommen — Anfahrt-Timer gestoppt.');
  }, [markArrived, tracking, geofenceOverride, setGeofenceOverride]);

  const handlePrimary = useCallback(async () => {
    if (!visit || !primaryNext) return;
    setLocalError(null);
    setLocalSuccess(null);

    if (primaryNext === 'unterwegs') {
      await handleStartDrive();
      return;
    }
    if (visit.status === 'unterwegs' || primaryNext === 'angekommen') {
      await handleArrived();
      return;
    }
    if (primaryNext === 'gestartet') {
      const r = await startService();
      if (!r.ok) setLocalError(r.error ?? 'Einsatz konnte nicht gestartet werden.');
      else setLocalSuccess('Einsatz gestartet.');
      return;
    }
    if (primaryNext === 'beendet') {
      const r = await endService();
      if (!r.ok) setLocalError(r.error ?? 'Einsatz konnte nicht beendet werden.');
      else setLocalSuccess('Einsatz beendet — Dokumentation erforderlich.');
    }
  }, [visit, primaryNext, handleStartDrive, handleArrived, startService, endService]);

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
  const primaryLabel =
    visit.status === 'unterwegs'
      ? 'Angekommen'
      : visit.status === 'angekommen'
        ? 'Einsatz starten'
        : visit.status === 'gestartet'
          ? 'Einsatz beenden'
          : visit.status === 'pausiert'
            ? 'Pause beenden'
            : primaryNext === 'unterwegs'
              ? 'Anfahrt starten'
              : undefined;

  return (
    <ScreenShell title={visit.title} subtitle={`${visit.clientName} · Mitarbeiterportal`}>
      {showSuccess ? <SuccessState message={localSuccess!} /> : null}
      {localError ? <ErrorState message={localError} /> : null}
      {liveContextError && !queryError ? (
        <InfoBanner variant="warning" message={`Live-Kontext: ${liveContextError}`} />
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <EmployeePortalLocationConsentBanner
          consent={consent}
          onAccept={handleGrantConsent}
          loading={consentLoading}
        />

        <PremiumCard accentColor={colors.amber}>
          <Text style={styles.phase}>{ASSIGNMENT_STATUS_LABELS[visit.status]}</Text>
          <PremiumBadge label={ASSIGNMENT_STATUS_LABELS[visit.status]} variant="orange" dot />
          {workflowStep ? (
            <EmployeePortalVisitWorkflowTimeline
              status={visit.status}
              requiresSignature={visit.requiresSignature}
            />
          ) : null}
        </PremiumCard>

        <SectionPanel title="Live-Status" subtitle="Einsatz · GPS · Tracking">
          <DetailInfoRow label="Klient:in" value={visit.clientName} />
          <DetailInfoRow label="Adresse" value={visit.locationAddress} />
          <DetailInfoRow label="Geplant" value={formatDateTime(visit.plannedStartAt)} />
          <DetailInfoRow label="GPS-Berechtigung" value={gpsPermission} />
          <DetailInfoRow
            label="Tracking"
            value={trackingStatusLabel(trackingActive, gpsPermission, errorCode)}
          />
          {errorCode ? <Text style={styles.errorCode}>Support-Code: {errorCode}</Text> : null}
        </SectionPanel>

        <EmployeePortalLiveTimersPanel timers={timers} assignmentStatus={visit.status} />

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

            {primaryLabel && !isLocked ? (
              <PremiumButton
                title={
                  trackingActive && visit.status === 'unterwegs'
                    ? 'Anfahrt läuft — Angekommen'
                    : primaryLabel
                }
                fullWidth
                loading={actionLoading || driveLoading}
                disabled={actionLoading || driveLoading}
                onPress={handlePrimary}
              />
            ) : null}

            {visit.status === 'gestartet' ? (
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

            {visit.status === 'pausiert' ? (
              <PremiumButton
                title="Pause beenden"
                variant="secondary"
                fullWidth
                loading={actionLoading}
                onPress={async () => {
                  const r = await endPause();
                  if (r.ok) setLocalSuccess('Einsatz fortgesetzt.');
                  else setLocalError(r.error ?? 'Fortsetzen fehlgeschlagen.');
                }}
              />
            ) : null}

            {visit.allowedTransitions.includes('nicht_erschienen') && !isLocked ? (
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
            loading={actionLoading}
            onUpdateTask={saveTask}
          />
        ) : null}

        {showDocumentation && !isLocked ? (
          <EmployeePortalVisitDocumentationPanel
            loading={actionLoading}
            onSubmit={saveDocumentation}
          />
        ) : null}

        {showSignature && !isLocked ? (
          <EmployeePortalVisitSignaturePanel
            clientName={visit.clientName}
            loading={actionLoading}
            onCapture={saveSignature}
          />
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl + 32, gap: spacing.md },
  phase: { ...typography.body, marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
  errorCode: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
