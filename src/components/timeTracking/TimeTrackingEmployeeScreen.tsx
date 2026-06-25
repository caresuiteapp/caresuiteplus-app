import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { AuroraSegmentedControl } from '@/components/aurora';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumKpiCard,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  closeWorkday,
  ensureTimeTrackingSettings,
  fetchTimeTrackingCatalogs,
  getCurrentWorkdayStatus,
  pauseWorkday,
  requestTimeCorrection,
  respondToInactivityCheck,
  resumeWorkday,
  startWorkday,
  switchActivity,
  triggerInactivityCheck,
} from '@/lib/timeTracking';
import type { ActivityType, TimeEntry, TimeWorkday } from '@/types/modules/timeTracking';
import { typography } from '@/theme';

export function TimeTrackingEmployeeScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const tenantId = useServiceTenantId();
  const userId = user?.id ?? profile?.id ?? 'demo-user';
  const roleKey = profile?.roleKey ?? null;
  const { can, check, roleLabel } = usePermissions();
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('office');

  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [pendingCheckId, setPendingCheckId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const canView = can('time.tracking.own.view');
  const canStart = can('time.tracking.own.start');

  const statusQuery = useAsyncQuery<{ workday: import('@/types/modules/timeTracking').TimeWorkday | null; entries: import('@/types/modules/timeTracking').TimeEntry[]; multiTabConflict: boolean } | null>(
    useCallback(async () => {
      if (!tenantId || !canView) return { ok: true as const, data: null };
      return getCurrentWorkdayStatus(tenantId, userId, roleKey);
    }, [tenantId, userId, roleKey, canView]),
    [tenantId, userId, roleKey, canView],
    { enabled: !!tenantId && canView },
  );

  const catalogQuery = useAsyncQuery<{ organizations: import('@/types/modules/timeTracking').WorkOrganization[]; costCenters: import('@/types/modules/timeTracking').CostCenter[]; projects: import('@/types/modules/timeTracking').WorkProject[]; activityTypes: import('@/types/modules/timeTracking').ActivityType[] } | null>(
    useCallback(async () => {
      if (!tenantId || !canView) return { ok: true as const, data: null };
      return fetchTimeTrackingCatalogs(tenantId, roleKey);
    }, [tenantId, roleKey, canView]),
    [tenantId, roleKey, canView],
    { enabled: !!tenantId && canView },
  );

  const settingsQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
      return ensureTimeTrackingSettings(tenantId, roleKey);
    }, [tenantId, roleKey]),
    [tenantId, roleKey],
  );

  const workday = statusQuery.data?.workday ?? null;
  const entries = statusQuery.data?.entries ?? [];
  const activityTypes: ActivityType[] = catalogQuery.data?.activityTypes ?? [];
  const multiTabConflict = statusQuery.data?.multiTabConflict ?? false;

  useEffect(() => {
    if (settingsQuery.data?.requirePrivacyConsent && !workday?.privacyConsentAt) {
      setShowPrivacyModal(true);
    }
  }, [settingsQuery.data, workday?.privacyConsentAt]);

  const refresh = useCallback(async () => {
    await statusQuery.refresh();
  }, [statusQuery]);

  const defaultActivityId = useMemo(
    () => selectedActivityId ?? settingsQuery.data?.defaultActivityTypeId ?? activityTypes[0]?.id ?? null,
    [selectedActivityId, settingsQuery.data, activityTypes],
  );

  const handleStart = async () => {
    if (!tenantId || !defaultActivityId) return;
    setActionLoading(true);
    setError(null);
    const result = await startWorkday(tenantId, userId, roleKey, {
      activityTypeId: defaultActivityId,
      privacyConsentAccepted: privacyAccepted || !settingsQuery.data?.requirePrivacyConsent,
      sessionId: `tab-${Date.now()}`,
    });
    setActionLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setShowPrivacyModal(false);
    setMessage('Arbeitstag gestartet.');
    await refresh();
  };

  const handlePause = async () => {
    if (!tenantId) return;
    setActionLoading(true);
    const result = await pauseWorkday(tenantId, userId, roleKey);
    setActionLoading(false);
    if (!result.ok) setError(result.error);
    else await refresh();
  };

  const handleResume = async () => {
    if (!tenantId) return;
    setActionLoading(true);
    const result = await resumeWorkday(tenantId, userId, roleKey);
    setActionLoading(false);
    if (!result.ok) setError(result.error);
    else await refresh();
  };

  const handleSwitch = async () => {
    if (!tenantId || !defaultActivityId) return;
    setActionLoading(true);
    const result = await switchActivity(tenantId, userId, roleKey, {
      activityTypeId: defaultActivityId,
    });
    setActionLoading(false);
    if (!result.ok) setError(result.error);
    else {
      setMessage('Tätigkeit gewechselt.');
      await refresh();
    }
  };

  const handleClose = async () => {
    if (!tenantId) return;
    setActionLoading(true);
    const result = await closeWorkday(tenantId, userId, roleKey);
    setActionLoading(false);
    if (!result.ok) setError(result.error);
    else {
      setMessage(`Tag abgeschlossen — Ampel: ${result.data.ampel.trafficLight}`);
      await refresh();
    }
  };

  const simulateInactivity = async () => {
    if (!tenantId) return;
    const result = await triggerInactivityCheck(tenantId, userId, roleKey);
    if (result.ok) {
      setPendingCheckId(result.data.id);
      setShowInactivityModal(true);
      if ((result.data ? 1 : 0) && statusQuery.data) {
        const count = entries.length;
        if (count >= 0) setShowWarningModal(false);
      }
    }
  };

  const handleInactivityResponse = async (action: 'continue' | 'pause' | 'switch' | 'unclear') => {
    if (!tenantId || !pendingCheckId) return;
    await respondToInactivityCheck(tenantId, userId, roleKey, pendingCheckId, action, {
      activityTypeId: defaultActivityId ?? undefined,
    });
    setShowInactivityModal(false);
    setPendingCheckId(null);
    await refresh();
  };

  if (!canView) {
    return (
      <ScreenShell title="Arbeitszeit" subtitle="Homeoffice & Tätigkeitsnachweis">
        <LockedActionBanner
          message={check('time.tracking.own.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if ((statusQuery.loading && !statusQuery.data) || catalogQuery.loading) {
    return (
      <ScreenShell title="Arbeitszeit" subtitle="Wird geladen…">
        <LoadingState message="Arbeitszeit wird geladen…" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Arbeitszeit" subtitle="Homeoffice & Tätigkeitsnachweis — nur Metadaten" scroll>
      {multiTabConflict ? (
        <SectionPanel title="Hinweis">
          <Text style={[styles.warn, { color: text.primary }]}>
            Arbeitszeit wird möglicherweise in einem anderen Tab erfasst. Bitte nur eine aktive Sitzung nutzen.
          </Text>
        </SectionPanel>
      ) : null}

      <SectionPanel title="Status heute">
        <View style={styles.kpiRow}>
          <PremiumKpiCard label="Status" value={workday?.status ?? 'Nicht gestartet'} accentColor={accent} />
          <PremiumKpiCard label="Blöcke" value={String(entries.length)} accentColor={accent} />
          <PremiumKpiCard label="Ampel" value={workday?.trafficLight ?? '—'} accentColor={accent} />
        </View>
      </SectionPanel>

      <SectionPanel title="Tätigkeit wählen">
        <AuroraSegmentedControl
          options={activityTypes.map((a) => ({ key: a.id, label: a.name }))}
          value={defaultActivityId ?? ''}
          onChange={(key) => setSelectedActivityId(key)}
        />
      </SectionPanel>

      <SectionPanel title="Aktionen">
        {!workday || workday.status === 'closed' || workday.status === 'submitted' ? (
          <PremiumButton
            title="Arbeitstag starten"
            onPress={() => (settingsQuery.data?.requirePrivacyConsent ? setShowPrivacyModal(true) : handleStart())}
            disabled={!canStart || actionLoading || !defaultActivityId}
          />
        ) : null}
        {workday?.status === 'active' ? (
          <>
            <PremiumButton title="Pause" variant="secondary" onPress={handlePause} disabled={actionLoading} />
            <PremiumButton title="Tätigkeit wechseln" variant="secondary" onPress={handleSwitch} disabled={actionLoading} />
            <PremiumButton title="Tag abschließen" variant="secondary" onPress={handleClose} disabled={actionLoading} />
          </>
        ) : null}
        {workday?.status === 'paused' ? (
          <>
            <PremiumButton title="Fortsetzen" onPress={handleResume} disabled={actionLoading} />
            <PremiumButton title="Tag abschließen" variant="secondary" onPress={handleClose} disabled={actionLoading} />
          </>
        ) : null}
        {can('time.settings.manage') ? (
          <PremiumButton
            title="Einstellungen"
            variant="ghost"
            onPress={() => router.push('/business/office/settings/time-tracking' as never)}
          />
        ) : null}
      </SectionPanel>

      <SectionPanel title="Zeitblöcke heute" subtitle="Mehrere Blöcke — kein Mischzeit-Feld">
        {entries.length === 0 ? (
          <Text style={{ color: text.secondary }}>Noch keine Zeitblöcke erfasst.</Text>
        ) : (
          entries.map((entry: TimeEntry) => (
            <View key={entry.id} style={styles.blockRow}>
              <Text style={{ color: text.primary, ...typography.body }}>
                Block {entry.blockIndex}: {activityTypes.find((a) => a.id === entry.activityTypeId)?.name ?? '—'} —{' '}
                {entry.status}
                {entry.isUnclear ? ' (unklar)' : ''}
              </Text>
            </View>
          ))
        )}
      </SectionPanel>

      {message ? <SuccessState title="Erfolg" message={message} /> : null}
      {error ? <ErrorState title="Fehler" message={error} onRetry={() => setError(null)} /> : null}

      <PrivacyConsentModal
        visible={showPrivacyModal}
        onAccept={() => {
          setPrivacyAccepted(true);
          setShowPrivacyModal(false);
          void handleStart();
        }}
        onDecline={() => setShowPrivacyModal(false)}
      />

      <InactivityModal
        visible={showInactivityModal}
        onContinue={() => void handleInactivityResponse('continue')}
        onPause={() => void handleInactivityResponse('pause')}
        onSwitch={() => void handleInactivityResponse('switch')}
        onUnclear={() => void handleInactivityResponse('unclear')}
      />

      <WarningModal visible={showWarningModal} onDismiss={() => setShowWarningModal(false)} />

      {__DEV__ ? (
        <PremiumButton title="[Dev] Inaktivität simulieren" variant="ghost" onPress={() => void simulateInactivity()} />
      ) : null}
    </ScreenShell>
  );
}

function PrivacyConsentModal(props: {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <Modal visible={props.visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Datenschutz & Aktivitätserfassung</Text>
          <Text style={styles.modalBody}>
            CareSuite+ erfasst ausschließlich Metadaten (Modul, Zeitstempel, Ressourcen-ID) — keine Tastatureingaben,
            Screenshots oder Kameradaten. Sie können jederzeit pausieren oder den Tag abschließen.
          </Text>
          <PremiumButton title="Verstanden & starten" onPress={props.onAccept} />
          <PremiumButton title="Abbrechen" variant="ghost" onPress={props.onDecline} />
        </View>
      </View>
    </Modal>
  );
}

function InactivityModal(props: {
  visible: boolean;
  onContinue: () => void;
  onPause: () => void;
  onSwitch: () => void;
  onUnclear: () => void;
}) {
  return (
    <Modal visible={props.visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Sind Sie noch tätig?</Text>
          <Text style={styles.modalBody}>Keine Aktivität seit 5 Minuten. Bitte bestätigen Sie Ihre Tätigkeit.</Text>
          <PremiumButton title="Ja, weiterarbeiten" onPress={props.onContinue} />
          <PremiumButton title="Pause" variant="secondary" onPress={props.onPause} />
          <PremiumButton title="Tätigkeit wechseln" variant="secondary" onPress={props.onSwitch} />
          <PremiumButton title="Zeit unklar" variant="ghost" onPress={props.onUnclear} />
        </View>
      </View>
    </Modal>
  );
}

function WarningModal(props: { visible: boolean; onDismiss: () => void }) {
  return (
    <Modal visible={props.visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Hinweis</Text>
          <Text style={styles.modalBody}>
            Mehrere Inaktivitätsprüfungen heute. Bitte prüfen Sie Ihre Tätigkeitszuordnung — dies ist ein Hinweis, keine
            Bewertung.
          </Text>
          <PremiumButton title="Verstanden" onPress={props.onDismiss} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  blockRow: { paddingVertical: careSpacing.xs },
  warn: { ...typography.caption },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: careSpacing.lg,
  },
  modalCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    padding: careSpacing.lg,
    gap: careSpacing.sm,
  },
  modalTitle: { ...typography.h3, color: '#1a1a2e' },
  modalBody: { ...typography.body, color: '#333', marginBottom: careSpacing.sm },
});
