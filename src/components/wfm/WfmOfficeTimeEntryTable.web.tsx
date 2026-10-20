import { canApproveWfmOfficeTimeEntry } from '@/lib/wfm/wfmOfficeTimeApproval';
import { resolveWfmOfficeTimeDisplay } from '@/lib/wfm/wfmOfficeTimeDisplayResolver';
import { formatWfmDurationMinutes, formatWfmPlanTimeRange } from '@/lib/wfm/wfmDisplayHelpers';
import { WFM_DEVIATION_AMPEL_LABELS, WFM_OFFICE_TIME_STATUS_LABELS, WFM_OFFICE_WORK_KIND_LABELS, type WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';

type Props = {
  entries: WfmOfficeTimeEntry[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  reviewQueueMode?: boolean;
  approval?: { selectedIds: ReadonlySet<string>; onToggle: (id: string) => void; onApprove: (entry: WfmOfficeTimeEntry) => void; busy: boolean };
};
const time = (iso: string | null | undefined) => iso && Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—';
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : value;
const range = (start: string | null | undefined, end: string | null | undefined) => `${time(start)} – ${time(end)}`;

export function WfmOfficeTimeEntryTable({ entries, selectedId, onSelect, reviewQueueMode = false, approval }: Props) {
  if (!entries.length) return <div className="wr-empty"><h3>Keine Einträge für diese Auswahl</h3><p className="wr-muted">Zeitraum, Person oder Filter anpassen.</p></div>;
  return <>
    <div className="wr-scroll" role="region" aria-label="Arbeitszeitbuchungen, horizontal scrollbar" tabIndex={0}>
      <table className="wr-table">
        <colgroup>{approval ? <col style={{ width: 46 }} /> : null}<col style={{ width: 160 }} /><col style={{ width: 160 }} /><col style={{ width: 130 }} /><col style={{ width: 140 }} /><col style={{ width: 135 }} /><col style={{ width: 155 }} /><col style={{ width: 130 }} /></colgroup>
        <thead><tr>{approval ? <th scope="col"><span aria-label="Auswahl">✓</span></th> : null}<th scope="col">Person / Datum</th><th scope="col">Einsatz / Tätigkeit</th><th scope="col">Plan</th><th scope="col">Einsatz-Ist</th><th scope="col">Buchung</th><th scope="col">Status</th><th scope="col">Aktionen</th></tr></thead>
        <tbody>{entries.map(entry => {
          const display = resolveWfmOfficeTimeDisplay(entry);
          const eligible = canApproveWfmOfficeTimeEntry(entry);
          const statusTone = entry.reviewStatus === 'approved' ? 'green' : entry.reviewStatus === 'rejected' ? 'red' : entry.reviewStatus === 'needs_clarification' ? 'warning' : 'blue';
          return <tr key={entry.id} data-selected={selectedId === entry.id}>
            {approval ? <td><label className="wr-check" title={eligible ? 'Für Sammelgenehmigung auswählen' : 'Nur offene Einträge mit vollständigen Ist-Zeiten sind auswählbar'}><input type="checkbox" aria-label={`${entry.employeeName}, ${date(entry.workDate)} auswählen`} checked={approval.selectedIds.has(entry.id)} disabled={approval.busy || !eligible} onChange={() => approval.onToggle(entry.id)} /></label></td> : null}
            <td><strong>{entry.employeeName}</strong><small>{date(entry.workDate)}</small></td>
            <td><strong>{entry.clientLabel || entry.assignmentTitle || WFM_OFFICE_WORK_KIND_LABELS[entry.workKind]}</strong><small>{WFM_OFFICE_WORK_KIND_LABELS[entry.workKind]}</small></td>
            <td>{formatWfmPlanTimeRange(entry.plannedStartAt, entry.plannedEndAt, entry.planDisplayStatus)}{display.plannedDurationMinutes > 0 ? <small>{formatWfmDurationMinutes(display.plannedDurationMinutes)}</small> : null}</td>
            <td>{display.hasAssignmentActual ? <>{range(entry.assignmentActualStartAt, entry.assignmentActualEndAt)}<small>{entry.assignmentActualEndAt ? formatWfmDurationMinutes(display.assignmentActualDurationMinutes) : 'Ende noch offen'}</small></> : <span className="wr-muted">Nicht erfasst</span>}</td>
            <td>{display.hasTimeEntry ? <>{range(entry.actualStartAt, entry.actualEndAt)}<strong>{formatWfmDurationMinutes(entry.netMinutes)} netto</strong><small>{entry.pauseMinutes} Min. Pause</small></> : <span className="wr-badge" data-tone={display.isPlannedOnly && entry.rowKind === 'planned_upcoming' ? 'blue' : 'warning'}>{entry.rowKind === 'planned_upcoming' ? 'Geplant' : 'Keine Buchung'}</span>}</td>
            <td><span className="wr-badge" data-tone={statusTone}>{WFM_OFFICE_TIME_STATUS_LABELS[entry.reviewStatus]}</span>{entry.overallAmpel ? <span className="wr-badge" data-tone={entry.overallAmpel}>{WFM_DEVIATION_AMPEL_LABELS[entry.overallAmpel]}</span> : null}{entry.hasOpenOfficeMessage ? <span className="wr-badge" data-tone="warning">Office-Meldung</span> : null}</td>
            <td><div className="wr-row-actions"><button className="wr-button" type="button" disabled={approval?.busy} onClick={() => onSelect(entry.id)} aria-label={`${reviewQueueMode ? 'Prüfen' : 'Details'}: ${entry.employeeName}, ${date(entry.workDate)}`}>{reviewQueueMode ? 'Prüfen' : 'Details'}</button>{approval && eligible ? <button className="wr-button" type="button" disabled={approval.busy} onClick={() => approval.onApprove(entry)}>Genehmigen</button> : null}</div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="wr-foot"><span>{entries.length} {entries.length === 1 ? 'Eintrag' : 'Einträge'} · Plan, Einsatz-Ist und Buchung getrennt</span><span>Bei wenig Platz seitlich scrollen</span></p>
  </>;
}
