import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { triggerCsvDownload } from '@/lib/csv/csvDownload';
import type { ServiceResult } from '@/types';
import { buildInternalCsv, createExportDraft, finalizeExportBatch, validateExportBatch, listExportItems, type WfmTimeExportItem, type WfmTimeExportJob, type WfmTimeExportValidationResult, type WfmTimeExportReviewRow } from '@/lib/wfm/wfmTimeExportService';
import { draftReviewedTimeCorrectionExport, finalizeReviewedTimeCorrectionExport, getExportItemTimeline, getReviewExportState, listReviewedTimeCorrectionCandidates, listReviewedTimeExports, previewChangedAfterExport, validateCorrectionExportDraft, type WfmReviewDriftPreview, type WfmReviewExportState } from '@/lib/wfm/wfmTimeCorrectionExportService';
import { WFM_CORRECTION_REASON_MIN_LENGTH } from '@/lib/wfm/wfmTimeExportPolicy';
import { WfmSecondaryWorkspace, WfmWebNotice, useWfmUnsavedChanges } from './WfmSecondaryWorkspace.web';

const thisMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; };
const statusLabel: Record<WfmTimeExportJob['status'], string> = { draft: 'Entwurf', validated: 'Geprüft', finalized: 'Finalisiert', canceled: 'Abgebrochen', pending: 'Ausstehend', processing: 'In Bearbeitung', completed: 'Abgeschlossen', failed: 'Fehlgeschlagen' };
const itemLabel = (status?: WfmTimeExportItem['itemStatus']) => status === 'superseded' ? 'Ersetzt' : status === 'voided' ? 'Ungültig' : 'Aktiv';
const dateLabel = (date: string | null) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('de-DE') : 'Ohne Datum';
const take = <T,>(result: ServiceResult<T>): T => { if (!result.ok) throw new Error(result.error); return result.data; };
const kindLabels: Record<string, string> = { visit: 'Einsatz', session: 'Zeiterfassung', manual: 'Nachtrag', travel: 'Fahrzeit', meeting: 'Meeting' };
const kindLabel = (value: string) => kindLabels[value] ?? 'Arbeitszeit';
function reviewLabel(review: WfmTimeExportReviewRow) { const name = review.metadata?.employee_name ?? review.metadata?.employeeName; return `${dateLabel(review.workDate)} · ${typeof name === 'string' ? `${name} · ` : ''}${kindLabel(review.entryKind)}`; }

export function WfmExportScreen() {
  const params = useLocalSearchParams<{ month?: string | string[] }>(); const router = useRouter(); const focused = useIsFocused();
  const requestedMonth = Array.isArray(params.month) ? params.month[0] : params.month;
  const tenantId = useServiceTenantId(); const { user, profile } = useAuth(); const userId = user?.id ?? profile?.id ?? ''; const { can, check, roleKey } = usePermissions(); const canExport = can('time.tracking.admin.export');
  const scope = `${tenantId}:${userId}:${roleKey}:${canExport}`; const scopeRef = useRef(scope); scopeRef.current = scope;
  const [month, setMonth] = useState(() => requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : thisMonth()); const [busy, setBusy] = useState(false); const lock = useRef(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<WfmTimeExportJob | null>(null); const [validation, setValidation] = useState<WfmTimeExportValidationResult | null>(null);
  const [selected, setSelected] = useState<WfmReviewExportState | null>(null); const [drift, setDrift] = useState<WfmReviewDriftPreview | null>(null); const [timeline, setTimeline] = useState<WfmTimeExportItem[]>([]);
  const [reason, setReason] = useState(''); const [correctionDraft, setCorrectionDraft] = useState<WfmTimeExportJob | null>(null); const [previewItems, setPreviewItems] = useState<WfmTimeExportItem[]>([]); const [validatedReason, setValidatedReason] = useState<string | null>(null);
  useWfmUnsavedChanges(!!reason.trim() && !correctionDraft, busy);
  useEffect(() => { if (focused && !busy && requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) && requestedMonth !== month) { setMonth(requestedMonth); setDraft(null); setValidation(null); } }, [focused, requestedMonth, busy]);
  const changeMonth = (value: string) => { setMonth(value); setDraft(null); setValidation(null); setMessage(''); setError(''); if (focused) router.setParams({ month: value || undefined }); };
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) >= 1900 && Number(month.slice(0, 4)) <= 9999;
  const period = useMemo(() => { const [year, monthNumber] = month.split('-').map(Number); return { startDate: `${month}-01`, endDate: `${month}-${new Date(year, monthNumber, 0).getDate()}` }; }, [month]);
  const query = useAsyncQuery(useCallback(async () => {
    if (!tenantId || !canExport || !getSupabaseClient()) return { ok: false as const, error: 'Keine sichere Verbindung für den Arbeitszeitexport.' };
    const [history, candidates] = await Promise.all([listReviewedTimeExports(tenantId, roleKey, 50), listReviewedTimeCorrectionCandidates(tenantId, roleKey)]);
    if (!history.ok) return history; if (!candidates.ok) return candidates;
    return { ok: true as const, data: { history: history.data, candidates: candidates.data } };
  }, [tenantId, roleKey, canExport]), [tenantId, roleKey, canExport], { enabled: !!tenantId && !!userId && canExport, queryKey: scope });
  useEffect(() => { setDraft(null); setValidation(null); setSelected(null); setDrift(null); setTimeline([]); setReason(''); setCorrectionDraft(null); setPreviewItems([]); setValidatedReason(null); setError(''); setMessage(''); lock.current = false; setBusy(false); }, [scope]);
  const run = async (action: (current: () => boolean) => Promise<void>) => {
    if (lock.current || !tenantId || !userId || !canExport || !getSupabaseClient() || query.loading || query.error || query.refreshError) return;
    const requestedScope = scope; const current = () => scopeRef.current === requestedScope;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(current); } catch (cause) { if (current()) setError(cause instanceof Error ? cause.message : 'Export konnte nicht verarbeitet werden.'); }
    finally { if (current()) { lock.current = false; setBusy(false); } }
  };
  const prepare = () => run(async current => {
    if (!validMonth) throw new Error('Bitte einen gültigen Monat auswählen.');
    setDraft(null); setValidation(null);
    const prepared = take(await createExportDraft(tenantId!, userId, roleKey, period)); if (!current()) return;
    setDraft(prepared.job); // Keep the saved draft available when its validation needs a retry.
    const checked = take(await validateExportBatch(tenantId!, roleKey, prepared.job.id)); if (!current()) return;
    setValidation(checked); setMessage(`${checked.exportableCount} Einträge freigegeben, ${checked.blockedCount} Einträge blockiert.`); await query.refresh();
  });
  const validate = () => run(async current => { if (!draft) return; const checked = take(await validateExportBatch(tenantId!, roleKey, draft.id)); if (current()) setValidation(checked); });
  const finalize = () => run(async current => {
    if (!draft || !validation?.valid || validation.exportableCount < 1) return;
    if (!window.confirm(`${validation.exportableCount} geprüfte Einträge endgültig für den Export übernehmen?`)) return;
    const result = take(await finalizeExportBatch(tenantId!, userId, roleKey, draft.id)); if (!current()) return;
    setDraft(result.job); setValidation(null); setMessage(`${result.exportedCount} Einträge finalisiert. Der CSV-Download ist jetzt verfügbar.`); await query.refresh();
  });
  const download = (job: WfmTimeExportJob) => run(async current => {
    const result = take(await buildInternalCsv(tenantId!, roleKey, job.id)); if (!current()) return;
    triggerCsvDownload(result.csv, `arbeitszeit-${job.periodStart ?? 'export'}-${job.id.slice(0, 8)}.csv`); setMessage(`CSV-Download mit ${result.rowCount} Zeilen gestartet.`);
  });
  const openCorrection = (reviewId: string) => run(async current => {
    if (reason.trim() && !window.confirm('Eingegebenen Korrekturgrund verwerfen?')) return;
    setSelected(null); setDrift(null); setTimeline([]); setCorrectionDraft(null); setPreviewItems([]); setValidatedReason(null); setReason('');
    const [stateResult, driftResult] = await Promise.all([getReviewExportState(tenantId!, roleKey, reviewId), previewChangedAfterExport(tenantId!, roleKey, reviewId)]);
    const state = take(stateResult); const changed = take(driftResult); if (!current()) return;
    setSelected(state); setDrift(changed);
    if (state?.pendingReexportJobId) {
      const pending = query.data?.history.find(job => job.id === state.pendingReexportJobId);
      if (!pending) throw new Error('Ein gespeicherter Korrekturentwurf ist vorhanden, liegt aber außerhalb des geladenen Exportverlaufs. Bitte den Exportverlauf prüfen, bevor ein neuer Entwurf erstellt wird.');
      const savedItems = take(await listExportItems(tenantId!, roleKey, pending.id)); if (!current()) return;
      setCorrectionDraft(pending); setPreviewItems(savedItems); setReason(pending.correctionReason ?? '');
    }
    const key = state?.activeItem?.logicalReferenceKey ?? state?.activeItem?.referenceKey;
    if (key) { const items = take(await getExportItemTimeline(tenantId!, roleKey, key)); if (current()) setTimeline(items); }
  });
  const draftCorrection = () => run(async current => {
    if (!selected?.lastExportJobId || selected.pendingReexportJobId || reason.trim().length < WFM_CORRECTION_REASON_MIN_LENGTH) return;
    const result = take(await draftReviewedTimeCorrectionExport(tenantId!, userId, roleKey, { reviewIds: [selected.id], correctionOfExportJobId: selected.lastExportJobId, reason: reason.trim() })); if (!current()) return;
    setCorrectionDraft(result.job); setPreviewItems(result.previewItems); setValidatedReason(null); setMessage('Korrekturentwurf gespeichert. Prüfen Sie die Vorschau und validieren Sie den Export.'); await query.refresh();
  });
  const validateCorrection = () => run(async current => {
    if (!correctionDraft || reason.trim().length < WFM_CORRECTION_REASON_MIN_LENGTH) return;
    const result = take(await validateCorrectionExportDraft(tenantId!, roleKey, correctionDraft.id, reason.trim())); if (!current()) return;
    if (!result.valid) { setValidatedReason(null); throw new Error(result.reasonError ?? 'Der Korrekturentwurf ist nicht gültig.'); }
    setValidatedReason(reason.trim()); setMessage('Korrekturentwurf geprüft und zur Finalisierung bereit.');
  });
  const finalizeCorrection = () => run(async current => {
    if (!correctionDraft || validatedReason !== reason.trim() || !previewItems.length) return;
    if (!window.confirm('Geprüften Korrekturexport finalisieren? Der ursprüngliche Export bleibt im Verlauf erhalten.')) return;
    take(await finalizeReviewedTimeCorrectionExport(tenantId!, userId, roleKey, correctionDraft.id, reason.trim())); if (!current()) return;
    setCorrectionDraft(null); setPreviewItems([]); setValidatedReason(null); setSelected(null); setReason(''); setDrift(null); setTimeline([]); setMessage('Korrekturexport finalisiert. Die CSV-Datei steht im Exportverlauf bereit.'); await query.refresh();
  });
  const blocked = busy || query.loading || !!query.error || !!query.refreshError;
  const reasonValid = reason.trim().length >= WFM_CORRECTION_REASON_MIN_LENGTH;
  return <WfmSecondaryWorkspace title="Arbeitszeit-Export" description="Freigegebene Zeiten prüfen, finalisieren und als CSV herunterladen." actions={<button onClick={() => void query.refresh()} disabled={!canExport || busy || query.refreshing}>Aktualisieren</button>}>
    {!canExport ? <WfmWebNotice>{check('time.tracking.admin.export').reason ?? 'Keine Berechtigung.'}</WfmWebNotice> : <>
      {query.loading && <WfmWebNotice>Exportdaten werden geladen…</WfmWebNotice>}{(query.error || query.refreshError) && <WfmWebNotice tone="error">{query.error || query.refreshError}</WfmWebNotice>}{busy && <WfmWebNotice>Export wird verarbeitet…</WfmWebNotice>}{error && <WfmWebNotice tone="error">{error}</WfmWebNotice>}{message && <WfmWebNotice tone="success">{message}</WfmWebNotice>}
      <section className="wts-panel"><h3>Monatsexport</h3><div className="wts-filters"><label className="wts-field">Abrechnungsmonat<input type="month" value={month} min="1900-01" max="9999-12" disabled={busy} onChange={e => changeMonth(e.target.value)} /></label><button className="wts-primary" disabled={blocked || !validMonth} onClick={() => void prepare()}>Export vorbereiten</button></div>
        <p>Nur geprüfte und freigegebene Einträge werden übernommen. Nicht freigegebene oder unvollständige Einträge erscheinen mit ihrem Sperrgrund.</p>
        {draft && <div className="wts-row"><div className="wts-row-head"><strong>{dateLabel(draft.periodStart)} – {dateLabel(draft.periodEnd)}</strong><span className="wts-badge" data-tone={draft.status === 'finalized' ? 'good' : 'warning'}>{statusLabel[draft.status]}</span></div>
          {validation && <><p>{validation.exportableCount} exportierbar · {validation.blockedCount} blockiert</p><details><summary>Einträge und Sperrgründe anzeigen</summary>{validation.exportableReviews.map(review => <p key={review.id}>{reviewLabel(review)} · Freigegeben</p>)}{validation.blockedReviews.map(review => <p key={review.reviewId}>{review.reasonLabel}<small className="wts-muted"> · Referenz {review.referenceKey}</small></p>)}</details></>}
          <div className="wts-actions">{draft.status === 'finalized' ? <button className="wts-primary" disabled={blocked} onClick={() => void download(draft)}>CSV herunterladen</button> : <><button disabled={blocked} onClick={() => void validate()}>Entwurf erneut prüfen</button><button className="wts-primary" disabled={blocked || !validation?.valid || validation.exportableCount === 0} onClick={() => void finalize()}>Export finalisieren</button></>}</div>
        </div>}
      </section>
      <section className="wts-panel"><h3>Exportverlauf</h3><p>Bis zu 50 zuletzt erstellte Exporte. Gespeicherte Entwürfe können erneut geprüft werden.</p>{query.data && !query.data.history.length && <div className="wts-empty">Noch keine Exporte gespeichert.</div>}{(query.data?.history ?? []).map(job => <article className="wts-row" key={job.id}><div className="wts-row-head"><div><strong>{dateLabel(job.periodStart)} – {dateLabel(job.periodEnd)}</strong><p>{job.exportType === 'reviewed_time_correction' ? 'Korrekturexport' : 'Monatsexport'} · {statusLabel[job.status]} · {job.rowCount} Einträge</p></div>{job.status === 'finalized' ? <button disabled={blocked} onClick={() => void download(job)}>CSV herunterladen</button> : job.exportType === 'reviewed_time' && (job.status === 'draft' || job.status === 'validated') ? <button disabled={blocked} onClick={() => { setDraft(job); setValidation(null); if (job.periodStart) { setMonth(job.periodStart.slice(0, 7)); if (focused) router.setParams({ month: job.periodStart.slice(0, 7) }); } setMessage('Gespeicherten Entwurf geöffnet. Bitte vor der Finalisierung erneut prüfen.'); }}>Entwurf öffnen</button> : null}</div></article>)}</section>
      <section className="wts-panel"><h3>Korrekturexporte</h3><p>Änderungen an bereits exportierten Zeiten werden mit Begründung und eigenem Export dokumentiert.</p>{query.data && !query.data.candidates.length && <div className="wts-empty">Keine nachträglich geänderten Exporte.</div>}
        {(query.data?.candidates ?? []).map(review => <article className="wts-row" key={review.id}><div className="wts-row-head"><div><strong>{reviewLabel(review)}</strong><p>Exportversion {review.exportVersion ?? 1}{review.pendingReexportJobId ? ' · Korrekturentwurf vorhanden' : ''}</p></div><button disabled={blocked} onClick={() => void openCorrection(review.id)}>{selected?.id === review.id ? 'Erneut prüfen' : 'Korrektur prüfen'}</button></div></article>)}
      </section>
      {selected && <section className="wts-panel"><h3>Korrektur prüfen</h3><p>{reviewLabel(selected)} · Exportversion {selected.exportVersion ?? 1}</p>{drift && <WfmWebNotice>{drift.changed ? `Exportrelevante Änderung erkannt${drift.delta?.deltaMinutes != null ? ` · Zeitdifferenz ${drift.delta.deltaMinutes} Minuten` : ''}.` : 'Keine exportrelevante Änderung erkannt.'}</WfmWebNotice>}
        <label className="wts-field">Korrekturgrund (mindestens {WFM_CORRECTION_REASON_MIN_LENGTH} Zeichen)<textarea value={reason} disabled={busy || !!correctionDraft} onChange={e => { setReason(e.target.value); setValidatedReason(null); }} /></label>
        {!correctionDraft && <div className="wts-actions"><button className="wts-primary" disabled={blocked || !reasonValid || !selected.lastExportJobId || !!selected.pendingReexportJobId} onClick={() => void draftCorrection()}>Korrekturentwurf erstellen</button></div>}
        {!!previewItems.length && <div className="wts-row"><h3>Vorschau</h3>{previewItems.map(item => <p key={item.id}>{dateLabel(item.periodDate)} · {kindLabel(item.entryKind)} · {item.minutesTotal} Minuten · {itemLabel(item.itemStatus)}</p>)}</div>}
        {correctionDraft && <div className="wts-actions"><button disabled={blocked || !reasonValid} onClick={() => void validateCorrection()}>Korrektur validieren</button><button className="wts-primary" disabled={blocked || !reasonValid || validatedReason !== reason.trim() || !previewItems.length} onClick={() => void finalizeCorrection()}>Korrekturexport finalisieren</button></div>}
        {!!timeline.length && <details className="wts-row"><summary>Exportverlauf des Eintrags</summary>{timeline.map(item => <p key={item.id}>Version {item.exportSequence ?? 1} · {item.minutesTotal} Minuten · {itemLabel(item.itemStatus)}</p>)}</details>}
      </section>}
    </>}
  </WfmSecondaryWorkspace>;
}
