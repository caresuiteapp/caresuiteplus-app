// Generated native presentation from src/components/wfm/WfmOfficeTimeEntryTable.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeH3,NativeP,NativeTable,NativeColgroup,NativeCol,NativeThead,NativeTr,NativeTh,NativeSpan,NativeTbody,NativeTd,NativeLabel,NativeInput,NativeStrong,NativeSmall,NativeButton} from '@/components/layout/NativeWorkspaceElements.native';
import { canApproveWfmOfficeTimeEntry } from '@/lib/wfm/wfmOfficeTimeApproval';
import { resolveWfmOfficeTimeDisplay } from '@/lib/wfm/wfmOfficeTimeDisplayResolver';
import { formatWfmDurationMinutes, formatWfmPlanTimeRange } from '@/lib/wfm/wfmDisplayHelpers';
import { WFM_DEVIATION_AMPEL_LABELS, WFM_OFFICE_TIME_STATUS_LABELS, WFM_OFFICE_WORK_KIND_LABELS, type WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';
type Props = {
    entries: WfmOfficeTimeEntry[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    reviewQueueMode?: boolean;
    approval?: {
        selectedIds: ReadonlySet<string>;
        onToggle: (id: string) => void;
        onApprove: (entry: WfmOfficeTimeEntry) => void;
        busy: boolean;
    };
};
const time = (iso: string | null | undefined) => iso && Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—';
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : value;
const range = (start: string | null | undefined, end: string | null | undefined) => `${time(start)} – ${time(end)}`;
export function WfmOfficeTimeEntryTable({ entries, selectedId, onSelect, reviewQueueMode = false, approval }: Props) {
    if (!entries.length)
        return <NativeDiv className="wr-empty"><NativeH3>Keine Einträge für diese Auswahl</NativeH3><NativeP className="wr-muted">Zeitraum, Person oder Filter anpassen.</NativeP></NativeDiv>;
    return <>
    <NativeDiv className="wr-scroll" role="region" aria-label="Arbeitszeitbuchungen, horizontal scrollbar" tabIndex={0}>
      <NativeTable className="wr-table">
        <NativeColgroup>{approval ? <NativeCol style={{ width: 46 }}/> : null}<NativeCol style={{ width: 160 }}/><NativeCol style={{ width: 160 }}/><NativeCol style={{ width: 130 }}/><NativeCol style={{ width: 140 }}/><NativeCol style={{ width: 135 }}/><NativeCol style={{ width: 155 }}/><NativeCol style={{ width: 130 }}/></NativeColgroup>
        <NativeThead><NativeTr>{approval ? <NativeTh scope="col"><NativeSpan aria-label="Auswahl">✓</NativeSpan></NativeTh> : null}<NativeTh scope="col">Person / Datum</NativeTh><NativeTh scope="col">Einsatz / Tätigkeit</NativeTh><NativeTh scope="col">Plan</NativeTh><NativeTh scope="col">Einsatz-Ist</NativeTh><NativeTh scope="col">Buchung</NativeTh><NativeTh scope="col">Status</NativeTh><NativeTh scope="col">Aktionen</NativeTh></NativeTr></NativeThead>
        <NativeTbody>{entries.map(entry => {
            const display = resolveWfmOfficeTimeDisplay(entry);
            const eligible = canApproveWfmOfficeTimeEntry(entry);
            const statusTone = entry.reviewStatus === 'approved' ? 'green' : entry.reviewStatus === 'rejected' ? 'red' : entry.reviewStatus === 'needs_clarification' ? 'warning' : 'blue';
            return <NativeTr key={entry.id} data-selected={selectedId === entry.id}>
            {approval ? <NativeTd><NativeLabel className="wr-check" title={eligible ? 'Für Sammelgenehmigung auswählen' : 'Nur offene Einträge mit vollständigen Ist-Zeiten sind auswählbar'}><NativeInput type="checkbox" aria-label={`${entry.employeeName}, ${date(entry.workDate)} auswählen`} checked={approval.selectedIds.has(entry.id)} disabled={approval.busy || !eligible} onChange={() => approval.onToggle(entry.id)}/></NativeLabel></NativeTd> : null}
            <NativeTd><NativeStrong>{entry.employeeName}</NativeStrong><NativeSmall>{date(entry.workDate)}</NativeSmall></NativeTd>
            <NativeTd><NativeStrong>{entry.clientLabel || entry.assignmentTitle || WFM_OFFICE_WORK_KIND_LABELS[entry.workKind]}</NativeStrong><NativeSmall>{WFM_OFFICE_WORK_KIND_LABELS[entry.workKind]}</NativeSmall></NativeTd>
            <NativeTd>{formatWfmPlanTimeRange(entry.plannedStartAt, entry.plannedEndAt, entry.planDisplayStatus)}{display.plannedDurationMinutes > 0 ? <NativeSmall>{formatWfmDurationMinutes(display.plannedDurationMinutes)}</NativeSmall> : null}</NativeTd>
            <NativeTd>{display.hasAssignmentActual ? <>{range(entry.assignmentActualStartAt, entry.assignmentActualEndAt)}<NativeSmall>{entry.assignmentActualEndAt ? formatWfmDurationMinutes(display.assignmentActualDurationMinutes) : 'Ende noch offen'}</NativeSmall></> : <NativeSpan className="wr-muted">Nicht erfasst</NativeSpan>}</NativeTd>
            <NativeTd>{display.hasTimeEntry ? <>{range(entry.actualStartAt, entry.actualEndAt)}<NativeStrong>{formatWfmDurationMinutes(entry.netMinutes)} netto</NativeStrong><NativeSmall>{entry.pauseMinutes} Min. Pause</NativeSmall></> : <NativeSpan className="wr-badge" data-tone={display.isPlannedOnly && entry.rowKind === 'planned_upcoming' ? 'blue' : 'warning'}>{entry.rowKind === 'planned_upcoming' ? 'Geplant' : 'Keine Buchung'}</NativeSpan>}</NativeTd>
            <NativeTd><NativeSpan className="wr-badge" data-tone={statusTone}>{WFM_OFFICE_TIME_STATUS_LABELS[entry.reviewStatus]}</NativeSpan>{entry.overallAmpel ? <NativeSpan className="wr-badge" data-tone={entry.overallAmpel}>{WFM_DEVIATION_AMPEL_LABELS[entry.overallAmpel]}</NativeSpan> : null}{entry.hasOpenOfficeMessage ? <NativeSpan className="wr-badge" data-tone="warning">Office-Meldung</NativeSpan> : null}</NativeTd>
            <NativeTd><NativeDiv className="wr-row-actions"><NativeButton className="wr-button" type="button" disabled={approval?.busy} onClick={() => onSelect(entry.id)} aria-label={`${reviewQueueMode ? 'Prüfen' : 'Details'}: ${entry.employeeName}, ${date(entry.workDate)}`}>{reviewQueueMode ? 'Prüfen' : 'Details'}</NativeButton>{approval && eligible ? <NativeButton className="wr-button" type="button" disabled={approval.busy} onClick={() => approval.onApprove(entry)}>Genehmigen</NativeButton> : null}</NativeDiv></NativeTd>
          </NativeTr>;
        })}</NativeTbody>
      </NativeTable>
    </NativeDiv>
    <NativeP className="wr-foot"><NativeSpan>{entries.length} {entries.length === 1 ? 'Eintrag' : 'Einträge'} · Plan, Einsatz-Ist und Buchung getrennt</NativeSpan><NativeSpan>Bei wenig Platz seitlich scrollen</NativeSpan></NativeP>
  </>;
}
