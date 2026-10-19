import { useState } from 'react';
import { STATUS_LABELS } from '@/lib/gkvExchange/model';
import type { RevisionSummary, SavedRevision } from '@/lib/gkvExchange/history';
import { CaseEditor, Choice, ProfileEditor, money } from './GkvEditors.web';

const dateTime = (date: string) => new Date(date).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });
type Props = {
  rows: RevisionSummary[]; hasMore: boolean; pending: boolean; error: string;
  preview: SavedRevision | null; reason: string; canCopy: boolean;
  onInspect: (revision: number) => void; onMore: () => void; onRetry: () => void;
  onClose: () => void; onReason: (value: string) => void; onCopy: () => void;
};
export function RevisionHistory({ rows, hasMore, pending, error, preview, reason, canCopy, onInspect, onMore, onRetry, onClose, onReason, onCopy }: Props) {
  return <section className="gx-card gx-stack" aria-label="Gespeicherte Paketstände">
    <div><h2>Gespeicherte Paketstände</h2><p className="gx-muted">Jede Speicherung und Statusänderung erhält einen eigenen Stand. Frühere Stände lassen sich ansehen und als neuer Prüfentwurf weiterbearbeiten.</p></div>
    {error && <div role="alert" className="gx-notice" data-tone="error">{error}<div className="gx-actions"><button type="button" disabled={pending} onClick={onRetry}>Stände erneut laden</button></div></div>}
    <div>{rows.map(row => <div className="gx-source" key={row.revision}><span><strong>Stand {row.revision}</strong> · {STATUS_LABELS[row.status]}<br /><small>{dateTime(row.recorded_at)}{row.capture_kind === 'backfill' ? ' · Bei Einführung der Historie übernommen' : ''}</small></span><button type="button" disabled={pending} aria-pressed={preview?.revision === row.revision} onClick={() => onInspect(row.revision)}>Stand {row.revision} ansehen</button></div>)}</div>
    {!rows.length && !error && <p className="gx-muted" role="status">{pending ? 'Gespeicherte Stände werden geladen …' : 'Für dieses Paket wurden noch keine Stände geladen.'}</p>}
    {hasMore && <button type="button" disabled={pending} onClick={onMore}>Ältere Stände laden</button>}
    <p className="gx-limit">Die Historie beginnt mit ihrer Einführung. Ein gespeicherter Entwurf und dessen Prüfsumme belegen keine übermittelte Datei, Kassenannahme oder vollständige revisionssichere Archivierung.</p>
    {preview && <div className="gx-stack gx-history-preview" aria-label={`Ansicht von Stand ${preview.revision}`}>
      <div className="gx-card-title"><h3>Stand {preview.revision} · Nur Ansicht</h3><button type="button" disabled={pending} onClick={onClose}>Ansicht schließen</button></div>
      <p>{preview.draft.month} · {preview.draft.cases.length} Fälle · {money(preview.draft.cases.reduce((sum, c) => sum + c.grossCents, 0))}</p>
      <RevisionPreview key={`${preview.batch_id}:${preview.revision}`} value={preview} />
      <p className="gx-limit gx-filename">Prüfsumme des gespeicherten Datenstands: {preview.draft_sha256}</p>
      {canCopy && <div className="gx-stack"><label className="gx-field"><span>Grund für den neuen Prüfentwurf</span><textarea disabled={pending} value={reason} maxLength={500} onChange={event => onReason(event.target.value)} placeholder="Zum Beispiel: Angaben nach einer Prüfrückmeldung überarbeiten" /></label>
        <p className="gx-subtle">Der ausgewählte Stand bleibt erhalten. Die Kopie startet im Testmodus; Nachweise müssen erneut bestätigt und aktuelle Quellen erneut geprüft werden. Dies ist noch kein Storno- oder Korrekturversand an die Pflegekasse. Dateinummern sind anschließend zu prüfen.</p>
        <button type="button" className="gx-primary" disabled={pending || reason.trim().length < 5} onClick={onCopy}>Als neuen Prüfentwurf übernehmen</button></div>}
    </div>}
  </section>;
}

function RevisionPreview({ value }: { value: SavedRevision }) {
  const [caseIndex, setCaseIndex] = useState(0);
  const current = value.draft.cases[caseIndex];
  return <div className="gx-stack">
    <details><summary>Leistungserbringer und Vertrag ansehen</summary><fieldset disabled className="gx-readonly"><ProfileEditor value={value.draft.profile} onChange={() => {}} /></fieldset></details>
    {value.draft.cases.length > 0 && <Choice label="Gespeicherten Fall ansehen" value={String(caseIndex)} onChange={next => setCaseIndex(Number(next))}>{value.draft.cases.map((c, index) => <option key={index} value={index}>{index + 1} · {c.invoiceNumber || 'Ohne Rechnungsnummer'} · {c.firstName} {c.lastName}</option>)}</Choice>}
    {current && <fieldset disabled className="gx-readonly"><CaseEditor key={caseIndex} value={current} index={0} onChange={() => {}} onRemove={() => {}} /></fieldset>}
  </div>;
}
