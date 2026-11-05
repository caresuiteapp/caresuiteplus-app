// Generated native presentation from src/components/office/documentation/DocumentationWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeMain,NativeStyle,NativeHeader,NativeDiv,NativeP,NativeH1,NativeButton,NativeSpan,NativeSelect,NativeOption,NativeSection,NativeLabel,NativeInput,NativeStrong,NativeH2,NativeH3,NativeNav,NativeAside,NativeForm,NativeFieldset,NativeTextarea,NativeDl,NativeDt,NativeDd,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUnsavedWebChanges } from "../../../hooks/useUnsavedWebChanges.native.ts";
import { DOCUMENTATION_AREAS, DOCUMENTATION_CATEGORIES, berlinMonth, documentationDateTime, documentationDraft, newDocumentationId, shiftDocumentationMonth, validateDocumentation } from '@/lib/office/documentation/model';
import type { DocumentationActor, DocumentationDraft, DocumentationEntry, DocumentationFilters, DocumentationPage } from '@/lib/office/documentation/model';
import { createDocumentation, listDocumentation } from '@/lib/office/documentation/service';
import { documentationCss } from "./documentationCss.native.ts";
const initialFilters = (): DocumentationFilters => ({ month: berlinMonth(), area: '', clientId: '', employeeId: '', category: '', source: '', priority: '', query: '', offset: 0 });
const emptyPage: DocumentationPage = { items: [], total: 0, months: [], clients: [], employees: [] };
const monthLabel = (value: string) => new Date(`${value}-15T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', month: 'long', year: 'numeric' });
const dateInput = (iso: string) => {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime()))
        return '';
    const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
    const get = (type: string) => p.find(v => v.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};
/** Convert a Berlin wall-clock input, including summer time, independently of the device zone. */
export function berlinInputToIso(value: string): string {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
        return '';
    const guess = Date.parse(`${value}Z`);
    if (!Number.isFinite(guess))
        return '';
    let result = guess;
    for (let step = 0; step < 3; step++) {
        const represented = Date.parse(`${dateInput(new Date(result).toISOString())}Z`);
        result += guess - represented;
    }
    const iso = new Date(result).toISOString();
    return dateInput(iso) === value ? iso : '';
}
export function DocumentationWorkspace({ actor }: {
    actor: DocumentationActor;
}) {
    const [filters, setFilters] = useState(initialFilters);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(emptyPage);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [selected, setSelected] = useState<DocumentationEntry | null>(null);
    const [compact, setCompact] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [draft, setDraft] = useState<DocumentationDraft | null>(null);
    const [draftId, setDraftId] = useState('');
    const [saveError, setSaveError] = useState('');
    const [uncertain, setUncertain] = useState(false);
    const [busy, setBusy] = useState(false);
    const alive = useRef(true), requestNumber = useRef(0), locked = useRef(false);
    const confirmLeave = useUnsavedWebChanges(Boolean(draft && (draft.title || draft.body)), busy);
    const refresh = useCallback(async () => {
        const request = ++requestNumber.current;
        setLoading(true);
        setError('');
        const result = await listDocumentation(actor, filters);
        if (!alive.current || request !== requestNumber.current)
            return;
        if (result.ok) {
            setPage(result.data);
            setSelected(current => current ? result.data.items.find(e => e.id === current.id && e.source === current.source) ?? null : null);
        }
        else {
            setPage(emptyPage);
            setSelected(null);
            setError(result.error);
        }
        setLoading(false);
    }, [actor.tenantId, actor.userId, filters]);
    useEffect(() => { alive.current = true; return () => { alive.current = false; requestNumber.current++; }; }, []);
    useEffect(() => { void refresh(); }, [refresh]);
    useEffect(() => { const id = setTimeout(() => setFilters(f => f.query === search.trim() ? f : { ...f, query: search.trim(), offset: 0 }), 280); return () => clearTimeout(id); }, [search]);
    const filter = (patch: Partial<DocumentationFilters>) => { setSelected(null); setFilters(f => ({ ...f, ...patch, offset: 0 })); };
    const months = useMemo(() => [...new Set([berlinMonth(), filters.month, ...page.months].filter(Boolean))].sort().reverse(), [page.months, filters.month]);
    const start = async (entry?: DocumentationEntry) => {
        if (locked.current || !(await confirmLeave()) || !alive.current)
            return;
        setDraft(documentationDraft(entry ? { area: entry.area, clientId: entry.client_id ?? '', employeeId: entry.employee_id ?? '', category: entry.category,
            title: `Ergänzung: ${entry.title}`.slice(0, 180), body: `Bezug: ${entry.title}, ${documentationDateTime(entry.occurred_at)}\n\n` }
            : { area: (filters.area || (filters.clientId ? 'client' : filters.employeeId ? 'employee' : 'administration')) as DocumentationDraft['area'], clientId: filters.clientId, employeeId: filters.employeeId }));
        setDraftId(newDocumentationId());
        setSelected(null);
        setSaveError('');
        setUncertain(false);
        setNotice('');
    };
    const close = async () => { if (locked.current || !(await confirmLeave()) || !alive.current)
        return; setDraft(null); setSelected(null); setSaveError(''); setUncertain(false); };
    const open = async (entry: DocumentationEntry) => { if (locked.current || !(await confirmLeave()) || !alive.current)
        return; setDraft(null); setSelected(entry); setSaveError(''); setUncertain(false); };
    const save = async () => {
        if (!draft || locked.current)
            return;
        const invalid = validateDocumentation(draft);
        if (invalid) {
            setSaveError(invalid);
            return;
        }
        locked.current = true;
        setBusy(true);
        setSaveError('');
        try {
            const result = await createDocumentation(actor, draftId, draft);
            if (!alive.current)
                return;
            if (result.ok) {
                setDraft(null);
                setUncertain(false);
                setSearch('');
                setSelected(null);
                setFilters({ ...initialFilters(), month: berlinMonth(new Date(draft.occurredAt)) });
                setNotice('Dokumentation gespeichert. Der Eintrag ist für das gesamte Team verfügbar.');
            }
            else {
                setSaveError(result.error);
                setUncertain(Boolean(result.uncertain));
            }
        }
        finally {
            locked.current = false;
            if (alive.current)
                setBusy(false);
        }
    };
    const changeDraft = (patch: Partial<DocumentationDraft>) => { if (!busy && !uncertain)
        setDraft(d => d ? { ...d, ...patch } : d); };
    const reset = () => { setSearch(''); setSelected(null); setFilters({ ...initialFilters(), month: '' }); };
    const hasPanel = Boolean(draft || selected);
    return <NativeWorkspaceStyleScope css={[documentationCss, documentationCss]}>{<NativeMain className="cs-doc" aria-label="Gemeinsame Dokumentation">
    <NativeStyle>{documentationCss}</NativeStyle>
    <NativeHeader className="cs-doc-head"><NativeDiv><NativeP className="cs-doc-eyebrow">Office · Gemeinsamer Verlauf</NativeP><NativeH1>Dokumentation</NativeH1>
      <NativeP className="cs-doc-intro">Was passiert ist. Was das Team wissen muss. Für Klienten, Mitarbeitende und die Verwaltung, auch ohne Einsatz.</NativeP></NativeDiv>
      <NativeDiv className="cs-doc-actions"><NativeButton type="button" className="cs-doc-btn" disabled={loading} onClick={() => void refresh()}>Aktualisieren</NativeButton>
        <NativeButton type="button" className="cs-doc-btn primary" disabled={busy} onClick={() => void start()}><NativeSpan aria-hidden="true">＋</NativeSpan> Neuer Eintrag</NativeButton></NativeDiv></NativeHeader>
    {notice && <NativeDiv role="status" className="cs-doc-notice">{notice}</NativeDiv>}
    <NativeDiv className="cs-doc-toolbar"><NativeDiv className="cs-doc-tabs" aria-label="Bereich">
      {[{ value: '', label: 'Alle' }, ...DOCUMENTATION_AREAS].map(a => <NativeButton key={a.value} type="button" aria-pressed={filters.area === a.value} onClick={() => filter({ area: a.value })}>{a.label}</NativeButton>)}</NativeDiv>
      <NativeDiv className="cs-doc-month"><NativeButton type="button" className="cs-doc-btn icon" aria-label="Vorheriger Monat" onClick={() => filter({ month: shiftDocumentationMonth(filters.month, -1) })}>‹</NativeButton>
        <NativeSelect aria-label="Monat" value={filters.month} onChange={e => filter({ month: e.target.value })}><NativeOption value="">Alle Monate</NativeOption>{months.map(m => <NativeOption key={m} value={m}>{monthLabel(m)}</NativeOption>)}</NativeSelect>
        <NativeButton type="button" className="cs-doc-btn icon" aria-label="Nächster Monat" onClick={() => filter({ month: shiftDocumentationMonth(filters.month, 1) })}>›</NativeButton></NativeDiv></NativeDiv>
    <NativeButton type="button" className="cs-doc-btn cs-doc-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)}>Suche & Filter{[filters.clientId, filters.employeeId, filters.category, filters.source, filters.priority, filters.query].filter(Boolean).length > 0 ? ` (${[filters.clientId, filters.employeeId, filters.category, filters.source, filters.priority, filters.query].filter(Boolean).length})` : ''}<NativeSpan aria-hidden="true">{filtersOpen ? '⌃' : '⌄'}</NativeSpan></NativeButton>
    <NativeDiv className={`cs-doc-filter-block${filtersOpen ? ' open' : ''}`}>
    <NativeSection className="cs-doc-filters" aria-label="Dokumentationen filtern"><NativeLabel>Suche<NativeInput type="search" maxLength={200} value={search} placeholder="Inhalt, Name oder Stichwort …" onChange={e => setSearch(e.target.value)}/></NativeLabel>
      <NativeLabel>Klient<NativeSelect value={filters.clientId} onChange={e => filter({ clientId: e.target.value })}><NativeOption value="">Alle Klienten</NativeOption>{page.clients.map(o => <NativeOption key={o.id} value={o.id}>{o.name}</NativeOption>)}</NativeSelect></NativeLabel>
      <NativeLabel>Mitarbeitende<NativeSelect value={filters.employeeId} onChange={e => filter({ employeeId: e.target.value })}><NativeOption value="">Alle Mitarbeitenden</NativeOption>{page.employees.map(o => <NativeOption key={o.id} value={o.id}>{o.name}</NativeOption>)}</NativeSelect></NativeLabel>
      <NativeLabel>Quelle<NativeSelect value={filters.source} onChange={e => filter({ source: e.target.value })}><NativeOption value="">Alle Einträge</NativeOption><NativeOption value="manual">Freie Dokumentation</NativeOption><NativeOption value="visit">Abgeschlossene Einsätze</NativeOption></NativeSelect></NativeLabel>
      <NativeLabel>Dringlichkeit<NativeSelect value={filters.priority} onChange={e => filter({ priority: e.target.value })}><NativeOption value="">Jede Dringlichkeit</NativeOption><NativeOption value="normal">Normal</NativeOption><NativeOption value="important">Wichtig</NativeOption><NativeOption value="urgent">Dringend</NativeOption></NativeSelect></NativeLabel></NativeSection>
    <NativeDiv className="cs-doc-categories" aria-label="Kategorien"><NativeButton type="button" className="cs-doc-chip" style={{ color: '#405d71', background: '#e5edf2' }} aria-pressed={!filters.category} onClick={() => filter({ category: '' })}>Alle Kategorien</NativeButton>
      {DOCUMENTATION_CATEGORIES.map(c => <NativeButton key={c.value} type="button" className="cs-doc-chip" style={{ color: c.color, background: c.tint }} aria-pressed={filters.category === c.value} onClick={() => filter({ category: c.value })}><NativeSpan className="cs-doc-dot"/>{c.label}</NativeButton>)}</NativeDiv>
    </NativeDiv>
    <NativeDiv className="cs-doc-summary"><NativeP aria-live="polite"><NativeStrong>{loading ? '…' : page.total}</NativeStrong> {page.total === 1 ? 'Eintrag' : 'Einträge'}{filters.month ? ` · ${monthLabel(filters.month)}` : ' · alle Monate'}</NativeP>
      <NativeDiv className="cs-doc-actions"><NativeButton type="button" className="cs-doc-btn" onClick={reset}>Filter zurücksetzen</NativeButton><NativeButton type="button" className={`cs-doc-btn${compact ? ' active' : ''}`} aria-pressed={compact} onClick={() => setCompact(c => !c)}>Kompakte Ansicht</NativeButton></NativeDiv></NativeDiv>
    {error && <NativeDiv role="alert" className="cs-doc-error">{error} <NativeButton type="button" className="cs-doc-btn" onClick={() => void refresh()}>Erneut laden</NativeButton></NativeDiv>}
    <NativeDiv className={`cs-doc-layout${hasPanel ? ' has-panel' : ''}`}>
      <NativeSection aria-label="Dokumentationsverlauf" aria-busy={loading}>
        {loading ? <NativeDiv role="status" aria-label="Dokumentationen werden geladen" className="cs-doc-loading"><NativeDiv /><NativeDiv /><NativeDiv /></NativeDiv>
            : !error && page.items.length === 0 ? <NativeDiv className="cs-doc-empty"><NativeH2>Hier beginnt der Überblick.</NativeH2><NativeP>Für diese Auswahl gibt es noch keine Einträge. Sie können jederzeit frei dokumentieren. Gespeicherte Berichte erscheinen automatisch nach Abschluss des Einsatzes.</NativeP><NativeButton type="button" className="cs-doc-btn primary" onClick={() => void start()}>Dokumentation erfassen</NativeButton></NativeDiv>
                : <NativeDiv className={`cs-doc-list${compact ? ' compact' : ''}`}>{page.items.map(entry => {
                        const c = DOCUMENTATION_CATEGORIES.find(c => c.value === entry.category)!;
                        return <NativeWorkspaceStyleScope key={`${entry.source}:${entry.id}`} css={[documentationCss]}>{<NativeButton type="button" className="cs-doc-card" key={`${entry.source}:${entry.id}`} style={{ '--category': c.color } as React.CSSProperties} aria-pressed={selected?.id === entry.id && selected.source === entry.source} onClick={() => void open(entry)}>
              <NativeDiv className="cs-doc-card-top"><NativeSpan className="cs-doc-badge" style={{ color: c.color, background: c.tint }}><NativeSpan className="cs-doc-dot"/>{c.label}</NativeSpan>
                <NativeSpan className="cs-doc-subtle">{documentationDateTime(entry.occurred_at)}</NativeSpan></NativeDiv>
              <NativeH3>{entry.title}</NativeH3><NativeP className="cs-doc-preview">{entry.body}</NativeP><NativeDiv className="cs-doc-card-bottom">
                <NativeStrong>{entry.client_name || entry.employee_name || 'Verwaltung'}</NativeStrong><NativeSpan>{entry.author_name}</NativeSpan><NativeSpan>{entry.source === 'visit' ? '↳ Aus Einsatz übernommen' : 'Freier Eintrag'}</NativeSpan>
                {entry.priority !== 'normal' && <NativeSpan className="cs-doc-badge cs-doc-priority">{entry.priority === 'urgent' ? 'Dringend' : 'Wichtig'}</NativeSpan>}</NativeDiv></NativeButton>}</NativeWorkspaceStyleScope>;
                    })}</NativeDiv>}
        {!loading && page.total > 50 && <NativeNav className="cs-doc-pagination" aria-label="Seiten"><NativeButton type="button" className="cs-doc-btn" disabled={!filters.offset} onClick={() => setFilters(f => ({ ...f, offset: Math.max(0, f.offset - 50) }))}>Zurück</NativeButton>
          <NativeSpan>{filters.offset + 1}–{Math.min(filters.offset + 50, page.total)} von {page.total}</NativeSpan><NativeButton type="button" className="cs-doc-btn" disabled={filters.offset + 50 >= page.total} onClick={() => setFilters(f => ({ ...f, offset: f.offset + 50 }))}>Weiter</NativeButton></NativeNav>}
      </NativeSection>
      {draft && <NativeAside className="cs-doc-panel" aria-label="Neuen Eintrag erfassen"><NativeDiv className="cs-doc-panel-head"><NativeDiv><NativeP className="cs-doc-eyebrow">Jederzeit dokumentieren</NativeP><NativeH2>Neuer Eintrag</NativeH2></NativeDiv><NativeButton type="button" className="cs-doc-btn icon" aria-label="Editor schließen" disabled={busy} onClick={() => void close()}>×</NativeButton></NativeDiv>
        <NativeForm className="cs-doc-panel-body" onSubmit={e => { e.preventDefault(); void save(); }}>
          <NativeP className="cs-doc-hint">Dieser Eintrag ist für das gesamte Team Ihres Unternehmens sichtbar. Vertrauliche Personalakten bleiben in der Personalverwaltung.</NativeP>
          {saveError && <NativeDiv role="alert" className="cs-doc-error">{saveError}</NativeDiv>}
          <NativeFieldset disabled={busy || uncertain} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}><NativeDiv className="cs-doc-form-grid">
            <NativeLabel>Bereich<NativeSelect value={draft.area} onChange={e => changeDraft({ area: e.target.value as DocumentationDraft['area'] })}>{DOCUMENTATION_AREAS.map(a => <NativeOption key={a.value} value={a.value}>{a.label}</NativeOption>)}</NativeSelect></NativeLabel>
            <NativeLabel>Kategorie<NativeSelect value={draft.category} onChange={e => changeDraft({ category: e.target.value as DocumentationDraft['category'] })}>{DOCUMENTATION_CATEGORIES.map(c => <NativeOption key={c.value} value={c.value}>{c.label}</NativeOption>)}</NativeSelect></NativeLabel>
            <NativeLabel>Klient{draft.area === 'client' ? ' *' : ' (optional)'}<NativeSelect value={draft.clientId} required={draft.area === 'client'} onChange={e => changeDraft({ clientId: e.target.value })}><NativeOption value="">Bitte auswählen</NativeOption>{page.clients.map(o => <NativeOption key={o.id} value={o.id}>{o.name}</NativeOption>)}</NativeSelect></NativeLabel>
            <NativeLabel>Mitarbeitende{draft.area === 'employee' ? ' *' : ' (optional)'}<NativeSelect value={draft.employeeId} required={draft.area === 'employee'} onChange={e => changeDraft({ employeeId: e.target.value })}><NativeOption value="">Bitte auswählen</NativeOption>{page.employees.map(o => <NativeOption key={o.id} value={o.id}>{o.name}</NativeOption>)}</NativeSelect></NativeLabel>
            <NativeLabel>Zeitpunkt (Berlin)<NativeInput type="datetime-local" required value={dateInput(draft.occurredAt)} onChange={e => changeDraft({ occurredAt: berlinInputToIso(e.target.value) })}/></NativeLabel>
            <NativeLabel>Dringlichkeit<NativeSelect value={draft.priority} onChange={e => changeDraft({ priority: e.target.value as DocumentationDraft['priority'] })}><NativeOption value="normal">Normal</NativeOption><NativeOption value="important">Wichtig</NativeOption><NativeOption value="urgent">Dringend</NativeOption></NativeSelect></NativeLabel>
            <NativeLabel className="cs-doc-full">Titel *<NativeInput required autoFocus maxLength={180} value={draft.title} placeholder="Was möchten Sie festhalten?" onChange={e => changeDraft({ title: e.target.value })}/></NativeLabel>
            <NativeLabel className="cs-doc-full">Dokumentation *<NativeTextarea required maxLength={20000} value={draft.body} placeholder="Beobachtungen, Gespräche, Absprachen oder wichtige Veränderungen …" onChange={e => changeDraft({ body: e.target.value })}/></NativeLabel>
          </NativeDiv></NativeFieldset>
          <NativeP className="cs-doc-hint">Verfasser und Erfassungszeit werden automatisch gespeichert. Gespeicherte Inhalte bleiben erhalten; Korrekturen werden als Ergänzung dokumentiert.</NativeP>
          <NativeDiv className="cs-doc-actions"><NativeButton type="submit" className="cs-doc-btn primary" disabled={busy}>{busy ? 'Wird gespeichert …' : uncertain ? 'Speicherbestätigung prüfen' : 'Eintrag speichern'}</NativeButton><NativeButton type="button" className="cs-doc-btn" disabled={busy} onClick={() => void close()}>Abbrechen</NativeButton></NativeDiv>
        </NativeForm></NativeAside>}
      {selected && <NativeAside className="cs-doc-panel" aria-label="Dokumentation im Detail"><NativeDiv className="cs-doc-panel-head"><NativeDiv><NativeP className="cs-doc-eyebrow">{selected.source === 'visit' ? 'Aus abgeschlossenem Einsatz' : 'Freie Dokumentation'}</NativeP><NativeH2>{selected.title}</NativeH2></NativeDiv><NativeButton type="button" className="cs-doc-btn icon" aria-label="Details schließen" onClick={() => void close()}>×</NativeButton></NativeDiv>
        <NativeDiv className="cs-doc-panel-body"><NativeDl className="cs-doc-meta"><NativeDiv><NativeDt>Zeitpunkt</NativeDt><NativeDd>{documentationDateTime(selected.occurred_at)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Verfasst von</NativeDt><NativeDd>{selected.author_name}</NativeDd></NativeDiv>
          <NativeDiv><NativeDt>Klient</NativeDt><NativeDd>{selected.client_name || 'Keine Zuordnung'}</NativeDd></NativeDiv><NativeDiv><NativeDt>Mitarbeitende</NativeDt><NativeDd>{selected.employee_name || 'Keine Zuordnung'}</NativeDd></NativeDiv>
          <NativeDiv><NativeDt>Kategorie</NativeDt><NativeDd>{DOCUMENTATION_CATEGORIES.find(c => c.value === selected.category)?.label}</NativeDd></NativeDiv><NativeDiv><NativeDt>Erfasst am</NativeDt><NativeDd>{documentationDateTime(selected.created_at)}</NativeDd></NativeDiv></NativeDl>
          <NativeDiv className="cs-doc-copy">{selected.body}</NativeDiv><NativeP className="cs-doc-hint">{selected.source === 'visit' ? 'Dieser Bericht stammt aus dem Einsatz. Das Original bleibt dort gespeichert. Ergänzungen können Sie hier als neuen Eintrag festhalten.' : 'Der gespeicherte Eintrag bleibt erhalten. Ergänzen Sie neue Informationen oder Korrekturen mit einem weiteren Eintrag.'}</NativeP>
          <NativeButton type="button" className="cs-doc-btn primary" onClick={() => void start(selected)}>Ergänzung erfassen</NativeButton></NativeDiv></NativeAside>}
    </NativeDiv>
    <NativeP className="cs-doc-hint" style={{ marginTop: 22 }}>Gemeinsam im Team · Abgeschlossene Einsätze werden automatisch eingebunden · Freie Einträge sind unabhängig vom Einsatzplan</NativeP>
  </NativeMain>}</NativeWorkspaceStyleScope>;
}
