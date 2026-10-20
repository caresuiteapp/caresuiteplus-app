import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { PlatformModal } from '@/components/layout/platform';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import { getWfmOfficeEmployeeTimeAccounts } from '@/lib/wfm/wfmOfficeZeitkontenService.web';
import { officeMonthLabel, officeMonthPeriod, officePeriodLabel, shiftOfficeMonth } from '@/lib/wfm/wfmOfficeMonth';
import { resolveOfficeTimePeriod } from '@/lib/wfm/wfmOfficeDateRange';
import type { RoleKey } from '@/types';
import type { WfmOfficeEmployeeTimeAccount } from '@/types/modules/wfmOfficeTimekeeping';
import { WfmEmployeeTimeAccountWorkspace } from './WfmEmployeeTimeAccountWorkspace.web';
import { WfmRuleWarningsPanel } from './WfmRuleWarningsPanel';
import type { WfmEditorState } from './WfmOfficeTimeHistoryPanel.web';
import { accountDuration, accountInitials, accountPeriodPreset, accountReviewFilter, accountSort, queryValue, selectTimeAccounts, timeAccountTotals, validAccountMonth } from './wfmTimeAccountsModel.web';
import { wfmTimeAccountsCss } from './wfmTimeAccountsCss.web';
import { berlinWorkDate } from './wfmManualEntryDraft.web';

type Params = { month?: string | string[]; preset?: string | string[]; search?: string | string[]; employee?: string | string[]; employeeId?: string | string[]; review?: string | string[]; sort?: string | string[]; account?: string | string[] };
const cleanEditor: WfmEditorState = { dirty: false, busy: false, childOpen: false };

export function WfmZeitkontenScreen() {
  const auth = useAuth();
  const tenantId = useServiceTenantId()?.trim() ?? '';
  const { roleKey, permissions, can } = usePermissions();
  const reviewerId = auth.user?.id ?? '';
  const allowed = Boolean(auth.authReady && auth.isAuthenticated && tenantId && reviewerId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('time.tracking.team.view'));
  const scopeKey = JSON.stringify([tenantId, reviewerId, roleKey, [...new Set(permissions)].sort()]);
  return <><style>{wfmTimeAccountsCss}</style>{!auth.authReady
    ? <div className="wta wta-state" role="status">Zugang wird geprüft …</div>
    : allowed && roleKey ? <Accounts key={scopeKey} tenantId={tenantId} reviewerId={reviewerId} roleKey={roleKey} scopeKey={scopeKey} canCorrect={can('time.tracking.admin.correct')} canManage={can('office.employee_time.manage')} />
      : <section className="wta wta-state"><h2>Zeitkonten</h2><p>Für die Zeitkonten benötigen Sie einen Verwaltungszugang und die Berechtigung, die Arbeitszeiten des Teams einzusehen.</p></section>}</>;
}

function Accounts({ tenantId, reviewerId, roleKey, scopeKey, canCorrect, canManage }: {
  tenantId: string; reviewerId: string; roleKey: RoleKey; scopeKey: string; canCorrect: boolean; canManage: boolean;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const focused = useIsFocused();
  const params = useLocalSearchParams<Params>();
  const calendarDay = berlinWorkDate();
  const [today, setToday] = useState(calendarDay);
  const currentMonth = today.slice(0, 7);
  const month = validAccountMonth(queryValue(params.month)) ? queryValue(params.month) : currentMonth;
  const preset = accountPeriodPreset(queryValue(params.preset));
  const search = (Array.isArray(params.search) ? params.search[0] ?? '' : params.search ?? '').slice(0, 180);
  const employeeId = queryValue(params.employee) || queryValue(params.employeeId);
  const review = accountReviewFilter(queryValue(params.review));
  const sort = accountSort(queryValue(params.sort));
  const selectedId = queryValue(params.account);
  const [initialTab, setInitialTab] = useState<'overview' | 'bookings'>('overview');
  const [editor, setEditor] = useState<WfmEditorState>(cleanEditor);
  const editorRef = useRef(editor);
  const reportEditor = useCallback((next: WfmEditorState) => { editorRef.current = next; setEditor(next); }, []);
  const [warningsOpen, setWarningsOpen] = useState(false);
  useEffect(() => { if (!selectedId && !editor.dirty && !editor.busy && !editor.childOpen) setToday(calendarDay); }, [calendarDay, selectedId, editor.dirty, editor.busy, editor.childOpen]);
  const period = useMemo(() => preset === 'this_month' ? officeMonthPeriod(month) : resolveOfficeTimePeriod(preset, undefined, undefined, new Date(`${today}T12:00:00`)), [month, preset, today]);
  const periodLabel = preset === 'this_month' ? officeMonthLabel(month) : preset === 'today' ? 'Heute' : 'Diese Woche';
  const query = useAsyncQuery<WfmOfficeEmployeeTimeAccount[]>(
    useCallback(() => getWfmOfficeEmployeeTimeAccounts(tenantId, roleKey, { preset: 'custom', fromDate: period.fromDate, toDate: period.toDate }), [tenantId, roleKey, period.fromDate, period.toDate]),
    [scopeKey, period.fromDate, period.toDate],
    { queryKey: `office-accounts:${scopeKey}:${period.fromDate}:${period.toDate}`, refreshOnAppFocus: false,
      live: { enabled: focused && !editor.dirty && !editor.busy && !editor.childOpen, tenantId, subscribe: subscribeToWfmLiveChanges, pollMs: 30000, refreshOnFocus: true } },
  );
  const previousFocus = useRef(focused);
  useEffect(() => { if (focused && !previousFocus.current && !editor.dirty && !editor.busy) void query.refresh(); previousFocus.current = focused; }, [focused, editor.dirty, editor.busy, query.refresh]);
  function allowLeave(): boolean {
    if (editorRef.current.busy || editorRef.current.childOpen) return false;
    if (editorRef.current.dirty && !window.confirm('Ungespeicherte Änderungen am Zeitkonto verwerfen?')) return false;
    reportEditor(cleanEditor);
    return true;
  }
  usePreventRemove(editor.dirty || editor.busy || editor.childOpen, ({ data }) => { if (allowLeave()) navigation.dispatch(data.action); });
  useEffect(() => {
    if (!editor.dirty && !editor.busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [editor.dirty, editor.busy]);
  const all = query.data ?? [];
  const accounts = useMemo(() => selectTimeAccounts(all, { search, employeeId, review, sort }), [query.data, search, employeeId, review, sort]);
  const totals = timeAccountTotals(accounts);
  const selected = all.find(account => account.employeeId === selectedId);
  const hasData = query.data !== null;
  const busy = query.loading || query.refreshing;
  const activeFilters = Boolean(search || employeeId || review !== 'all');
  const error = query.error || query.refreshError;
  function updateParams(next: Record<string, string | undefined>) {
    if (!focused || !allowLeave()) return;
    router.setParams({ ...next, ...('employee' in next ? { employeeId: undefined } : {}), account: undefined });
  }
  function selectAccount(account: WfmOfficeEmployeeTimeAccount, tab: 'overview' | 'bookings' = 'overview') {
    if (!focused || !allowLeave()) return;
    setInitialTab(tab);
    router.setParams({ account: account.employeeId });
  }
  function closeAccount() {
    if (!focused || editorRef.current.busy || editorRef.current.childOpen) return;
    reportEditor(cleanEditor);
    router.setParams({ account: undefined });
  }
  function navigate(pathname: string) {
    if (!focused || !allowLeave()) return;
    const reviewRange = pathname.endsWith('/pruefqueue') || pathname.endsWith('/historie')
      ? { preset: 'custom', from: period.fromDate, to: period.toDate } : {};
    router.push({ pathname, params: { month: period.fromDate.slice(0, 7), ...reviewRange, ...(employeeId ? { employeeId } : {}) } } as never);
  }
  return <section className="wta wta-stack" data-testid="wfm-zeitkonten-screen" data-worktime-accounts="20261018">
    <div className="wta-heading">
      <div><h2>Zeitkonten</h2><p>{periodLabel} · {officePeriodLabel(period)}</p></div>
      <div className="wta-actions"><button type="button" className="wta-link wta-live-link" onClick={() => navigate('/business/office/time-tracking/live')}>Team heute ansehen</button><button type="button" className="wta-button" disabled={busy || editor.busy} onClick={() => void query.refresh()}>{busy ? 'Wird geladen …' : 'Aktualisieren'}</button></div>
    </div>
    <div className="wta-toolbar">
      <div className="wta-segments" role="group" aria-label="Zeitraum">
        {([{ key: 'today', label: 'Heute' }, { key: 'this_week', label: 'Diese Woche' }, { key: 'this_month', label: 'Monat' }] as const).map(item => <button key={item.key} type="button" aria-pressed={preset === item.key} onClick={() => updateParams({ preset: item.key, month })}>{item.label}</button>)}
      </div>
      {preset === 'this_month' ? <div className="wta-period">
        <button type="button" className="wta-button" data-icon="true" aria-label="Vorheriger Monat" disabled={!validAccountMonth(shiftOfficeMonth(month, -1))} onClick={() => updateParams({ month: shiftOfficeMonth(month, -1) })}>‹</button>
        <label className="wta-field wta-month"><input type="month" aria-label="Monat auswählen" value={month} min="1900-01" max="2199-12" onChange={event => { if (validAccountMonth(event.target.value)) updateParams({ month: event.target.value }); }} /></label>
        <button type="button" className="wta-button" data-icon="true" aria-label="Nächster Monat" disabled={!validAccountMonth(shiftOfficeMonth(month, 1))} onClick={() => updateParams({ month: shiftOfficeMonth(month, 1) })}>›</button>
        {month !== currentMonth ? <button type="button" className="wta-link" onClick={() => updateParams({ month: currentMonth })}>Aktueller Monat</button> : null}
      </div> : null}
    </div>
    <div className="wta-filters" role="search" aria-label="Zeitkonten filtern">
      <label className="wta-field"><span>Name suchen</span><input type="search" value={search} maxLength={180} placeholder="Vor- oder Nachname" onChange={event => updateParams({ search: event.target.value || undefined })} /></label>
      <label className="wta-field"><span>Mitarbeitende</span><select value={employeeId} onChange={event => updateParams({ employee: event.target.value || undefined })}><option value="">Alle Mitarbeitenden</option>{employeeId && !all.some(account => account.employeeId === employeeId) ? <option value={employeeId}>Ausgewählte Person nicht verfügbar</option> : null}{all.map(account => <option key={account.employeeId} value={account.employeeId}>{account.employeeName}</option>)}</select></label>
      <label className="wta-field"><span>Prüfstand</span><select value={review} onChange={event => updateParams({ review: event.target.value === 'all' ? undefined : event.target.value })}><option value="all">Alle Zeitkonten</option><option value="open">Mit offenen Prüfungen</option><option value="negative">Mit negativem Saldo</option></select></label>
      <label className="wta-field"><span>Sortierung</span><select value={sort} onChange={event => updateParams({ sort: event.target.value === 'name' ? undefined : event.target.value })}><option value="name">Name A–Z</option><option value="reviews">Offene Prüfungen zuerst</option><option value="balance">Saldo aufsteigend</option></select></label>
    </div>
    {error ? <div className="wta-message" data-tone={hasData ? 'warning' : 'error'} role="alert"><div><strong>{hasData ? 'Aktualisierung fehlgeschlagen' : 'Zeitkonten konnten nicht geladen werden'}</strong><p>{hasData ? 'Die Daten stammen vom letzten erfolgreichen Abruf. ' : ''}{error}</p></div><button type="button" className="wta-button" disabled={busy} onClick={() => void query.refresh()}>Erneut laden</button></div> : null}
    {busy && hasData ? <div className="wta-loading" role="status" aria-label="Zeitkonten werden aktualisiert" /> : null}
    {hasData ? <>
      <div className="wta-kpis" aria-label="Summen der angezeigten Zeitkonten">
        <div className="wta-kpi"><span>Sollzeit</span><strong>{accountDuration(totals.targetMinutes)}</strong><small>{totals.employees} {totals.employees === 1 ? 'Person' : 'Personen'} im Filter</small></div>
        <div className="wta-kpi"><span>Istzeit</span><strong>{accountDuration(totals.actualMinutes)}</strong><small>Erfasste Arbeitszeit</small></div>
        <div className="wta-kpi"><span>Genehmigt</span><strong>{accountDuration(totals.approvedMinutes)}</strong><small>Freigegebene Arbeitszeit</small></div>
        <div className="wta-kpi" data-tone={totals.saldoMinutes < 0 ? 'warning' : 'good'}><span>Saldo im Zeitraum</span><strong>{accountDuration(totals.saldoMinutes, true)}</strong><small>Mit {accountDuration(totals.absenceMinutes)} Abwesenheit</small></div>
        <div className="wta-kpi" data-tone={totals.openReviews > 0 ? 'warning' : undefined}><span>Offene Prüfungen</span><strong>{totals.openReviews.toLocaleString('de-DE')}</strong><button type="button" className="wta-link" onClick={() => navigate('/business/office/time-tracking/pruefqueue')}>Prüfbereich öffnen →</button></div>
      </div>
      <div className="wta-filterline"><span>{accounts.length} von {all.length} Zeitkonten · Summen beziehen sich auf die angezeigten Personen.</span>{activeFilters ? <button type="button" className="wta-link" onClick={() => updateParams({ search: undefined, employee: undefined, review: undefined })}>Filter zurücksetzen</button> : null}</div>
    </> : null}
    <div className="wta-table-panel" aria-busy={busy}>
      <div className="wta-table-heading"><h3>Arbeitszeiten im Überblick</h3><span className="wta-muted">Alle Zeitangaben in Stunden : Minuten</span></div>
      {!hasData && busy ? <div className="wta-skeletons" role="status" aria-label="Zeitkonten werden geladen"><div className="wta-skeleton" /><div className="wta-skeleton" /><div className="wta-skeleton" /></div>
        : !hasData && error ? <div className="wta-state"><h3>Keine bestätigten Daten verfügbar</h3><p>Bitte laden Sie die Zeitkonten erneut.</p></div>
          : accounts.length === 0 ? <div className="wta-state"><h3>{activeFilters ? 'Keine passenden Zeitkonten' : 'Noch keine Zeitkonten vorhanden'}</h3><p>{activeFilters ? 'Passen Sie die Suche oder den Prüfstand an.' : 'Für diesen Zeitraum sind keine Mitarbeitenden mit Zeitkontodaten verfügbar.'}</p>{activeFilters ? <button type="button" className="wta-button" onClick={() => updateParams({ search: undefined, employee: undefined, review: undefined })}>Filter zurücksetzen</button> : null}</div>
            : <div className="wta-table-scroll" role="region" aria-label="Zeitkonten, bei Bedarf horizontal scrollbar" tabIndex={0}><table className="wta-table">
              <thead><tr><th scope="col">Mitarbeitende</th><th scope="col">Soll</th><th scope="col">Ist</th><th scope="col">Genehmigt</th><th scope="col">Abwesenheit</th><th scope="col">Saldo</th><th scope="col">Prüfung</th><th scope="col">Details</th></tr></thead>
              <tbody>{accounts.map(account => <tr key={account.employeeId} data-selected={selectedId === account.employeeId}>
                <td><div className="wta-person"><span className="wta-avatar" aria-hidden="true">{accountInitials(account.employeeName)}</span><div className="wta-person-copy"><button type="button" className="wta-link" onClick={() => selectAccount(account)}>{account.employeeName}</button><small>{account.targetSource === 'contract' ? 'Soll aus Vertrag' : account.targetSource === 'saved_account' ? 'Gespeicherte Sollzeit' : account.targetSource === 'planned' ? 'Soll aus Planung' : `${account.entries.length} Zeitbuchungen`}</small></div></div></td>
                <td>{accountDuration(account.targetMinutes)}</td><td>{accountDuration(account.actualMinutes)}</td><td>{accountDuration(account.approvedMinutes)}</td><td>{accountDuration(account.absenceMinutes)}</td><td><span className="wta-saldo" data-negative={account.saldoMinutes < 0}>{accountDuration(account.saldoMinutes, true)}</span></td>
                <td>{account.openReviewCount > 0 ? <button type="button" className="wta-link" aria-label={`${account.openReviewCount} offene Prüfungen für ${account.employeeName}`} onClick={() => selectAccount(account, 'bookings')}><span className="wta-badge" data-tone="warning">{account.openReviewCount} offen</span></button> : <span className="wta-badge">Keine offenen</span>}</td>
                <td><button type="button" className="wta-button" aria-label={`Zeitkonto von ${account.employeeName} öffnen`} onClick={() => selectAccount(account)}>Öffnen</button></td>
              </tr>)}</tbody>
            </table></div>}
    </div>
    <p className="wta-footnote">Saldo = Istzeit + gutgeschriebene Abwesenheit − Sollzeit des gewählten Zeitraums. Für einen laufenden Monat ist die gesamte Monatssollzeit enthalten. Die Einzelansicht zeigt Fahrzeit, Urlaub, Buchungen und Monatsabschlüsse.</p>
    <details className="wta-disclosure" open={warningsOpen} onToggle={event => setWarningsOpen(event.currentTarget.open)}><summary>Arbeitszeit-Hinweise für heute</summary>{warningsOpen ? <div className="wta-disclosure-body"><WfmRuleWarningsPanel tenantId={tenantId} userId={reviewerId} roleKey={roleKey} teamView compact /></div> : null}</details>
    <div className="wta-workflow"><p>Vor dem Monatsabschluss offene Zeiten prüfen und Abwesenheiten freigeben. Anschließend die Gehaltsstatistik für den gewählten Monat öffnen.</p><button type="button" className="wta-button" onClick={() => navigate('/business/office/payroll')}>Zur Gehaltsstatistik →</button></div>
    <PlatformModal visible={Boolean(selectedId)} title={selected ? `Zeitkonto · ${selected.employeeName}` : 'Zeitkonto'} subtitle={`${periodLabel} · ${officePeriodLabel(period)}`} maxWidth={1320} minWidth={280} maxHeightRatio={0.94} surfaceScope="company" dismissOnBackdrop={false} isDirty={editor.dirty && !editor.childOpen} onClose={closeAccount} bodyStyle={{ padding: 14, backgroundColor: '#f3f7fc' }}>
      {error && hasData ? <div className="wta"><div className="wta-message" data-tone="warning" role="alert">Die Aktualisierung ist fehlgeschlagen. Angezeigt wird der letzte erfolgreiche Stand. {error}</div></div> : null}
      {selected ? <WfmEmployeeTimeAccountWorkspace key={`${selected.employeeId}:${period.fromDate}:${period.toDate}`} account={selected} tenantId={tenantId} reviewerId={reviewerId} roleKey={roleKey} canCorrect={canCorrect} canManage={canManage} periodLabel={periodLabel} period={period} initialTab={initialTab} onChanged={query.refresh} onEditorStateChange={reportEditor} onClose={closeAccount} />
        : <div className="wta wta-state"><h3>{busy ? 'Zeitkonto wird geladen …' : 'Zeitkonto nicht verfügbar'}</h3><p>{busy ? 'Die Daten werden für den gewählten Zeitraum abgerufen.' : 'Die ausgewählte Person ist in diesem Zeitraum nicht verfügbar. Bitte schließen Sie die Ansicht und prüfen Sie den Zeitraum.'}</p></div>}
    </PlatformModal>
  </section>;
}

export function TimeTrackingTeamScreen() { return <WfmZeitkontenScreen />; }
