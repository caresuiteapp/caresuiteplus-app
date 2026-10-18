import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { listWfmAbsenceApprovalDetails, listWfmAbsenceOverviewDetails, reviewWfmAbsenceRequest } from '@/lib/wfm';
import { WFM_ABSENCE_STATUS_LABELS, WFM_ABSENCE_TYPE_LABELS } from '@/types/modules/wfm';
import { WfmSecondaryWorkspace, WfmWebNotice, useWfmUnsavedChanges } from './WfmSecondaryWorkspace.web';

function range(start: string, end: string) { return `${new Date(start).toLocaleDateString('de-DE')} – ${new Date(end).toLocaleDateString('de-DE')}`; }

export function WfmEmployeeRequestsOfficeScreen() {
  const params = useLocalSearchParams<{ employeeId?: string | string[] }>(); const router = useRouter(); const focused = useIsFocused(); const employeeFilter = Array.isArray(params.employeeId) ? params.employeeId[0] : params.employeeId;
  const tenantId = useServiceTenantId(); const { user, profile } = useAuth(); const reviewerId = user?.id ?? profile?.id ?? '';
  const { can, check, roleKey } = usePermissions(); const canApprove = can('office.employees.absences.approve'); const canView = can('office.employees.absences.view'); const canRead = canView || canApprove;
  const [filter, setFilter] = useState<'all' | 'vacation' | 'absence'>('all'); const [status, setStatus] = useState('all'); const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null); const [comment, setComment] = useState(''); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false); const lock = useRef(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [warning, setWarning] = useState('');
  useWfmUnsavedChanges(!!selectedId && !!(comment.trim() || reason.trim()), busy);
  const scope = `${tenantId}:${reviewerId}:${roleKey}:${canApprove}:${canView}`; const scopeRef = useRef(scope); scopeRef.current = scope;
  useEffect(() => { setSelectedId(null); setComment(''); setReason(''); setError(''); setMessage(''); setWarning(''); setBusy(false); lock.current = false; }, [scope]);
  useEffect(() => { setSelectedId(null); setComment(''); setReason(''); }, [employeeFilter]);
  const query = useAsyncQuery(useCallback(async () => {
    if (!tenantId || !canRead) return { ok: false as const, error: 'Keine Berechtigung.' };
    const [approvals, overview] = await Promise.all([canApprove ? listWfmAbsenceApprovalDetails(tenantId, roleKey) : Promise.resolve({ ok: true as const, data: [] }), canView ? listWfmAbsenceOverviewDetails(tenantId, roleKey) : Promise.resolve({ ok: true as const, data: [] })]);
    if (!approvals.ok) return approvals; if (!overview.ok) return overview;
    return { ok: true as const, data: { approvals: approvals.data, overview: overview.data } };
  }, [tenantId, roleKey, canRead, canApprove, canView]), [tenantId, roleKey, canRead, canApprove, canView], { enabled: !!tenantId && !!reviewerId && canRead, queryKey: scope });
  const matches = (name: string, type: string) => name.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE')) && (filter === 'all' || (filter === 'vacation' ? type === 'vacation' : type !== 'vacation'));
  const approvals = (query.data?.approvals ?? []).filter(item => (!employeeFilter || item.approval.employeeId === employeeFilter) && matches(item.employeeName, item.absence?.absenceType ?? item.approval.approvalType));
  const overview = (query.data?.overview ?? []).filter(item => (!employeeFilter || item.absence.employeeId === employeeFilter) && matches(item.employeeName, item.absence.absenceType) && (status === 'all' || item.absence.status === status));
  const selected = query.data?.approvals.find(item => item.approval.id === selectedId);
  const choose = (id: string | null) => { if (busy || id === selectedId || ((comment.trim() || reason.trim()) && !window.confirm('Eingegebene Entscheidungstexte verwerfen?'))) return; setSelectedId(id); setComment(''); setReason(''); setError(''); };
  const decide = async (decision: 'approved' | 'rejected') => {
    if (lock.current || !tenantId || !reviewerId || !canApprove || !selected || query.loading || query.refreshError) return;
    if (decision === 'rejected' && !reason.trim()) { setError('Bitte einen Ablehnungsgrund eingeben.'); return; }
    const requestedScope = scope; lock.current = true; setBusy(true); setError(''); setMessage(''); setWarning('');
    try {
      const result = await reviewWfmAbsenceRequest(tenantId, reviewerId, roleKey, selected.approval.id, decision, { rejectionReason: decision === 'rejected' ? reason.trim() : undefined, approvalComment: decision === 'approved' ? comment.trim() : undefined });
      if (scopeRef.current !== requestedScope) return;
      if (!result.ok) { setError(result.error); return; }
      setSelectedId(null); setReason(''); setComment(''); setMessage(decision === 'approved' ? 'Antrag genehmigt.' : 'Antrag abgelehnt.'); setWarning(result.data.calendarSyncWarning ?? '');
      await query.refresh();
    } catch (cause) { if (scopeRef.current === requestedScope) setError(cause instanceof Error ? cause.message : 'Die Entscheidung konnte nicht gespeichert werden.'); }
    finally { if (scopeRef.current === requestedScope) { lock.current = false; setBusy(false); } }
  };
  return <WfmSecondaryWorkspace title="Abwesenheiten" description="Anträge prüfen und genehmigte Zeiträume im Blick behalten." actions={<button onClick={() => void query.refresh()} disabled={!canRead || busy || query.refreshing}>Aktualisieren</button>}>
    {!canRead ? <WfmWebNotice>{check('office.employees.absences.view').reason ?? 'Keine Berechtigung.'}</WfmWebNotice> : <>
      {employeeFilter && <WfmWebNotice>Ansicht auf eine mitarbeitende Person begrenzt.<button disabled={!focused || busy} onClick={() => { if ((comment.trim() || reason.trim()) && !window.confirm('Eingegebene Entscheidungstexte verwerfen?')) return; router.setParams({ employeeId: undefined, employee: undefined }); }}>Alle Mitarbeitenden</button></WfmWebNotice>}
      <div className="wts-filters"><label className="wts-field">Mitarbeitende suchen<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name" /></label><label className="wts-field">Art<select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="all">Alle Arten</option><option value="vacation">Urlaub</option><option value="absence">Weitere Abwesenheit</option></select></label><label className="wts-field">Status in der Übersicht<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">Alle Status</option>{Object.entries(WFM_ABSENCE_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      {query.loading && <WfmWebNotice>Abwesenheiten werden geladen…</WfmWebNotice>}{(query.error || query.refreshError) && <WfmWebNotice tone="error">{query.error || query.refreshError}<button onClick={() => void query.refresh()}>Erneut laden</button></WfmWebNotice>}
      {error && <WfmWebNotice tone="error">{error}</WfmWebNotice>}{message && <WfmWebNotice tone="success">{message}</WfmWebNotice>}{warning && <WfmWebNotice>{warning}</WfmWebNotice>}
      {query.data && canApprove && <div className="wts-split"><section className="wts-panel"><h3>Offene Anträge · {approvals.length}</h3>
        {!approvals.length && <div className="wts-empty">Keine offenen Anträge für diese Auswahl.</div>}
        {approvals.map(item => <article key={item.approval.id} className="wts-row" data-selected={selectedId === item.approval.id}><div className="wts-row-head"><strong>{item.employeeName}</strong><button disabled={busy} aria-expanded={selectedId === item.approval.id} onClick={() => choose(item.approval.id)}>Antrag prüfen</button></div><p>{item.absence ? `${WFM_ABSENCE_TYPE_LABELS[item.absence.absenceType]} · ${range(item.absence.startsAt, item.absence.endsAt)}` : 'Antrag ohne verknüpften Zeitraum'}</p>{item.conflicts.length > 0 && <span className="wts-badge" data-tone="warning">{item.conflicts.length} Hinweise</span>}</article>)}
      </section><section className="wts-panel"><h3>{selected ? 'Entscheidung' : 'Antrag auswählen'}</h3>
        {!selected ? <p>Öffnen Sie einen Antrag, um Zeitraum, Hinweise und Entscheidung zu prüfen.</p> : <><div className="wts-row-head"><strong>{selected.employeeName}</strong><button onClick={() => choose(null)} disabled={busy}>Schließen</button></div>
          {selected.absence && <p>{WFM_ABSENCE_TYPE_LABELS[selected.absence.absenceType]} · {range(selected.absence.startsAt, selected.absence.endsAt)}</p>}
          {selected.absence?.employeeNote && <p>{selected.absence.employeeNote}</p>}
          {selected.conflicts.map((conflict, index) => <WfmWebNotice key={`${conflict.code}-${index}`} tone={conflict.severity === 'error' ? 'error' : 'info'}>{conflict.message}</WfmWebNotice>)}
          <div className="wts-stack"><label className="wts-field">Kommentar zur Genehmigung (optional)<textarea value={comment} onChange={e => setComment(e.target.value)} disabled={busy} /></label><label className="wts-field">Grund bei Ablehnung<textarea value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /></label></div>
          <div className="wts-actions"><button className="wts-primary" onClick={() => void decide('approved')} disabled={busy || !!query.refreshError || selected.conflicts.some(c => c.severity === 'error')}>{busy ? 'Wird gespeichert…' : 'Genehmigen'}</button><button onClick={() => void decide('rejected')} disabled={busy || !!query.refreshError || !reason.trim()}>Ablehnen</button></div>
        </>}
      </section></div>}
      {query.data && canView && <section className="wts-panel"><h3>Abwesenheitsübersicht · {overview.length}</h3>{!overview.length && <div className="wts-empty">Keine Abwesenheiten für diese Auswahl.</div>}{overview.map(item => <article className="wts-row" key={item.absence.id}><div className="wts-row-head"><strong>{item.employeeName}</strong><span className="wts-badge" data-tone={['approved', 'active', 'completed'].includes(item.absence.status) ? 'good' : item.absence.status === 'requested' ? 'warning' : 'muted'}>{WFM_ABSENCE_STATUS_LABELS[item.absence.status]}</span></div><p>{WFM_ABSENCE_TYPE_LABELS[item.absence.absenceType]} · {range(item.absence.startsAt, item.absence.endsAt)}</p>{item.absence.employeeNote && <p>{item.absence.employeeNote}</p>}</article>)}</section>}
    </>}
  </WfmSecondaryWorkspace>;
}
