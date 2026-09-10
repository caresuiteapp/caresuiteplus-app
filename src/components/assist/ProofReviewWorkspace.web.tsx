import { Fragment, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_REVIEW_FILTERS, REVIEW_STATES, dateTime, elapsed, filterReviewEntries, matchesReviewState, serviceDay,
  type ReviewEntry, type ReviewFilters, type ReviewState,
} from '@/lib/assist/proofReviewModel.web';
import { proofReviewCss } from './proofReviewCss.web';

const STATUS_LABELS: Record<string, string> = { draft: 'Entwurf', pending_review: 'In Prüfung', approved: 'Freigegeben', exported: 'PDF erzeugt', rejected: 'Abgelehnt', archived: 'Archiviert' };
type Props = {
  entries: ReviewEntry[]; loadedAt: string | null; refreshing: boolean; error: string | null;
  onRefresh: () => void; onOpenVisit: (entry: ReviewEntry) => void;
  renderProof: (entry: ReviewEntry) => ReactNode;
};
function Tag({ state, children }: { state: string; children: ReactNode }) {
  return <span className={`pr-tag pr-tag-${state}`}>{children}</span>;
}
function DateFact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="pr-fact"><dt>{label}</dt><dd>{value}</dd>{hint ? <small>{hint}</small> : null}</div>;
}
export function ProofReviewWorkspace({ entries, loadedAt, refreshing, error, onRefresh, onOpenVisit, renderProof }: Props) {
  const [filters, setFilters] = useState<ReviewFilters>({ ...DEFAULT_REVIEW_FILTERS });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const setFilter = <K extends keyof ReviewFilters>(key: K, value: ReviewFilters[K]) => { setFilters(prev => ({ ...prev, [key]: value })); setPage(0); };
  const reset = () => { setFilters({ ...DEFAULT_REVIEW_FILTERS }); setPage(0); };
  const rangeError = filters.from && filters.to && filters.from > filters.to;
  const scoped = useMemo(() => filterReviewEntries(entries, filters, false), [entries, filters]);
  const filtered = useMemo(() => filterReviewEntries(entries, filters), [entries, filters]);
  const counts = useMemo(() => scoped.reduce((all, e) => { Object.keys(all).forEach(s => { if (matchesReviewState(e, s)) all[s as ReviewState]++; }); return all; }, { missing: 0, not_sent: 0, awaiting: 0, signed: 0, portal_signed: 0, revoked: 0, check: 0 } as Record<ReviewState, number>), [scoped]);
  const clients = useMemo(() => {
    const result = new Map<string, string>();
    entries.forEach(e => { if (e.clientId) result.set(e.clientId, e.clientName); });
    return [...result].sort((a, b) => a[1].localeCompare(b[1], 'de'));
  }, [entries]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * 25, (currentPage + 1) * 25);
  const period = (monthsAgo: number | null) => {
    if (monthsAgo === null) { setFilters(prev => ({ ...prev, from: '', to: '' })); setPage(0); return; }
    const today = serviceDay(new Date().toISOString());
    const [year, month] = today.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1 - monthsAgo, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    setFilters(prev => ({ ...prev, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) })); setPage(0);
  };
  const toggle = (id: string) => {
    // Native details-like placement keeps the opening point next to its row.
    setSelectedId(prev => prev === id ? null : id);
    requestAnimationFrame(() => document.getElementById(`pr-row-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'auto' }));
  };
  return <section className="pr-workspace" aria-label="Nachweise und Portalstatus">
    <style>{proofReviewCss}</style>
    <div className="pr-intro"><div><span className="pr-eyebrow">LEISTUNGSNACHWEISE · ÜBERBLICK</span><h2>Nachweise und Unterschriften im Überblick</h2><p>Fehlende Nachweise erkennen, Freigaben prüfen und Unterschriften im Klientenportal nachverfolgen.</p></div>
      <button className="pr-button" disabled={refreshing} onClick={onRefresh}>{refreshing ? 'Wird aktualisiert…' : '↻ Aktualisieren'}</button>
    </div>
    {error ? <div className="pr-alert" role="alert"><strong>Aktualisierung fehlgeschlagen.</strong> {error} Die zuletzt geladenen Daten bleiben sichtbar.<button className="pr-link" onClick={onRefresh} disabled={refreshing}>Erneut versuchen</button></div> : null}
    <div className="pr-stats" aria-label="Statusübersicht für die aktuellen Filter">
      <button aria-pressed={filters.state === 'all'} onClick={() => setFilter('state', 'all')} className="pr-stat"><span>Alle Einträge</span><strong>{scoped.length}</strong><small>Im gewählten Umfang</small></button>
      {(['missing', 'not_sent', 'awaiting', 'signed', 'check'] as ReviewState[]).map(state => <button key={state} aria-pressed={filters.state === state} onClick={() => setFilter('state', state)} className={`pr-stat pr-stat-${state}`}><span>{REVIEW_STATES[state]}</span><strong>{counts[state]}</strong><small>{state === 'missing' ? 'Abgeschlossene Einsätze' : state === 'awaiting' ? 'Im Portal freigegeben' : state === 'signed' ? 'Vor Ort oder im Portal' : state === 'check' ? 'Abweichende Angaben' : 'Freigabe noch offen'}</small></button>)}
    </div>
    <div className="pr-filterbox">
      <div className="pr-filters">
        <label className="pr-search">Suche<input type="search" value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="Name, Leistung oder Nachweisnummer…" /></label>
        <label>Klient:in<select value={filters.clientId} onChange={e => setFilter('clientId', e.target.value)}><option value="">Alle Klient:innen</option>{clients.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
        <label>Leistungsdatum von<input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)} max={filters.to || undefined} /></label>
        <label>Leistungsdatum bis<input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)} min={filters.from || undefined} /></label>
        <label>Prüfstatus<select value={filters.status} onChange={e => setFilter('status', e.target.value)}><option value="all">Alle Prüfstände</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label>Sortieren nach<select value={filters.sort} onChange={e => setFilter('sort', e.target.value)}><option value="newest">Neueste Leistung zuerst</option><option value="oldest">Älteste Leistung zuerst</option><option value="client">Klient:in A–Z</option><option value="waiting">Längste Wartezeit zuerst</option><option value="attention">Handlungsbedarf zuerst</option></select></label>
      </div>
      <div className="pr-filterbottom"><div className="pr-period"><span>Zeitraum:</span><button onClick={() => period(0)}>Dieser Monat</button><button onClick={() => period(1)}>Letzter Monat</button><button onClick={() => period(null)}>Gesamter Zeitraum</button></div><button className="pr-link" onClick={reset}>Filter zurücksetzen</button></div>
      {rangeError ? <p className="pr-validation" role="alert">Das Enddatum muss am oder nach dem Startdatum liegen.</p> : null}
    </div>
    <div className="pr-resultsbar"><div className="pr-chips"><button aria-pressed={filters.state === 'all'} onClick={() => setFilter('state', 'all')}>Alle</button>{Object.entries(REVIEW_STATES).map(([key, label]) => <button key={key} aria-pressed={filters.state === key} onClick={() => setFilter('state', key)}>{label}<span>{counts[key as ReviewState]}</span></button>)}</div><span className="pr-updated">Stand: {loadedAt ? dateTime(loadedAt) : 'Wird geladen…'} · automatisch aktualisiert · mehrere Statusmerkmale möglich</span></div>
    <div className="pr-list" aria-label="Gefilterte Nachweise">
      <div className="pr-columns pr-listhead" aria-hidden="true"><span>Klient:in / Leistung</span><span>Leistungszeitraum</span><span>Prüfung / Vollständigkeit</span><span>Klientenportal</span><span>Unterschrift / Wartezeit</span><span /></div>
      {!filtered.length ? <div className="pr-empty"><strong>{rangeError ? 'Zeitraum korrigieren' : entries.length ? 'Keine passenden Einträge' : 'Noch keine Nachweise oder abgeschlossenen Einsätze'}</strong><p>{entries.length ? 'Passen Sie Klient:in, Zeitraum oder Status an.' : 'Sobald Einsätze abgeschlossen sind, erscheinen die Nachweise und offene Aufgaben hier.'}</p>{entries.length ? <button className="pr-button" onClick={reset}>Alle Einträge anzeigen</button> : null}</div> : visible.map(entry => {
        const open = selectedId === entry.id;
        const daysWaiting = entry.waitSince ? Math.max(0, Math.floor((Date.now() - Date.parse(entry.waitSince)) / 86_400_000)) : 0;
        return <Fragment key={entry.id}><article className={`pr-entry${open ? ' pr-entry-open' : ''}`}>
          <button id={`pr-row-${entry.id}`} className="pr-columns pr-row" onClick={() => toggle(entry.id)} aria-expanded={open} aria-controls={`pr-detail-${entry.id}`}>
            <span className="pr-cell"><span className="pr-name">{entry.clientName}</span><span>{entry.service}</span><small>{entry.employeeName}</small><small>{entry.proof ? `Nr. ${entry.proof.proofNumber || entry.proof.id.slice(0, 8)}` : 'Nachweis noch nicht erstellt'}</small></span>
            <span className="pr-cell" data-label="Leistungszeitraum"><strong>{entry.startsAt ? dateTime(entry.startsAt) : 'Datum nicht dokumentiert'}</strong>{entry.endsAt ? <small>bis {dateTime(entry.endsAt)}</small> : null}</span>
            <span className="pr-cell" data-label="Bearbeitung"><Tag state={entry.state}>{REVIEW_STATES[entry.state]}</Tag><small>{entry.proof ? STATUS_LABELS[entry.proof.status] || entry.proof.status : 'Einsatz beendet · Nachweis fehlt'}</small>{entry.issue ? <small className="pr-warning">Abgleich erforderlich</small> : null}</span>
            <span className="pr-cell" data-label="Klientenportal"><strong>{entry.portalVisible ? 'Im Portal verfügbar' : entry.state === 'revoked' ? 'Zurückgezogen' : 'Nicht freigegeben'}</strong><small>{entry.portalVisible ? dateTime(entry.availableAt) : entry.releasedAt ? `Frühere Freigabe: ${dateTime(entry.releasedAt)}` : 'Noch kein Versand'}</small></span>
            <span className="pr-cell" data-label="Unterschrift"><strong>{entry.signed ? entry.signedViaPortal ? 'Im Portal unterzeichnet' : 'Unterschrift vorhanden' : entry.portalVisible ? 'Unterschrift ausstehend' : 'Noch nicht unterzeichnet'}</strong><small>{entry.signed ? dateTime(entry.signedAt) : entry.waitSince ? `Offen seit ${elapsed(entry.waitSince)}` : '—'}</small>{daysWaiting >= 7 ? <Tag state="awaiting">Seit mindestens 7 Tagen offen</Tag> : null}</span>
            <span className="pr-chevron" aria-hidden="true">{open ? '−' : '+'}</span>
          </button>
          {open ? <div className="pr-detail" id={`pr-detail-${entry.id}`} role="region" aria-label={`Nachweisdetails ${entry.clientName}`}>
            <div className="pr-detailhead"><div><span className="pr-eyebrow">NACHWEISDETAILS</span><h3>{entry.clientName}</h3></div><button className="pr-button" onClick={() => onOpenVisit(entry)}>Einsatz öffnen ↗</button></div>
            {entry.issue ? <div className="pr-alert" role="status">{entry.issue}</div> : null}
            <dl className="pr-timeline">
              <DateFact label="1 · Nachweis erstellt" value={entry.proof ? dateTime(entry.proof.createdAt) : 'Noch nicht erstellt'} />
              <DateFact label="2 · An das Portal freigegeben" value={entry.releasedAt ? dateTime(entry.releasedAt) : 'Noch nicht freigegeben'} hint={entry.portalVisible ? 'Aktuell im Bereich Nachweise verfügbar' : entry.releasedAt ? 'Freigabe aktuell nicht aktiv' : undefined} />
              <DateFact label="3 · Portal-Dokument angelegt" value={entry.documentAt ? dateTime(entry.documentAt) : 'Kein Dokument nachgewiesen'} hint={entry.documentVisible ? 'Aktuell im Dokumentenbereich sichtbar' : 'Aktuell kein sichtbares Portal-Dokument'} />
              <DateFact label="4 · Unterzeichnet" value={entry.signed ? dateTime(entry.signedAt) : 'Unterschrift ausstehend'} hint={entry.signed ? `${entry.signedViaPortal ? 'Im Klientenportal' : 'Vor Ort / Quelle nicht dokumentiert'}${entry.signerName ? ` · ${entry.signerName}` : ''}` : entry.waitSince ? `Wartezeit: ${elapsed(entry.waitSince)}` : 'Noch keine aktive Unterschriftsanforderung im Portal'} />
            </dl>
            <p className="pr-note">Portal-Eingang bedeutet technische Bereitstellung. Ob der Nachweis persönlich geöffnet oder gelesen wurde, wird bisher nicht erfasst. Alle Uhrzeiten gelten für Deutschland.</p>
            {entry.proof ? renderProof(entry) : <div className="pr-missing"><strong>Für diesen abgeschlossenen Einsatz fehlt der Leistungsnachweis.</strong><p>Öffnen Sie den Einsatz, prüfen Sie Leistungszeiten, Dokumentation und Unterschrift und vervollständigen Sie den Abschluss. Danach kann der Nachweis geprüft und freigegeben werden.</p><button className="pr-button pr-primary" onClick={() => onOpenVisit(entry)}>Einsatz prüfen und Nachweis vervollständigen</button></div>}
            <button className="pr-link pr-close" onClick={() => { setSelectedId(null); document.getElementById(`pr-row-${entry.id}`)?.focus(); }}>Details schließen</button>
          </div> : null}
        </article></Fragment>;
      })}
    </div>
    <div className="pr-pagination"><span role="status">{filtered.length ? `${currentPage * 25 + 1}–${Math.min((currentPage + 1) * 25, filtered.length)} von ${filtered.length} Einträgen` : '0 Einträge'}{entries.length !== filtered.length ? ` · ${entries.length} insgesamt` : ''}</span><div><button className="pr-button" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setSelectedId(null); }}>← Zurück</button><span>Seite {currentPage + 1} / {pageCount}</span><button className="pr-button" disabled={currentPage >= pageCount - 1} onClick={() => { setPage(currentPage + 1); setSelectedId(null); }}>Weiter →</button></div></div>
  </section>;
}
