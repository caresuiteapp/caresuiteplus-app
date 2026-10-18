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
import { todayWorkDate, resolveEmployeeIdForUser } from '@/lib/wfm/wfmWorkSessionRepository';
import type { ServiceResult } from '@/types';
import type { WfmWorkTypeKey } from '@/types/modules/wfm';
import { WfmSecondaryWorkspace, WfmWebNotice, useWfmUnsavedChanges } from './WfmSecondaryWorkspace.web';

const workTypes = listWfmWorkTypesForClockIn();
const labels: Record<string, string> = { clock_in: 'Arbeitsbeginn', clock_out: 'Feierabend', pause_start: 'Pause begonnen', pause_end: 'Pause beendet', homeoffice_start: 'Homeoffice begonnen', homeoffice_end: 'Homeoffice beendet', office_check_in: 'Im Büro eingecheckt', office_check_out: 'Büro verlassen', visit_started: 'Einsatz begonnen', visit_ended: 'Einsatz beendet', standby_start: 'Bereitschaft', training_start: 'Fortbildung', meeting_start: 'Besprechung', meeting_end: 'Besprechung beendet', travel_start: 'Fahrt begonnen', travel_end: 'Fahrt beendet', work_type_switch: 'Tätigkeit gewechselt' };
const duration = (minutes: number | undefined) => minutes == null || !Number.isFinite(minutes) ? '—' : `${Math.floor(Math.max(0, Math.round(minutes)) / 60)} Std. ${Math.max(0, Math.round(minutes)) % 60} Min.`;

export function WfmOwnTimeTrackingScreen() {
  const tenantId = useServiceTenantId(); const { user, profile } = useAuth(); const userId = user?.id ?? profile?.id ?? ''; const knownEmployeeId = profile?.employeeId ?? null;
  const { can, check, roleKey } = usePermissions(); const canView = can('time.tracking.own.view'); const focused = useIsFocused(); const router = useRouter();
  const identityScope = `${tenantId}:${userId}:${knownEmployeeId}:${roleKey}:${canView}`;
  const employeeQuery = useAsyncQuery(useCallback(() => resolveEmployeeIdForUser(tenantId!, userId, knownEmployeeId), [tenantId, userId, knownEmployeeId]), [tenantId, userId, knownEmployeeId], { enabled: !!tenantId && !!userId && canView, queryKey: identityScope });
  const employeeId = employeeQuery.data;
  const scope = `${identityScope}:${employeeId}`; const scopeRef = useRef(scope); scopeRef.current = scope;
  const options = useMemo(() => ({ employeeId, source: 'office' as const }), [employeeId]);
  const [workType, setWorkType] = useState<WfmWorkTypeKey>('buero'); const [consent, setConsent] = useState(false); const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false); const lock = useRef(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useWfmUnsavedChanges(false, busy);
  useEffect(() => { setConsent(false); setCode(''); setWorkType('buero'); setMessage(''); setError(''); setBusy(false); lock.current = false; }, [scope]);
  const ready = !!tenantId && !!userId && !!employeeId && canView && !employeeQuery.error && !employeeQuery.refreshError;
  const status = useAsyncQuery(useCallback(() => getWfmTodayStatus(tenantId!, userId, roleKey, options), [tenantId, userId, roleKey, options]), [tenantId, userId, roleKey, options], { enabled: ready, queryKey: scope });
  const settings = useAsyncQuery(useCallback(() => fetchPortalTimeTrackingSettings(tenantId!, roleKey), [tenantId, roleKey]), [tenantId, roleKey], { enabled: ready, queryKey: `${scope}:settings` });
  const warnings = useAsyncQuery(useCallback(() => listWfmRuleViolationsForDate(tenantId!, roleKey, todayWorkDate(), { employeeId }), [tenantId, roleKey, employeeId]), [tenantId, roleKey, employeeId], { enabled: ready, queryKey: `${scope}:warnings` });
  const refreshStatus = status.refresh; const refreshSettings = settings.refresh;
  useEffect(() => {
    if (!focused || !ready) return;
    void refreshStatus(); void refreshSettings();
    const timer = window.setInterval(() => { if (!lock.current) void refreshStatus(); }, 60000);
    return () => window.clearInterval(timer);
  }, [focused, ready, refreshStatus, refreshSettings]);
  const session = status.data?.session ?? null; const active = isWfmSessionActive(session); const paused = isWfmSessionPaused(session);
  const stale = status.loading || !!status.error || !!status.refreshError;
  const startBlocked = busy || stale || settings.loading || !!settings.error || !!settings.refreshError || !settings.data?.moduleEnabled || (!!settings.data?.requirePrivacyConsent && !consent) || !can('time.tracking.own.start');
  const action = async (operation: () => Promise<ServiceResult<unknown>>, success: string) => {
    if (lock.current || !ready || stale) return;
    const requestedScope = scope; lock.current = true; setBusy(true); setMessage(''); setError('');
    try {
      const result = await operation(); if (scopeRef.current !== requestedScope) return;
      if (!result.ok) { setError(result.error); return; }
      setMessage(success); setCode(''); await Promise.all([status.refresh(), warnings.refresh()]);
    } catch (cause) { if (scopeRef.current === requestedScope) setError(cause instanceof Error ? cause.message : 'Die Buchung konnte nicht gespeichert werden.'); }
    finally { if (scopeRef.current === requestedScope) { lock.current = false; setBusy(false); } }
  };
  const start = () => { if (!startBlocked) void action(() => wfmClockIn(tenantId!, userId, roleKey, workType, options), 'Arbeitstag gestartet.'); };
  const checkIn = () => { if (!startBlocked && /^[A-Z0-9]{8}$/.test(code)) void action(() => wfmOfficeCheckInByToken(tenantId!, userId, roleKey, code, { employeeId }), 'Im Büro eingecheckt.'); };
  return <WfmSecondaryWorkspace title="Eigene Erfassung" description="Arbeitsbeginn, Pausen und Tätigkeiten für Ihren Arbeitstag." actions={<button disabled={!ready || busy || status.refreshing} onClick={() => void Promise.all([status.refresh(), settings.refresh(), warnings.refresh()])}>Aktualisieren</button>}>
    {!canView ? <WfmWebNotice>{check('time.tracking.own.view').reason ?? 'Keine Berechtigung.'}</WfmWebNotice> : employeeQuery.loading ? <WfmWebNotice>Mitarbeiterzuordnung wird geprüft…</WfmWebNotice> : !employeeId || employeeQuery.error || employeeQuery.refreshError ? <section className="wts-panel"><h3>Mitarbeiterzuordnung prüfen</h3><WfmWebNotice tone="error">{employeeQuery.error || employeeQuery.refreshError || 'Es ist kein Mitarbeiterprofil verknüpft.'}<button onClick={() => void employeeQuery.refresh()}>Erneut prüfen</button></WfmWebNotice><p>Für Ihre persönliche Stempeluhr benötigt Ihr Zugang ein Mitarbeiterprofil. Die Verwaltung des Teams bleibt über die freigegebenen Zeitkonten erreichbar.</p>{(can('time.tracking.admin.view') || can('time.tracking.team.view')) && <div className="wts-actions"><button onClick={() => router.push('/business/office/time-tracking/zeitkonten')}>Zeitkonten öffnen</button></div>}</section> : <>
      {status.loading && <WfmWebNotice>Arbeitstag wird geladen…</WfmWebNotice>}{(status.error || status.refreshError) && <WfmWebNotice tone="error">{status.error || status.refreshError}</WfmWebNotice>}
      {(settings.error || settings.refreshError) && <WfmWebNotice tone="error">{settings.error || settings.refreshError}<button onClick={() => void settings.refresh()}>Einstellungen erneut laden</button></WfmWebNotice>}{settings.data?.moduleEnabled === false && <WfmWebNotice>Die eigene Zeiterfassung ist deaktiviert. Ein laufender Arbeitstag kann weiterhin beendet werden.</WfmWebNotice>}
      {error && <WfmWebNotice tone="error">{error}</WfmWebNotice>}{message && <WfmWebNotice tone="success">{message}</WfmWebNotice>}
      {status.data && <section className="wts-panel"><div className="wts-row-head"><h3>Heute</h3><span className="wts-badge" data-tone={active ? 'good' : 'muted'}>{status.data.statusLabel}</span></div><div className="wts-grid" style={{ marginTop: 14 }}><div><span className="wts-muted">Nettozeit</span><h3>{duration(session?.netMinutes ?? 0)}</h3></div><div><span className="wts-muted">Pausen</span><h3>{duration(session?.pauseMinutes ?? 0)}</h3></div><div><span className="wts-muted">Zeitblöcke</span><h3>{status.data.blockCount}</h3></div></div><p>Die erfasste Zeit wird spätestens beim Aktualisieren neu berechnet.</p>
        <div className="wts-filters" style={{ marginTop: 14 }}><label className="wts-field">{active ? 'Tätigkeit wechseln' : 'Tätigkeit'}<select value={workType} disabled={busy || paused} onChange={e => setWorkType(e.target.value as WfmWorkTypeKey)}>{workTypes.map(type => <option key={type.key} value={type.key}>{type.label}</option>)}</select></label></div>
        {!active && settings.data?.requirePrivacyConsent && <label className="wts-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy} />Ich habe verstanden, dass Arbeitszeiten und Tätigkeitsarten gespeichert werden. Arbeitsinhalte werden durch die Zeiterfassung nicht erfasst.</label>}
        <div className="wts-actions">{!active ? <button className="wts-primary" disabled={startBlocked} onClick={start}>Arbeitstag starten</button> : <>
          {paused ? <button className="wts-primary" disabled={busy || stale || !can('time.tracking.own.resume')} onClick={() => void action(() => wfmResume(tenantId!, userId, roleKey, options), 'Arbeit fortgesetzt.')}>Fortsetzen</button> : <><button disabled={busy || stale || !can('time.tracking.own.pause')} onClick={() => void action(() => wfmPause(tenantId!, userId, roleKey, options), 'Pause begonnen.')}>Pause beginnen</button><button disabled={busy || stale || !can('time.tracking.own.switch')} onClick={() => void action(() => wfmSwitchWorkType(tenantId!, userId, roleKey, workType, options), 'Tätigkeit gewechselt.')}>Tätigkeit übernehmen</button></>}
          <button disabled={busy || stale || !can('time.tracking.own.close')} onClick={() => { if (window.confirm('Arbeitstag jetzt beenden?')) void action(() => wfmClockOut(tenantId!, userId, roleKey, options), 'Arbeitstag beendet.'); }}>Feierabend</button>
        </>}</div>
      </section>}
      {!active && status.data && <section className="wts-panel"><h3>Büro-Check-in mit Standortcode</h3><p>Nutzen Sie den achtstelligen Code am Empfang. Es gelten dieselben Freigaben und Datenschutzeinstellungen wie beim Arbeitsbeginn.</p><form className="wts-actions" onSubmit={e => { e.preventDefault(); checkIn(); }}><label className="wts-field">Standortcode<input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} maxLength={8} autoComplete="off" disabled={busy} /></label><button disabled={startBlocked || code.length !== 8}>Im Büro einchecken</button></form></section>}
      {status.data && <section className="wts-panel"><h3>Stempelungen heute</h3>{!status.data.events.length && <div className="wts-empty">Heute wurden noch keine Stempelungen erfasst.</div>}{status.data.events.map(event => <article className="wts-row" key={event.id}><strong>{new Date(event.occurredAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · {labels[event.eventType] ?? 'Zeitstempel'}</strong>{event.note && <p>{event.note}</p>}</article>)}</section>}
      <section className="wts-panel"><h3>Gespeicherte Arbeitszeithinweise</h3>{(warnings.error || warnings.refreshError) ? <WfmWebNotice tone="error">{warnings.error || warnings.refreshError}<button onClick={() => void warnings.refresh()}>Erneut laden</button></WfmWebNotice> : warnings.loading ? <p>Hinweise werden geladen…</p> : warnings.data?.length ? warnings.data.map(item => <WfmWebNotice key={item.id} tone={item.severity === 'violation' ? 'error' : 'info'}>{item.message}</WfmWebNotice>) : <p>Für heute liegen keine gespeicherten Hinweise vor.</p>}</section>
      {(can('time.tracking.admin.view') || can('time.tracking.team.view')) && <div className="wts-actions"><button onClick={() => router.push({ pathname: '/business/office/time-tracking/zeitkonten', params: { account: employeeId } })}>Mein Zeitkonto öffnen</button></div>}
    </>}
  </WfmSecondaryWorkspace>;
}
