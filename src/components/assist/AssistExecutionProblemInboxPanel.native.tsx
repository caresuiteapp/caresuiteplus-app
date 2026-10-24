// Generated native presentation from src/components/assist/AssistExecutionProblemInboxPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeSection,NativeHeader,NativeDiv,NativeH2,NativeP,NativeSpan,NativeButton,NativeStrong,NativeDetails,NativeSummary,NativeUl,NativeLi,NativeLabel,NativeInput,NativeArticle,NativeH3} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../icons/WebActionIcon.native.tsx";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useFlowRouter } from "../../hooks/useFlowRouter.ts";
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { useAssistProblemInbox } from "../../hooks/useAssistProblemInbox.native.ts";
import { getAssistProblemRepair, runAssistProblemRepair, type AssistProblemCategory, type AssistProblemItem, } from "../../lib/assist/assistProblemWorkspaceService.native.ts";
import { AssistProblemInboxStyles } from "./AssistProblemInboxStyles.native.tsx";
import { AssistLiveFilterSelect } from "./AssistLiveFilterSelect.native.tsx";
type Props = {
    refreshToken?: number;
    onChanged?: () => void;
    onCountChange?: (count: number | null) => void;
    onOpenAssignment?: (id: string) => void;
};
const CATEGORIES: Record<AssistProblemCategory, string> = {
    documentation: 'Dokumentation', signature: 'Unterschrift', proof: 'Nachweise',
    budget: 'Budget', timekeeping: 'Arbeitszeit', status: 'Einsatzstatus',
};
const ISSUE_TITLES: Record<AssistProblemItem['code'], string> = {
    ended_missing_documentation: 'Dokumentation fehlt',
    documentation_missing_signature: 'Unterschrift fehlt',
    signature_missing_proof: 'Leistungsnachweis fehlt',
    proof_missing_pdf: 'PDF zum Nachweis fehlt',
    proof_missing_client_document: 'Nachweis fehlt in der Klientenakte',
    proof_not_portal_visible: 'Nachweis ist im Klientenportal nicht sichtbar',
    budget_reservation_not_executed: 'Reserviertes Budget wurde noch nicht verbucht',
    budget_reservation_failed: 'Budgetbuchung ist noch offen',
    budget_ledger_missing: 'Budgetbuchung fehlt',
    budget_usage_missing_after_approval: 'Budgetverbrauch nach Freigabe fehlt',
    wfm_sync_missing: 'Arbeitszeit fehlt im Zeitkonto',
    wfm_sync_failed: 'Arbeitszeit wurde nicht übertragen',
    assignment_visit_execution_drift: 'Abschlussstatus ist nicht einheitlich',
};
const GUIDANCE: Record<AssistProblemCategory, string> = {
    documentation: 'Öffnen Sie die Nachbearbeitung, ergänzen Sie die fehlende Dokumentation und speichern Sie den Eintrag.',
    signature: 'Prüfen Sie den Einsatzabschluss. Dort können Sie eine noch fehlende Unterschrift im Klientenportal anfordern.',
    proof: 'Prüfen Sie den Nachweis und den Einsatzabschluss. Fehlende Angaben oder eine ausstehende Unterschrift müssen zuerst ergänzt werden.',
    budget: 'Prüfen Sie Budget und Abrechnung des Einsatzes. Über die Nachbearbeitung lässt sich der Abschluss mit den vorhandenen Angaben erneut durchführen.',
    timekeeping: 'Prüfen Sie die tatsächlichen Einsatzzeiten und Pausen. Nur bestätigte, vollständige Zeiten können in das Zeitkonto übernommen werden.',
    status: 'Prüfen Sie in der Nachbearbeitung die Einsatzzeiten, Aufgaben, Dokumentation und Unterschrift. Führen Sie anschließend den Abschluss erneut aus.',
};
const PAGE_SIZE = 12;
function Icon({ name, spinning = false }: {
    name: 'refresh' | 'arrow' | 'chevron';
    spinning?: boolean;
}) {
    return <WebActionIcon size={16} className={spinning ? 'pbi-spin' : undefined}>{name === 'refresh' ? <><NativeSvgPath d="M20 7v5h-5M4 17v-5h5"/><NativeSvgPath d="M6.1 7a7 7 0 0 1 11.5-1L20 9M4 15l2.4 3A7 7 0 0 0 18 17"/></> : name === 'chevron' ? <NativeSvgPath d="m6 9 6 6 6-6"/> : <NativeSvgPath d="M5 12h14m-5-5 5 5-5 5"/>}</WebActionIcon>;
}
function dateLabel(value: string | null) {
    if (!value || !Number.isFinite(Date.parse(value)))
        return 'Termin nicht hinterlegt';
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    return new Date(dateOnly ? `${value}T12:00:00Z` : value).toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric',
        ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit' }),
    });
}
function client(item: AssistProblemItem) { return item.clientName?.trim() || 'Klient:in nicht zugeordnet'; }
function employee(item: AssistProblemItem) { return item.employeeName?.trim() || 'Mitarbeitende nicht zugeordnet'; }
function normalize(value: string) { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de-DE'); }
export function AssistExecutionProblemInboxPanel(props: Props = {}) {
    const tenantId = useServiceTenantId();
    const { profile, user } = useAuth();
    const { can, permissions, roleKey, isReadOnly } = usePermissions();
    const allowed = can('assist.assignments.view');
    // A changed company, actor or permission set must discard pending actions and local selection.
    const scope = JSON.stringify([tenantId, profile?.id, user?.id, profile?.roleKey, roleKey, isReadOnly, [...permissions].sort()]);
    const currentScope = useRef(scope);
    currentScope.current = scope;
    return <ProblemInbox key={scope} {...props} tenantId={tenantId || null} allowed={allowed} isScopeCurrent={() => currentScope.current === scope}/>;
}
function ProblemInbox({ tenantId, allowed, isScopeCurrent, refreshToken = 0, onChanged, onCountChange, onOpenAssignment }: Props & {
    tenantId: string | null;
    allowed: boolean;
    isScopeCurrent: () => boolean;
}) {
    const { profile } = useAuth();
    const { can, permissions, roleKey, isReadOnly } = usePermissions();
    const router = useFlowRouter();
    const { snapshot, loading, refreshing, error, refresh } = useAssistProblemInbox({ enabled: allowed && !!tenantId, refreshToken });
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<AssistProblemCategory | 'all'>('all');
    const [employeeId, setEmployeeId] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [notice, setNotice] = useState<{
        tone: 'error' | 'warning' | 'success';
        text: string;
    } | null>(null);
    const lock = useRef(false), mounted = useRef(true), sectionId = useId();
    const latest = useRef({ can, permissions, roleKey, profileId: profile?.id, tenantId, isReadOnly });
    latest.current = { can, permissions, roleKey, profileId: profile?.id, tenantId, isReadOnly };
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => { onCountChange?.(allowed && snapshot?.complete && !error ? snapshot.items.length : null); }, [allowed, snapshot, error, onCountChange]);
    useEffect(() => { setPage(0); }, [query, category, employeeId]);
    const items = snapshot?.items ?? [];
    const hasUnverified = items.some(item => item.unverified);
    const employees = useMemo(() => {
        const byId = new Map<string, string>();
        for (const item of items)
            if (item.employeeId)
                byId.set(item.employeeId, employee(item));
        return [{ value: '', label: 'Alle Mitarbeitenden' },
            ...[...byId].sort((a, b) => a[1].localeCompare(b[1], 'de')).map(([value, label]) => ({ value, label })),
            ...(items.some(item => !item.employeeId) ? [{ value: 'unassigned', label: 'Ohne Zuordnung' }] : [])];
    }, [items]);
    const counts = useMemo(() => items.reduce((acc, item) => ({ ...acc, [item.category]: (acc[item.category] ?? 0) + 1 }), {} as Partial<Record<AssistProblemCategory, number>>), [items]);
    const groups = useMemo(() => {
        const words = normalize(query.trim()).split(/\s+/).filter(Boolean), byAssignment = new Map<string, AssistProblemItem[]>();
        for (const item of items) {
            if (category !== 'all' && item.category !== category)
                continue;
            if (employeeId && (employeeId === 'unassigned' ? !!item.employeeId : item.employeeId !== employeeId))
                continue;
            const search = normalize([client(item), employee(item), item.title, item.message, dateLabel(item.date), CATEGORIES[item.category], ISSUE_TITLES[item.code]].join(' '));
            if (!words.every(word => search.includes(word)))
                continue;
            const group = byAssignment.get(item.assignmentId) ?? [];
            group.push(item);
            byAssignment.set(item.assignmentId, group);
        }
        return [...byAssignment].map(([id, problems]) => ({ id, problems, item: problems[0] }));
    }, [items, query, category, employeeId]);
    const pages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE)), shownPage = Math.min(page, pages - 1);
    const visibleGroups = groups.slice(shownPage * PAGE_SIZE, (shownPage + 1) * PAGE_SIZE);
    const hasFilters = !!query.trim() || category !== 'all' || !!employeeId;
    const reset = () => { setQuery(''); setCategory('all'); setEmployeeId(''); setPage(0); };
    const check = useCallback(async () => {
        if (lock.current || !isScopeCurrent())
            return;
        setNotice(null);
        await refresh();
    }, [refresh, isScopeCurrent]);
    const openAssignment = (item: AssistProblemItem) => {
        if (!isScopeCurrent() || !latest.current.can('assist.assignments.view') || lock.current)
            return;
        if (onOpenAssignment)
            onOpenAssignment(item.visitId || item.assignmentId);
        else
            router.push(`/assist/assignments/${encodeURIComponent(item.visitId || item.assignmentId)}` as never);
    };
    const openWorkflow = (item: AssistProblemItem, execution = false) => {
        if (lock.current || !isScopeCurrent())
            return;
        const id = encodeURIComponent(item.visitId || item.assignmentId);
        const targetExecution = execution || !['proof', 'budget'].includes(item.category);
        if (targetExecution && can('assist.execution.view'))
            router.push(`/assist/assignments/${id}/execute` as never);
        else if (can('assist.assignments.view'))
            router.push(`/assist/assignments/${id}?tab=${targetExecution ? 'execution' : item.category === 'budget' ? 'budget' : 'proof'}` as never);
    };
    const repair = async (item: AssistProblemItem) => {
        if (lock.current || !tenantId || !mounted.current || !isScopeCurrent() || latest.current.isReadOnly)
            return;
        const action = getAssistProblemRepair(item, latest.current.can, latest.current.isReadOnly);
        if (!action || item.tenantId !== latest.current.tenantId)
            return;
        lock.current = true;
        setBusyId(item.id);
        setNotice(null);
        try {
            const result = await runAssistProblemRepair({ tenantId, item, actionId: action.id, actor: { roleKey: latest.current.roleKey, permissions: latest.current.permissions, profileId: latest.current.profileId ?? null, isReadOnly: latest.current.isReadOnly }, isCurrent: () => mounted.current && isScopeCurrent() && !latest.current.isReadOnly });
            if (!mounted.current || !isScopeCurrent())
                return;
            if (!result.ok) {
                setNotice({ tone: 'error', text: result.error || 'Die Korrektur ist fehlgeschlagen. Der offene Punkt bleibt erhalten.' });
                return;
            }
            const verified = await refresh();
            if (!mounted.current || !isScopeCurrent())
                return;
            onChanged?.();
            if (!verified || !verified.complete)
                setNotice({ tone: 'warning', text: 'Die Aktion wurde ausgeführt. Die anschließende Prüfung ist noch unvollständig; der offene Punkt gilt noch nicht als erledigt.' });
            else if (verified.items.some(value => value.id === item.id || (value.assignmentId === item.assignmentId && value.code === item.code)))
                setNotice({ tone: 'warning', text: 'Die Aktion wurde ausgeführt. Bei der erneuten Prüfung besteht dieser offene Punkt weiterhin. Bitte prüfen Sie die Angaben im Einsatz.' });
            else
                setNotice({ tone: 'success', text: 'Erneut geprüft: Der offene Punkt ist behoben.' });
        }
        catch {
            if (mounted.current && isScopeCurrent())
                setNotice({ tone: 'error', text: 'Die Aktion konnte nicht bestätigt werden. Bitte prüfen Sie die Daten erneut, bevor Sie sie wiederholen.' });
        }
        finally {
            lock.current = false;
            if (mounted.current && isScopeCurrent())
                setBusyId(null);
        }
    };
    const checkedTime = snapshot?.checkedAt && Number.isFinite(Date.parse(snapshot.checkedAt)) ? new Date(snapshot.checkedAt).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }) : null;
    const healthy = !!snapshot?.complete && !error && items.length === 0;
    return <NativeSection className="pbi-root" aria-labelledby={`${sectionId}-title`} data-cs-problem-inbox="workspace">
    <AssistProblemInboxStyles />
    <NativeHeader className="pbi-header"><NativeDiv><NativeH2 id={`${sectionId}-title`}>Problem-Inbox</NativeH2><NativeP>Offene Punkte prüfen und direkt im Einsatz bearbeiten.</NativeP></NativeDiv><NativeDiv className="pbi-header-actions"><NativeSpan className="pbi-counter" data-tone={healthy ? 'healthy' : items.length || error ? 'warning' : undefined}>{error ? 'Prüfung offen' : snapshot ? hasUnverified ? `${items.length} zu prüfen` : `${!snapshot.complete ? 'Mind. ' : ''}${items.length} offen` : 'Noch nicht geprüft'}</NativeSpan><NativeButton type="button" className="pbi-button" disabled={!allowed || !tenantId || loading || refreshing || !!busyId} onClick={() => void check()}><Icon name="refresh" spinning={loading || refreshing}/>{loading || refreshing ? 'Wird geprüft…' : 'Erneut prüfen'}</NativeButton></NativeDiv></NativeHeader>
    <NativeDiv className="pbi-body" aria-busy={loading || refreshing || !!busyId}>
      {!allowed || !tenantId ? <NativeDiv className="pbi-alert" role="alert">{!allowed ? 'Sie haben keine Berechtigung, offene Punkte aus der Einsatzdurchführung anzusehen.' : 'Bitte wählen Sie zuerst ein Unternehmen aus.'}</NativeDiv> : <>
        {notice ? <NativeDiv className="pbi-alert" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</NativeDiv> : null}
        {error ? <NativeDiv className="pbi-alert" data-tone="error" role="alert"><NativeStrong>Prüfung nicht abgeschlossen</NativeStrong><NativeP>{error}</NativeP>{snapshot ? <NativeP>Der zuletzt geladene Stand bleibt sichtbar. Er bestätigt nicht den aktuellen Zustand.</NativeP> : null}</NativeDiv> : null}
        {snapshot && !snapshot.complete ? <NativeDiv className="pbi-alert" data-tone="warning" role="status"><NativeStrong>Nur teilweise geprüft</NativeStrong><NativeP>{snapshot.checkedAssignments} Einsätze wurden geprüft{snapshot.totalAssignments != null ? `, ${snapshot.totalAssignments} liegen im Prüfbereich` : ''}. Weitere offene Punkte sind möglich.</NativeP>{snapshot.warnings.length ? <NativeDetails><NativeSummary>Was noch nicht geprüft werden konnte</NativeSummary><NativeUl>{snapshot.warnings.map((warning, index) => <NativeLi key={index}>{warning}</NativeLi>)}</NativeUl></NativeDetails> : null}</NativeDiv> : null}
        {loading && !snapshot ? <NativeDiv role="status" aria-label="Problem-Inbox wird geprüft"><NativeDiv className="pbi-skeleton"/><NativeP className="pbi-note">Einsatzdaten, Nachweise und Arbeitszeiten werden geprüft.</NativeP></NativeDiv> : null}
        {snapshot && items.length > 0 ? <>
          <NativeDiv className="pbi-tools"><NativeLabel className="pbi-field pbi-field--search"><NativeSpan>Suche</NativeSpan><NativeInput type="search" aria-label="Problem-Inbox durchsuchen" placeholder="Name, Datum, Leistung oder Problem" value={query} onChange={event => setQuery(event.target.value)}/></NativeLabel><AssistLiveFilterSelect className="pbi-field" label="Mitarbeitende" ariaLabel="Problem-Inbox nach Mitarbeitenden filtern" value={employeeId} options={employees} onChange={setEmployeeId}/></NativeDiv>
          <NativeDiv className="pbi-categories" aria-label="Problembereich filtern"><NativeButton type="button" className="pbi-category" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>Alle<NativeSpan>{items.length}</NativeSpan></NativeButton>{(Object.entries(CATEGORIES) as [
                AssistProblemCategory,
                string
            ][]).map(([key, label]) => <NativeButton type="button" key={key} className="pbi-category" aria-pressed={category === key} onClick={() => setCategory(key)}>{label}<NativeSpan>{counts[key] ?? 0}</NativeSpan></NativeButton>)}</NativeDiv>
          <NativeDiv className="pbi-summary"><NativeP>{groups.reduce((sum, group) => sum + group.problems.length, 0)} {hasUnverified ? 'Prüfhinweise' : 'offene Punkte'} in {groups.length} {groups.length === 1 ? 'Einsatz' : 'Einsätzen'}</NativeP>{hasFilters ? <NativeButton type="button" className="pbi-button pbi-button--quiet" onClick={reset}>Filter zurücksetzen</NativeButton> : null}</NativeDiv>
          {groups.length ? <NativeDiv className="pbi-list">{visibleGroups.map(({ id, item, problems }, index) => {
                        const open = expanded === id, detailId = `${sectionId}-detail-${shownPage * PAGE_SIZE + index}`;
                        const labels = [...new Set(problems.map(problem => CATEGORIES[problem.category]))].join(' · ');
                        return <NativeArticle className="pbi-card" key={id}><NativeDiv className="pbi-card-header"><NativeButton type="button" className="pbi-toggle" aria-expanded={open} aria-controls={detailId} aria-label={`Probleme für ${client(item)} am ${dateLabel(item.date)} ${open ? 'schließen' : 'öffnen'}`} onClick={() => setExpanded(open ? null : id)}><NativeSpan className="pbi-initial" aria-hidden="true">{client(item).split(/\s+/).slice(0, 2).map(word => word[0]).join('')}</NativeSpan><NativeSpan className="pbi-card-copy"><NativeSpan className="pbi-card-title">{client(item)}</NativeSpan><NativeSpan className="pbi-meta"><NativeSpan>{dateLabel(item.date)}</NativeSpan><NativeSpan>{employee(item)}</NativeSpan><NativeSpan>{item.title || 'Einsatz'}</NativeSpan></NativeSpan><NativeSpan className="pbi-card-bottom"><NativeSpan className="pbi-small-count">{problems.length} {problems.some(problem => problem.unverified) ? 'zu prüfen' : problems.length === 1 ? 'offener Punkt' : 'offene Punkte'}</NativeSpan><NativeSpan className="pbi-category-list">{labels}</NativeSpan></NativeSpan></NativeSpan><NativeSpan className="pbi-chevron"><Icon name="chevron"/></NativeSpan></NativeButton>{can('assist.assignments.view') ? <NativeButton type="button" className="pbi-button" disabled={!!busyId} aria-label={`Einsatz für ${client(item)} am ${dateLabel(item.date)} öffnen`} onClick={() => openAssignment(item)}>Einsatz öffnen<Icon name="arrow"/></NativeButton> : null}</NativeDiv>
              {open ? <NativeDiv className="pbi-details" id={detailId}>{problems.map(problem => {
                                    const action = getAssistProblemRepair(problem, can, isReadOnly);
                                    const workflowAllowed = can('assist.assignments.view') || can('assist.execution.view');
                                    const label = problem.category === 'budget' ? 'Budget prüfen' : problem.category === 'proof' ? 'Nachweis prüfen' : problem.category === 'documentation' ? isReadOnly ? 'Dokumentation ansehen' : 'Dokumentation bearbeiten' : problem.category === 'signature' ? 'Unterschrift prüfen' : problem.category === 'timekeeping' ? 'Einsatzzeiten prüfen' : 'Abschluss prüfen';
                                    return <NativeSection className="pbi-issue" key={problem.id} aria-label={ISSUE_TITLES[problem.code]}><NativeSpan className="pbi-issue-label">{CATEGORIES[problem.category]}</NativeSpan><NativeH3>{ISSUE_TITLES[problem.code]}</NativeH3>{problem.unverified ? <NativeP className="pbi-alert" data-tone="warning">Zuletzt erkannt; noch nicht erneut bestätigt. Bitte die Daten erneut prüfen.</NativeP> : null}<NativeP>{problem.message}</NativeP><NativeP>{GUIDANCE[problem.category]}</NativeP><NativeP className="pbi-note">Geprüft: {problem.source}</NativeP>{action ? <NativeP>{action.description}</NativeP> : null}<NativeDiv className="pbi-actions">{action ? <NativeButton type="button" className="pbi-button pbi-button--primary" disabled={!!busyId || refreshing || loading || !!error} onClick={() => void repair(problem)}>{busyId === problem.id ? 'Wird ausgeführt…' : action.label}</NativeButton> : null}{workflowAllowed ? <NativeButton type="button" className="pbi-button" disabled={!!busyId} onClick={() => openWorkflow(problem)}>{label}<Icon name="arrow"/></NativeButton> : null}{['budget', 'proof'].includes(problem.category) && can('assist.execution.view') ? <NativeButton type="button" className="pbi-button pbi-button--quiet" disabled={!!busyId} onClick={() => openWorkflow(problem, true)}>Nachbearbeitung öffnen</NativeButton> : null}</NativeDiv>{!workflowAllowed && !action ? <NativeP className="pbi-readonly">Die Bearbeitung ist für Ihre Rolle nicht freigegeben.</NativeP> : null}</NativeSection>;
                                })}<NativeP className="pbi-note">Nach der Bearbeitung erneut prüfen. Ein Punkt verschwindet, sobald die Ursache behoben ist.</NativeP></NativeDiv> : null}
            </NativeArticle>;
                    })}</NativeDiv> : <NativeDiv className="pbi-empty"><NativeH3>Keine passenden offenen Punkte</NativeH3><NativeP>Für diese Suche und Filter wurden keine Einträge gefunden.</NativeP><NativeButton type="button" className="pbi-button" onClick={reset}>Filter zurücksetzen</NativeButton></NativeDiv>}
          {pages > 1 ? <NativeDiv className="pbi-page"><NativeSpan>Einsätze {shownPage * PAGE_SIZE + 1}–{Math.min((shownPage + 1) * PAGE_SIZE, groups.length)} von {groups.length}</NativeSpan><NativeDiv className="pbi-actions"><NativeButton type="button" className="pbi-button" disabled={shownPage === 0} onClick={() => setPage(shownPage - 1)}>Vorherige Einsätze</NativeButton><NativeButton type="button" className="pbi-button" disabled={shownPage === pages - 1} onClick={() => setPage(shownPage + 1)}>Weitere Einsätze</NativeButton></NativeDiv></NativeDiv> : null}
        </> : snapshot && !loading && !error ? <NativeDiv className="pbi-empty"><NativeH3>{healthy ? 'Keine offenen Punkte gefunden' : 'Bisher keine offenen Punkte gefunden'}</NativeH3><NativeP>{healthy ? 'In den geprüften Einsätzen sind Dokumentation, Nachweise, Budget und Arbeitszeit unauffällig.' : 'Die Prüfung ist noch unvollständig. Eine Entwarnung ist erst nach vollständiger Prüfung möglich.'}</NativeP></NativeDiv> : null}
        {snapshot ? <NativeP className="pbi-note">{snapshot.checkedAssignments} Einsätze geprüft{checkedTime ? ` · Stand ${checkedTime} Uhr` : ''}. {refreshing ? 'Daten werden aktualisiert.' : 'Die Inbox zeigt Probleme aus gespeicherten Einsatzdaten.'}</NativeP> : null}
      </>}
    </NativeDiv>
  </NativeSection>;
}
