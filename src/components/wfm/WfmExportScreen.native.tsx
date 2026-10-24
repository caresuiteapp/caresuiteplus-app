// Generated native presentation from src/components/wfm/WfmExportScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeButton,NativeSection,NativeH3,NativeDiv,NativeLabel,NativeInput,NativeP,NativeStrong,NativeSpan,NativeDetails,NativeSummary,NativeSmall,NativeArticle,NativeTextarea} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { getSupabaseClient } from "../../lib/supabase/client.ts";
import { triggerCsvDownload } from '@/lib/csv/csvDownload';
import type { ServiceResult } from '@/types';
import { buildInternalCsv, createExportDraft, finalizeExportBatch, validateExportBatch, listExportItems, type WfmTimeExportItem, type WfmTimeExportJob, type WfmTimeExportValidationResult, type WfmTimeExportReviewRow } from '@/lib/wfm/wfmTimeExportService';
import { draftReviewedTimeCorrectionExport, finalizeReviewedTimeCorrectionExport, getExportItemTimeline, getReviewExportState, listReviewedTimeCorrectionCandidates, listReviewedTimeExports, previewChangedAfterExport, validateCorrectionExportDraft, type WfmReviewDriftPreview, type WfmReviewExportState } from '@/lib/wfm/wfmTimeCorrectionExportService';
import { WFM_CORRECTION_REASON_MIN_LENGTH } from '@/lib/wfm/wfmTimeExportPolicy';
import { WfmSecondaryWorkspace, WfmWebNotice, useWfmUnsavedChanges } from "./WfmSecondaryWorkspace.native.tsx";
const thisMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; };
const statusLabel: Record<WfmTimeExportJob['status'], string> = { draft: 'Entwurf', validated: 'Geprüft', finalized: 'Finalisiert', canceled: 'Abgebrochen', pending: 'Ausstehend', processing: 'In Bearbeitung', completed: 'Abgeschlossen', failed: 'Fehlgeschlagen' };
const itemLabel = (status?: WfmTimeExportItem['itemStatus']) => status === 'superseded' ? 'Ersetzt' : status === 'voided' ? 'Ungültig' : 'Aktiv';
const dateLabel = (date: string | null) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('de-DE') : 'Ohne Datum';
const take = <T,>(result: ServiceResult<T>): T => { if (!result.ok)
    throw new Error(result.error); return result.data; };
const kindLabels: Record<string, string> = { visit: 'Einsatz', session: 'Zeiterfassung', manual: 'Nachtrag', travel: 'Fahrzeit', meeting: 'Meeting' };
const kindLabel = (value: string) => kindLabels[value] ?? 'Arbeitszeit';
function reviewLabel(review: WfmTimeExportReviewRow) { const name = review.metadata?.employee_name ?? review.metadata?.employeeName; return `${dateLabel(review.workDate)} · ${typeof name === 'string' ? `${name} · ` : ''}${kindLabel(review.entryKind)}`; }
export function WfmExportScreen() {
    const params = useLocalSearchParams<{
        month?: string | string[];
    }>();
    const router = useRouter();
    const focused = useIsFocused();
    const requestedMonth = Array.isArray(params.month) ? params.month[0] : params.month;
    const tenantId = useServiceTenantId();
    const { user, profile } = useAuth();
    const userId = user?.id ?? profile?.id ?? '';
    const { can, check, roleKey } = usePermissions();
    const canExport = can('time.tracking.admin.export');
    const scope = `${tenantId}:${userId}:${roleKey}:${canExport}`;
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    const [month, setMonth] = useState(() => requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : thisMonth());
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [draft, setDraft] = useState<WfmTimeExportJob | null>(null);
    const [validation, setValidation] = useState<WfmTimeExportValidationResult | null>(null);
    const [selected, setSelected] = useState<WfmReviewExportState | null>(null);
    const [drift, setDrift] = useState<WfmReviewDriftPreview | null>(null);
    const [timeline, setTimeline] = useState<WfmTimeExportItem[]>([]);
    const [reason, setReason] = useState('');
    const [correctionDraft, setCorrectionDraft] = useState<WfmTimeExportJob | null>(null);
    const [previewItems, setPreviewItems] = useState<WfmTimeExportItem[]>([]);
    const [validatedReason, setValidatedReason] = useState<string | null>(null);
    useWfmUnsavedChanges(!!reason.trim() && !correctionDraft, busy);
    useEffect(() => { if (focused && !busy && requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) && requestedMonth !== month) {
        setMonth(requestedMonth);
        setDraft(null);
        setValidation(null);
    } }, [focused, requestedMonth, busy]);
    const changeMonth = (value: string) => { setMonth(value); setDraft(null); setValidation(null); setMessage(''); setError(''); if (focused)
        router.setParams({ month: value || undefined }); };
    const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) >= 1900 && Number(month.slice(0, 4)) <= 9999;
    const period = useMemo(() => { const [year, monthNumber] = month.split('-').map(Number); return { startDate: `${month}-01`, endDate: `${month}-${new Date(year, monthNumber, 0).getDate()}` }; }, [month]);
    const query = useAsyncQuery(useCallback(async () => {
        if (!tenantId || !canExport || !getSupabaseClient())
            return { ok: false as const, error: 'Keine sichere Verbindung für den Arbeitszeitexport.' };
        const [history, candidates] = await Promise.all([listReviewedTimeExports(tenantId, roleKey, 50), listReviewedTimeCorrectionCandidates(tenantId, roleKey)]);
        if (!history.ok)
            return history;
        if (!candidates.ok)
            return candidates;
        return { ok: true as const, data: { history: history.data, candidates: candidates.data } };
    }, [tenantId, roleKey, canExport]), [tenantId, roleKey, canExport], { enabled: !!tenantId && !!userId && canExport, queryKey: scope });
    useEffect(() => { setDraft(null); setValidation(null); setSelected(null); setDrift(null); setTimeline([]); setReason(''); setCorrectionDraft(null); setPreviewItems([]); setValidatedReason(null); setError(''); setMessage(''); lock.current = false; setBusy(false); }, [scope]);
    const run = async (action: (current: () => boolean) => Promise<void>) => {
        if (lock.current || !tenantId || !userId || !canExport || !getSupabaseClient() || query.loading || query.error || query.refreshError)
            return;
        const requestedScope = scope;
        const current = () => scopeRef.current === requestedScope;
        lock.current = true;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            await action(current);
        }
        catch (cause) {
            if (current())
                setError(cause instanceof Error ? cause.message : 'Export konnte nicht verarbeitet werden.');
        }
        finally {
            if (current()) {
                lock.current = false;
                setBusy(false);
            }
        }
    };
    const prepare = () => run(async (current) => {
        if (!validMonth)
            throw new Error('Bitte einen gültigen Monat auswählen.');
        setDraft(null);
        setValidation(null);
        const prepared = take(await createExportDraft(tenantId!, userId, roleKey, period));
        if (!current())
            return;
        setDraft(prepared.job); // Keep the saved draft available when its validation needs a retry.
        const checked = take(await validateExportBatch(tenantId!, roleKey, prepared.job.id));
        if (!current())
            return;
        setValidation(checked);
        setMessage(`${checked.exportableCount} Einträge freigegeben, ${checked.blockedCount} Einträge blockiert.`);
        await query.refresh();
    });
    const validate = () => run(async (current) => { if (!draft)
        return; const checked = take(await validateExportBatch(tenantId!, roleKey, draft.id)); if (current())
        setValidation(checked); });
    const finalize = () => run(async (current) => {
        if (!draft || !validation?.valid || validation.exportableCount < 1)
            return;
        if (!await confirmNativeWorkspaceAction(`${validation.exportableCount} geprüfte Einträge endgültig für den Export übernehmen?`))
            return;
        const result = take(await finalizeExportBatch(tenantId!, userId, roleKey, draft.id));
        if (!current())
            return;
        setDraft(result.job);
        setValidation(null);
        setMessage(`${result.exportedCount} Einträge finalisiert. Der CSV-Download ist jetzt verfügbar.`);
        await query.refresh();
    });
    const download = (job: WfmTimeExportJob) => run(async (current) => {
        const result = take(await buildInternalCsv(tenantId!, roleKey, job.id));
        if (!current())
            return;
        triggerCsvDownload(result.csv, `arbeitszeit-${job.periodStart ?? 'export'}-${job.id.slice(0, 8)}.csv`);
        setMessage(`CSV-Download mit ${result.rowCount} Zeilen gestartet.`);
    });
    const openCorrection = (reviewId: string) => run(async (current) => {
        if (reason.trim() && !await confirmNativeWorkspaceAction('Eingegebenen Korrekturgrund verwerfen?'))
            return;
        setSelected(null);
        setDrift(null);
        setTimeline([]);
        setCorrectionDraft(null);
        setPreviewItems([]);
        setValidatedReason(null);
        setReason('');
        const [stateResult, driftResult] = await Promise.all([getReviewExportState(tenantId!, roleKey, reviewId), previewChangedAfterExport(tenantId!, roleKey, reviewId)]);
        const state = take(stateResult);
        const changed = take(driftResult);
        if (!current())
            return;
        setSelected(state);
        setDrift(changed);
        if (state?.pendingReexportJobId) {
            const pending = query.data?.history.find(job => job.id === state.pendingReexportJobId);
            if (!pending)
                throw new Error('Ein gespeicherter Korrekturentwurf ist vorhanden, liegt aber außerhalb des geladenen Exportverlaufs. Bitte den Exportverlauf prüfen, bevor ein neuer Entwurf erstellt wird.');
            const savedItems = take(await listExportItems(tenantId!, roleKey, pending.id));
            if (!current())
                return;
            setCorrectionDraft(pending);
            setPreviewItems(savedItems);
            setReason(pending.correctionReason ?? '');
        }
        const key = state?.activeItem?.logicalReferenceKey ?? state?.activeItem?.referenceKey;
        if (key) {
            const items = take(await getExportItemTimeline(tenantId!, roleKey, key));
            if (current())
                setTimeline(items);
        }
    });
    const draftCorrection = () => run(async (current) => {
        if (!selected?.lastExportJobId || selected.pendingReexportJobId || reason.trim().length < WFM_CORRECTION_REASON_MIN_LENGTH)
            return;
        const result = take(await draftReviewedTimeCorrectionExport(tenantId!, userId, roleKey, { reviewIds: [selected.id], correctionOfExportJobId: selected.lastExportJobId, reason: reason.trim() }));
        if (!current())
            return;
        setCorrectionDraft(result.job);
        setPreviewItems(result.previewItems);
        setValidatedReason(null);
        setMessage('Korrekturentwurf gespeichert. Prüfen Sie die Vorschau und validieren Sie den Export.');
        await query.refresh();
    });
    const validateCorrection = () => run(async (current) => {
        if (!correctionDraft || reason.trim().length < WFM_CORRECTION_REASON_MIN_LENGTH)
            return;
        const result = take(await validateCorrectionExportDraft(tenantId!, roleKey, correctionDraft.id, reason.trim()));
        if (!current())
            return;
        if (!result.valid) {
            setValidatedReason(null);
            throw new Error(result.reasonError ?? 'Der Korrekturentwurf ist nicht gültig.');
        }
        setValidatedReason(reason.trim());
        setMessage('Korrekturentwurf geprüft und zur Finalisierung bereit.');
    });
    const finalizeCorrection = () => run(async (current) => {
        if (!correctionDraft || validatedReason !== reason.trim() || !previewItems.length)
            return;
        if (!await confirmNativeWorkspaceAction('Geprüften Korrekturexport finalisieren? Der ursprüngliche Export bleibt im Verlauf erhalten.'))
            return;
        take(await finalizeReviewedTimeCorrectionExport(tenantId!, userId, roleKey, correctionDraft.id, reason.trim()));
        if (!current())
            return;
        setCorrectionDraft(null);
        setPreviewItems([]);
        setValidatedReason(null);
        setSelected(null);
        setReason('');
        setDrift(null);
        setTimeline([]);
        setMessage('Korrekturexport finalisiert. Die CSV-Datei steht im Exportverlauf bereit.');
        await query.refresh();
    });
    const blocked = busy || query.loading || !!query.error || !!query.refreshError;
    const reasonValid = reason.trim().length >= WFM_CORRECTION_REASON_MIN_LENGTH;
    return <WfmSecondaryWorkspace title="Arbeitszeit-Export" description="Freigegebene Zeiten prüfen, finalisieren und als CSV herunterladen." actions={<NativeButton onClick={() => void query.refresh()} disabled={!canExport || busy || query.refreshing}>Aktualisieren</NativeButton>}>
    {!canExport ? <WfmWebNotice>{check('time.tracking.admin.export').reason ?? 'Keine Berechtigung.'}</WfmWebNotice> : <>
      {query.loading && <WfmWebNotice>Exportdaten werden geladen…</WfmWebNotice>}{(query.error || query.refreshError) && <WfmWebNotice tone="error">{query.error || query.refreshError}</WfmWebNotice>}{busy && <WfmWebNotice>Export wird verarbeitet…</WfmWebNotice>}{error && <WfmWebNotice tone="error">{error}</WfmWebNotice>}{message && <WfmWebNotice tone="success">{message}</WfmWebNotice>}
      <NativeSection className="wts-panel"><NativeH3>Monatsexport</NativeH3><NativeDiv className="wts-filters"><NativeLabel className="wts-field">Abrechnungsmonat<NativeInput type="month" value={month} min="1900-01" max="9999-12" disabled={busy} onChange={e => changeMonth(e.target.value)}/></NativeLabel><NativeButton className="wts-primary" disabled={blocked || !validMonth} onClick={() => void prepare()}>Export vorbereiten</NativeButton></NativeDiv>
        <NativeP>Nur geprüfte und freigegebene Einträge werden übernommen. Nicht freigegebene oder unvollständige Einträge erscheinen mit ihrem Sperrgrund.</NativeP>
        {draft && <NativeDiv className="wts-row"><NativeDiv className="wts-row-head"><NativeStrong>{dateLabel(draft.periodStart)} – {dateLabel(draft.periodEnd)}</NativeStrong><NativeSpan className="wts-badge" data-tone={draft.status === 'finalized' ? 'good' : 'warning'}>{statusLabel[draft.status]}</NativeSpan></NativeDiv>
          {validation && <><NativeP>{validation.exportableCount} exportierbar · {validation.blockedCount} blockiert</NativeP><NativeDetails><NativeSummary>Einträge und Sperrgründe anzeigen</NativeSummary>{validation.exportableReviews.map(review => <NativeP key={review.id}>{reviewLabel(review)} · Freigegeben</NativeP>)}{validation.blockedReviews.map(review => <NativeP key={review.reviewId}>{review.reasonLabel}<NativeSmall className="wts-muted"> · Referenz {review.referenceKey}</NativeSmall></NativeP>)}</NativeDetails></>}
          <NativeDiv className="wts-actions">{draft.status === 'finalized' ? <NativeButton className="wts-primary" disabled={blocked} onClick={() => void download(draft)}>CSV herunterladen</NativeButton> : <><NativeButton disabled={blocked} onClick={() => void validate()}>Entwurf erneut prüfen</NativeButton><NativeButton className="wts-primary" disabled={blocked || !validation?.valid || validation.exportableCount === 0} onClick={() => void finalize()}>Export finalisieren</NativeButton></>}</NativeDiv>
        </NativeDiv>}
      </NativeSection>
      <NativeSection className="wts-panel"><NativeH3>Exportverlauf</NativeH3><NativeP>Bis zu 50 zuletzt erstellte Exporte. Gespeicherte Entwürfe können erneut geprüft werden.</NativeP>{query.data && !query.data.history.length && <NativeDiv className="wts-empty">Noch keine Exporte gespeichert.</NativeDiv>}{(query.data?.history ?? []).map(job => <NativeArticle className="wts-row" key={job.id}><NativeDiv className="wts-row-head"><NativeDiv><NativeStrong>{dateLabel(job.periodStart)} – {dateLabel(job.periodEnd)}</NativeStrong><NativeP>{job.exportType === 'reviewed_time_correction' ? 'Korrekturexport' : 'Monatsexport'} · {statusLabel[job.status]} · {job.rowCount} Einträge</NativeP></NativeDiv>{job.status === 'finalized' ? <NativeButton disabled={blocked} onClick={() => void download(job)}>CSV herunterladen</NativeButton> : job.exportType === 'reviewed_time' && (job.status === 'draft' || job.status === 'validated') ? <NativeButton disabled={blocked} onClick={() => { setDraft(job); setValidation(null); if (job.periodStart) {
            setMonth(job.periodStart.slice(0, 7));
            if (focused)
                router.setParams({ month: job.periodStart.slice(0, 7) });
        } setMessage('Gespeicherten Entwurf geöffnet. Bitte vor der Finalisierung erneut prüfen.'); }}>Entwurf öffnen</NativeButton> : null}</NativeDiv></NativeArticle>)}</NativeSection>
      <NativeSection className="wts-panel"><NativeH3>Korrekturexporte</NativeH3><NativeP>Änderungen an bereits exportierten Zeiten werden mit Begründung und eigenem Export dokumentiert.</NativeP>{query.data && !query.data.candidates.length && <NativeDiv className="wts-empty">Keine nachträglich geänderten Exporte.</NativeDiv>}
        {(query.data?.candidates ?? []).map(review => <NativeArticle className="wts-row" key={review.id}><NativeDiv className="wts-row-head"><NativeDiv><NativeStrong>{reviewLabel(review)}</NativeStrong><NativeP>Exportversion {review.exportVersion ?? 1}{review.pendingReexportJobId ? ' · Korrekturentwurf vorhanden' : ''}</NativeP></NativeDiv><NativeButton disabled={blocked} onClick={() => void openCorrection(review.id)}>{selected?.id === review.id ? 'Erneut prüfen' : 'Korrektur prüfen'}</NativeButton></NativeDiv></NativeArticle>)}
      </NativeSection>
      {selected && <NativeSection className="wts-panel"><NativeH3>Korrektur prüfen</NativeH3><NativeP>{reviewLabel(selected)} · Exportversion {selected.exportVersion ?? 1}</NativeP>{drift && <WfmWebNotice>{drift.changed ? `Exportrelevante Änderung erkannt${drift.delta?.deltaMinutes != null ? ` · Zeitdifferenz ${drift.delta.deltaMinutes} Minuten` : ''}.` : 'Keine exportrelevante Änderung erkannt.'}</WfmWebNotice>}
        <NativeLabel className="wts-field">Korrekturgrund (mindestens {WFM_CORRECTION_REASON_MIN_LENGTH} Zeichen)<NativeTextarea value={reason} disabled={busy || !!correctionDraft} onChange={e => { setReason(e.target.value); setValidatedReason(null); }}/></NativeLabel>
        {!correctionDraft && <NativeDiv className="wts-actions"><NativeButton className="wts-primary" disabled={blocked || !reasonValid || !selected.lastExportJobId || !!selected.pendingReexportJobId} onClick={() => void draftCorrection()}>Korrekturentwurf erstellen</NativeButton></NativeDiv>}
        {!!previewItems.length && <NativeDiv className="wts-row"><NativeH3>Vorschau</NativeH3>{previewItems.map(item => <NativeP key={item.id}>{dateLabel(item.periodDate)} · {kindLabel(item.entryKind)} · {item.minutesTotal} Minuten · {itemLabel(item.itemStatus)}</NativeP>)}</NativeDiv>}
        {correctionDraft && <NativeDiv className="wts-actions"><NativeButton disabled={blocked || !reasonValid} onClick={() => void validateCorrection()}>Korrektur validieren</NativeButton><NativeButton className="wts-primary" disabled={blocked || !reasonValid || validatedReason !== reason.trim() || !previewItems.length} onClick={() => void finalizeCorrection()}>Korrekturexport finalisieren</NativeButton></NativeDiv>}
        {!!timeline.length && <NativeDetails className="wts-row"><NativeSummary>Exportverlauf des Eintrags</NativeSummary>{timeline.map(item => <NativeP key={item.id}>Version {item.exportSequence ?? 1} · {item.minutesTotal} Minuten · {itemLabel(item.itemStatus)}</NativeP>)}</NativeDetails>}
      </NativeSection>}
    </>}
  </WfmSecondaryWorkspace>;
}
