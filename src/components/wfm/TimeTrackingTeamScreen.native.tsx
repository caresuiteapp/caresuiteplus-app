// Generated native presentation from src/components/wfm/TimeTrackingTeamScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeStyle,NativeDiv,NativeSection,NativeH2,NativeP,NativeButton,NativeLabel,NativeInput,NativeSpan,NativeSelect,NativeOption,NativeStrong,NativeSmall,NativeH3,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeDetails,NativeSummary,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from "@/hooks/useNativePreventRemove.native";
import { PlatformModal } from '@/components/layout/platform';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import { getWfmOfficeEmployeeTimeAccounts } from "../../lib/wfm/wfmOfficeZeitkontenService.native.ts";
import { officeMonthLabel, officeMonthPeriod, officePeriodLabel, shiftOfficeMonth } from '@/lib/wfm/wfmOfficeMonth';
import { resolveOfficeTimePeriod } from '@/lib/wfm/wfmOfficeDateRange';
import type { RoleKey } from '@/types';
import type { WfmOfficeEmployeeTimeAccount } from '@/types/modules/wfmOfficeTimekeeping';
import { WfmEmployeeTimeAccountWorkspace } from "./WfmEmployeeTimeAccountWorkspace.native.tsx";
import { WfmRuleWarningsPanel } from './WfmRuleWarningsPanel';
import type { WfmEditorState } from "./WfmOfficeTimeHistoryPanel.native.tsx";
import { accountDuration, accountInitials, accountPeriodPreset, accountReviewFilter, accountSort, queryValue, selectTimeAccounts, timeAccountTotals, validAccountMonth } from "./wfmTimeAccountsModel.native.ts";
import { wfmTimeAccountsCss } from "./wfmTimeAccountsCss.native.ts";
import { berlinWorkDate } from "./wfmManualEntryDraft.native.ts";
type Params = {
    month?: string | string[];
    preset?: string | string[];
    search?: string | string[];
    employee?: string | string[];
    employeeId?: string | string[];
    review?: string | string[];
    sort?: string | string[];
    account?: string | string[];
};
const cleanEditor: WfmEditorState = { dirty: false, busy: false, childOpen: false };
export function WfmZeitkontenScreen() {
    const auth = useAuth();
    const tenantId = useServiceTenantId()?.trim() ?? '';
    const { roleKey, permissions, can } = usePermissions();
    const reviewerId = auth.user?.id ?? '';
    const allowed = Boolean(auth.authReady && auth.isAuthenticated && tenantId && reviewerId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('time.tracking.team.view'));
    const scopeKey = JSON.stringify([tenantId, reviewerId, roleKey, [...new Set(permissions)].sort()]);
    return <NativeWorkspaceStyleScope css={[wfmTimeAccountsCss, wfmTimeAccountsCss]}>{<><NativeStyle>{wfmTimeAccountsCss}</NativeStyle>{!auth.authReady
            ? <NativeDiv className="wta wta-state" role="status">Zugang wird geprüft …</NativeDiv>
            : allowed && roleKey ? <Accounts key={scopeKey} tenantId={tenantId} reviewerId={reviewerId} roleKey={roleKey} scopeKey={scopeKey} canCorrect={can('time.tracking.admin.correct')} canManage={can('office.employee_time.manage')}/>
                : <NativeSection className="wta wta-state"><NativeH2>Zeitkonten</NativeH2><NativeP>Für die Zeitkonten benötigen Sie einen Verwaltungszugang und die Berechtigung, die Arbeitszeiten des Teams einzusehen.</NativeP></NativeSection>}</>}</NativeWorkspaceStyleScope>;
}
function Accounts({ tenantId, reviewerId, roleKey, scopeKey, canCorrect, canManage }: {
    tenantId: string;
    reviewerId: string;
    roleKey: RoleKey;
    scopeKey: string;
    canCorrect: boolean;
    canManage: boolean;
}) {
    const window = useNativeWorkflowWindow();
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
    const [editor, setEditor] = useState<WfmEditorState>(cleanEditor);
    const editorRef = useRef(editor);
    const reportEditor = useCallback((next: WfmEditorState) => { editorRef.current = next; setEditor(next); }, []);
    const [warningsOpen, setWarningsOpen] = useState(false);
    useEffect(() => { if (!selectedId && !editor.dirty && !editor.busy && !editor.childOpen)
        setToday(calendarDay); }, [calendarDay, selectedId, editor.dirty, editor.busy, editor.childOpen]);
    const period = useMemo(() => preset === 'this_month' ? officeMonthPeriod(month) : resolveOfficeTimePeriod(preset, undefined, undefined, new Date(`${today}T12:00:00`)), [month, preset, today]);
    const periodLabel = preset === 'this_month' ? officeMonthLabel(month) : preset === 'today' ? 'Heute' : 'Diese Woche';
    const query = useAsyncQuery<WfmOfficeEmployeeTimeAccount[]>(useCallback(() => getWfmOfficeEmployeeTimeAccounts(tenantId, roleKey, { preset: 'custom', fromDate: period.fromDate, toDate: period.toDate }), [tenantId, roleKey, period.fromDate, period.toDate]), [scopeKey, period.fromDate, period.toDate], { queryKey: `office-accounts:${scopeKey}:${period.fromDate}:${period.toDate}`, refreshOnAppFocus: false,
        live: { enabled: focused && !editor.dirty && !editor.busy && !editor.childOpen, tenantId, subscribe: subscribeToWfmLiveChanges, pollMs: 30000, refreshOnFocus: true } });
    const previousFocus = useRef(focused);
    useEffect(() => { if (focused && !previousFocus.current && !editor.dirty && !editor.busy)
        void query.refresh(); previousFocus.current = focused; }, [focused, editor.dirty, editor.busy, query.refresh]);
    async function allowLeave(): Promise<boolean> {
        if (editorRef.current.busy || editorRef.current.childOpen)
            return false;
        if (editorRef.current.dirty && !await confirmNativeWorkspaceAction('Ungespeicherte Änderungen am Zeitkonto verwerfen?'))
            return false;
        reportEditor(cleanEditor);
        return true;
    }
    usePreventRemove(editor.dirty || editor.busy || editor.childOpen, async ({ data }) => { if (await allowLeave())
        navigation.dispatch(data.action); });
    useEffect(() => {
        if (!editor.dirty && !editor.busy)
            return;
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
    async function updateParams(next: Record<string, string | undefined>) {
        if (!focused || !await allowLeave())
            return;
        router.setParams({ ...next, ...('employee' in next ? { employeeId: undefined } : {}), account: undefined });
    }
    async function selectAccount(account: WfmOfficeEmployeeTimeAccount) {
        if (!focused || !await allowLeave())
            return;
        router.setParams({ account: account.employeeId });
    }
    function closeAccount() {
        if (!focused || editorRef.current.busy || editorRef.current.childOpen)
            return;
        reportEditor(cleanEditor);
        router.setParams({ account: undefined });
    }
    async function navigate(pathname: string, selectedEmployeeId = employeeId) {
        if (!focused || !await allowLeave())
            return;
        const reviewRange = pathname.endsWith('/pruefqueue') || pathname.endsWith('/historie')
            ? { preset: 'custom', from: period.fromDate, to: period.toDate } : {};
        router.push({ pathname, params: { month: period.fromDate.slice(0, 7), ...reviewRange, ...(pathname.endsWith('/pruefqueue') ? { filter: 'pending' } : {}), ...(selectedEmployeeId ? { employeeId: selectedEmployeeId } : {}) } } as never);
    }
    return <NativeWorkspaceStyleScope css={[wfmTimeAccountsCss]}>{<NativeSection className="wta wta-stack" data-testid="wfm-zeitkonten-screen" data-worktime-accounts="20261018">
    <NativeDiv className="wta-heading">
      <NativeDiv><NativeH2>Zeitkonten</NativeH2><NativeP>{periodLabel} · {officePeriodLabel(period)}</NativeP></NativeDiv>
      <NativeDiv className="wta-actions"><NativeButton type="button" className="wta-link wta-live-link" onClick={async () => await navigate('/business/office/time-tracking/live')}>Team heute ansehen</NativeButton><NativeButton type="button" className="wta-button" disabled={busy || editor.busy} onClick={() => void query.refresh()}>{busy ? 'Wird geladen …' : 'Aktualisieren'}</NativeButton></NativeDiv>
    </NativeDiv>
    <NativeDiv className="wta-toolbar">
      <NativeDiv className="wta-segments" role="group" aria-label="Zeitraum">
        {([{ key: 'today', label: 'Heute' }, { key: 'this_week', label: 'Diese Woche' }, { key: 'this_month', label: 'Monat' }] as const).map(item => <NativeButton key={item.key} type="button" aria-pressed={preset === item.key} onClick={async () => await updateParams({ preset: item.key, month })}>{item.label}</NativeButton>)}
      </NativeDiv>
      {preset === 'this_month' ? <NativeDiv className="wta-period">
        <NativeButton type="button" className="wta-button" data-icon="true" aria-label="Vorheriger Monat" disabled={!validAccountMonth(shiftOfficeMonth(month, -1))} onClick={async () => await updateParams({ month: shiftOfficeMonth(month, -1) })}>‹</NativeButton>
        <NativeLabel className="wta-field wta-month"><NativeInput type="month" aria-label="Monat auswählen" value={month} min="1900-01" max="2199-12" onChange={async (event) => { if (validAccountMonth(event.target.value))
            await updateParams({ month: event.target.value }); }}/></NativeLabel>
        <NativeButton type="button" className="wta-button" data-icon="true" aria-label="Nächster Monat" disabled={!validAccountMonth(shiftOfficeMonth(month, 1))} onClick={async () => await updateParams({ month: shiftOfficeMonth(month, 1) })}>›</NativeButton>
        {month !== currentMonth ? <NativeButton type="button" className="wta-link" onClick={async () => await updateParams({ month: currentMonth })}>Aktueller Monat</NativeButton> : null}
      </NativeDiv> : null}
    </NativeDiv>
    <NativeDiv className="wta-filters" role="search" aria-label="Zeitkonten filtern">
      <NativeLabel className="wta-field"><NativeSpan>Name suchen</NativeSpan><NativeInput type="search" value={search} maxLength={180} placeholder="Vor- oder Nachname" onChange={async (event) => await updateParams({ search: event.target.value || undefined })}/></NativeLabel>
      <NativeLabel className="wta-field"><NativeSpan>Mitarbeitende</NativeSpan><NativeSelect value={employeeId} onChange={async (event) => await updateParams({ employee: event.target.value || undefined })}><NativeOption value="">Alle Mitarbeitenden</NativeOption>{employeeId && !all.some(account => account.employeeId === employeeId) ? <NativeOption value={employeeId}>Ausgewählte Person nicht verfügbar</NativeOption> : null}{all.map(account => <NativeOption key={account.employeeId} value={account.employeeId}>{account.employeeName}</NativeOption>)}</NativeSelect></NativeLabel>
      <NativeLabel className="wta-field"><NativeSpan>Prüfstand</NativeSpan><NativeSelect value={review} onChange={async (event) => await updateParams({ review: event.target.value === 'all' ? undefined : event.target.value })}><NativeOption value="all">Alle Zeitkonten</NativeOption><NativeOption value="open">Mit offenen Prüfungen</NativeOption><NativeOption value="negative">Mit negativem Saldo</NativeOption></NativeSelect></NativeLabel>
      <NativeLabel className="wta-field"><NativeSpan>Sortierung</NativeSpan><NativeSelect value={sort} onChange={async (event) => await updateParams({ sort: event.target.value === 'name' ? undefined : event.target.value })}><NativeOption value="name">Name A–Z</NativeOption><NativeOption value="reviews">Offene Prüfungen zuerst</NativeOption><NativeOption value="balance">Saldo aufsteigend</NativeOption></NativeSelect></NativeLabel>
    </NativeDiv>
    {error ? <NativeDiv className="wta-message" data-tone={hasData ? 'warning' : 'error'} role="alert"><NativeDiv><NativeStrong>{hasData ? 'Aktualisierung fehlgeschlagen' : 'Zeitkonten konnten nicht geladen werden'}</NativeStrong><NativeP>{hasData ? 'Die Daten stammen vom letzten erfolgreichen Abruf. ' : ''}{error}</NativeP></NativeDiv><NativeButton type="button" className="wta-button" disabled={busy} onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
    {busy && hasData ? <NativeDiv className="wta-loading" role="status" aria-label="Zeitkonten werden aktualisiert"/> : null}
    {hasData ? <>
      <NativeDiv className="wta-kpis" aria-label="Summen der angezeigten Zeitkonten">
        <NativeDiv className="wta-kpi"><NativeSpan>Sollzeit</NativeSpan><NativeStrong>{accountDuration(totals.targetMinutes)}</NativeStrong><NativeSmall>{totals.employees} {totals.employees === 1 ? 'Person' : 'Personen'} im Filter</NativeSmall></NativeDiv>
        <NativeDiv className="wta-kpi"><NativeSpan>Istzeit</NativeSpan><NativeStrong>{accountDuration(totals.actualMinutes)}</NativeStrong><NativeSmall>Erfasste Arbeitszeit</NativeSmall></NativeDiv>
        <NativeDiv className="wta-kpi"><NativeSpan>Genehmigt</NativeSpan><NativeStrong>{accountDuration(totals.approvedMinutes)}</NativeStrong><NativeSmall>Freigegebene Arbeitszeit</NativeSmall></NativeDiv>
        <NativeDiv className="wta-kpi" data-tone={totals.saldoMinutes < 0 ? 'warning' : 'good'}><NativeSpan>Saldo im Zeitraum</NativeSpan><NativeStrong>{accountDuration(totals.saldoMinutes, true)}</NativeStrong><NativeSmall>Mit {accountDuration(totals.absenceMinutes)} Abwesenheit</NativeSmall></NativeDiv>
        <NativeButton type="button" className="wta-kpi wta-kpi-action" data-tone={totals.openReviews > 0 ? 'warning' : undefined} onClick={async () => await navigate('/business/office/time-tracking/pruefqueue')}><NativeSpan>Offene Prüfungen</NativeSpan><NativeStrong>{totals.openReviews.toLocaleString('de-DE')}</NativeStrong><NativeSmall>Prüfbereich öffnen →</NativeSmall></NativeButton>
      </NativeDiv>
      <NativeDiv className="wta-filterline"><NativeSpan>{accounts.length} von {all.length} Zeitkonten · Summen beziehen sich auf die angezeigten Personen.</NativeSpan>{activeFilters ? <NativeButton type="button" className="wta-link" onClick={async () => await updateParams({ search: undefined, employee: undefined, review: undefined })}>Filter zurücksetzen</NativeButton> : null}</NativeDiv>
    </> : null}
    <NativeDiv className="wta-table-panel" aria-busy={busy}>
      <NativeDiv className="wta-table-heading"><NativeH3>Arbeitszeiten im Überblick</NativeH3><NativeSpan className="wta-muted">Alle Zeitangaben in Stunden : Minuten</NativeSpan></NativeDiv>
      {!hasData && busy ? <NativeDiv className="wta-skeletons" role="status" aria-label="Zeitkonten werden geladen"><NativeDiv className="wta-skeleton"/><NativeDiv className="wta-skeleton"/><NativeDiv className="wta-skeleton"/></NativeDiv>
            : !hasData && error ? <NativeDiv className="wta-state"><NativeH3>Keine bestätigten Daten verfügbar</NativeH3><NativeP>Bitte laden Sie die Zeitkonten erneut.</NativeP></NativeDiv>
                : accounts.length === 0 ? <NativeDiv className="wta-state"><NativeH3>{activeFilters ? 'Keine passenden Zeitkonten' : 'Noch keine Zeitkonten vorhanden'}</NativeH3><NativeP>{activeFilters ? 'Passen Sie die Suche oder den Prüfstand an.' : 'Für diesen Zeitraum sind keine Mitarbeitenden mit Zeitkontodaten verfügbar.'}</NativeP>{activeFilters ? <NativeButton type="button" className="wta-button" onClick={async () => await updateParams({ search: undefined, employee: undefined, review: undefined })}>Filter zurücksetzen</NativeButton> : null}</NativeDiv>
                    : <NativeDiv className="wta-table-scroll" role="region" aria-label="Zeitkonten, bei Bedarf horizontal scrollbar" tabIndex={0}><NativeTable className="wta-table">
              <NativeThead><NativeTr><NativeTh scope="col">Mitarbeitende</NativeTh><NativeTh scope="col">Soll</NativeTh><NativeTh scope="col">Ist</NativeTh><NativeTh scope="col">Genehmigt</NativeTh><NativeTh scope="col">Abwesenheit</NativeTh><NativeTh scope="col">Saldo</NativeTh><NativeTh scope="col">Prüfung</NativeTh><NativeTh scope="col">Details</NativeTh></NativeTr></NativeThead>
              <NativeTbody>{accounts.map(account => <NativeTr key={account.employeeId} data-selected={selectedId === account.employeeId}>
                <NativeTd><NativeDiv className="wta-person"><NativeSpan className="wta-avatar" aria-hidden="true">{accountInitials(account.employeeName)}</NativeSpan><NativeDiv className="wta-person-copy"><NativeButton type="button" className="wta-link" onClick={async () => await selectAccount(account)}>{account.employeeName}</NativeButton><NativeSmall>{account.targetSource === 'contract' ? 'Soll aus Vertrag' : account.targetSource === 'saved_account' ? 'Gespeicherte Sollzeit' : account.targetSource === 'planned' ? 'Soll aus Planung' : `${account.entries.length} Zeitbuchungen`}</NativeSmall></NativeDiv></NativeDiv></NativeTd>
                <NativeTd>{accountDuration(account.targetMinutes)}</NativeTd><NativeTd>{accountDuration(account.actualMinutes)}</NativeTd><NativeTd>{accountDuration(account.approvedMinutes)}</NativeTd><NativeTd>{accountDuration(account.absenceMinutes)}</NativeTd><NativeTd><NativeSpan className="wta-saldo" data-negative={account.saldoMinutes < 0}>{accountDuration(account.saldoMinutes, true)}</NativeSpan></NativeTd>
                <NativeTd>{account.openReviewCount > 0 ? <NativeButton type="button" className="wta-link" aria-label={`${account.openReviewCount} ${account.openReviewCount === 1 ? 'offene Prüfung' : 'offene Prüfungen'} für ${account.employeeName}`} onClick={async () => await navigate('/business/office/time-tracking/pruefqueue', account.employeeId)}><NativeSpan className="wta-badge" data-tone="warning">{account.openReviewCount} offen →</NativeSpan></NativeButton> : <NativeSpan className="wta-badge">Keine offenen</NativeSpan>}</NativeTd>
                <NativeTd><NativeButton type="button" className="wta-button" aria-label={`Zeitkonto von ${account.employeeName} öffnen`} onClick={async () => await selectAccount(account)}>Öffnen</NativeButton></NativeTd>
              </NativeTr>)}</NativeTbody>
            </NativeTable></NativeDiv>}
    </NativeDiv>
    <NativeP className="wta-footnote">Saldo = Istzeit + gutgeschriebene Abwesenheit − Sollzeit des gewählten Zeitraums. Für einen laufenden Monat ist die gesamte Monatssollzeit enthalten. Die Einzelansicht zeigt Fahrzeit, Urlaub, Buchungen und Monatsabschlüsse.</NativeP>
    <NativeDetails className="wta-disclosure" open={warningsOpen} onToggle={event => setWarningsOpen(event.currentTarget.open)}><NativeSummary>Arbeitszeit-Hinweise für heute</NativeSummary>{warningsOpen ? <NativeDiv className="wta-disclosure-body"><WfmRuleWarningsPanel tenantId={tenantId} userId={reviewerId} roleKey={roleKey} teamView compact/></NativeDiv> : null}</NativeDetails>
    <NativeDiv className="wta-workflow"><NativeP>Vor dem Monatsabschluss offene Zeiten prüfen und Abwesenheiten freigeben. Anschließend die Gehaltsstatistik für den gewählten Monat öffnen.</NativeP><NativeButton type="button" className="wta-button" onClick={async () => await navigate('/business/office/payroll')}>Zur Gehaltsstatistik →</NativeButton></NativeDiv>
    <PlatformModal visible={Boolean(selectedId)} title={selected ? `Zeitkonto · ${selected.employeeName}` : 'Zeitkonto'} subtitle={`${periodLabel} · ${officePeriodLabel(period)}`} maxWidth={1320} minWidth={280} maxHeightRatio={0.94} surfaceScope="company" dismissOnBackdrop={false} isDirty={editor.dirty && !editor.childOpen} onClose={closeAccount} bodyStyle={{ padding: 14, backgroundColor: '#f3f7fc' }}>
      {error && hasData ? <NativeDiv className="wta"><NativeDiv className="wta-message" data-tone="warning" role="alert">Die Aktualisierung ist fehlgeschlagen. Angezeigt wird der letzte erfolgreiche Stand. {error}</NativeDiv></NativeDiv> : null}
      {selected ? <WfmEmployeeTimeAccountWorkspace key={`${selected.employeeId}:${period.fromDate}:${period.toDate}`} account={selected} tenantId={tenantId} reviewerId={reviewerId} roleKey={roleKey} canCorrect={canCorrect} canManage={canManage} periodLabel={periodLabel} period={period} onChanged={query.refresh} onEditorStateChange={reportEditor} onClose={closeAccount}/>
            : <NativeDiv className="wta wta-state"><NativeH3>{busy ? 'Zeitkonto wird geladen …' : 'Zeitkonto nicht verfügbar'}</NativeH3><NativeP>{busy ? 'Die Daten werden für den gewählten Zeitraum abgerufen.' : 'Die ausgewählte Person ist in diesem Zeitraum nicht verfügbar. Bitte schließen Sie die Ansicht und prüfen Sie den Zeitraum.'}</NativeP></NativeDiv>}
    </PlatformModal>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
export function TimeTrackingTeamScreen() { return <NativeWorkspaceStyleScope css={[wfmTimeAccountsCss]}>{<WfmZeitkontenScreen />}</NativeWorkspaceStyleScope>; }
