// Generated native presentation from src/components/wfm/WfmOwnTimeTrackingScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeButton,NativeSection,NativeH3,NativeP,NativeDiv,NativeSpan,NativeLabel,NativeSelect,NativeOption,NativeInput,NativeForm,NativeArticle,NativeStrong} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused, useRouter } from 'expo-router';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchPortalTimeTrackingSettings } from '@/lib/timeTracking/timeTrackingSettingsService';
import { getWfmTodayStatus, isWfmSessionActive, isWfmSessionPaused, listWfmWorkTypesForClockIn, wfmClockIn, wfmClockOut, wfmPause, wfmResume, wfmSwitchWorkType } from '@/lib/wfm';
import { wfmOfficeCheckInByToken } from '@/lib/wfm/wfmCheckinService';
import { listWfmRuleViolationsForDate } from '@/lib/wfm/wfmRuleEngine';
import { todayWorkDate } from '@/lib/wfm/wfmWorkSessionRepository';
import { resolveOfficeOwnIdentity } from "../../lib/wfm/wfmOfficeOwnIdentity.native.ts";
import type { ServiceResult } from '@/types';
import type { WfmWorkTypeKey } from '@/types/modules/wfm';
import { WfmSecondaryWorkspace, WfmWebNotice, useWfmUnsavedChanges } from "./WfmSecondaryWorkspace.native.tsx";
const workTypes = listWfmWorkTypesForClockIn();
const labels: Record<string, string> = { clock_in: 'Arbeitsbeginn', clock_out: 'Feierabend', pause_start: 'Pause begonnen', pause_end: 'Pause beendet', homeoffice_start: 'Homeoffice begonnen', homeoffice_end: 'Homeoffice beendet', office_check_in: 'Im Büro eingecheckt', office_check_out: 'Büro verlassen', visit_started: 'Einsatz begonnen', visit_ended: 'Einsatz beendet', standby_start: 'Bereitschaft', training_start: 'Fortbildung', meeting_start: 'Besprechung', meeting_end: 'Besprechung beendet', travel_start: 'Fahrt begonnen', travel_end: 'Fahrt beendet', work_type_switch: 'Tätigkeit gewechselt' };
const duration = (minutes: number | undefined) => minutes == null || !Number.isFinite(minutes) ? '—' : `${Math.floor(Math.max(0, Math.round(minutes)) / 60)} Std. ${Math.max(0, Math.round(minutes)) % 60} Min.`;
export function WfmOwnTimeTrackingScreen() {
    const tenantId = useServiceTenantId();
    const { user, profile } = useAuth();
    const userId = user?.id ?? profile?.id ?? '';
    const knownEmployeeId = profile?.employeeId ?? null;
    const { can, check, roleKey, permissions } = usePermissions();
    const canView = can('time.tracking.own.view');
    const focused = useIsFocused();
    const router = useRouter();
    const identityScope = `${tenantId}:${userId}:${knownEmployeeId}:${roleKey}:${canView}:${[...permissions].sort().join(',')}`;
    const employeeQuery = useAsyncQuery(useCallback(() => resolveOfficeOwnIdentity({ tenantId: tenantId!, userId, roleKey, effectivePermissions: permissions }), [tenantId, userId, roleKey, permissions]), [tenantId, userId, roleKey, permissions], { enabled: !!tenantId && !!userId && canView, queryKey: identityScope });
    const employeeId = employeeQuery.data?.employeeId ?? null;
    const scope = `${identityScope}:${employeeId}`;
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    const options = useMemo(() => ({ employeeId, source: 'office' as const }), [employeeId]);
    const [workType, setWorkType] = useState<WfmWorkTypeKey>('buero');
    const [consent, setConsent] = useState(false);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    useWfmUnsavedChanges(false, busy);
    useEffect(() => { setConsent(false); setCode(''); setWorkType('buero'); setMessage(''); setError(''); setBusy(false); lock.current = false; }, [scope]);
    const ready = !!tenantId && !!userId && !!employeeId && canView && !employeeQuery.error && !employeeQuery.refreshError;
    const status = useAsyncQuery(useCallback(() => getWfmTodayStatus(tenantId!, userId, roleKey, options), [tenantId, userId, roleKey, options]), [tenantId, userId, roleKey, options], { enabled: ready, queryKey: scope });
    const settings = useAsyncQuery(useCallback(() => fetchPortalTimeTrackingSettings(tenantId!, roleKey), [tenantId, roleKey]), [tenantId, roleKey], { enabled: ready, queryKey: `${scope}:settings` });
    const warnings = useAsyncQuery(useCallback(() => listWfmRuleViolationsForDate(tenantId!, roleKey, todayWorkDate(), { employeeId }), [tenantId, roleKey, employeeId]), [tenantId, roleKey, employeeId], { enabled: ready, queryKey: `${scope}:warnings` });
    const refreshStatus = status.refresh;
    const refreshSettings = settings.refresh;
    useEffect(() => {
        if (!focused || !ready)
            return;
        void refreshStatus();
        void refreshSettings();
        const timer = window.setInterval(() => { if (!lock.current)
            void refreshStatus(); }, 60000);
        return () => window.clearInterval(timer);
    }, [focused, ready, refreshStatus, refreshSettings]);
    const session = status.data?.session ?? null;
    const active = isWfmSessionActive(session);
    const paused = isWfmSessionPaused(session);
    const stale = status.loading || !!status.error || !!status.refreshError;
    const startBlocked = busy || stale || settings.loading || !!settings.error || !!settings.refreshError || !settings.data?.moduleEnabled || (!!settings.data?.requirePrivacyConsent && !consent) || !can('time.tracking.own.start');
    const action = async (operation: () => Promise<ServiceResult<unknown>>, success: string) => {
        if (lock.current || !ready || stale)
            return;
        const requestedScope = scope;
        lock.current = true;
        setBusy(true);
        setMessage('');
        setError('');
        try {
            const result = await operation();
            if (scopeRef.current !== requestedScope)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            setMessage(success);
            setCode('');
            await Promise.all([status.refresh(), warnings.refresh()]);
        }
        catch (cause) {
            if (scopeRef.current === requestedScope)
                setError(cause instanceof Error ? cause.message : 'Die Buchung konnte nicht gespeichert werden.');
        }
        finally {
            if (scopeRef.current === requestedScope) {
                lock.current = false;
                setBusy(false);
            }
        }
    };
    const start = () => { if (!startBlocked)
        void action(() => wfmClockIn(tenantId!, userId, roleKey, workType, options), 'Arbeitstag gestartet.'); };
    const checkIn = () => { if (!startBlocked && /^[A-Z0-9]{8}$/.test(code))
        void action(() => wfmOfficeCheckInByToken(tenantId!, userId, roleKey, code, { employeeId }), 'Im Büro eingecheckt.'); };
    return <WfmSecondaryWorkspace title="Eigene Erfassung" description="Arbeitsbeginn, Pausen und Tätigkeiten für Ihren Arbeitstag." actions={<NativeButton disabled={!ready || busy || status.refreshing} onClick={() => void Promise.all([status.refresh(), settings.refresh(), warnings.refresh()])}>Aktualisieren</NativeButton>}>
    {!canView ? <WfmWebNotice>{check('time.tracking.own.view').reason ?? 'Keine Berechtigung.'}</WfmWebNotice> : employeeQuery.loading ? <WfmWebNotice>Mitarbeiterzuordnung wird geprüft…</WfmWebNotice> : !employeeId || employeeQuery.error || employeeQuery.refreshError ? <NativeSection className="wts-panel"><NativeH3>{employeeQuery.error || employeeQuery.refreshError ? 'Mitarbeiterzuordnung nicht verfügbar' : 'Keine persönliche Zeiterfassung eingerichtet'}</NativeH3>{employeeQuery.error || employeeQuery.refreshError ? <WfmWebNotice tone="error">{employeeQuery.error || employeeQuery.refreshError}<NativeButton onClick={() => void employeeQuery.refresh()}>Erneut prüfen</NativeButton></WfmWebNotice> : <><NativeP>Ihr Verwaltungszugang ist keinem Mitarbeiterprofil zugeordnet. Für eine persönliche Stempeluhr muss die Personalverwaltung Ihren Zugang mit Ihrem eigenen Mitarbeiterprofil verknüpfen.</NativeP><NativeDiv className="wts-actions"><NativeButton onClick={() => void employeeQuery.refresh()}>Zuordnung erneut prüfen</NativeButton></NativeDiv></>}<NativeP>Die Verwaltung der Arbeitszeiten Ihres Teams bleibt über die freigegebenen Zeitkonten erreichbar.</NativeP>{(can('time.tracking.admin.view') || can('time.tracking.team.view')) && <NativeDiv className="wts-actions"><NativeButton onClick={() => router.push('/business/office/time-tracking/zeitkonten')}>Zeitkonten öffnen</NativeButton></NativeDiv>}</NativeSection> : <>
      {status.loading && <WfmWebNotice>Arbeitstag wird geladen…</WfmWebNotice>}{(status.error || status.refreshError) && <WfmWebNotice tone="error">{status.error || status.refreshError}</WfmWebNotice>}
      {(settings.error || settings.refreshError) && <WfmWebNotice tone="error">{settings.error || settings.refreshError}<NativeButton onClick={() => void settings.refresh()}>Einstellungen erneut laden</NativeButton></WfmWebNotice>}{settings.data?.moduleEnabled === false && <WfmWebNotice>Die eigene Zeiterfassung ist deaktiviert. Ein laufender Arbeitstag kann weiterhin beendet werden.</WfmWebNotice>}
      {error && <WfmWebNotice tone="error">{error}</WfmWebNotice>}{message && <WfmWebNotice tone="success">{message}</WfmWebNotice>}
      {status.data && <NativeSection className="wts-panel"><NativeDiv className="wts-row-head"><NativeH3>Heute</NativeH3><NativeSpan className="wts-badge" data-tone={active ? 'good' : 'muted'}>{status.data.statusLabel}</NativeSpan></NativeDiv><NativeDiv className="wts-grid" style={{ marginTop: 14 }}><NativeDiv><NativeSpan className="wts-muted">Nettozeit</NativeSpan><NativeH3>{duration(session?.netMinutes ?? 0)}</NativeH3></NativeDiv><NativeDiv><NativeSpan className="wts-muted">Pausen</NativeSpan><NativeH3>{duration(session?.pauseMinutes ?? 0)}</NativeH3></NativeDiv><NativeDiv><NativeSpan className="wts-muted">Zeitblöcke</NativeSpan><NativeH3>{status.data.blockCount}</NativeH3></NativeDiv></NativeDiv><NativeP>Die erfasste Zeit wird spätestens beim Aktualisieren neu berechnet.</NativeP>
        <NativeDiv className="wts-filters" style={{ marginTop: 14 }}><NativeLabel className="wts-field">{active ? 'Tätigkeit wechseln' : 'Tätigkeit'}<NativeSelect value={workType} disabled={busy || paused} onChange={e => setWorkType(e.target.value as WfmWorkTypeKey)}>{workTypes.map(type => <NativeOption key={type.key} value={type.key}>{type.label}</NativeOption>)}</NativeSelect></NativeLabel></NativeDiv>
        {!active && settings.data?.requirePrivacyConsent && <NativeLabel className="wts-check"><NativeInput type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy}/>Ich habe verstanden, dass Arbeitszeiten und Tätigkeitsarten gespeichert werden. Arbeitsinhalte werden durch die Zeiterfassung nicht erfasst.</NativeLabel>}
        <NativeDiv className="wts-actions">{!active ? <NativeButton className="wts-primary" disabled={startBlocked} onClick={start}>Arbeitstag starten</NativeButton> : <>
          {paused ? <NativeButton className="wts-primary" disabled={busy || stale || !can('time.tracking.own.resume')} onClick={() => void action(() => wfmResume(tenantId!, userId, roleKey, options), 'Arbeit fortgesetzt.')}>Fortsetzen</NativeButton> : <><NativeButton disabled={busy || stale || !can('time.tracking.own.pause')} onClick={() => void action(() => wfmPause(tenantId!, userId, roleKey, options), 'Pause begonnen.')}>Pause beginnen</NativeButton><NativeButton disabled={busy || stale || !can('time.tracking.own.switch')} onClick={() => void action(() => wfmSwitchWorkType(tenantId!, userId, roleKey, workType, options), 'Tätigkeit gewechselt.')}>Tätigkeit übernehmen</NativeButton></>}
          <NativeButton disabled={busy || stale || !can('time.tracking.own.close')} onClick={async () => { if (await confirmNativeWorkspaceAction('Arbeitstag jetzt beenden?'))
                    void action(() => wfmClockOut(tenantId!, userId, roleKey, options), 'Arbeitstag beendet.'); }}>Feierabend</NativeButton>
        </>}</NativeDiv>
      </NativeSection>}
      {!active && status.data && <NativeSection className="wts-panel"><NativeH3>Büro-Check-in mit Standortcode</NativeH3><NativeP>Nutzen Sie den achtstelligen Code am Empfang. Es gelten dieselben Freigaben und Datenschutzeinstellungen wie beim Arbeitsbeginn.</NativeP><NativeForm className="wts-actions" onSubmit={e => { e.preventDefault(); checkIn(); }}><NativeLabel className="wts-field">Standortcode<NativeInput value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} maxLength={8} autoComplete="off" disabled={busy}/></NativeLabel><NativeButton disabled={startBlocked || code.length !== 8}>Im Büro einchecken</NativeButton></NativeForm></NativeSection>}
      {status.data && <NativeSection className="wts-panel"><NativeH3>Stempelungen heute</NativeH3>{!status.data.events.length && <NativeDiv className="wts-empty">Heute wurden noch keine Stempelungen erfasst.</NativeDiv>}{status.data.events.map(event => <NativeArticle className="wts-row" key={event.id}><NativeStrong>{new Date(event.occurredAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · {labels[event.eventType] ?? 'Zeitstempel'}</NativeStrong>{event.note && <NativeP>{event.note}</NativeP>}</NativeArticle>)}</NativeSection>}
      <NativeSection className="wts-panel"><NativeH3>Gespeicherte Arbeitszeithinweise</NativeH3>{(warnings.error || warnings.refreshError) ? <WfmWebNotice tone="error">{warnings.error || warnings.refreshError}<NativeButton onClick={() => void warnings.refresh()}>Erneut laden</NativeButton></WfmWebNotice> : warnings.loading ? <NativeP>Hinweise werden geladen…</NativeP> : warnings.data?.length ? warnings.data.map(item => <WfmWebNotice key={item.id} tone={item.severity === 'violation' ? 'error' : 'info'}>{item.message}</WfmWebNotice>) : <NativeP>Für heute liegen keine gespeicherten Hinweise vor.</NativeP>}</NativeSection>
      {(can('time.tracking.admin.view') || can('time.tracking.team.view')) && <NativeDiv className="wts-actions"><NativeButton onClick={() => router.push({ pathname: '/business/office/time-tracking/zeitkonten', params: { account: employeeId } })}>Mein Zeitkonto öffnen</NativeButton></NativeDiv>}
    </>}
  </WfmSecondaryWorkspace>;
}
