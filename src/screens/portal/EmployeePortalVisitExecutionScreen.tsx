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

export function EmployeePortalVisitExecutionScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const canExecute = can('assist.execution.manage');

  const {
    data: visit,
    tracking,
    timers,
    consent,
    gpsPermission,
    loading,
    error,
    actionLoading,
    refresh,
    changeStatus,
    grantConsent,
    requestLocationPermission,
    capturePosition,
    setGeofenceOverride,
    openRoute,
    notFound,
  } = useEmployeePortalVisitExecution(id);

  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [geofenceOverride, setGeofenceOverrideInput] = useState('');
  const [showGeofenceOverride, setShowGeofenceOverride] = useState(false);

  const primaryNext = visit ? PRIMARY_NEXT[visit.status] : undefined;

  const handleGrantConsent = useCallback(async () => {
    setConsentLoading(true);
    setLocalError(null);
    setLocalSuccess(null);
    try {
      await grantConsent();
      await refresh();
      if (notFound) {
        setLocalError('Einsatz nicht gefunden — Einwilligung konnte nicht verknüpft werden.');
        return;
      }
      setLocalSuccess('Einwilligung gespeichert.');
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Einwilligung konnte nicht gespeichert werden.',
      );
    } finally {
      setConsentLoading(false);
    }
  }, [grantConsent, refresh, notFound]);

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
    setLocalError(null);
    setLocalSuccess(null);
    if (!consent?.granted) {
      setLocalError('Bitte zuerst Standort-Einwilligung bestätigen.');
      return;
    }
    const perm = await requestLocationPermission();
    if (perm !== 'granted') {
      setLocalError('Standortberechtigung erforderlich — bitte zuerst freigeben.');
      return;
    }
    const pos = await capturePosition();
    if (!pos.ok) {
      setLocalError(pos.error);
      return;
    }
    await changeStatus('unterwegs');
    setLocalSuccess('Anfahrt gestartet — Assist wird informiert.');
  }, [consent, requestLocationPermission, capturePosition, changeStatus]);

  const handleArrived = useCallback(async () => {
    setLocalError(null);
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

  if (!can('portal.employee.appointments.view')) {
    return (
      <ScreenShell title="Einsatz durchführen" subtitle={resolvePortalScreenSubtitle(roleLabel, 'employee')}>
        <LockedActionBanner
          message={check('portal.employee.appointments.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (loading) {
    return (
      <ScreenShell title="Einsatz durchführen" subtitle="Wird geladen…">
        <LoadingState message="Einsatz wird geladen…" />
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

  return (
    <ScreenShell title={visit.title} subtitle={`${visit.clientName} · Mitarbeiterportal`}>
      {localSuccess && !localError ? <SuccessState message={localSuccess} /> : null}
      {localError ? <ErrorState message={localError} /> : null}

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

        <SectionPanel title="Einsatz" subtitle="Nur aus dem Mitarbeiterportal startbar">
          <DetailInfoRow label="Klient:in" value={visit.clientName} />
          <DetailInfoRow label="Adresse" value={visit.locationAddress} />
          <DetailInfoRow label="Geplant" value={formatDateTime(visit.plannedStartAt)} />
          <DetailInfoRow label="GPS-Berechtigung" value={gpsPermission} />
          <DetailInfoRow
            label="Tracking"
            value={tracking?.trackingActive ? 'Aktiv (Anfahrt)' : 'Inaktiv'}
          />
        </SectionPanel>

        <EmployeePortalLiveTimersPanel timers={timers} />

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
                  primaryNext === 'unterwegs'
                    ? 'Anfahrt starten'
                    : primaryNext === 'angekommen'
                      ? 'Angekommen'
                      : primaryNext === 'gestartet'
                        ? 'Einsatz starten'
                        : `Weiter: ${ASSIGNMENT_STATUS_LABELS[primaryNext]}`
                }
                fullWidth
                loading={actionLoading}
                disabled={actionLoading}
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
          <SectionPanel title="Aufgaben">
            {visit.tasks.map((task) => (
              <Text key={task.id} style={styles.task}>
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
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  phase: { ...typography.body, marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
  task: { ...typography.body, marginBottom: spacing.xs },
});
