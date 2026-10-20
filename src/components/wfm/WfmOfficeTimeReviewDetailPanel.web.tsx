import { formatWfmDurationMinutes, formatWfmPlanTimeRange } from '@/lib/wfm/wfmDisplayHelpers';
import { resolveWfmOfficeTimeDisplay } from '@/lib/wfm/wfmOfficeTimeDisplayResolver';
import { canApproveWfmOfficeTimeEntry } from '@/lib/wfm/wfmOfficeTimeApproval';
import { WFM_OFFICE_TIME_STATUS_LABELS, WFM_OFFICE_WORK_KIND_LABELS, type WfmOfficeAuditEntry, type WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { localDateTimeInput, localDateTimeToIso, reviewCorrectionChanged, reviewEntryProtected, validateReviewCorrection } from './wfmOfficeReviewDraft.web';
import { wfmOfficeReviewCss } from './wfmOfficeReviewStyles.web';

type Props = {
  entry: WfmOfficeTimeEntry; auditEntries: WfmOfficeAuditEntry[]; canCorrect: boolean;
  onApprove: () => void; onReject: () => void; onClarification: () => void; onAdoptAssignment: () => void; onSaveCorrection: () => void; onClose: () => void;
  reviewNote: string; onReviewNoteChange: (value: string) => void; correctionReason: string; onCorrectionReasonChange: (value: string) => void;
  editStartAt: string; editEndAt: string; editPauseMinutes: string; onEditStartAtChange: (value: string) => void; onEditEndAtChange: (value: string) => void; onEditPauseMinutesChange: (value: string) => void;
  exportedWarning?: boolean; embedded?: boolean; saving?: boolean;
  auditLoading?: boolean; auditError?: string | null; onRetryAudit?: () => void; blockedReason?: string | null;
};
const datetime = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nicht erfasst';

export function WfmOfficeTimeReviewDetailPanel(props: Props) {
  const { entry, auditEntries, canCorrect, reviewNote, correctionReason, editStartAt, editEndAt, editPauseMinutes, saving = false } = props;
  const display = resolveWfmOfficeTimeDisplay(entry);
  const protectedEntry = reviewEntryProtected(entry);
  const canEdit = canCorrect && !protectedEntry && !props.blockedReason && entry.canEdit !== false;
  const draftChanged = reviewCorrectionChanged(entry, editStartAt, editEndAt, editPauseMinutes) || Boolean(correctionReason.trim());
  const correctionError = validateReviewCorrection(editStartAt, editEndAt, editPauseMinutes);
  const canReview = canCorrect && !protectedEntry && !props.blockedReason && !draftChanged;
  const canAdopt = canEdit && display.hasAssignmentActual && Number.isFinite(Date.parse(entry.assignmentActualStartAt ?? '')) && Number.isFinite(Date.parse(entry.assignmentActualEndAt ?? ''));
  const net = correctionError ? null : Math.round((Date.parse(editEndAt) - Date.parse(editStartAt)) / 60_000) - Number(editPauseMinutes);
  return <div data-wfm-review="detail">
    <style>{wfmOfficeReviewCss}</style>
    {!props.embedded ? <header className="wr-head"><h2>{entry.employeeName}</h2><button className="wr-button" type="button" disabled={saving} onClick={props.onClose}>Schließen</button></header> : null}
    <div className="wr-detail-summary">
      <div className="wr-actions"><strong>{entry.clientLabel || entry.assignmentTitle || WFM_OFFICE_WORK_KIND_LABELS[entry.workKind]}</strong><span className="wr-badge" data-tone={entry.reviewStatus === 'approved' ? 'green' : 'blue'}>{WFM_OFFICE_TIME_STATUS_LABELS[entry.reviewStatus]}</span></div>
      <div className="wr-detail-times">
        <div className="wr-time"><strong>Plan</strong><p>{formatWfmPlanTimeRange(entry.plannedStartAt, entry.plannedEndAt, entry.planDisplayStatus)}</p><p>{display.plannedDurationMinutes ? formatWfmDurationMinutes(display.plannedDurationMinutes) : 'Keine Plandauer'}</p></div>
        <div className="wr-time"><strong>Einsatz-Ist</strong><p>{datetime(entry.assignmentActualStartAt)}</p><p>bis {datetime(entry.assignmentActualEndAt)}</p></div>
        <div className="wr-time"><strong>Buchung</strong><p>{display.hasTimeEntry ? `${formatWfmDurationMinutes(entry.netMinutes)} netto · ${entry.pauseMinutes} Min. Pause` : 'Keine Buchung vorhanden'}</p><p>{entry.exportStatus === 'exported' ? 'Bereits exportiert' : entry.exportStatus === 'export_ready' ? 'Zum Export freigegeben' : 'Noch nicht exportiert'}</p></div>
      </div>
      {entry.startJustification ? <p className="wr-muted">Begründung Beginn: {entry.startJustification}</p> : null}
      {entry.endJustification ? <p className="wr-muted">Begründung Ende: {entry.endJustification}</p> : null}
      {entry.officeComment ? <p className="wr-muted">Office-Kommentar: {entry.officeComment}</p> : null}
      {entry.reviewNote ? <p className="wr-muted">Letzte Prüfung: {entry.reviewNote}</p> : null}
    </div>
    {!canCorrect || protectedEntry ? <div className="wr-message" data-tone="warning">{!canCorrect ? 'Ihre Rolle besitzt keine Berechtigung zum Bearbeiten oder Genehmigen von Arbeitszeiten.' : 'Diese Buchung ist exportiert oder gesperrt. Änderungen sind hier geschützt und benötigen den vorgesehenen Korrekturabschluss.'}</div> : null}
    {props.blockedReason ? <div className="wr-message" data-tone="warning">{props.blockedReason}</div> : null}
    <div className="wr-detail-grid">
      <section className="wr-detail-section"><h3>Buchung korrigieren</h3>
        <p className="wr-muted">Beginn und Ende mit Datum erfassen. Die Nettozeit ergibt sich aus der Dauer abzüglich Pause. Angezeigt wird die Zeitzone Ihres Geräts.</p>
        <form onSubmit={event => { event.preventDefault(); if (canEdit && !saving && !correctionError && correctionReason.trim()) props.onSaveCorrection(); }}>
          <fieldset disabled={!canEdit || saving}>
            <label className="wr-field">Beginn<input type="datetime-local" step="1" required value={localDateTimeInput(editStartAt)} onChange={event => props.onEditStartAtChange(localDateTimeToIso(event.target.value))} /></label>
            <label className="wr-field">Ende<input type="datetime-local" step="1" required value={localDateTimeInput(editEndAt)} onChange={event => props.onEditEndAtChange(localDateTimeToIso(event.target.value))} /></label>
            <label className="wr-field">Pause in Minuten<input type="number" min="0" step="1" required value={editPauseMinutes} onChange={event => props.onEditPauseMinutesChange(event.target.value)} /></label>
            {net !== null ? <p className="wr-muted">Netto nach Korrektur: <strong>{formatWfmDurationMinutes(net)}</strong></p> : <p className="wr-muted">{correctionError}</p>}
            <label className="wr-field">Begründung der Korrektur<textarea required value={correctionReason} maxLength={4000} onChange={event => props.onCorrectionReasonChange(event.target.value)} placeholder="Was wird geändert und warum?" /></label>
            <div className="wr-actions"><button className="wr-button" data-primary type="submit" disabled={!canEdit || saving || Boolean(correctionError) || !correctionReason.trim()}>{saving ? 'Wird gespeichert …' : 'Korrektur speichern'}</button>{canAdopt ? <button className="wr-button" type="button" disabled={saving || !correctionReason.trim()} onClick={props.onAdoptAssignment}>Einsatz-Ist übernehmen</button> : null}</div>
          </fieldset>
        </form>
      </section>
      <section className="wr-detail-section"><h3>Prüfung und Freigabe</h3><p className="wr-muted">Die Prüfung bezieht sich auf die gespeicherten Ist-Zeiten. Für eine Rückfrage oder Ablehnung ist eine Nachricht erforderlich.</p>
        {draftChanged ? <div className="wr-message" data-tone="warning">Zuerst die Korrektur speichern oder die Änderungen zurücknehmen. Anschließend die gespeicherte Buchung prüfen.</div> : null}
        <fieldset disabled={!canCorrect || protectedEntry || Boolean(props.blockedReason) || saving}><label className="wr-field">Nachricht zur Prüfung<textarea value={reviewNote} maxLength={4000} onChange={event => props.onReviewNoteChange(event.target.value)} placeholder="Kommentar, Rückfrage oder Ablehnungsgrund" /></label>
          <div className="wr-actions"><button className="wr-button" data-primary type="button" disabled={!canReview || saving || !canApproveWfmOfficeTimeEntry(entry)} onClick={props.onApprove}>Genehmigen</button><button className="wr-button" type="button" disabled={!canReview || saving || !reviewNote.trim() || entry.canRequestClarification === false || !display.canRequestClarification} onClick={props.onClarification}>Rückfrage</button><button className="wr-button" data-danger type="button" disabled={!canReview || saving || !reviewNote.trim() || entry.canReject === false || !display.canReject} onClick={props.onReject}>Ablehnen</button></div>
          {!canApproveWfmOfficeTimeEntry(entry) && !protectedEntry ? <p className="wr-muted">Genehmigt werden können offene Einträge mit vollständig abgeschlossenen Ist-Zeiten.</p> : null}
        </fieldset>
      </section>
    </div>
    <details className="wr-history"><summary>Änderungsverlauf {props.auditLoading ? 'wird geladen …' : `(${auditEntries.length})`}</summary>
      {props.auditError ? <div className="wr-message" data-tone="error" role="alert"><p>Der Änderungsverlauf konnte nicht vollständig geladen werden.</p><p>{props.auditError}</p>{props.onRetryAudit ? <button className="wr-button" type="button" disabled={props.auditLoading} onClick={props.onRetryAudit}>Erneut laden</button> : null}</div> : null}
      {!props.auditLoading && !props.auditError && !auditEntries.length ? <p className="wr-muted">Noch keine Änderungen dokumentiert.</p> : null}
      {auditEntries.length ? <ul>{auditEntries.map(audit => <li key={audit.id}><time dateTime={audit.createdAt}>{datetime(audit.createdAt)}</time>{audit.summary}{audit.reason ? <p className="wr-muted">{audit.reason}</p> : null}</li>)}</ul> : null}
    </details>
  </div>;
}
