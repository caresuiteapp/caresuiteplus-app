import { useCallback, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmployeePortalLiveTimersPanel,
  EmployeePortalLocationConsentBanner,
} from '@/components/portal';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
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
import { ASSIGNMENT_STATUS_LABELS } from '@/types/modules/assignmentStatus';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { colors, spacing, typography } from '@/theme';

const PRIMARY_NEXT: Partial<Record<AssignmentStatus, AssignmentStatus>> = {
  geplant: 'unterwegs',
  bestaetigt: 'unterwegs',
  unterwegs: 'angekommen',
  angekommen: 'gestartet',
  gestartet: 'beendet',
  pausiert: 'gestartet',
  beendet: 'dokumentation_offen',
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
    changeStatus,
    grantConsent,
    startDriveTracking,
    requestLocationPermission,
    capturePosition,
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

  const primaryNext = visit ? PRIMARY_NEXT[visit.status] : undefined;
  const trackingActive = Boolean(tracking?.trackingActive || liveContext?.trackingSessionActive);

  const handleGrantConsent = useCallback(async () => {
    setConsentLoading(true);
    setLocalError(null);
    setLocalSuccess(null);
    const result = await grantConsent();
    if (!result.ok) {
      setLocalError(result.error ?? 'Einwilligung konnte nicht gespeichert werden.');
    } else {
      setLocalSuccess('Einwilligung gespeichert.');
    }
    setConsentLoading(false);
  }, [grantConsent]);

  const handleRequestPermission = useCallback(async () => {
    setLocalError(null);
    setLocalSuccess(null);
    const status = await requestLocationPermission();
    if (status === 'granted') {
      setLocalSuccess('Standortberechtigung erteilt.');
    } else if (status === 'denied') {
      setLocalError(
        Platform.OS === 'ios'
          ? 'Standortberechtigung abgelehnt — bitte in Safari-Einstellungen unter „Standort“ freigeben.'
          : 'Standortberechtigung nicht erteilt — bitte in den Geräteeinstellungen prüfen.',
      );
    } else {
      setLocalError('Standortberechtigung ausstehend — bitte erneut über die Schaltfläche anfordern.');
    }
  }, [requestLocationPermission]);

  const handleStartDrive = useCallback(async () => {
    setDriveLoading(true);
    setLocalError(null);
    setLocalSuccess(null);
    if (!consent?.granted) {
      setLocalError('Bitte zuerst Standort-Einwilligung bestätigen.');
      setDriveLoading(false);
      return;
    }
    const result = await startDriveTracking();
    if (!result.ok) {
      setLocalError(result.error ?? 'Tracking konnte nicht gestartet werden.');
    } else {
      setLocalSuccess('Anfahrt gestartet — Tracking aktiv.');
    }
    setDriveLoading(false);
  }, [consent, startDriveTracking]);

  const handleArrived = useCallback(async () => {
    setLocalError(null);
    setLocalSuccess(null);
    const pos = await capturePosition();
    if (!pos.ok && consent?.granted) {
      setLocalError(pos.error);
    }
    if (tracking?.geofence?.warning && !tracking.geofence.overridden && !geofenceOverride.trim()) {
      setShowGeofenceOverride(true);
      setLocalError(tracking.geofence.warning);
      return;
    }
    if (geofenceOverride.trim()) {
      setGeofenceOverride(geofenceOverride.trim());
    }
    await changeStatus('angekommen');
    setLocalSuccess('Angekommen — Anfahrt-Timer gestoppt.');
  }, [capturePosition, consent, tracking, geofenceOverride, setGeofenceOverride, changeStatus]);

  const handlePrimary = useCallback(async () => {
    if (!visit || !primaryNext) return;
    if (primaryNext === 'unterwegs') {
      await handleStartDrive();
      return;
    }
    if (primaryNext === 'angekommen') {
      await handleArrived();
      return;
    }
    setLocalError(null);
    setLocalSuccess(null);
    await changeStatus(primaryNext);
    setLocalSuccess(`Status: ${ASSIGNMENT_STATUS_LABELS[primaryNext]}`);
  }, [visit, primaryNext, handleStartDrive, handleArrived, changeStatus]);

  const handleOpenMap = useCallback(async () => {
    const route = await openRoute();
    if (route.ok && route.data.mapUrl) {
      await Linking.openURL(route.data.mapUrl);
    } else {
      setLocalError(route.ok ? 'Keine Karten-URL.' : route.error);
    }
  }, [openRoute]);

  const isLocked = useMemo(
    () =>
      visit?.status === 'abgeschlossen' ||
      visit?.status === 'storniert' ||
      visit?.status === 'nicht_erschienen' ||
      visit?.isLocked,
    [visit],
  );

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
        {errorCode ? (
          <Text style={styles.errorCode}>Support-Code: {errorCode}</Text>
        ) : null}
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (notFound || !visit) {
    return (
      <ScreenShell title={shellTitle} subtitle="Fehler">
        <ErrorState message={error ?? 'Einsatz nicht gefunden.'} onRetry={refresh} />
        {errorCode ? (
          <Text style={styles.errorCode}>Support-Code: {errorCode}</Text>
        ) : null}
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  const showSuccess = localSuccess && !localError;

  return (
    <ScreenShell title={visit.title} subtitle={`${visit.clientName} · Mitarbeiterportal`}>
      {showSuccess ? <SuccessState message={localSuccess!} /> : null}
      {localError ? <ErrorState message={localError} /> : null}
      {liveContextError && !queryError ? (
        <InfoBanner
          variant="warning"
          message={`Live-Kontext: ${liveContextError}${errorCode ? ` (${errorCode})` : ''}`}
        />
      ) : null}
      {error && !localError && !liveContextError ? (
        <InfoBanner variant="warning" message={error} />
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
        </PremiumCard>

        <SectionPanel title="Live-Status" subtitle="Einsatz · GPS · Tracking">
          <DetailInfoRow label="Einsatz gefunden" value={liveContext ? 'Ja' : 'Prüfung…'} />
          <DetailInfoRow label="Klient:in" value={visit.clientName} />
          <DetailInfoRow label="Adresse" value={visit.locationAddress} />
          <DetailInfoRow label="Geplant" value={formatDateTime(visit.plannedStartAt)} />
          <DetailInfoRow label="GPS-Berechtigung" value={gpsPermission} />
          <DetailInfoRow
            label="Tracking"
            value={trackingStatusLabel(trackingActive, gpsPermission, errorCode)}
          />
          {liveContext?.lastLocationAt ? (
            <DetailInfoRow
              label="Letzte Standortübertragung"
              value={formatDateTime(liveContext.lastLocationAt)}
            />
          ) : null}
          {liveContext?.lastLocationAccuracyMeters != null ? (
            <DetailInfoRow
              label="Genauigkeit"
              value={`±${Math.round(liveContext.lastLocationAccuracyMeters)} m`}
            />
          ) : null}
          {errorCode ? (
            <Text style={styles.errorCode}>Support-Code: {errorCode}</Text>
          ) : null}
        </SectionPanel>

        <EmployeePortalLiveTimersPanel timers={timers} assignmentStatus={visit.status} />

        {tracking?.warnings.map((w) => (
          <InfoBanner key={w} variant="warning" message={w} />
        ))}

        {showGeofenceOverride ? (
          <SectionPanel title="Geofence-Hinweis" subtitle="Weicher Check — kein Hard-Block">
            <PremiumInput
              label="Begründung (optional)"
              value={geofenceOverride}
              onChangeText={setGeofenceOverrideInput}
              placeholder="z. B. Parkplatz nebenan, Hausmeister-Zutritt…"
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

            {primaryNext && !isLocked ? (
              <PremiumButton
                title={
                  trackingActive && visit.status === 'unterwegs'
                    ? 'Anfahrt läuft'
                    : primaryNext === 'unterwegs'
                      ? 'Anfahrt starten'
                      : primaryNext === 'angekommen'
                        ? 'Angekommen'
                        : primaryNext === 'gestartet'
                          ? 'Einsatz starten'
                          : `Weiter: ${ASSIGNMENT_STATUS_LABELS[primaryNext]}`
                }
                fullWidth
                loading={actionLoading || driveLoading}
                disabled={actionLoading || driveLoading || (trackingActive && visit.status === 'unterwegs')}
                onPress={handlePrimary}
              />
            ) : null}

            {visit.status === 'gestartet' ? (
              <PremiumButton
                title="Pause"
                variant="ghost"
                fullWidth
                loading={actionLoading}
                onPress={() => changeStatus('pausiert')}
              />
            ) : null}

            {visit.allowedTransitions.includes('nicht_erschienen') ? (
              <PremiumButton
                title="Nicht angetroffen"
                variant="ghost"
                fullWidth
                loading={actionLoading}
                onPress={() => changeStatus('nicht_erschienen')}
              />
            ) : null}
          </View>
        )}

        {visit.tasks.length > 0 ? (
          <SectionPanel title="Aufgaben" subtitle={isLocked ? 'Einsatz abgeschlossen' : undefined}>
            {visit.tasks.map((task) => (
              <Text
                key={task.id}
                style={[styles.task, isLocked ? styles.taskMuted : null]}
              >
                • {task.title} ({task.status})
              </Text>
            ))}
          </SectionPanel>
        ) : (
          <EmptyState title="Keine Aufgaben" message="Für diesen Einsatz sind keine Aufgaben hinterlegt." />
        )}

        <PremiumButton title="Zurück zur Übersicht" variant="ghost" fullWidth onPress={() => router.back()} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl + 32, gap: spacing.md },
  phase: { ...typography.body, marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
  task: { ...typography.body, marginBottom: spacing.xs },
  taskMuted: { color: colors.textMuted },
  errorCode: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
