// Generated native presentation from src/components/wfm/WfmEmployeeRequestsOfficeScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeButton,NativeDiv,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeSection,NativeH3,NativeArticle,NativeStrong,NativeP,NativeSpan,NativeTextarea} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { listWfmAbsenceApprovalDetails, listWfmAbsenceOverviewDetails, reviewWfmAbsenceRequest } from '@/lib/wfm';
import { WFM_ABSENCE_STATUS_LABELS, WFM_ABSENCE_TYPE_LABELS } from '@/types/modules/wfm';
import { WfmSecondaryWorkspace, WfmWebNotice, useWfmUnsavedChanges } from "./WfmSecondaryWorkspace.native.tsx";
function range(start: string, end: string) { return `${new Date(start).toLocaleDateString('de-DE')} – ${new Date(end).toLocaleDateString('de-DE')}`; }
export function WfmEmployeeRequestsOfficeScreen() {
    const params = useLocalSearchParams<{
        employeeId?: string | string[];
    }>();
    const router = useRouter();
    const focused = useIsFocused();
    const employeeFilter = Array.isArray(params.employeeId) ? params.employeeId[0] : params.employeeId;
    const tenantId = useServiceTenantId();
    const { user, profile } = useAuth();
    const reviewerId = user?.id ?? profile?.id ?? '';
    const { can, check, roleKey } = usePermissions();
    const canApprove = can('office.employees.absences.approve');
    const canView = can('office.employees.absences.view');
    const canRead = canView || canApprove;
    const [filter, setFilter] = useState<'all' | 'vacation' | 'absence'>('all');
    const [status, setStatus] = useState('all');
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [comment, setComment] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [warning, setWarning] = useState('');
    useWfmUnsavedChanges(!!selectedId && !!(comment.trim() || reason.trim()), busy);
    const scope = `${tenantId}:${reviewerId}:${roleKey}:${canApprove}:${canView}`;
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    useEffect(() => { setSelectedId(null); setComment(''); setReason(''); setError(''); setMessage(''); setWarning(''); setBusy(false); lock.current = false; }, [scope]);
    useEffect(() => { setSelectedId(null); setComment(''); setReason(''); }, [employeeFilter]);
    const query = useAsyncQuery(useCallback(async () => {
        if (!tenantId || !canRead)
            return { ok: false as const, error: 'Keine Berechtigung.' };
        const [approvals, overview] = await Promise.all([canApprove ? listWfmAbsenceApprovalDetails(tenantId, roleKey) : Promise.resolve({ ok: true as const, data: [] }), canView ? listWfmAbsenceOverviewDetails(tenantId, roleKey) : Promise.resolve({ ok: true as const, data: [] })]);
        if (!approvals.ok)
            return approvals;
        if (!overview.ok)
            return overview;
        return { ok: true as const, data: { approvals: approvals.data, overview: overview.data } };
    }, [tenantId, roleKey, canRead, canApprove, canView]), [tenantId, roleKey, canRead, canApprove, canView], { enabled: !!tenantId && !!reviewerId && canRead, queryKey: scope });
    const matches = (name: string, type: string) => name.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE')) && (filter === 'all' || (filter === 'vacation' ? type === 'vacation' : type !== 'vacation'));
    const approvals = (query.data?.approvals ?? []).filter(item => (!employeeFilter || item.approval.employeeId === employeeFilter) && matches(item.employeeName, item.absence?.absenceType ?? item.approval.approvalType));
    const overview = (query.data?.overview ?? []).filter(item => (!employeeFilter || item.absence.employeeId === employeeFilter) && matches(item.employeeName, item.absence.absenceType) && (status === 'all' || item.absence.status === status));
    const selected = query.data?.approvals.find(item => item.approval.id === selectedId);
    const choose = async (id: string | null) => { if (busy || id === selectedId || ((comment.trim() || reason.trim()) && !await confirmNativeWorkspaceAction('Eingegebene Entscheidungstexte verwerfen?')))
        return; setSelectedId(id); setComment(''); setReason(''); setError(''); };
    const decide = async (decision: 'approved' | 'rejected') => {
        if (lock.current || !tenantId || !reviewerId || !canApprove || !selected || query.loading || query.refreshError)
            return;
        if (decision === 'rejected' && !reason.trim()) {
            setError('Bitte einen Ablehnungsgrund eingeben.');
            return;
        }
        const requestedScope = scope;
        lock.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        setWarning('');
        try {
            const result = await reviewWfmAbsenceRequest(tenantId, reviewerId, roleKey, selected.approval.id, decision, { rejectionReason: decision === 'rejected' ? reason.trim() : undefined, approvalComment: decision === 'approved' ? comment.trim() : undefined });
            if (scopeRef.current !== requestedScope)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            setSelectedId(null);
            setReason('');
            setComment('');
            setMessage(decision === 'approved' ? 'Antrag genehmigt.' : 'Antrag abgelehnt.');
            setWarning(result.data.calendarSyncWarning ?? '');
            await query.refresh();
        }
        catch (cause) {
            if (scopeRef.current === requestedScope)
                setError(cause instanceof Error ? cause.message : 'Die Entscheidung konnte nicht gespeichert werden.');
        }
        finally {
            if (scopeRef.current === requestedScope) {
                lock.current = false;
                setBusy(false);
            }
        }
    };
    return <WfmSecondaryWorkspace title="Abwesenheiten" description="Anträge prüfen und genehmigte Zeiträume im Blick behalten." actions={<NativeButton onClick={() => void query.refresh()} disabled={!canRead || busy || query.refreshing}>Aktualisieren</NativeButton>}>
    {!canRead ? <WfmWebNotice>{check('office.employees.absences.view').reason ?? 'Keine Berechtigung.'}</WfmWebNotice> : <>
      {employeeFilter && <WfmWebNotice>Ansicht auf eine mitarbeitende Person begrenzt.<NativeButton disabled={!focused || busy} onClick={async () => { if ((comment.trim() || reason.trim()) && !await confirmNativeWorkspaceAction('Eingegebene Entscheidungstexte verwerfen?'))
            return; router.setParams({ employeeId: undefined, employee: undefined }); }}>Alle Mitarbeitenden</NativeButton></WfmWebNotice>}
      <NativeDiv className="wts-filters"><NativeLabel className="wts-field">Mitarbeitende suchen<NativeInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Name"/></NativeLabel><NativeLabel className="wts-field">Art<NativeSelect value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><NativeOption value="all">Alle Arten</NativeOption><NativeOption value="vacation">Urlaub</NativeOption><NativeOption value="absence">Weitere Abwesenheit</NativeOption></NativeSelect></NativeLabel><NativeLabel className="wts-field">Status in der Übersicht<NativeSelect value={status} onChange={e => setStatus(e.target.value)}><NativeOption value="all">Alle Status</NativeOption>{Object.entries(WFM_ABSENCE_STATUS_LABELS).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel></NativeDiv>
      {query.loading && <WfmWebNotice>Abwesenheiten werden geladen…</WfmWebNotice>}{(query.error || query.refreshError) && <WfmWebNotice tone="error">{query.error || query.refreshError}<NativeButton onClick={() => void query.refresh()}>Erneut laden</NativeButton></WfmWebNotice>}
      {error && <WfmWebNotice tone="error">{error}</WfmWebNotice>}{message && <WfmWebNotice tone="success">{message}</WfmWebNotice>}{warning && <WfmWebNotice>{warning}</WfmWebNotice>}
      {query.data && canApprove && <NativeDiv className="wts-split"><NativeSection className="wts-panel"><NativeH3>Offene Anträge · {approvals.length}</NativeH3>
        {!approvals.length && <NativeDiv className="wts-empty">Keine offenen Anträge für diese Auswahl.</NativeDiv>}
        {approvals.map(item => <NativeArticle key={item.approval.id} className="wts-row" data-selected={selectedId === item.approval.id}><NativeDiv className="wts-row-head"><NativeStrong>{item.employeeName}</NativeStrong><NativeButton disabled={busy} aria-expanded={selectedId === item.approval.id} onClick={async () => await choose(item.approval.id)}>Antrag prüfen</NativeButton></NativeDiv><NativeP>{item.absence ? `${WFM_ABSENCE_TYPE_LABELS[item.absence.absenceType]} · ${range(item.absence.startsAt, item.absence.endsAt)}` : 'Antrag ohne verknüpften Zeitraum'}</NativeP>{item.conflicts.length > 0 && <NativeSpan className="wts-badge" data-tone="warning">{item.conflicts.length} Hinweise</NativeSpan>}</NativeArticle>)}
      </NativeSection><NativeSection className="wts-panel"><NativeH3>{selected ? 'Entscheidung' : 'Antrag auswählen'}</NativeH3>
        {!selected ? <NativeP>Öffnen Sie einen Antrag, um Zeitraum, Hinweise und Entscheidung zu prüfen.</NativeP> : <><NativeDiv className="wts-row-head"><NativeStrong>{selected.employeeName}</NativeStrong><NativeButton onClick={async () => await choose(null)} disabled={busy}>Schließen</NativeButton></NativeDiv>
          {selected.absence && <NativeP>{WFM_ABSENCE_TYPE_LABELS[selected.absence.absenceType]} · {range(selected.absence.startsAt, selected.absence.endsAt)}</NativeP>}
          {selected.absence?.employeeNote && <NativeP>{selected.absence.employeeNote}</NativeP>}
          {selected.conflicts.map((conflict, index) => <WfmWebNotice key={`${conflict.code}-${index}`} tone={conflict.severity === 'error' ? 'error' : 'info'}>{conflict.message}</WfmWebNotice>)}
          <NativeDiv className="wts-stack"><NativeLabel className="wts-field">Kommentar zur Genehmigung (optional)<NativeTextarea value={comment} onChange={e => setComment(e.target.value)} disabled={busy}/></NativeLabel><NativeLabel className="wts-field">Grund bei Ablehnung<NativeTextarea value={reason} onChange={e => setReason(e.target.value)} disabled={busy}/></NativeLabel></NativeDiv>
          <NativeDiv className="wts-actions"><NativeButton className="wts-primary" onClick={() => void decide('approved')} disabled={busy || !!query.refreshError || selected.conflicts.some(c => c.severity === 'error')}>{busy ? 'Wird gespeichert…' : 'Genehmigen'}</NativeButton><NativeButton onClick={() => void decide('rejected')} disabled={busy || !!query.refreshError || !reason.trim()}>Ablehnen</NativeButton></NativeDiv>
        </>}
      </NativeSection></NativeDiv>}
      {query.data && canView && <NativeSection className="wts-panel"><NativeH3>Abwesenheitsübersicht · {overview.length}</NativeH3>{!overview.length && <NativeDiv className="wts-empty">Keine Abwesenheiten für diese Auswahl.</NativeDiv>}{overview.map(item => <NativeArticle className="wts-row" key={item.absence.id}><NativeDiv className="wts-row-head"><NativeStrong>{item.employeeName}</NativeStrong><NativeSpan className="wts-badge" data-tone={['approved', 'active', 'completed'].includes(item.absence.status) ? 'good' : item.absence.status === 'requested' ? 'warning' : 'muted'}>{WFM_ABSENCE_STATUS_LABELS[item.absence.status]}</NativeSpan></NativeDiv><NativeP>{WFM_ABSENCE_TYPE_LABELS[item.absence.absenceType]} · {range(item.absence.startsAt, item.absence.endsAt)}</NativeP>{item.absence.employeeNote && <NativeP>{item.absence.employeeNote}</NativeP>}</NativeArticle>)}</NativeSection>}
    </>}
  </WfmSecondaryWorkspace>;
}
