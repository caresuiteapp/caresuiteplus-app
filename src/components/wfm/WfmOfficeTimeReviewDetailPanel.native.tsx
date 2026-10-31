// Generated native presentation from src/components/wfm/WfmOfficeTimeReviewDetailPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeStyle,NativeHeader,NativeH2,NativeButton,NativeStrong,NativeSpan,NativeP,NativeSection,NativeH3,NativeForm,NativeFieldset,NativeLabel,NativeInput,NativeTextarea,NativeDetails,NativeSummary,NativeUl,NativeLi,NativeTime,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { formatWfmDurationMinutes, formatWfmPlanTimeRange } from '@/lib/wfm/wfmDisplayHelpers';
import { resolveWfmOfficeTimeDisplay } from '@/lib/wfm/wfmOfficeTimeDisplayResolver';
import { canApproveWfmOfficeTimeEntry } from '@/lib/wfm/wfmOfficeTimeApproval';
import { WFM_OFFICE_TIME_STATUS_LABELS, WFM_OFFICE_WORK_KIND_LABELS, type WfmOfficeAuditEntry, type WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
import { localDateTimeInput, localDateTimeToIso, reviewCorrectionChanged, reviewEntryProtected, validateReviewCorrection } from "./wfmOfficeReviewDraft.native.ts";
import { wfmOfficeReviewCss } from "./wfmOfficeReviewStyles.native.ts";
type Props = {
    entry: WfmOfficeTimeEntry;
    auditEntries: WfmOfficeAuditEntry[];
    canCorrect: boolean;
    onApprove: () => void;
    onReject: () => void;
    onClarification: () => void;
    onAdoptAssignment: () => void;
    onSaveCorrection: () => void;
    onClose: () => void;
    reviewNote: string;
    onReviewNoteChange: (value: string) => void;
    correctionReason: string;
    onCorrectionReasonChange: (value: string) => void;
    editStartAt: string;
    editEndAt: string;
    editPauseMinutes: string;
    onEditStartAtChange: (value: string) => void;
    onEditEndAtChange: (value: string) => void;
    onEditPauseMinutesChange: (value: string) => void;
    exportedWarning?: boolean;
    embedded?: boolean;
    saving?: boolean;
    auditLoading?: boolean;
    auditError?: string | null;
    onRetryAudit?: () => void;
    blockedReason?: string | null;
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
    const net = correctionError ? null : Math.round((Date.parse(editEndAt) - Date.parse(editStartAt)) / 60000) - Number(editPauseMinutes);
    return <NativeWorkspaceStyleScope css={[wfmOfficeReviewCss, wfmOfficeReviewCss]}>{<NativeDiv data-wfm-review="detail">
    <NativeStyle>{wfmOfficeReviewCss}</NativeStyle>
    {!props.embedded ? <NativeHeader className="wr-head"><NativeH2>{entry.employeeName}</NativeH2><NativeButton className="wr-button" type="button" disabled={saving} onClick={props.onClose}>Schließen</NativeButton></NativeHeader> : null}
    <NativeDiv className="wr-detail-summary">
      <NativeDiv className="wr-actions"><NativeStrong>{entry.clientLabel || entry.assignmentTitle || WFM_OFFICE_WORK_KIND_LABELS[entry.workKind]}</NativeStrong><NativeSpan className="wr-badge" data-tone={entry.reviewStatus === 'approved' ? 'green' : 'blue'}>{WFM_OFFICE_TIME_STATUS_LABELS[entry.reviewStatus]}</NativeSpan></NativeDiv>
      <NativeDiv className="wr-detail-times">
        <NativeDiv className="wr-time"><NativeStrong>Plan</NativeStrong><NativeP>{formatWfmPlanTimeRange(entry.plannedStartAt, entry.plannedEndAt, entry.planDisplayStatus)}</NativeP><NativeP>{display.plannedDurationMinutes ? formatWfmDurationMinutes(display.plannedDurationMinutes) : 'Keine Plandauer'}</NativeP></NativeDiv>
        <NativeDiv className="wr-time"><NativeStrong>Einsatz-Ist</NativeStrong><NativeP>{datetime(entry.assignmentActualStartAt)}</NativeP><NativeP>bis {datetime(entry.assignmentActualEndAt)}</NativeP></NativeDiv>
        <NativeDiv className="wr-time"><NativeStrong>Buchung</NativeStrong><NativeP>{display.hasTimeEntry ? `${formatWfmDurationMinutes(entry.netMinutes)} netto · ${entry.pauseMinutes} Min. Pause` : 'Keine Buchung vorhanden'}</NativeP><NativeP>{entry.exportStatus === 'exported' ? 'Bereits exportiert' : entry.exportStatus === 'export_ready' ? 'Zum Export freigegeben' : 'Noch nicht exportiert'}</NativeP></NativeDiv>
      </NativeDiv>
      {entry.startJustification ? <NativeP className="wr-muted">Begründung Beginn: {entry.startJustification}</NativeP> : null}
      {entry.endJustification ? <NativeP className="wr-muted">Begründung Ende: {entry.endJustification}</NativeP> : null}
      {entry.officeComment ? <NativeP className="wr-muted">Office-Kommentar: {entry.officeComment}</NativeP> : null}
      {entry.reviewNote ? <NativeP className="wr-muted">Letzte Prüfung: {entry.reviewNote}</NativeP> : null}
    </NativeDiv>
    {!canCorrect || protectedEntry ? <NativeDiv className="wr-message" data-tone="warning">{!canCorrect ? 'Ihre Rolle besitzt keine Berechtigung zum Bearbeiten oder Genehmigen von Arbeitszeiten.' : 'Diese Buchung ist exportiert oder gesperrt. Änderungen sind hier geschützt und benötigen den vorgesehenen Korrekturabschluss.'}</NativeDiv> : null}
    {props.blockedReason ? <NativeDiv className="wr-message" data-tone="warning">{props.blockedReason}</NativeDiv> : null}
    <NativeDiv className="wr-detail-grid">
      <NativeSection className="wr-detail-section"><NativeH3>Buchung korrigieren</NativeH3>
        <NativeP className="wr-muted">Beginn und Ende mit Datum erfassen. Die Nettozeit ergibt sich aus der Dauer abzüglich Pause. Angezeigt wird die Zeitzone Ihres Geräts.</NativeP>
        <NativeForm onSubmit={event => { event.preventDefault(); if (canEdit && !saving && !correctionError && correctionReason.trim())
        props.onSaveCorrection(); }}>
          <NativeFieldset disabled={!canEdit || saving}>
            <NativeLabel className="wr-field">Beginn<NativeInput type="datetime-local" step="1" required value={localDateTimeInput(editStartAt)} onChange={event => props.onEditStartAtChange(localDateTimeToIso(event.target.value))}/></NativeLabel>
            <NativeLabel className="wr-field">Ende<NativeInput type="datetime-local" step="1" required value={localDateTimeInput(editEndAt)} onChange={event => props.onEditEndAtChange(localDateTimeToIso(event.target.value))}/></NativeLabel>
            <NativeLabel className="wr-field">Pause in Minuten<NativeInput type="number" min="0" step="1" required value={editPauseMinutes} onChange={event => props.onEditPauseMinutesChange(event.target.value)}/></NativeLabel>
            {net !== null ? <NativeP className="wr-muted">Netto nach Korrektur: <NativeStrong>{formatWfmDurationMinutes(net)}</NativeStrong></NativeP> : <NativeP className="wr-muted">{correctionError}</NativeP>}
            <NativeLabel className="wr-field">Begründung der Korrektur<NativeTextarea required value={correctionReason} maxLength={4000} onChange={event => props.onCorrectionReasonChange(event.target.value)} placeholder="Was wird geändert und warum?"/></NativeLabel>
            <NativeDiv className="wr-actions"><NativeButton className="wr-button" data-primary type="submit" disabled={!canEdit || saving || Boolean(correctionError) || !correctionReason.trim()}>{saving ? 'Wird gespeichert …' : 'Korrektur speichern'}</NativeButton>{canAdopt ? <NativeButton className="wr-button" type="button" disabled={saving || !correctionReason.trim()} onClick={props.onAdoptAssignment}>Einsatz-Ist übernehmen</NativeButton> : null}</NativeDiv>
          </NativeFieldset>
        </NativeForm>
      </NativeSection>
      <NativeSection className="wr-detail-section"><NativeH3>Prüfung und Freigabe</NativeH3><NativeP className="wr-muted">Die Prüfung bezieht sich auf die gespeicherten Ist-Zeiten. Für eine Rückfrage oder Ablehnung ist eine Nachricht erforderlich.</NativeP>
        {draftChanged ? <NativeDiv className="wr-message" data-tone="warning">Zuerst die Korrektur speichern oder die Änderungen zurücknehmen. Anschließend die gespeicherte Buchung prüfen.</NativeDiv> : null}
        <NativeFieldset disabled={!canCorrect || protectedEntry || Boolean(props.blockedReason) || saving}><NativeLabel className="wr-field">Nachricht zur Prüfung<NativeTextarea value={reviewNote} maxLength={4000} onChange={event => props.onReviewNoteChange(event.target.value)} placeholder="Kommentar, Rückfrage oder Ablehnungsgrund"/></NativeLabel>
          <NativeDiv className="wr-actions"><NativeButton className="wr-button" data-primary type="button" disabled={!canReview || saving || !canApproveWfmOfficeTimeEntry(entry)} onClick={props.onApprove}>Genehmigen</NativeButton><NativeButton className="wr-button" type="button" disabled={!canReview || saving || !reviewNote.trim() || entry.canRequestClarification === false || !display.canRequestClarification} onClick={props.onClarification}>Rückfrage</NativeButton><NativeButton className="wr-button" data-danger type="button" disabled={!canReview || saving || !reviewNote.trim() || entry.canReject === false || !display.canReject} onClick={props.onReject}>Ablehnen</NativeButton></NativeDiv>
          {!canApproveWfmOfficeTimeEntry(entry) && !protectedEntry ? <NativeP className="wr-muted">Genehmigt werden können offene Einträge mit vollständig abgeschlossenen Ist-Zeiten.</NativeP> : null}
        </NativeFieldset>
      </NativeSection>
    </NativeDiv>
    <NativeDetails className="wr-history"><NativeSummary>Änderungsverlauf {props.auditLoading ? 'wird geladen …' : `(${auditEntries.length})`}</NativeSummary>
      {props.auditError ? <NativeDiv className="wr-message" data-tone="error" role="alert"><NativeP>Der Änderungsverlauf konnte nicht vollständig geladen werden.</NativeP><NativeP>{props.auditError}</NativeP>{props.onRetryAudit ? <NativeButton className="wr-button" type="button" disabled={props.auditLoading} onClick={props.onRetryAudit}>Erneut laden</NativeButton> : null}</NativeDiv> : null}
      {!props.auditLoading && !props.auditError && !auditEntries.length ? <NativeP className="wr-muted">Noch keine Änderungen dokumentiert.</NativeP> : null}
      {auditEntries.length ? <NativeUl>{auditEntries.map(audit => <NativeLi key={audit.id}><NativeTime dateTime={audit.createdAt}>{datetime(audit.createdAt)}</NativeTime>{audit.summary}{audit.reason ? <NativeP className="wr-muted">{audit.reason}</NativeP> : null}</NativeLi>)}</NativeUl> : null}
    </NativeDetails>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
