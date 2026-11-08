// Generated native presentation from src/components/office/documentation/DocumentationWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeStyle,NativeMain,NativeHeader,NativeP,NativeH1,NativeButton,NativeSpan,NativeLabel,NativeSelect,NativeOption,NativeInput,NativeSection,NativeAside,NativeH2,NativeForm,NativeFieldset,NativeTextarea,NativeStrong,NativeH3,NativeNav,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { EmployeePortalBackdrop } from '@/components/portal/employee/EmployeePortalBackdrop';
import { DesktopCatalogArtwork } from "../../../liquid-command/components/DesktopCatalogArtwork.tsx";
import { useUnsavedWebChanges } from "../../../hooks/useUnsavedWebChanges.native.ts";
import { DOCUMENTATION_AREAS, DOCUMENTATION_CATEGORIES, berlinMonth, documentationDateParts, documentationDateTime, documentationDraft, newDocumentationId, shiftDocumentationMonth, validateDocumentation } from '@/lib/office/documentation/model';
import type { DocumentationActor, DocumentationDraft, DocumentationEntry, DocumentationFilters, DocumentationPage, DocumentationUpload } from '@/lib/office/documentation/model';
import { createDocumentation, listDocumentation } from '@/lib/office/documentation/service';
import { DocumentationReader } from "./DocumentationReader.native.tsx";
import { DocumentationFilePicker } from "./DocumentationFiles.native.tsx";
import { discardDocumentationFile, uploadDocumentationFile } from '@/lib/office/documentation/attachments';
import { documentationCss } from "./documentationCss.native.ts";
const initialFilters = (): DocumentationFilters => ({ month: berlinMonth(), area: '', clientId: '', employeeId: '', category: '', source: '', priority: '', query: '', offset: 0 });
const emptyPage: DocumentationPage = { items: [], total: 0, months: [], clients: [], employees: [] };
const areaOptions = [{ value: '', label: 'Alle' }, ...DOCUMENTATION_AREAS];
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
export function DocumentationWorkspace({ actor, employeeView = false }: {
    actor: DocumentationActor;
    employeeView?: boolean;
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
    const filterPanelId = useId();
    const [draft, setDraft] = useState<DocumentationDraft | null>(null);
    const [draftId, setDraftId] = useState('');
    const [files, setFiles] = useState<DocumentationUpload[]>([]);
    const [savedId, setSavedId] = useState('');
    const [recording, setRecording] = useState(false);
    const fileState = useRef({ files, savedId });
    fileState.current = { files, savedId };
    const [saveError, setSaveError] = useState('');
    const [uncertain, setUncertain] = useState(false);
    const [busy, setBusy] = useState(false);
    const alive = useRef(true), requestNumber = useRef(0), locked = useRef(false);
    const confirmLeave = useUnsavedWebChanges(Boolean(draft && (draft.title || draft.body || files.length)), busy || recording);
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
    useEffect(() => { alive.current = true; return () => { alive.current = false; requestNumber.current++; const state = fileState.current; if (state.savedId)
        for (const f of state.files.filter(f => !f.done))
            void discardDocumentationFile(actor, { id: state.savedId, source: 'manual' }, f).catch(() => { }); }; }, []);
    useEffect(() => { void refresh(); }, [refresh]);
    useEffect(() => { const id = setTimeout(() => setFilters(f => f.query === search.trim() ? f : { ...f, query: search.trim(), offset: 0 }), 280); return () => clearTimeout(id); }, [search]);
    const filter = (patch: Partial<DocumentationFilters>) => { setSelected(null); setFilters(f => ({ ...f, ...patch, offset: 0 })); };
    const months = useMemo(() => [...new Set([berlinMonth(), filters.month, ...page.months].filter(Boolean))].sort().reverse(), [page.months, filters.month]);
    const start = async (entry?: DocumentationEntry) => {
        if (locked.current || !(await confirmLeave()) || !alive.current)
            return;
        if (savedId)
            for (const f of files.filter(f => !f.done))
                void discardDocumentationFile(actor, { id: savedId, source: 'manual' }, f).catch(() => { });
        setDraft(documentationDraft(entry ? { area: entry.area, clientId: entry.client_id ?? '', employeeId: entry.employee_id ?? '', category: entry.category,
            title: `Ergänzung: ${entry.title}`.slice(0, 180), body: `Bezug: ${entry.title}, ${documentationDateTime(entry.occurred_at)}\n\n` }
            : { area: (filters.area || (filters.clientId ? 'client' : filters.employeeId ? 'employee' : 'administration')) as DocumentationDraft['area'], clientId: filters.clientId, employeeId: filters.employeeId }));
        setDraftId(newDocumentationId());
        setFiles([]);
        setSavedId('');
        setSelected(null);
        setSaveError('');
        setUncertain(false);
        setNotice('');
    };
    const close = async () => { if (locked.current || !(await confirmLeave()) || !alive.current)
        return; if (savedId)
        for (const f of files.filter(f => !f.done))
            void discardDocumentationFile(actor, { id: savedId, source: 'manual' }, f).catch(() => { }); setDraft(null); setFiles([]); setSavedId(''); setSelected(null); setSaveError(''); setUncertain(false); };
    const open = async (entry: DocumentationEntry) => { if (locked.current || !(await confirmLeave()) || !alive.current)
        return; if (savedId)
        for (const f of files.filter(f => !f.done))
            void discardDocumentationFile(actor, { id: savedId, source: 'manual' }, f).catch(() => { }); setFiles([]); setSavedId(''); setDraft(null); setSelected(entry); setSaveError(''); setUncertain(false); };
    const save = async () => {
        if (!draft || locked.current || recording)
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
            let entryId = savedId;
            if (!entryId) {
                const result = await createDocumentation(actor, draftId, draft);
                if (!alive.current)
                    return;
                if (!result.ok) {
                    setSaveError(result.error);
                    setUncertain(Boolean(result.uncertain));
                    return;
                }
                entryId = result.data.id;
                setSavedId(entryId);
                setUncertain(false);
            }
            try {
                for (const file of files.filter(f => !f.done)) {
                    await uploadDocumentationFile(actor, { id: entryId, source: 'manual' }, file);
                    if (!alive.current)
                        return;
                    setFiles(current => current.map(item => item.id === file.id ? { ...item, done: true } : item));
                }
            }
            catch {
                if (alive.current)
                    setSaveError('Der Text ist gespeichert. Mindestens ein Anhang fehlt noch. Bitte die fehlenden Anhänge erneut speichern.');
                return;
            }
            if (!alive.current)
                return;
            setDraft(null);
            setFiles([]);
            setSavedId('');
            setUncertain(false);
            setSearch('');
            setSelected(null);
            setFilters({ ...initialFilters(), month: berlinMonth(new Date(draft.occurredAt)) });
            setNotice('Dokumentation gespeichert. Der Eintrag ist für das gesamte Team verfügbar.');
        }
        finally {
            locked.current = false;
            if (alive.current)
                setBusy(false);
        }
    };
    const changeDraft = (patch: Partial<DocumentationDraft>) => { if (!busy && !uncertain && !savedId)
        setDraft(d => d ? { ...d, ...patch } : d); };
    const reset = () => { setSearch(''); setSelected(null); setFilters({ ...initialFilters(), month: '' }); };
    const activeFilterCount = [filters.clientId, filters.employeeId, filters.category, filters.source, filters.priority].filter(Boolean).length;
    return <NativeWorkspaceStyleScope css={[documentationCss, documentationCss]}>{(<NativeDiv className="cs-doc-viewport">
      <NativeStyle>{documentationCss}</NativeStyle>
      {!employeeView && <EmployeePortalBackdrop animated/>}
      <NativeMain className="cs-doc cs-doc-workspace" data-cs-healthos-surface="dark" aria-label="Gemeinsame Dokumentation">
        <NativeDiv className="cs-doc-board">
          <NativeHeader className="cs-doc-head">
            <NativeDiv className="cs-doc-hero-copy">
              <NativeP className="cs-doc-eyebrow">{employeeView ? 'Gemeinsamer Verlauf' : 'Office · Gemeinsamer Verlauf'}</NativeP>
              <NativeH1>Dokumentation</NativeH1>
              <NativeP className="cs-doc-intro">Abgeschlossene Einsätze und freie Einträge für das Team.</NativeP>
              <NativeDiv className="cs-doc-actions">
                <NativeButton type="button" className="cs-doc-btn primary" disabled={busy} onClick={() => void start()}>
                  <NativeSpan aria-hidden="true">＋</NativeSpan> Neuer Eintrag
                </NativeButton>
                <NativeButton type="button" className="cs-doc-btn cs-doc-refresh" aria-label="Aktualisieren" disabled={loading} onClick={() => void refresh()}>
                  <NativeSpan className="cs-doc-refresh-label">Aktualisieren</NativeSpan><NativeSpan className="cs-doc-refresh-icon" aria-hidden="true">↻</NativeSpan>
                </NativeButton>
              </NativeDiv>
            </NativeDiv>
            <NativeDiv className="cs-doc-hero-art" aria-hidden="true">
              <DesktopCatalogArtwork route="/office/dokumentation" label="" size={166}/>
            </NativeDiv>
          </NativeHeader>

          {notice && <NativeDiv role="status" className="cs-doc-notice">{notice}</NativeDiv>}
          <NativeDiv className="cs-doc-controls">
            <NativeDiv className="cs-doc-toolbar">
              <NativeDiv className="cs-doc-tabs" role="group" aria-label="Bereich">
                {areaOptions.map(area => (<NativeButton key={area.value} type="button" aria-pressed={filters.area === area.value} onClick={() => filter({ area: area.value })}>
                    {area.label}
                  </NativeButton>))}
              </NativeDiv>
              <NativeLabel className="cs-doc-scope-select">Bereich
                <NativeSelect value={filters.area} onChange={e => filter({ area: e.target.value })}>
                  {areaOptions.map(area => <NativeOption key={area.value} value={area.value}>{area.label}</NativeOption>)}
                </NativeSelect>
              </NativeLabel>
              <NativeDiv className="cs-doc-month" role="group" aria-label="Zeitraum">
                <NativeSelect aria-label="Monat" value={filters.month} onChange={e => filter({ month: e.target.value })}>
                  <NativeOption value="">Alle Monate</NativeOption>
                  {months.map(month => <NativeOption key={month} value={month}>{monthLabel(month)}</NativeOption>)}
                </NativeSelect>
                <NativeButton type="button" className="cs-doc-btn icon cs-doc-month-prev" aria-label="Vorheriger Monat" onClick={() => filter({ month: shiftDocumentationMonth(filters.month, -1) })}>‹</NativeButton>
                <NativeButton type="button" className="cs-doc-btn icon" aria-label="Nächster Monat" onClick={() => filter({ month: shiftDocumentationMonth(filters.month, 1) })}>›</NativeButton>
              </NativeDiv>
            </NativeDiv>

            <NativeDiv className="cs-doc-search-row">
              <NativeLabel className="cs-doc-search">Suche
                <NativeInput type="search" maxLength={200} value={search} placeholder="Name oder Stichwort …" onChange={e => setSearch(e.target.value)}/>
              </NativeLabel>
              <NativeButton type="button" className="cs-doc-btn cs-doc-filter-toggle" aria-expanded={filtersOpen} aria-controls={filterPanelId} onClick={() => setFiltersOpen(open => !open)}>
                Weitere Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}<NativeSpan aria-hidden="true">{filtersOpen ? '⌃' : '⌄'}</NativeSpan>
              </NativeButton>
            </NativeDiv>

            {filtersOpen && (<NativeSection id={filterPanelId} className="cs-doc-filter-block" aria-label="Weitere Dokumentationsfilter">
                <NativeDiv className="cs-doc-filters">
                  <NativeLabel>Klient<NativeSelect value={filters.clientId} onChange={e => filter({ clientId: e.target.value })}><NativeOption value="">Alle Klienten</NativeOption>{page.clients.map(o => <NativeOption key={o.id} value={o.id}>{o.name}</NativeOption>)}</NativeSelect></NativeLabel>
                  <NativeLabel>Mitarbeitende<NativeSelect value={filters.employeeId} onChange={e => filter({ employeeId: e.target.value })}><NativeOption value="">Alle Mitarbeitenden</NativeOption>{page.employees.map(o => <NativeOption key={o.id} value={o.id}>{o.name}</NativeOption>)}</NativeSelect></NativeLabel>
                  <NativeLabel>Quelle<NativeSelect value={filters.source} onChange={e => filter({ source: e.target.value })}><NativeOption value="">Alle Einträge</NativeOption><NativeOption value="manual">Freie Dokumentation</NativeOption><NativeOption value="visit">Abgeschlossene Einsätze</NativeOption></NativeSelect></NativeLabel>
                  <NativeLabel>Dringlichkeit<NativeSelect value={filters.priority} onChange={e => filter({ priority: e.target.value })}><NativeOption value="">Jede Dringlichkeit</NativeOption><NativeOption value="normal">Normal</NativeOption><NativeOption value="important">Wichtig</NativeOption><NativeOption value="urgent">Dringend</NativeOption></NativeSelect></NativeLabel>
                </NativeDiv>
                <NativeDiv className="cs-doc-categories" aria-label="Kategorien">
                  <NativeButton type="button" className="cs-doc-chip" aria-pressed={!filters.category} onClick={() => filter({ category: '' })}>Alle Kategorien</NativeButton>
                  {DOCUMENTATION_CATEGORIES.map(category => (<NativeButton key={category.value} type="button" className={`cs-doc-chip cs-doc-category-${category.value}`} aria-pressed={filters.category === category.value} onClick={() => filter({ category: category.value })}>
                      <NativeSpan className="cs-doc-dot" aria-hidden="true"/>{category.label}
                    </NativeButton>))}
                </NativeDiv>
              </NativeSection>)}
          </NativeDiv>

          {error && <NativeDiv role="alert" className="cs-doc-error">{error} <NativeButton type="button" className="cs-doc-btn" onClick={() => void refresh()}>Erneut laden</NativeButton></NativeDiv>}
          <NativeDiv className={`cs-doc-layout${draft ? ' has-panel' : ''}`}>
            {draft && <NativeAside className="cs-doc-panel" aria-label="Neuen Eintrag erfassen"><NativeDiv className="cs-doc-panel-head"><NativeDiv><NativeP className="cs-doc-eyebrow">Jederzeit dokumentieren</NativeP><NativeH2>Neuer Eintrag</NativeH2></NativeDiv><NativeButton type="button" className="cs-doc-btn icon" aria-label="Editor schließen" disabled={busy} onClick={() => void close()}>×</NativeButton></NativeDiv>
              <NativeForm className="cs-doc-panel-body" onSubmit={e => { e.preventDefault(); void save(); }}>
                <NativeP className="cs-doc-hint">Dieser Eintrag ist für das gesamte Team Ihres Unternehmens sichtbar. Vertrauliche Personalakten bleiben in der Personalverwaltung.</NativeP>
                {saveError && <NativeDiv role="alert" className="cs-doc-error">{saveError}</NativeDiv>}
                <NativeFieldset disabled={busy || uncertain || Boolean(savedId)} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}><NativeDiv className="cs-doc-form-grid">
                  <NativeLabel>Bereich<NativeSelect value={draft.area} onChange={e => changeDraft({ area: e.target.value as DocumentationDraft['area'] })}>{DOCUMENTATION_AREAS.map(a => <NativeOption key={a.value} value={a.value}>{a.label}</NativeOption>)}</NativeSelect></NativeLabel>
                  <NativeLabel>Kategorie<NativeSelect value={draft.category} onChange={e => changeDraft({ category: e.target.value as DocumentationDraft['category'] })}>{DOCUMENTATION_CATEGORIES.map(c => <NativeOption key={c.value} value={c.value}>{c.label}</NativeOption>)}</NativeSelect></NativeLabel>
                  <NativeLabel>Klient{draft.area === 'client' ? ' *' : ' (optional)'}<NativeSelect value={draft.clientId} required={draft.area === 'client'} onChange={e => changeDraft({ clientId: e.target.value })}><NativeOption value="">Bitte auswählen</NativeOption>{page.clients.map(o => <NativeOption key={o.id} value={o.id}>{o.name}</NativeOption>)}</NativeSelect></NativeLabel>
                  <NativeLabel>Mitarbeitende{draft.area === 'employee' ? ' *' : ' (optional)'}<NativeSelect value={draft.employeeId} required={draft.area === 'employee'} onChange={e => changeDraft({ employeeId: e.target.value })}><NativeOption value="">Bitte auswählen</NativeOption>{page.employees.map(o => <NativeOption key={o.id} value={o.id}>{o.name}</NativeOption>)}</NativeSelect></NativeLabel>
                  <NativeLabel>Dringlichkeit<NativeSelect value={draft.priority} onChange={e => changeDraft({ priority: e.target.value as DocumentationDraft['priority'] })}><NativeOption value="normal">Normal</NativeOption><NativeOption value="important">Wichtig</NativeOption><NativeOption value="urgent">Dringend</NativeOption></NativeSelect></NativeLabel>
                  <NativeLabel className="cs-doc-full">Zeitpunkt (Berlin)<NativeInput type="datetime-local" required value={dateInput(draft.occurredAt)} onChange={e => changeDraft({ occurredAt: berlinInputToIso(e.target.value) })}/></NativeLabel>
                  <NativeLabel className="cs-doc-full">Titel *<NativeInput required autoFocus maxLength={180} value={draft.title} placeholder="Was möchten Sie festhalten?" onChange={e => changeDraft({ title: e.target.value })}/></NativeLabel>
                  <NativeLabel className="cs-doc-full">Dokumentation *<NativeTextarea required maxLength={20000} value={draft.body} placeholder="Beobachtungen, Gespräche, Absprachen oder wichtige Veränderungen …" onChange={e => changeDraft({ body: e.target.value })}/></NativeLabel>
                </NativeDiv></NativeFieldset>
                {actor.canUpload && <DocumentationFilePicker files={files} disabled={busy || uncertain} onRecording={setRecording} onChange={next => { if (savedId)
            for (const f of files.filter(f => !f.done && !next.some(n => n.id === f.id)))
                void discardDocumentationFile(actor, { id: savedId, source: 'manual' }, f).catch(() => { }); setFiles(next); }}/>}
                <NativeP className="cs-doc-hint">Verfasser und Erfassungszeit werden automatisch gespeichert. Gespeicherte Inhalte bleiben erhalten; Korrekturen werden als Ergänzung dokumentiert.</NativeP>
                <NativeDiv className="cs-doc-actions"><NativeButton type="submit" className="cs-doc-btn primary" disabled={busy || recording}>{busy ? 'Wird gespeichert …' : uncertain ? 'Speicherbestätigung prüfen' : savedId ? 'Fehlende Anhänge speichern' : 'Eintrag speichern'}</NativeButton><NativeButton type="button" className="cs-doc-btn" disabled={busy} onClick={() => void close()}>Abbrechen</NativeButton></NativeDiv>
              </NativeForm></NativeAside>}

            <NativeSection className="cs-doc-list-pane" aria-label="Dokumentationsverlauf" aria-busy={loading}>
              <NativeDiv className="cs-doc-summary">
                <NativeDiv className="cs-doc-summary-copy">
                  <NativeH2>Verlauf</NativeH2>
                  <NativeP aria-live="polite"><NativeStrong>{loading ? '…' : page.total}</NativeStrong> {page.total === 1 ? 'Eintrag' : 'Einträge'}
                    {filters.month ? ` · ${monthLabel(filters.month)}` : ' · alle Monate'}</NativeP>
                </NativeDiv>
                <NativeDiv className="cs-doc-actions">
                  <NativeButton type="button" className="cs-doc-btn" onClick={reset}>Filter zurücksetzen</NativeButton>
                  <NativeButton type="button" className="cs-doc-btn" aria-pressed={compact} onClick={() => setCompact(value => !value)}>Kompakte Ansicht</NativeButton>
                </NativeDiv>
              </NativeDiv>

              {loading ? (<NativeDiv role="status" className="cs-doc-loading">Dokumentationen werden geladen …</NativeDiv>) : !error && page.items.length === 0 ? (<NativeDiv className="cs-doc-empty">
                  <NativeH3>Keine Einträge für diese Auswahl</NativeH3>
                  <NativeP>Ändern Sie den Zeitraum oder die Filter, oder erfassen Sie einen neuen Eintrag.</NativeP>
                  <NativeButton type="button" className="cs-doc-btn primary" onClick={() => void start()}>Dokumentation erfassen</NativeButton>
                </NativeDiv>) : (<NativeDiv className={`cs-doc-list${compact ? ' compact' : ''}`}>
                  {page.items.map(entry => {
                const category = DOCUMENTATION_CATEGORIES.find(item => item.value === entry.category)!;
                const person = entry.client_name || entry.employee_name || 'Verwaltung';
                const date = documentationDateParts(entry.occurred_at);
                const dateLabel = date ? documentationDateTime(entry.occurred_at) : 'Datum offen';
                return <NativeWorkspaceStyleScope key={`${entry.source}:${entry.id}`} css={[documentationCss]}>{(<NativeButton type="button" className={`cs-doc-card cs-doc-category-${category.value}`} key={`${entry.source}:${entry.id}`} aria-haspopup="dialog" aria-label={`Dokumentation öffnen: ${entry.title}, ${person}, ${dateLabel}`} aria-expanded={selected?.id === entry.id && selected.source === entry.source} onClick={() => void open(entry)}>
                        <NativeSpan className="cs-doc-card-main">
                          <NativeSpan className="cs-doc-date" aria-hidden="true">
                            {date ? <>
                              <NativeSpan>{date.weekday}</NativeSpan>
                              <NativeStrong>{date.day}</NativeStrong>
                              <NativeSpan>{date.month} {date.year}</NativeSpan>
                              <NativeSpan className="cs-doc-date-time">{date.time}</NativeSpan>
                            </> : <NativeSpan>Datum offen</NativeSpan>}
                          </NativeSpan>
                          <NativeSpan className="cs-doc-card-copy">
                            <NativeSpan className="cs-doc-card-top">
                              <NativeSpan className="cs-doc-badge"><NativeSpan className="cs-doc-dot" aria-hidden="true"/>{category.label}</NativeSpan>
                              {entry.priority !== 'normal' && (<NativeSpan className={`cs-doc-priority ${entry.priority}`}>{entry.priority === 'urgent' ? 'Dringend' : 'Wichtig'}</NativeSpan>)}
                            </NativeSpan>
                            <NativeStrong className="cs-doc-card-title">{entry.title}</NativeStrong>
                            <NativeSpan className="cs-doc-preview">{entry.body}</NativeSpan>
                          </NativeSpan>
                        </NativeSpan>
                        <NativeSpan className="cs-doc-card-bottom">
                          <NativeSpan className="cs-doc-card-meta">
                            <NativeStrong>{person}</NativeStrong><NativeSpan>{entry.author_name}</NativeSpan>
                            <NativeSpan>{entry.source === 'visit' ? 'Aus Einsatz übernommen' : 'Freier Eintrag'}</NativeSpan>
                          </NativeSpan>
                          <NativeSpan className="cs-doc-read-label">Groß lesen ↗</NativeSpan>
                        </NativeSpan>
                      </NativeButton>)}</NativeWorkspaceStyleScope>;
            })}
                </NativeDiv>)}

              {!loading && page.total > 50 && (<NativeNav className="cs-doc-pagination" aria-label="Seiten">
                  <NativeButton type="button" className="cs-doc-btn" disabled={!filters.offset} onClick={() => setFilters(f => ({ ...f, offset: Math.max(0, f.offset - 50) }))}>Zurück</NativeButton>
                  <NativeSpan>{filters.offset + 1}–{Math.min(filters.offset + 50, page.total)} von {page.total}</NativeSpan>
                  <NativeButton type="button" className="cs-doc-btn" disabled={filters.offset + 50 >= page.total} onClick={() => setFilters(f => ({ ...f, offset: f.offset + 50 }))}>Weiter</NativeButton>
                </NativeNav>)}
            </NativeSection>
          </NativeDiv>

          {selected && <DocumentationReader actor={actor} entry={selected} onClose={() => void close()} onAdd={() => void start(selected)}/>}
        </NativeDiv>
      </NativeMain>
    </NativeDiv>)}</NativeWorkspaceStyleScope>;
}
