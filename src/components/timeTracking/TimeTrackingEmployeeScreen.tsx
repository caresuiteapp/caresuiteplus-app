import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
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
  InfoBanner,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePortalActor } from '@/hooks/usePortalActor';
import { useAuth } from '@/lib/auth/context';
import { ensureTimeTrackingSettings } from '@/lib/timeTracking';
import {
  formatWfmStatusLabel,
  getWfmTodayStatus,
  isWfmSessionActive,
  isWfmSessionPaused,
  listWfmWorkTypesForClockIn,
  wfmClockIn,
  wfmClockOut,
  wfmPause,
  wfmResume,
  wfmSwitchWorkType,
} from '@/lib/wfm';
import { WfmTimeAccountPanel } from '@/components/wfm/WfmTimeAccountPanel';
import { WfmCheckinScanPanel } from '@/components/wfm/WfmCheckinScanPanel';
import { WfmRuleWarningsPanel } from '@/components/wfm/WfmRuleWarningsPanel';
import { WfmOfficeManualEntryPanel } from '@/components/wfm/WfmOfficeManualEntryPanel';
import type { WfmEventSource, WfmWorkTypeKey } from '@/types/modules/wfm';
import { typography } from '@/theme';

const WORK_TYPES = listWfmWorkTypesForClockIn();

function resolveWfmSource(pathname: string): WfmEventSource {
  return pathname.startsWith('/portal/') ? 'portal' : 'office';
}

function eventTypeLabel(eventType: string): string {
  const map: Record<string, string> = {
    clock_in: 'Arbeitsbeginn',
    clock_out: 'Feierabend',
    pause_start: 'Pause',
    pause_end: 'Fortsetzung',
    homeoffice_start: 'Home Office',
    homeoffice_end: 'Home Office Ende',
    office_check_in: 'Büro',
    office_check_out: 'Büro Ende',
    visit_started: 'Einsatz',
    standby_start: 'Bereitschaft',
    training_start: 'Fortbildung',
    meeting_start: 'Besprechung',
    travel_start: 'Fahrt',
  };
  return map[eventType] ?? eventType;
}

export function TimeTrackingEmployeeScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, user } = useAuth();
  const { employeeId: portalEmployeeId } = usePortalActor();
  const tenantId = useServiceTenantId();
  const userId = user?.id ?? profile?.id ?? '';
  const employeeId = portalEmployeeId ?? profile?.employeeId ?? null;
  const roleKey = profile?.roleKey ?? null;
  const { can, check, roleLabel } = usePermissions();
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('office');
  const wfmSource = resolveWfmSource(pathname);

  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [selectedWorkType, setSelectedWorkType] = useState<WfmWorkTypeKey>('buero');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const canView = can('time.tracking.own.view');
  const canStart = can('time.tracking.own.start');
  const canAdminView = can('time.tracking.admin.view');
  const canTeamView = can('time.tracking.team.view');
  const canUseTeamOverview = canAdminView || canTeamView;
  const isAdminWithoutEmployee = !employeeId && canUseTeamOverview;

  const wfmOptions = useMemo(
    () => ({ employeeId, source: wfmSource }),
    [employeeId, wfmSource],
  );

  const statusQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canView || !userId) {
        return {
          ok: true as const,
          data: { session: null, events: [], statusLabel: 'Nicht gestartet', blockCount: 0 },
        };
      }
      if (isAdminWithoutEmployee) {
        return {
          ok: true as const,
          data: { session: null, events: [], statusLabel: 'Administrator', blockCount: 0 },
        };
      }
      return getWfmTodayStatus(tenantId, userId, roleKey, wfmOptions);
    }, [tenantId, userId, roleKey, canView, wfmOptions, isAdminWithoutEmployee]),
    [tenantId, userId, roleKey, canView, wfmOptions, isAdminWithoutEmployee],
    { enabled: !!tenantId && !!userId && canView },
  );

  const settingsQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
      return ensureTimeTrackingSettings(tenantId, roleKey);
    }, [tenantId, roleKey]),
    [tenantId, roleKey],
  );

  const session = statusQuery.data?.session ?? null;
  const events = statusQuery.data?.events ?? [];
  const statusLabel = statusQuery.data?.statusLabel ?? formatWfmStatusLabel(null);
  const sessionActive = isWfmSessionActive(session);
  const sessionPaused = isWfmSessionPaused(session);

  useEffect(() => {
    if (settingsQuery.data?.requirePrivacyConsent && sessionActive && !privacyAccepted) {
      setShowPrivacyModal(false);
    }
  }, [settingsQuery.data, sessionActive, privacyAccepted]);

  const refresh = useCallback(async () => {
    await statusQuery.refresh();
  }, [statusQuery]);

  const runAction = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setActionLoading(true);
    setError(null);
    const result = await action();
    setActionLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Aktion fehlgeschlagen.');
      return;
    }
    await refresh();
  };

  const handleStart = async () => {
    if (!tenantId || !userId) return;
    await runAction(async () => {
      const result = await wfmClockIn(tenantId, userId, roleKey, selectedWorkType, wfmOptions);
      if (result.ok) setMessage('Arbeitstag gestartet.');
      return result;
    });
    setShowPrivacyModal(false);
  };

  const handlePause = () =>
    void runAction(async () => wfmPause(tenantId!, userId, roleKey, wfmOptions));

  const handleResume = () =>
    void runAction(async () => wfmResume(tenantId!, userId, roleKey, wfmOptions));

  const handleSwitch = () =>
    void runAction(async () => {
      const result = await wfmSwitchWorkType(tenantId!, userId, roleKey, selectedWorkType, wfmOptions);
      if (result.ok) setMessage('Tätigkeit gewechselt.');
      return result;
    });

  const handleClose = () =>
    void runAction(async () => {
      const result = await wfmClockOut(tenantId!, userId, roleKey, wfmOptions);
      if (result.ok) setMessage('Arbeitstag abgeschlossen.');
      return result;
    });

  const subtitle = pathname.startsWith('/portal/')
    ? 'Ihre Arbeitszeit — live synchronisiert'
    : 'Zentrale Zeiterfassung für Büro und Home Office';

  if (!canView) {
    return (
      <ScreenShell title="Arbeitszeit" subtitle={subtitle}>
        <LockedActionBanner
          message={
            check('time.tracking.own.view').reason ??
            'Sie haben keine Berechtigung, diese Arbeitszeiten zu öffnen.'
          }
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (statusQuery.loading && !statusQuery.data) {
    return (
      <ScreenShell title="Arbeitszeit" subtitle="Wird geladen…">
        <LoadingState message="Arbeitszeit wird geladen…" />
      </ScreenShell>
    );
  }

  if (statusQuery.error && !statusQuery.data) {
    const isMissingEmployeeProfile =
      (statusQuery.error.includes('Portalzugang') ||
        statusQuery.error.includes('Kein Mitarbeiterprofil')) &&
      canUseTeamOverview;
    if (isMissingEmployeeProfile) {
      return (
        <ScreenShell title="Arbeitszeit" subtitle={subtitle} scroll>
          <InfoBanner
            variant="info"
            title="Team-Übersicht nutzen"
            message="Als Administrator haben Sie kein verknüpftes Mitarbeiterprofil. Nutzen Sie die Team-Übersicht zur Verwaltung der Arbeitszeiten."
          />
          <SectionPanel title="Team & Live">
            <PremiumButton
              title="Zur Team-Übersicht"
              variant="primary"
              onPress={() => router.push('/business/office/time-tracking/zeitkonten' as never)}
            />
            <PremiumButton
              title="Live-Mitarbeiter"
              variant="secondary"
              onPress={() => router.push('/business/office/time-tracking/live' as never)}
            />
          </SectionPanel>
        </ScreenShell>
      );
    }

    return (
      <ScreenShell title="Arbeitszeit" subtitle={subtitle}>
        <ErrorState title="Fehler" message={statusQuery.error} onRetry={() => void refresh()} />
      </ScreenShell>
    );
  }

  if (isAdminWithoutEmployee) {
    return (
      <ScreenShell title="Arbeitszeit" subtitle={subtitle} scroll>
        <InfoBanner
          variant="info"
          title="Team-Übersicht nutzen"
          message="Als Administrator nutzen Sie die Team-Übersicht. Ein verknüpftes Mitarbeiterprofil ist für die persönliche Stempeluhr nicht erforderlich."
        />
        <SectionPanel title="Team & Live">
          <PremiumButton
            title="Zur Team-Übersicht"
            variant="primary"
            onPress={() => router.push('/business/office/time-tracking/zeitkonten' as never)}
          />
          <PremiumButton
            title="Live-Mitarbeiter"
            variant="secondary"
            onPress={() => router.push('/business/office/time-tracking/live' as never)}
          />
          {can('time.settings.manage') && !pathname.startsWith('/portal/') ? (
            <PremiumButton
              title="Einstellungen"
              variant="ghost"
              onPress={() => router.push('/business/office/time-tracking/einstellungen' as never)}
            />
          ) : null}
        </SectionPanel>
      </ScreenShell>
    );
  }

  const startBlockedByPrivacy =
    settingsQuery.data?.requirePrivacyConsent && !privacyAccepted && !sessionActive;

  return (
    <ScreenShell title="Arbeitszeit" subtitle={subtitle} scroll>
      <SectionPanel title="Status heute">
        <View style={styles.kpiRow}>
          <PremiumKpiCard label="Status" value={statusLabel} accentColor={accent} />
          <PremiumKpiCard label="Blöcke" value={String(events.length)} accentColor={accent} />
          <PremiumKpiCard
            label="Netto"
            value={session ? `${session.netMinutes || session.grossMinutes} Min.` : '—'}
            accentColor={accent}
          />
        </View>
      </SectionPanel>

      {tenantId && userId ? (
        <WfmCheckinScanPanel
          tenantId={tenantId}
          userId={userId}
          roleKey={roleKey}
          employeeId={employeeId}
          session={session}
          onSuccess={() => void refresh()}
        />
      ) : null}

      {tenantId && userId ? (
        <WfmRuleWarningsPanel
          tenantId={tenantId}
          userId={userId}
          roleKey={roleKey}
          employeeId={employeeId}
        />
      ) : null}

      {tenantId && userId ? (
        <WfmTimeAccountPanel
          tenantId={tenantId}
          userId={userId}
          roleKey={roleKey}
          employeeId={employeeId}
        />
      ) : null}

      {tenantId && userId && can('time.tracking.admin.correct') && !pathname.startsWith('/portal/') ? (
        <WfmOfficeManualEntryPanel
          tenantId={tenantId}
          actorId={userId}
          roleKey={roleKey}
          employees={employeeId ? [{ id: employeeId, name: profile?.fullName ?? profile?.email ?? 'Aktueller MA' }] : []}
        />
      ) : null}

      {pathname.startsWith('/portal/') ? (
        <SectionPanel title="Weitere Bereiche">
          <PremiumButton
            title="Fahrten & Zeiten"
            variant="secondary"
            onPress={() => router.push('/portal/employee/times' as never)}
          />
          <PremiumButton
            title="Urlaub"
            variant="secondary"
            onPress={() => router.push('/portal/employee/arbeitszeit/urlaub' as never)}
          />
          <PremiumButton
            title="Abwesenheiten"
            variant="secondary"
            onPress={() => router.push('/portal/employee/arbeitszeit/abwesenheiten' as never)}
          />
        </SectionPanel>
      ) : null}

      {!pathname.startsWith('/portal/') && can('time.tracking.team.view') ? (
        <SectionPanel title="Team & Live">
          <PremiumButton
            title="Team-Übersicht"
            variant="secondary"
            onPress={() => router.push('/business/office/time-tracking/zeitkonten' as never)}
          />
          <PremiumButton
            title="Live-Mitarbeiter"
            variant="secondary"
            onPress={() => router.push('/business/office/time-tracking/live' as never)}
          />
        </SectionPanel>
      ) : null}

      <SectionPanel title="Tätigkeit wählen">
        <AuroraSegmentedControl
          options={WORK_TYPES.map((t) => ({ key: t.key, label: t.label }))}
          value={selectedWorkType}
          onChange={(key) => setSelectedWorkType(key as WfmWorkTypeKey)}
        />
      </SectionPanel>

      <SectionPanel title="Aktionen">
        {!sessionActive ? (
          <PremiumButton
            title="Arbeitstag starten"
            onPress={() =>
              startBlockedByPrivacy ? setShowPrivacyModal(true) : void handleStart()
            }
            disabled={!canStart || actionLoading}
          />
        ) : null}
        {sessionActive && !sessionPaused ? (
          <>
            <PremiumButton title="Pause" variant="secondary" onPress={handlePause} disabled={actionLoading} />
            <PremiumButton title="Tätigkeit wechseln" variant="secondary" onPress={handleSwitch} disabled={actionLoading} />
            <PremiumButton title="Tag abschließen" variant="secondary" onPress={handleClose} disabled={actionLoading} />
          </>
        ) : null}
        {sessionPaused ? (
          <>
            <PremiumButton title="Fortsetzen" onPress={handleResume} disabled={actionLoading} />
            <PremiumButton title="Tag abschließen" variant="secondary" onPress={handleClose} disabled={actionLoading} />
          </>
        ) : null}
        {can('time.settings.manage') && !pathname.startsWith('/portal/') ? (
          <PremiumButton
            title="Einstellungen"
            variant="ghost"
            onPress={() => router.push('/business/office/time-tracking/einstellungen' as never)}
          />
        ) : null}
      </SectionPanel>

      <SectionPanel title="Zeitblöcke heute" subtitle="Erfasste Stempelungen des Arbeitstags">
        {events.length === 0 ? (
          <Text style={{ color: text.secondary }}>Noch keine Zeitblöcke erfasst.</Text>
        ) : (
          events.map((entry) => (
            <View key={entry.id} style={styles.blockRow}>
              <Text style={{ color: text.primary, ...typography.body }}>
                {new Date(entry.occurredAt).toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                — {eventTypeLabel(entry.eventType)}
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
          <Text style={styles.modalTitle}>Datenschutz & Zeiterfassung</Text>
          <Text style={styles.modalBody}>
            CareSuite+ erfasst Arbeitszeiten zentral für Büro, Home Office und Einsätze. Es werden nur
            Zeitstempel und Tätigkeitsarten gespeichert — keine Inhaltsdaten Ihrer Arbeit.
          </Text>
          <PremiumButton title="Verstanden & starten" onPress={props.onAccept} />
          <PremiumButton title="Abbrechen" variant="ghost" onPress={props.onDecline} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  blockRow: { paddingVertical: careSpacing.xs },
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
