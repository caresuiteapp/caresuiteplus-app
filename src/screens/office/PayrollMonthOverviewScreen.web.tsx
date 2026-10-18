import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { PlatformModal } from '@/components/layout/platform';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { subscribeToWfmLiveChanges } from '@/lib/realtime/presets';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { listPayrollMonthOverview } from '@/lib/payroll/payrollMonthService.web';
import { getPayrollPdfUrl, publishPayrollStatement, reviewExpenseClaim, type PayrollOfficeDocumentContext } from '@/lib/payroll/payrollOfficeActions.web';
import type { PayrollOfficeEmployeeMonth } from '@/lib/payroll/payrollOfficeReadModel.web';
import { formatPayrollBalanceMinutes, formatPayrollMoney, formatPayrollMinutes } from '@/lib/payroll/payrollCalculator.web';
import { approvePayrollExpenses, preparePayrollExpenseApproval } from '@/lib/payroll/payrollExpenseApproval';
import { officeMonthLabel, shiftOfficeMonth } from '@/lib/wfm/wfmOfficeMonth';
import { berlinWorkDate } from '@/components/wfm/wfmManualEntryDraft.web';
import { PayrollEmployeeDetail } from '@/components/payroll/PayrollEmployeeDetail.web';
import { payrollWorkspaceCss } from '@/components/payroll/payrollWorkspaceCss.web';
import { payrollDetailTab, payrollDraftsDirty, payrollInitials, payrollSort, payrollStatementLabels, payrollStatusFilter, payrollTone, payrollTotalHint, payrollWorkspaceTotals, pendingExpenses, queryText, selectPayrollEmployees, validPayrollMonth, validatePayrollExpenseDraft, type PayrollDetailTab } from '@/components/payroll/payrollWorkspaceModel.web';
import type { RoleKey } from '@/types';
import type { PayrollExpenseClaim } from '@/types/modules/payrollMonth';

type Params = { month?: string | string[]; employeeId?: string | string[]; search?: string | string[]; status?: string | string[]; sort?: string | string[]; tab?: string | string[] };
type Notice = { tone: 'success' | 'error' | 'warning'; text: string };
const statusChoices = [{ key: 'all', label: 'Alle Freigabestände' }, { key: 'needs_review', label: 'Mit Prüfbedarf' }, { key: 'not_published', label: 'Noch ohne Veröffentlichung' }, { key: 'published', label: 'Antwort ausstehend' }, { key: 'confirmed', label: 'Bestätigt / abgeschlossen' }, { key: 'rejected', label: 'Abgelehnt' }, { key: 'blocked', label: 'Klärung erforderlich' }];

export function PayrollMonthOverviewScreen() {
  const auth = useAuth(); const tenantId = useServiceTenantId()?.trim() ?? ''; const { roleKey, permissions, can } = usePermissions();
  const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('office.employees.view') && can('time.tracking.team.view'));
  const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, [...new Set(permissions)].sort()]);
  return <ScreenShell title="Gehaltsstatistik" contentOwnsHeader><style>{payrollWorkspaceCss}</style>{!auth.authReady ? <div className="pg pg-empty" role="status">Zugang wird geprüft …</div> : allowed && roleKey ? <PayrollWorkspace key={scopeKey} tenantId={tenantId} roleKey={roleKey} scopeKey={scopeKey} canEdit={can('office.employees.edit')} canOpenEmployee={can('office.employees.view')} canOpenTimes={can('time.tracking.team.view')} /> : <section className="pg pg-empty"><h1>Gehaltsstatistik</h1><p>Für diesen Bereich benötigen Sie einen Verwaltungszugang mit Zugriff auf Personal und Teamarbeitszeiten.</p></section>}</ScreenShell>;
}

function PayrollWorkspace({ tenantId, roleKey, scopeKey, canEdit, canOpenEmployee, canOpenTimes }: { tenantId: string; roleKey: RoleKey; scopeKey: string; canEdit: boolean; canOpenEmployee: boolean; canOpenTimes: boolean }) {
  const router = useRouter(); const navigation = useNavigation(); const focused = useIsFocused(); const params = useLocalSearchParams<Params>();
  const currentMonth = berlinWorkDate().slice(0, 7); const requestedMonth = queryText(params.month); const monthKey = validPayrollMonth(requestedMonth) ? requestedMonth : currentMonth;
  const year = Number(monthKey.slice(0, 4)); const month = Number(monthKey.slice(5, 7));
  const search = queryText(params.search).slice(0, 180); const status = payrollStatusFilter(queryText(params.status)); const sort = payrollSort(queryText(params.sort)); const selectedId = queryText(params.employeeId); const tab = payrollDetailTab(queryText(params.tab));
  const [amounts, setAmounts] = useState<Record<string, string>>({}); const [notes, setNotes] = useState<Record<string, string>>({});
  const [snapshot, setSnapshot] = useState<PayrollOfficeEmployeeMonth | null>(null); const [busy, setBusy] = useState(''); const lock = useRef(false); const activeOperationScope = useRef<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null); const [progress, setProgress] = useState('');
  const [documentLink, setDocumentLink] = useState<{ url: string; title: string } | null>(null); const pendingWindow = useRef<Window | null>(null);
  const actionScope = `${scopeKey}:${monthKey}:${selectedId}`; const scopeRef = useRef<string | null>(actionScope); scopeRef.current = actionScope;
  useEffect(() => { scopeRef.current = actionScope; return () => { scopeRef.current = null; pendingWindow.current?.close(); pendingWindow.current = null; }; }, [actionScope]);
  useEffect(() => { setAmounts({}); setNotes({}); setSnapshot(null); setNotice(null); setProgress(''); setDocumentLink(null); }, [actionScope]);
  const dirty = payrollDraftsDirty(snapshot?.expenseClaims ?? [], amounts, notes); const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const query = useAsyncQuery(useCallback(() => withServiceQueryTimeout(listPayrollMonthOverview(tenantId, year, month, roleKey), 'Gehaltsstatistik', 30000), [tenantId, year, month, roleKey]), [scopeKey, monthKey], { queryKey: `office-payroll:${scopeKey}:${monthKey}`, refreshOnAppFocus: false, live: { enabled: focused && !busy && !dirty && !selectedId, tenantId, subscribe: subscribeToWfmLiveChanges, pollMs: 30000, refreshOnFocus: true } });
  const all = query.data?.employees ?? []; const candidate = all.find(row => row.employeeId === selectedId) ?? null;
  useEffect(() => { if (!busy && !dirty && candidate) setSnapshot(candidate); }, [candidate, busy, dirty]);
  const selected = snapshot?.employeeId === selectedId && snapshot.periodYear === year && snapshot.periodMonth === month ? snapshot : candidate;
  const rows = useMemo(() => selectPayrollEmployees(all, { search, status, sort }), [query.data, search, status, sort]); const totals = payrollWorkspaceTotals(rows);
  const queryError = query.error || query.refreshError; const stale = !!queryError || query.loading || query.refreshing || !query.data;
  const activeFilters = Boolean(search || status !== 'all');
  function discardDrafts(): boolean {
    if (lock.current) return false;
    if (dirtyRef.current && !window.confirm('Ungespeicherte Prüfvermerke und Beträge verwerfen?')) return false;
    setAmounts({}); setNotes({}); dirtyRef.current = false; return true;
  }
  usePreventRemove(dirty || !!busy, ({ data }) => { if (discardDrafts()) navigation.dispatch(data.action); });
  useEffect(() => { if (!dirty && !busy) return; const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave); }, [dirty, busy]);
  function updateParams(next: Record<string, string | undefined>) { if (focused && discardDrafts()) router.setParams(next); }
  function changeMonth(value: string) { if (validPayrollMonth(value)) updateParams({ month: value, employeeId: undefined, tab: undefined }); }
  function openEmployee(employee: PayrollOfficeEmployeeMonth, nextTab: PayrollDetailTab = 'overview') { if (!focused || !discardDrafts()) return; setSnapshot(employee); router.setParams({ month: monthKey, employeeId: employee.employeeId, tab: nextTab === 'overview' ? undefined : nextTab }); }
  function closeEmployee() { if (focused && discardDrafts()) { setSnapshot(null); router.setParams({ employeeId: undefined, tab: undefined }); } }
  function changeTab(next: PayrollDetailTab) { if (next !== tab) updateParams({ tab: next === 'overview' ? undefined : next }); }
  function navigate(pathname: string, extra: Record<string, string> = {}) { if (!focused || !discardDrafts()) return; router.push({ pathname, params: { month: monthKey, ...extra } } as never); }
  async function refresh() { if (!focused || !discardDrafts()) return; setNotice(null); await query.refresh(); }
  function begin(id: string): string | null { if (!focused || lock.current || !query.data || queryError) return null; lock.current = true; activeOperationScope.current = actionScope; setBusy(id); setNotice(null); return actionScope; }
  function finish(scope: string) { if (activeOperationScope.current === scope) { activeOperationScope.current = null; lock.current = false; if (scopeRef.current !== null) { setBusy(''); setProgress(''); } } }
  function clearSavedDrafts(ids: string[]) { setAmounts(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !ids.includes(id)))); setNotes(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !ids.includes(id)))); }
  function patchClaims(saved: PayrollExpenseClaim[]) { const map = new Map(saved.map(claim => [claim.id, claim])); setSnapshot(current => current ? { ...current, expenseClaims: current.expenseClaims.map(claim => map.get(claim.id) ?? claim) } : current); clearSavedDrafts(saved.map(claim => claim.id)); }
  async function publish(employee: PayrollOfficeEmployeeMonth) {
    if (!canEdit || stale || employee.calculationReady === false || employee.blockers.length || dirtyRef.current || ['confirmed', 'locked', 'paid'].includes(employee.latestStatement?.status ?? '')) return;
    const scope = begin(`publish:${employee.employeeId}`); if (!scope) return;
    try {
      if (!window.confirm(`${employee.employeeName} · ${officeMonthLabel(monthKey)}\n\nMonatsübersicht als neue PDF-Version im Mitarbeiterportal veröffentlichen?\n${employee.compensationType === 'salary' ? 'Festgehalt des Monats' : 'Brutto aus erfasster Zeit'}: ${formatPayrollMoney(employee.earnedGrossCents)}\nGenehmigte, noch offene Auslagen: ${formatPayrollMoney(employee.approvedExpensesCents)}${pendingExpenses(employee) ? `\n${pendingExpenses(employee)} ungeprüfte Belege sind noch nicht zur Erstattung freigegeben.` : ''}${employee.warnings.length ? `\n\nBerechnungsstand:\n${employee.warnings.map(warning => `• ${warning}`).join('\n')}` : ''}\n\nDie Person kann die veröffentlichte Übersicht bestätigen oder ablehnen.`)) return;
      const result = await withServiceQueryTimeout(publishPayrollStatement(tenantId, employee, roleKey), 'PDF erstellen und veröffentlichen', 90000);
      if (scopeRef.current !== scope) return;
      if (!result.ok) { setNotice({ tone: 'error', text: result.error }); return; }
      setNotice({ tone: 'success', text: `Version ${result.data.version} wurde für ${employee.employeeName} veröffentlicht. Die Antwort im Mitarbeiterportal steht aus.` });
      await query.refresh();
    } catch (cause) { if (scopeRef.current === scope) setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Die Veröffentlichung konnte nicht bestätigt werden.' }); }
    finally { finish(scope); }
  }
  async function review(claim: PayrollExpenseClaim, decision: 'approved' | 'rejected' | 'needs_info') {
    if (!canEdit || stale || !selected || ['confirmed', 'locked', 'paid'].includes(selected.latestStatement?.status ?? '') || !['submitted', 'needs_info'].includes(claim.status)) return;
    const checked = validatePayrollExpenseDraft(claim, amounts[claim.id] ?? (claim.amountCents / 100).toFixed(2).replace('.', ','), notes[claim.id] ?? claim.officeNote ?? '', decision);
    if (!checked.ok) { setNotice({ tone: 'error', text: checked.error }); return; }
    const scope = begin(`review:${claim.id}`); if (!scope) return;
    try {
      if (decision === 'rejected' && !window.confirm(`Beleg „${claim.description}“ über ${formatPayrollMoney(claim.amountCents)} ablehnen?`)) return;
      const result = await withServiceQueryTimeout(reviewExpenseClaim({ tenantId, employeeId: selected.employeeId, year, month, claimId: claim.id, status: checked.status, approvedAmountCents: checked.approvedAmountCents, officeNote: checked.officeNote, rejectionReason: decision === 'rejected' ? checked.officeNote : null, expectedUpdatedAt: claim.updatedAt }, roleKey), 'Auslagenprüfung', 30000);
      if (scopeRef.current !== scope) return;
      if (!result.ok) { setNotice({ tone: 'error', text: result.error }); return; }
      patchClaims([result.data]); setNotice({ tone: 'success', text: decision === 'needs_info' ? 'Rückfrage gespeichert. Der Beleg bleibt zur weiteren Prüfung offen.' : decision === 'rejected' ? 'Beleg mit Begründung abgelehnt.' : `Beleg mit ${formatPayrollMoney(result.data.approvedAmountCents ?? 0)} genehmigt.` });
      await query.refresh();
    } catch (cause) { if (scopeRef.current === scope) setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Die Belegprüfung konnte nicht gespeichert werden.' }); }
    finally { finish(scope); }
  }
  async function approveAll(employee: PayrollOfficeEmployeeMonth) {
    if (!canEdit || stale || ['confirmed', 'locked', 'paid'].includes(employee.latestStatement?.status ?? '')) return;
    const prepared = preparePayrollExpenseApproval(employee.expenseClaims, { tenantId, employeeId: employee.employeeId, year, month }, amounts, notes);
    if (!prepared.ok) { setNotice({ tone: 'error', text: prepared.error }); return; }
    for (const item of prepared.data.items) { const checked = validatePayrollExpenseDraft(item.claim, amounts[item.claim.id] ?? (item.claim.amountCents / 100).toFixed(2), notes[item.claim.id] ?? item.claim.officeNote ?? '', 'approved'); if (!checked.ok) { setNotice({ tone: 'error', text: `${item.claim.description}: ${checked.error}` }); return; } }
    if (!prepared.data.items.length) return;
    const scope = begin(`bulk:${employee.employeeId}`); if (!scope) return;
    try {
      const items = prepared.data.items; const openQuestions = items.filter(item => item.claim.status === 'needs_info').length;
      if (!window.confirm(`${employee.employeeName} · ${officeMonthLabel(monthKey)}\n${items.length} Belege mit insgesamt ${formatPayrollMoney(prepared.data.totalCents)} genehmigen?\nDie eingegebenen Beträge und Prüfvermerke werden übernommen.${openQuestions ? `\n${openQuestions} offene Rückfragen werden damit abgeschlossen.` : ''}`)) return;
      setProgress(`0 von ${items.length} Belegen bearbeitet`);
      const result = await approvePayrollExpenses(items, item => scopeRef.current !== scope ? Promise.resolve({ ok: false as const, error: 'Die Monatsansicht hat sich geändert. Bitte erneut prüfen.' }) : withServiceQueryTimeout(reviewExpenseClaim({ tenantId, employeeId: employee.employeeId, year, month, claimId: item.claim.id, status: item.status, approvedAmountCents: item.approvedAmountCents, officeNote: item.officeNote, expectedUpdatedAt: item.claim.updatedAt }, roleKey), 'Auslagenprüfung', 30000), (done, total) => { if (scopeRef.current === scope) setProgress(`${done} von ${total} Belegen bearbeitet`); });
      if (scopeRef.current !== scope) return;
      patchClaims(result.saved);
      setNotice({ tone: result.failed.length ? 'warning' : 'success', text: `${result.saved.length} von ${items.length} Belegen genehmigt.${result.failed.length ? ` ${result.failed.length} Belege bleiben zur Prüfung offen.\n${result.failed.slice(0, 4).map(item => `${item.claim.description}: ${item.error}`).join('\n')}` : ''}` });
      await query.refresh();
    } catch (cause) { if (scopeRef.current === scope) setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Die Sammelgenehmigung konnte nicht abgeschlossen werden.' }); }
    finally { finish(scope); }
  }
  async function openDocument(path: string, context: PayrollOfficeDocumentContext, title: string) {
    const scope = begin(`document:${context.documentId}`); if (!scope) return;
    setDocumentLink(null); const popup = window.open('about:blank', '_blank'); if (popup) popup.opener = null; pendingWindow.current = popup;
    try {
      const result = await withServiceQueryTimeout(getPayrollPdfUrl(path, context, roleKey), 'Dokument abrufen', 30000);
      if (scopeRef.current !== scope) { popup?.close(); return; }
      if (!result.ok) { popup?.close(); setNotice({ tone: 'error', text: result.error }); return; }
      const url = new URL(result.data); if (url.protocol !== 'https:') throw new Error('Der Dokumentlink ist ungültig. Bitte erneut versuchen.');
      if (popup && !popup.closed) popup.location.replace(url.href); else setDocumentLink({ url: url.href, title });
    } catch (cause) { popup?.close(); if (scopeRef.current === scope) setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Das Dokument konnte nicht geöffnet werden.' }); }
    finally { if (pendingWindow.current === popup) pendingWindow.current = null; finish(scope); }
  }
  const noticeView = <>{notice && <div className="pg-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</div>}{documentLink && <div className="pg-notice" role="status">Der Browser hat kein neues Fenster geöffnet. <a className="pg-linkbtn" href={documentLink.url} target="_blank" rel="noopener noreferrer">{documentLink.title} öffnen ↗</a></div>}</>;
  return <section className="pg pg-fade" data-testid="payroll-month-overview" data-healthos-payroll-revision="office-preview-20261018">
    <header className="pg-header"><div className="pg-heading"><span className="pg-mark" aria-hidden="true">€</span><div><p className="pg-eyebrow">Office · Personal</p><h1>Gehaltsstatistik</h1><p>Arbeitszeiten, Auslagen und Monatsübersichten.</p></div></div><div className="pg-actions"><span className="pg-sync">{query.refreshing ? 'Monatsdaten werden aktualisiert …' : query.data ? `Stand ${new Date(query.data.generatedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr` : 'Noch kein Datenstand'}</span><button type="button" disabled={!!busy || query.refreshing} onClick={() => void refresh()}>↻ Aktualisieren</button></div></header>
    <div className="pg-toolbar"><div className="pg-month"><button type="button" aria-label="Vorheriger Monat" disabled={!!busy || monthKey === '2000-01'} onClick={() => changeMonth(shiftOfficeMonth(monthKey, -1))}>‹</button><label>Abrechnungsmonat<input type="month" value={monthKey} min="2000-01" max="2100-12" disabled={!!busy} onChange={event => changeMonth(event.target.value)} /></label><button type="button" aria-label="Nächster Monat" disabled={!!busy || monthKey === '2100-12'} onClick={() => changeMonth(shiftOfficeMonth(monthKey, 1))}>›</button><button type="button" disabled={!!busy || monthKey === currentMonth} onClick={() => changeMonth(currentMonth)}>Aktuell</button></div><label className="pg-search">Mitarbeitende suchen<input type="search" value={search} disabled={!!busy} maxLength={180} placeholder="Name oder Personalnummer" onChange={event => updateParams({ search: event.target.value || undefined })} /></label><label className="pg-status">Freigabestand<select value={status} disabled={!!busy} onChange={event => updateParams({ status: event.target.value === 'all' ? undefined : event.target.value })}>{statusChoices.map(item => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label><label className="pg-sort">Sortierung<select value={sort} disabled={!!busy} onChange={event => updateParams({ sort: event.target.value === 'name' ? undefined : event.target.value })}><option value="name">Name A–Z</option><option value="gross">Höchste Bruttoprognose</option><option value="expenses">Offene Belege zuerst</option></select></label></div>
    {queryError && <div className="pg-notice" data-tone="error" role="alert">{queryError}{query.data ? ' Angezeigt wird der letzte erfolgreiche Stand. Änderungen und Veröffentlichungen bleiben bis zum erfolgreichen Aktualisieren gesperrt.' : ''}<br /><button disabled={!!busy || query.refreshing} onClick={() => void refresh()}>Erneut laden</button></div>}
    {!!busy && activeOperationScope.current !== actionScope && <div className="pg-notice" role="status">Die vorherige Aktion wird noch abgeschlossen. Neue Änderungen sind bis zur Rückmeldung gesperrt.</div>}{!selectedId && noticeView}
    {query.data && <><div className="pg-kpis"><Metric label="Bruttostand" value={totals.grossCount || !totals.totalCount ? formatPayrollMoney(totals.earned) : '—'} hint={payrollTotalHint(totals.grossCount, totals.totalCount, totals.provisional, 'Erfasste Zeit oder Monatsfestgehalt')} /><Metric label="Bruttoprognose" value={totals.grossCount || !totals.totalCount ? formatPayrollMoney(totals.projected) : '—'} hint={payrollTotalHint(totals.grossCount, totals.totalCount, totals.provisional, 'Mit verbleibender Monatsplanung')} /><Metric label="Genehmigte Auslagen" value={totals.expenseCount || !totals.totalCount ? formatPayrollMoney(totals.expenses) : '—'} hint={payrollTotalHint(totals.expenseCount, totals.totalCount, false, 'Noch nicht als erstattet markiert')} tone="good" /><Metric label="Offene Belege" value={String(totals.pending)} hint="Eingereicht oder Rückfrage offen" tone={totals.pending ? 'warning' : undefined} /><Metric label="Bestätigte Übersichten" value={`${totals.confirmed} / ${rows.length}`} hint="Einschließlich gesperrt / ausgezahlt" tone="good" /></div><div className="pg-filterline"><span>{rows.length} von {all.length} Personen · Summen der angezeigten Personen · {officeMonthLabel(monthKey)}</span>{activeFilters && <button className="pg-link" onClick={() => updateParams({ search: undefined, status: undefined })}>Filter zurücksetzen</button>}</div></>}
    <section className="pg-panel" aria-busy={query.loading || query.refreshing}><div className="pg-panel-head"><h2>Monatsübersicht</h2><small>Bruttowerte · Zeiten in Stunden : Minuten</small></div>{!query.data && query.loading ? <div role="status" aria-label="Gehaltsstatistik wird geladen"><div className="pg-skeleton" /><div className="pg-skeleton" /><div className="pg-skeleton" /></div> : !query.data ? <div className="pg-empty"><h3>Keine bestätigten Monatsdaten verfügbar</h3><p>Laden Sie die Daten erneut, um den Monatsstand zu prüfen.</p></div> : rows.length === 0 ? <div className="pg-empty"><h3>{activeFilters ? 'Keine passenden Personen' : 'Keine Monatsdaten vorhanden'}</h3><p>{activeFilters ? 'Passen Sie die Suche oder den Freigabestand an.' : 'Für diesen Monat wurden keine Mitarbeitenden mit Abrechnungsdaten gefunden.'}</p>{activeFilters && <button onClick={() => updateParams({ search: undefined, status: undefined })}>Filter zurücksetzen</button>}</div> : <div className="pg-table-scroll" role="region" aria-label="Gehaltsstatistik, bei Bedarf horizontal scrollbar" tabIndex={0}><table><thead><tr><th scope="col">Mitarbeitende</th><th scope="col" className="pg-number">Istzeit</th><th scope="col" className="pg-number">Zeitkonto</th><th scope="col" className="pg-number">Bruttoprognose</th><th scope="col" className="pg-number">Auslagen</th><th scope="col">Freigabestand</th><th scope="col">Prüfung</th><th scope="col">Details</th></tr></thead><tbody>{rows.map(employee => <tr key={employee.employeeId} data-selected={employee.employeeId === selectedId}><td><div className="pg-person"><span className="pg-avatar" aria-hidden="true">{payrollInitials(employee.employeeName)}</span><div><button type="button" className="pg-link" onClick={() => openEmployee(employee)}>{employee.employeeName}</button><small>{!employee.preview.compensationAvailable ? 'Vergütung fehlt oder ist ungültig' : employee.compensationType === 'hourly' ? `${formatPayrollMoney(employee.hourlyRateCents)} / Stunde` : `${formatPayrollMoney(employee.fixedSalaryCents)} Festgehalt`}{employee.employeeNumber ? ` · Nr. ${employee.employeeNumber}` : ''}</small>{!employee.preview.compensationAvailable && canOpenEmployee && <button className="pg-link" disabled={!!busy} onClick={() => navigate(`/business/office/employees/${employee.employeeId}`, { tab: 'compensation' })}>Vergütung prüfen →</button>}</div></div></td><td className="pg-number">{employee.preview.actualTimeAvailable ? formatPayrollMinutes(employee.actualWorkMinutes) : '—'}</td><td className="pg-number"><span className={employee.timeAccountBalanceMinutes < 0 ? 'pg-negative' : ''}>{employee.preview.timeAccountAvailable ? formatPayrollBalanceMinutes(employee.timeAccountBalanceMinutes) : '—'}</span></td><td className="pg-number"><strong>{employee.preview.grossAvailable ? formatPayrollMoney(employee.projectedGrossCents) : '—'}</strong>{employee.preview.grossAvailable && employee.preview.provisional ? <span className="pg-subtle">Vorläufig</span> : !employee.preview.grossAvailable ? <span className="pg-subtle">{employee.preview.compensationAvailable ? 'Berechnungsgrundlage fehlt' : 'Vergütung fehlt'}</span> : null}</td><td className="pg-number">{employee.preview.expensesAvailable ? formatPayrollMoney(employee.approvedExpensesCents) : '—'}{pendingExpenses(employee) > 0 && <span className="pg-subtle">{pendingExpenses(employee)} ungeprüft</span>}</td><td><div className="pg-statuscell"><span className="pg-badge" data-tone={payrollTone(employee.latestStatement?.status)}>{employee.latestStatement ? payrollStatementLabels[employee.latestStatement.status] : 'Nicht veröffentlicht'}</span>{employee.latestStatement && <small className="pg-subtle">Version {employee.latestStatement.version}</small>}</div></td><td>{employee.blockers.length > 0 ? <button className="pg-pill-action" onClick={() => openEmployee(employee)}><span className="pg-badge" data-tone="warning">Klärung erforderlich</span></button> : pendingExpenses(employee) > 0 ? <button className="pg-pill-action" onClick={() => openEmployee(employee, 'expenses')}>{pendingExpenses(employee)} Belege prüfen</button> : <span className="pg-badge">Keine offenen Belege</span>}</td><td><button onClick={() => openEmployee(employee)} aria-label={`Monatsübersicht für ${employee.employeeName} öffnen`}>Öffnen</button></td></tr>)}</tbody></table></div>}</section>
    <p className="pg-footnote">Die Prognose berücksichtigt noch geplante Zeiten. Brutto, Auslagen und Zeitkonto ergeben keine Nettoabrechnung. Im laufenden Monat enthält der Kontosaldo bereits das gesamte Monatssoll.</p>
    <PlatformModal visible={!!selectedId} title={selected ? `Gehaltsstatistik · ${selected.employeeName}` : 'Gehaltsstatistik'} subtitle={officeMonthLabel(monthKey)} maxWidth={1240} minWidth={280} maxHeightRatio={0.94} surfaceScope="company" dismissOnBackdrop={false} isDirty={false} onClose={closeEmployee} bodyStyle={{ padding: 16, backgroundColor: '#f3f7fc' }}>
      <div className="pg pg-detail">{queryError && query.data && <div className="pg-notice" data-tone="error" role="alert">Die Monatsdaten sind nicht aktuell. Bitte schließen Sie die Detailansicht und aktualisieren Sie die Übersicht. {queryError}</div>}{noticeView}{progress && <div className="pg-notice" role="status">{progress}</div>}{selected ? <PayrollEmployeeDetail employee={selected} tenantId={tenantId} monthKey={monthKey} tab={tab} onTab={changeTab} canEdit={canEdit} busy={busy} stale={stale} amounts={amounts} notes={notes} onAmount={(id, value) => setAmounts(previous => ({ ...previous, [id]: value }))} onNote={(id, value) => setNotes(previous => ({ ...previous, [id]: value }))} onReview={(claim, decision) => void review(claim, decision)} onApproveAll={() => void approveAll(selected)} onPublish={() => void publish(selected)} onDocument={(path, context, title) => void openDocument(path, context, title)} onTimeAccount={canOpenTimes ? () => navigate('/business/office/time-tracking/zeitkonten', { account: selected.employeeId }) : undefined} onEmployee={canOpenEmployee ? () => navigate(`/business/office/employees/${selected.employeeId}`, { tab: 'compensation' }) : undefined} onDocuments={canOpenEmployee ? () => navigate(`/business/office/employees/${selected.employeeId}`, { tab: 'documents' }) : undefined} /> : <div className="pg-empty"><h3>{query.loading ? 'Monatsdaten werden geladen …' : 'Person in diesem Monat nicht verfügbar'}</h3><p>{query.loading ? 'Die Übersicht wird für den gewählten Zeitraum abgerufen.' : 'Prüfen Sie den gewählten Monat oder öffnen Sie eine andere Person aus der Tabelle.'}</p></div>}<div className="pg-close-note"><button onClick={closeEmployee} disabled={!!busy}>Schließen</button></div></div>
    </PlatformModal>
  </section>;
}
function Metric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) { return <div className="pg-kpi" data-tone={tone}><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>; }
