// Generated native presentation from src/components/assist/ProofReviewWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSpan,NativeDiv,NativeDt,NativeDd,NativeSmall,NativeSection,NativeStyle,NativeH2,NativeP,NativeButton,NativeStrong,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeArticle,NativeH3,NativeDl,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_REVIEW_FILTERS, REVIEW_STATES, dateTime, elapsed, filterReviewEntries, matchesReviewState, serviceDay, type ReviewEntry, type ReviewFilters, type ReviewState, } from "../../lib/assist/proofReviewModel.native.ts";
import { getHousekeepingCareProofBoundaryWeb } from "../../lib/assist/housekeepingCareProofBoundary.native.ts";
import { proofReviewCss } from "./proofReviewCss.native.ts";
const STATUS_LABELS: Record<string, string> = { draft: 'Entwurf', pending_review: 'In Prüfung', approved: 'Freigegeben', exported: 'PDF erzeugt', rejected: 'Abgelehnt', archived: 'Archiviert' };
type Props = {
    entries: ReviewEntry[];
    loadedAt: string | null;
    refreshing: boolean;
    error: string | null;
    onRefresh: () => void;
    onOpenVisit: (entry: ReviewEntry) => void;
    renderProof: (entry: ReviewEntry) => ReactNode;
};
function Tag({ state, children }: {
    state: string;
    children: ReactNode;
}) {
    return <NativeWorkspaceStyleScope css={[proofReviewCss]}>{<NativeSpan className={`pr-tag pr-tag-${state}`}>{children}</NativeSpan>}</NativeWorkspaceStyleScope>;
}
function DateFact({ label, value, hint }: {
    label: string;
    value: string;
    hint?: string;
}) {
    return <NativeWorkspaceStyleScope css={[proofReviewCss]}>{<NativeDiv className="pr-fact"><NativeDt>{label}</NativeDt><NativeDd>{value}</NativeDd>{hint ? <NativeSmall>{hint}</NativeSmall> : null}</NativeDiv>}</NativeWorkspaceStyleScope>;
}
export function ProofReviewWorkspace({ entries, loadedAt, refreshing, error, onRefresh, onOpenVisit, renderProof }: Props) {
    const housekeepingBoundary = getHousekeepingCareProofBoundaryWeb();
    const [filters, setFilters] = useState<ReviewFilters>({ ...DEFAULT_REVIEW_FILTERS });
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const setFilter = <K extends keyof ReviewFilters>(key: K, value: ReviewFilters[K]) => { setFilters(prev => ({ ...prev, [key]: value })); setPage(0); };
    const reset = () => { setFilters({ ...DEFAULT_REVIEW_FILTERS }); setPage(0); };
    const rangeError = filters.from && filters.to && filters.from > filters.to;
    const scoped = useMemo(() => filterReviewEntries(entries, filters, false), [entries, filters]);
    const filtered = useMemo(() => filterReviewEntries(entries, filters), [entries, filters]);
    const counts = useMemo(() => scoped.reduce((all, e) => { Object.keys(all).forEach(s => { if (matchesReviewState(e, s))
        all[s as ReviewState]++; }); return all; }, { missing: 0, not_sent: 0, awaiting: 0, signed: 0, portal_signed: 0, revoked: 0, check: 0 } as Record<ReviewState, number>), [scoped]);
    const clients = useMemo(() => {
        const result = new Map<string, string>();
        entries.forEach(e => { if (e.clientId)
            result.set(e.clientId, e.clientName); });
        return [...result].sort((a, b) => a[1].localeCompare(b[1], 'de'));
    }, [entries]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
    const currentPage = Math.min(page, pageCount - 1);
    const visible = filtered.slice(currentPage * 25, (currentPage + 1) * 25);
    const period = (monthsAgo: number | null) => {
        if (monthsAgo === null) {
            setFilters(prev => ({ ...prev, from: '', to: '' }));
            setPage(0);
            return;
        }
        const today = serviceDay(new Date().toISOString());
        const [year, month] = today.split('-').map(Number);
        const start = new Date(Date.UTC(year, month - 1 - monthsAgo, 1));
        const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
        setFilters(prev => ({ ...prev, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }));
        setPage(0);
    };
    const toggle = (id: string) => {
        // Native details-like placement keeps the opening point next to its row.
        setSelectedId(prev => prev === id ? null : id);
        requestAnimationFrame(() => document.getElementById(`pr-row-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'auto' }));
    };
    return <NativeWorkspaceStyleScope css={[proofReviewCss, proofReviewCss]}>{<NativeSection className="pr-workspace" aria-label="Nachweise und Portalstatus">
    <NativeStyle>{proofReviewCss}</NativeStyle>
    <NativeDiv className="pr-intro"><NativeDiv><NativeSpan className="pr-eyebrow">LEISTUNGSNACHWEISE · ÜBERBLICK</NativeSpan><NativeH2>Nachweise und Unterschriften im Überblick</NativeH2><NativeP>Fehlende Nachweise erkennen, Freigaben prüfen und Unterschriften im Klientenportal nachverfolgen.</NativeP></NativeDiv>
      <NativeButton className="pr-button" disabled={refreshing} onClick={onRefresh}>{refreshing ? 'Wird aktualisiert…' : '↻ Aktualisieren'}</NativeButton>
    </NativeDiv>
    <NativeDiv className="pr-alert" role="note">
      <NativeStrong>Abgrenzung Hauswirtschaft / Pflege.</NativeStrong> Katalog, Auftrag, geplante Zeit, Notiz, Assist-Einsatz und Assist-Leistungsnachweis bleiben Nachweise für Hauswirtschaft oder Alltagshilfe. Sie erzeugen keinen Grundpflege- oder Behandlungspflegenachweis; dafür ist eine eigenständige native Pflegedurchführung erforderlich.
      <NativeSmall className="pr-note">Status: {housekeepingBoundary.capability} · Assist-Nachweis {housekeepingBoundary.assistVisitProofMeaning} · Pflegeausführung {housekeepingBoundary.actualCareExecutionProof}</NativeSmall>
    </NativeDiv>
    {error ? <NativeDiv className="pr-alert" role="alert"><NativeStrong>Aktualisierung fehlgeschlagen.</NativeStrong> {error} Die zuletzt geladenen Daten bleiben sichtbar.<NativeButton className="pr-link" onClick={onRefresh} disabled={refreshing}>Erneut versuchen</NativeButton></NativeDiv> : null}
    <NativeDiv className="pr-stats" aria-label="Statusübersicht für die aktuellen Filter">
      <NativeButton aria-pressed={filters.state === 'all'} onClick={() => setFilter('state', 'all')} className="pr-stat"><NativeSpan>Alle Einträge</NativeSpan><NativeStrong>{scoped.length}</NativeStrong><NativeSmall>Im gewählten Umfang</NativeSmall></NativeButton>
      {(['missing', 'not_sent', 'awaiting', 'signed', 'check'] as ReviewState[]).map(state => <NativeButton key={state} aria-pressed={filters.state === state} onClick={() => setFilter('state', state)} className={`pr-stat pr-stat-${state}`}><NativeSpan>{REVIEW_STATES[state]}</NativeSpan><NativeStrong>{counts[state]}</NativeStrong><NativeSmall>{state === 'missing' ? 'Abgeschlossene Einsätze' : state === 'awaiting' ? 'Im Portal freigegeben' : state === 'signed' ? 'Vor Ort oder im Portal' : state === 'check' ? 'Abweichende Angaben' : 'Freigabe noch offen'}</NativeSmall></NativeButton>)}
    </NativeDiv>
    <NativeDiv className="pr-filterbox">
      <NativeDiv className="pr-filters">
        <NativeLabel className="pr-search">Suche<NativeInput type="search" value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="Name, Leistung oder Nachweisnummer…"/></NativeLabel>
        <NativeLabel>Klient:in<NativeSelect value={filters.clientId} onChange={e => setFilter('clientId', e.target.value)}><NativeOption value="">Alle Klient:innen</NativeOption>{clients.map(([id, name]) => <NativeOption value={id} key={id}>{name}</NativeOption>)}</NativeSelect></NativeLabel>
        <NativeLabel>Leistungsdatum von<NativeInput type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)} max={filters.to || undefined}/></NativeLabel>
        <NativeLabel>Leistungsdatum bis<NativeInput type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)} min={filters.from || undefined}/></NativeLabel>
        <NativeLabel>Prüfstatus<NativeSelect value={filters.status} onChange={e => setFilter('status', e.target.value)}><NativeOption value="all">Alle Prüfstände</NativeOption>{Object.entries(STATUS_LABELS).map(([key, label]) => <NativeOption value={key} key={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel>
        <NativeLabel>Sortieren nach<NativeSelect value={filters.sort} onChange={e => setFilter('sort', e.target.value)}><NativeOption value="newest">Neueste Leistung zuerst</NativeOption><NativeOption value="oldest">Älteste Leistung zuerst</NativeOption><NativeOption value="client">Klient:in A–Z</NativeOption><NativeOption value="waiting">Längste Wartezeit zuerst</NativeOption><NativeOption value="attention">Handlungsbedarf zuerst</NativeOption></NativeSelect></NativeLabel>
      </NativeDiv>
      <NativeDiv className="pr-filterbottom"><NativeDiv className="pr-period"><NativeSpan>Zeitraum:</NativeSpan><NativeButton onClick={() => period(0)}>Dieser Monat</NativeButton><NativeButton onClick={() => period(1)}>Letzter Monat</NativeButton><NativeButton onClick={() => period(null)}>Gesamter Zeitraum</NativeButton></NativeDiv><NativeButton className="pr-link" onClick={reset}>Filter zurücksetzen</NativeButton></NativeDiv>
      {rangeError ? <NativeP className="pr-validation" role="alert">Das Enddatum muss am oder nach dem Startdatum liegen.</NativeP> : null}
    </NativeDiv>
    <NativeDiv className="pr-resultsbar"><NativeDiv className="pr-chips"><NativeButton aria-pressed={filters.state === 'all'} onClick={() => setFilter('state', 'all')}>Alle</NativeButton>{Object.entries(REVIEW_STATES).map(([key, label]) => <NativeButton key={key} aria-pressed={filters.state === key} onClick={() => setFilter('state', key)}>{label}<NativeSpan>{counts[key as ReviewState]}</NativeSpan></NativeButton>)}</NativeDiv><NativeSpan className="pr-updated">Stand: {loadedAt ? dateTime(loadedAt) : 'Wird geladen…'} · automatisch aktualisiert · mehrere Statusmerkmale möglich</NativeSpan></NativeDiv>
    <NativeDiv className="pr-list" aria-label="Gefilterte Nachweise">
      <NativeDiv className="pr-columns pr-listhead" aria-hidden="true"><NativeSpan>Klient:in / Leistung</NativeSpan><NativeSpan>Leistungszeitraum</NativeSpan><NativeSpan>Prüfung / Vollständigkeit</NativeSpan><NativeSpan>Klientenportal</NativeSpan><NativeSpan>Unterschrift / Wartezeit</NativeSpan><NativeSpan /></NativeDiv>
      {!filtered.length ? <NativeDiv className="pr-empty"><NativeStrong>{rangeError ? 'Zeitraum korrigieren' : entries.length ? 'Keine passenden Einträge' : 'Noch keine Nachweise oder abgeschlossenen Einsätze'}</NativeStrong><NativeP>{entries.length ? 'Passen Sie Klient:in, Zeitraum oder Status an.' : 'Sobald Einsätze abgeschlossen sind, erscheinen die Nachweise und offene Aufgaben hier.'}</NativeP>{entries.length ? <NativeButton className="pr-button" onClick={reset}>Alle Einträge anzeigen</NativeButton> : null}</NativeDiv> : visible.map(entry => {
            const open = selectedId === entry.id;
            const daysWaiting = entry.waitSince ? Math.max(0, Math.floor((Date.now() - Date.parse(entry.waitSince)) / 86400000)) : 0;
            return <NativeWorkspaceStyleScope css={[proofReviewCss]}>{<Fragment key={entry.id}><NativeArticle className={`pr-entry${open ? ' pr-entry-open' : ''}`}>
          <NativeButton id={`pr-row-${entry.id}`} className="pr-columns pr-row" onClick={() => toggle(entry.id)} aria-expanded={open} aria-controls={`pr-detail-${entry.id}`}>
            <NativeSpan className="pr-cell"><NativeSpan className="pr-name">{entry.clientName}</NativeSpan><NativeSpan>{entry.service}</NativeSpan><NativeSmall>{entry.employeeName}</NativeSmall><NativeSmall>{entry.proof ? `Nr. ${entry.proof.proofNumber || entry.proof.id.slice(0, 8)}` : 'Nachweis noch nicht erstellt'}</NativeSmall></NativeSpan>
            <NativeSpan className="pr-cell" data-label="Leistungszeitraum"><NativeStrong>{entry.startsAt ? dateTime(entry.startsAt) : 'Datum nicht dokumentiert'}</NativeStrong>{entry.endsAt ? <NativeSmall>bis {dateTime(entry.endsAt)}</NativeSmall> : null}</NativeSpan>
            <NativeSpan className="pr-cell" data-label="Bearbeitung"><Tag state={entry.state}>{REVIEW_STATES[entry.state]}</Tag><NativeSmall>{entry.proof ? STATUS_LABELS[entry.proof.status] || entry.proof.status : 'Einsatz beendet · Nachweis fehlt'}</NativeSmall>{entry.issue ? <NativeSmall className="pr-warning">Abgleich erforderlich</NativeSmall> : null}</NativeSpan>
            <NativeSpan className="pr-cell" data-label="Klientenportal"><NativeStrong>{entry.portalVisible ? 'Im Portal verfügbar' : entry.state === 'revoked' ? 'Zurückgezogen' : 'Nicht freigegeben'}</NativeStrong><NativeSmall>{entry.portalVisible ? dateTime(entry.availableAt) : entry.releasedAt ? `Frühere Freigabe: ${dateTime(entry.releasedAt)}` : 'Noch kein Versand'}</NativeSmall></NativeSpan>
            <NativeSpan className="pr-cell" data-label="Unterschrift"><NativeStrong>{entry.signed ? entry.signedViaPortal ? 'Im Portal unterzeichnet' : 'Unterschrift vorhanden' : entry.portalVisible ? 'Unterschrift ausstehend' : 'Noch nicht unterzeichnet'}</NativeStrong><NativeSmall>{entry.signed ? dateTime(entry.signedAt) : entry.waitSince ? `Offen seit ${elapsed(entry.waitSince)}` : '—'}</NativeSmall>{daysWaiting >= 7 ? <Tag state="awaiting">Seit mindestens 7 Tagen offen</Tag> : null}</NativeSpan>
            <NativeSpan className="pr-chevron" aria-hidden="true">{open ? '−' : '+'}</NativeSpan>
          </NativeButton>
          {open ? <NativeDiv className="pr-detail" id={`pr-detail-${entry.id}`} role="region" aria-label={`Nachweisdetails ${entry.clientName}`}>
            <NativeDiv className="pr-detailhead"><NativeDiv><NativeSpan className="pr-eyebrow">NACHWEISDETAILS</NativeSpan><NativeH3>{entry.clientName}</NativeH3></NativeDiv><NativeButton className="pr-button" onClick={() => onOpenVisit(entry)}>Einsatz öffnen ↗</NativeButton></NativeDiv>
            {entry.issue ? <NativeDiv className="pr-alert" role="status">{entry.issue}</NativeDiv> : null}
            <NativeDl className="pr-timeline">
              <DateFact label="1 · Nachweis erstellt" value={entry.proof ? dateTime(entry.proof.createdAt) : 'Noch nicht erstellt'}/>
              <DateFact label="2 · An das Portal freigegeben" value={entry.releasedAt ? dateTime(entry.releasedAt) : 'Noch nicht freigegeben'} hint={entry.portalVisible ? 'Aktuell im Bereich Nachweise verfügbar' : entry.releasedAt ? 'Freigabe aktuell nicht aktiv' : undefined}/>
              <DateFact label="3 · Portal-Dokument angelegt" value={entry.documentAt ? dateTime(entry.documentAt) : 'Kein Dokument nachgewiesen'} hint={entry.documentVisible ? 'Aktuell im Dokumentenbereich sichtbar' : 'Aktuell kein sichtbares Portal-Dokument'}/>
              <DateFact label="4 · Unterzeichnet" value={entry.signed ? dateTime(entry.signedAt) : 'Unterschrift ausstehend'} hint={entry.signed ? `${entry.signedViaPortal ? 'Im Klientenportal' : 'Vor Ort / Quelle nicht dokumentiert'}${entry.signerName ? ` · ${entry.signerName}` : ''}` : entry.waitSince ? `Wartezeit: ${elapsed(entry.waitSince)}` : 'Noch keine aktive Unterschriftsanforderung im Portal'}/>
            </NativeDl>
            <NativeP className="pr-note">Portal-Eingang bedeutet technische Bereitstellung. Ob der Nachweis persönlich geöffnet oder gelesen wurde, wird bisher nicht erfasst. Alle Uhrzeiten gelten für Deutschland.</NativeP>
            {entry.proof ? renderProof(entry) : <NativeDiv className="pr-missing"><NativeStrong>Für diesen abgeschlossenen Einsatz fehlt der Leistungsnachweis.</NativeStrong><NativeP>Öffnen Sie den Einsatz, prüfen Sie Leistungszeiten, Dokumentation und Unterschrift und vervollständigen Sie den Abschluss. Danach kann der Nachweis geprüft und freigegeben werden.</NativeP><NativeButton className="pr-button pr-primary" onClick={() => onOpenVisit(entry)}>Einsatz prüfen und Nachweis vervollständigen</NativeButton></NativeDiv>}
            <NativeButton className="pr-link pr-close" onClick={() => { setSelectedId(null); document.getElementById(`pr-row-${entry.id}`)?.focus(); }}>Details schließen</NativeButton>
          </NativeDiv> : null}
        </NativeArticle></Fragment>}</NativeWorkspaceStyleScope>;
        })}
    </NativeDiv>
    <NativeDiv className="pr-pagination"><NativeSpan role="status">{filtered.length ? `${currentPage * 25 + 1}–${Math.min((currentPage + 1) * 25, filtered.length)} von ${filtered.length} Einträgen` : '0 Einträge'}{entries.length !== filtered.length ? ` · ${entries.length} insgesamt` : ''}</NativeSpan><NativeDiv><NativeButton className="pr-button" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setSelectedId(null); }}>← Zurück</NativeButton><NativeSpan>Seite {currentPage + 1} / {pageCount}</NativeSpan><NativeButton className="pr-button" disabled={currentPage >= pageCount - 1} onClick={() => { setPage(currentPage + 1); setSelectedId(null); }}>Weiter →</NativeButton></NativeDiv></NativeDiv>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
