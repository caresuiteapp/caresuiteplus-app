import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { EmployeePortalBackdrop } from '@/components/portal/employee/EmployeePortalBackdrop';
import { DesktopCatalogArtwork } from '@/liquid-command/components/DesktopCatalogArtwork';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import { DOCUMENTATION_AREAS, DOCUMENTATION_CATEGORIES, berlinMonth, documentationDateParts, documentationDateTime, documentationDraft, newDocumentationId, shiftDocumentationMonth, validateDocumentation } from '@/lib/office/documentation/model';
import type { DocumentationActor, DocumentationDraft, DocumentationEntry, DocumentationFilters, DocumentationPage, DocumentationUpload } from '@/lib/office/documentation/model';
import { createDocumentation, listDocumentation } from '@/lib/office/documentation/service';
import { DocumentationReader } from './DocumentationReader.web';
import { DocumentationFilePicker } from './DocumentationFiles.web';
import { discardDocumentationFile, uploadDocumentationFile } from '@/lib/office/documentation/attachments';
import { documentationCss } from './documentationCss.web';

const initialFilters = (): DocumentationFilters => ({ month: berlinMonth(), area: '', clientId: '', employeeId: '', category: '', source: '', priority: '', query: '', offset: 0 });
const emptyPage: DocumentationPage = { items: [], total: 0, months: [], clients: [], employees: [] };
const areaOptions = [{ value: '', label: 'Alle' }, ...DOCUMENTATION_AREAS];
const monthLabel = (value: string) => new Date(`${value}-15T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', month: 'long', year: 'numeric' });
const dateInput = (iso: string) => {
  const d = new Date(iso); if (!Number.isFinite(d.getTime())) return '';
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const get = (type: string) => p.find(v => v.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};
/** Convert a Berlin wall-clock input, including summer time, independently of the device zone. */
export function berlinInputToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return '';
  const guess = Date.parse(`${value}Z`); if (!Number.isFinite(guess)) return '';
  let result = guess;
  for (let step = 0; step < 3; step++) {
    const represented = Date.parse(`${dateInput(new Date(result).toISOString())}Z`);
    result += guess - represented;
  }
  const iso = new Date(result).toISOString();
  return dateInput(iso) === value ? iso : '';
}

export function DocumentationWorkspace({ actor, employeeView = false }: { actor: DocumentationActor; employeeView?: boolean }) {
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
  const fileState = useRef({ files, savedId }); fileState.current = { files, savedId };
  const [saveError, setSaveError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true), requestNumber = useRef(0), locked = useRef(false);
  const confirmLeave = useUnsavedWebChanges(Boolean(draft && (draft.title || draft.body || files.length)), busy || recording);
  const refresh = useCallback(async () => {
    const request = ++requestNumber.current; setLoading(true); setError('');
    const result = await listDocumentation(actor, filters);
    if (!alive.current || request !== requestNumber.current) return;
    if (result.ok) {
      setPage(result.data);
      setSelected(current => current ? result.data.items.find(e => e.id === current.id && e.source === current.source) ?? null : null);
    } else { setPage(emptyPage); setSelected(null); setError(result.error); }
    setLoading(false);
  }, [actor.tenantId, actor.userId, filters]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; requestNumber.current++; const state = fileState.current; if (state.savedId) for (const f of state.files.filter(f => !f.done)) void discardDocumentationFile(actor, { id: state.savedId, source: 'manual' }, f).catch(() => {}); }; }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const id = setTimeout(() => setFilters(f => f.query === search.trim() ? f : { ...f, query: search.trim(), offset: 0 }), 280); return () => clearTimeout(id); }, [search]);
  const filter = (patch: Partial<DocumentationFilters>) => { setSelected(null); setFilters(f => ({ ...f, ...patch, offset: 0 })); };
  const months = useMemo(() => [...new Set([berlinMonth(), filters.month, ...page.months].filter(Boolean))].sort().reverse(), [page.months, filters.month]);
  const start = async (entry?: DocumentationEntry) => {
    if (locked.current || !(await confirmLeave()) || !alive.current) return;
    if (savedId) for (const f of files.filter(f => !f.done)) void discardDocumentationFile(actor, { id: savedId, source: 'manual' }, f).catch(() => {});
    setDraft(documentationDraft(entry ? { area: entry.area, clientId: entry.client_id ?? '', employeeId: entry.employee_id ?? '', category: entry.category,
      title: `Ergänzung: ${entry.title}`.slice(0, 180), body: `Bezug: ${entry.title}, ${documentationDateTime(entry.occurred_at)}\n\n` }
      : { area: (filters.area || (filters.clientId ? 'client' : filters.employeeId ? 'employee' : 'administration')) as DocumentationDraft['area'], clientId: filters.clientId, employeeId: filters.employeeId }));
    setDraftId(newDocumentationId()); setFiles([]); setSavedId(''); setSelected(null); setSaveError(''); setUncertain(false); setNotice('');
  };
  const close = async () => { if (locked.current || !(await confirmLeave()) || !alive.current) return; if (savedId) for (const f of files.filter(f => !f.done)) void discardDocumentationFile(actor, { id: savedId, source: 'manual' }, f).catch(() => {}); setDraft(null); setFiles([]); setSavedId(''); setSelected(null); setSaveError(''); setUncertain(false); };
  const open = async (entry: DocumentationEntry) => { if (locked.current || !(await confirmLeave()) || !alive.current) return; if (savedId) for (const f of files.filter(f => !f.done)) void discardDocumentationFile(actor, { id: savedId, source: 'manual' }, f).catch(() => {}); setFiles([]); setSavedId(''); setDraft(null); setSelected(entry); setSaveError(''); setUncertain(false); };
  const save = async () => {
    if (!draft || locked.current || recording) return;
    const invalid = validateDocumentation(draft); if (invalid) { setSaveError(invalid); return; }
    locked.current = true; setBusy(true); setSaveError('');
    try {
      let entryId = savedId;
      if (!entryId) {
        const result = await createDocumentation(actor, draftId, draft);
        if (!alive.current) return;
        if (!result.ok) { setSaveError(result.error); setUncertain(Boolean(result.uncertain)); return; }
        entryId = result.data.id; setSavedId(entryId); setUncertain(false);
      }
      try {
        for (const file of files.filter(f => !f.done)) {
          await uploadDocumentationFile(actor, { id: entryId, source: 'manual' }, file);
          if (!alive.current) return;
          setFiles(current => current.map(item => item.id === file.id ? { ...item, done: true } : item));
        }
      } catch {
        if (alive.current) setSaveError('Der Text ist gespeichert. Mindestens ein Anhang fehlt noch. Bitte die fehlenden Anhänge erneut speichern.');
        return;
      }
      if (!alive.current) return;
      setDraft(null); setFiles([]); setSavedId(''); setUncertain(false); setSearch(''); setSelected(null);
      setFilters({ ...initialFilters(), month: berlinMonth(new Date(draft.occurredAt)) });
      setNotice('Dokumentation gespeichert. Der Eintrag ist für das gesamte Team verfügbar.');
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  const changeDraft = (patch: Partial<DocumentationDraft>) => { if (!busy && !uncertain && !savedId) setDraft(d => d ? { ...d, ...patch } : d); };
  const reset = () => { setSearch(''); setSelected(null); setFilters({ ...initialFilters(), month: '' }); };
  const activeFilterCount = [filters.clientId, filters.employeeId, filters.category, filters.source, filters.priority].filter(Boolean).length;
  return (
    <div className="cs-doc-viewport">
      <style>{documentationCss}</style>
      {!employeeView && <EmployeePortalBackdrop animated />}
      <main className="cs-doc cs-doc-workspace" data-cs-healthos-surface="dark" aria-label="Gemeinsame Dokumentation">
        <div className="cs-doc-board">
          <header className="cs-doc-head">
            <div className="cs-doc-hero-copy">
              <p className="cs-doc-eyebrow">{employeeView ? 'Gemeinsamer Verlauf' : 'Office · Gemeinsamer Verlauf'}</p>
              <h1>Dokumentation</h1>
              <p className="cs-doc-intro">Abgeschlossene Einsätze und freie Einträge für das Team.</p>
              <div className="cs-doc-actions">
                <button type="button" className="cs-doc-btn primary" disabled={busy} onClick={() => void start()}>
                  <span aria-hidden="true">＋</span> Neuer Eintrag
                </button>
                <button type="button" className="cs-doc-btn cs-doc-refresh" aria-label="Aktualisieren" disabled={loading} onClick={() => void refresh()}>
                  <span className="cs-doc-refresh-label">Aktualisieren</span><span className="cs-doc-refresh-icon" aria-hidden="true">↻</span>
                </button>
              </div>
            </div>
            <div className="cs-doc-hero-art" aria-hidden="true">
              <DesktopCatalogArtwork route="/office/dokumentation" label="" size={166} />
            </div>
          </header>

          {notice && <div role="status" className="cs-doc-notice">{notice}</div>}
          <div className="cs-doc-controls">
            <div className="cs-doc-toolbar">
              <div className="cs-doc-tabs" role="group" aria-label="Bereich">
                {areaOptions.map(area => (
                  <button key={area.value} type="button" aria-pressed={filters.area === area.value} onClick={() => filter({ area: area.value })}>
                    {area.label}
                  </button>
                ))}
              </div>
              <label className="cs-doc-scope-select">Bereich
                <select value={filters.area} onChange={e => filter({ area: e.target.value })}>
                  {areaOptions.map(area => <option key={area.value} value={area.value}>{area.label}</option>)}
                </select>
              </label>
              <div className="cs-doc-month" role="group" aria-label="Zeitraum">
                <select aria-label="Monat" value={filters.month} onChange={e => filter({ month: e.target.value })}>
                  <option value="">Alle Monate</option>
                  {months.map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}
                </select>
                <button type="button" className="cs-doc-btn icon cs-doc-month-prev" aria-label="Vorheriger Monat" onClick={() => filter({ month: shiftDocumentationMonth(filters.month, -1) })}>‹</button>
                <button type="button" className="cs-doc-btn icon" aria-label="Nächster Monat" onClick={() => filter({ month: shiftDocumentationMonth(filters.month, 1) })}>›</button>
              </div>
            </div>

            <div className="cs-doc-search-row">
              <label className="cs-doc-search">Suche
                <input type="search" maxLength={200} value={search} placeholder="Name oder Stichwort …" onChange={e => setSearch(e.target.value)} />
              </label>
              <button type="button" className="cs-doc-btn cs-doc-filter-toggle" aria-expanded={filtersOpen} aria-controls={filterPanelId}
                onClick={() => setFiltersOpen(open => !open)}>
                Weitere Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}<span aria-hidden="true">{filtersOpen ? '⌃' : '⌄'}</span>
              </button>
            </div>

            {filtersOpen && (
              <section id={filterPanelId} className="cs-doc-filter-block" aria-label="Weitere Dokumentationsfilter">
                <div className="cs-doc-filters">
                  <label>Klient<select value={filters.clientId} onChange={e => filter({ clientId: e.target.value })}><option value="">Alle Klienten</option>{page.clients.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                  <label>Mitarbeitende<select value={filters.employeeId} onChange={e => filter({ employeeId: e.target.value })}><option value="">Alle Mitarbeitenden</option>{page.employees.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                  <label>Quelle<select value={filters.source} onChange={e => filter({ source: e.target.value })}><option value="">Alle Einträge</option><option value="manual">Freie Dokumentation</option><option value="visit">Abgeschlossene Einsätze</option></select></label>
                  <label>Dringlichkeit<select value={filters.priority} onChange={e => filter({ priority: e.target.value })}><option value="">Jede Dringlichkeit</option><option value="normal">Normal</option><option value="important">Wichtig</option><option value="urgent">Dringend</option></select></label>
                </div>
                <div className="cs-doc-categories" aria-label="Kategorien">
                  <button type="button" className="cs-doc-chip" aria-pressed={!filters.category} onClick={() => filter({ category: '' })}>Alle Kategorien</button>
                  {DOCUMENTATION_CATEGORIES.map(category => (
                    <button key={category.value} type="button" className={`cs-doc-chip cs-doc-category-${category.value}`}
                      aria-pressed={filters.category === category.value} onClick={() => filter({ category: category.value })}>
                      <span className="cs-doc-dot" aria-hidden="true" />{category.label}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {error && <div role="alert" className="cs-doc-error">{error} <button type="button" className="cs-doc-btn" onClick={() => void refresh()}>Erneut laden</button></div>}
          <div className={`cs-doc-layout${draft ? ' has-panel' : ''}`}>
            {draft && <aside className="cs-doc-panel" aria-label="Neuen Eintrag erfassen"><div className="cs-doc-panel-head"><div><p className="cs-doc-eyebrow">Jederzeit dokumentieren</p><h2>Neuer Eintrag</h2></div><button type="button" className="cs-doc-btn icon" aria-label="Editor schließen" disabled={busy} onClick={() => void close()}>×</button></div>
              <form className="cs-doc-panel-body" onSubmit={e => { e.preventDefault(); void save(); }}>
                <p className="cs-doc-hint">Dieser Eintrag ist für das gesamte Team Ihres Unternehmens sichtbar. Vertrauliche Personalakten bleiben in der Personalverwaltung.</p>
                {saveError && <div role="alert" className="cs-doc-error">{saveError}</div>}
                <fieldset disabled={busy || uncertain || Boolean(savedId)} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}><div className="cs-doc-form-grid">
                  <label>Bereich<select value={draft.area} onChange={e => changeDraft({ area: e.target.value as DocumentationDraft['area'] })}>{DOCUMENTATION_AREAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}</select></label>
                  <label>Kategorie<select value={draft.category} onChange={e => changeDraft({ category: e.target.value as DocumentationDraft['category'] })}>{DOCUMENTATION_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
                  <label>Klient{draft.area === 'client' ? ' *' : ' (optional)'}<select value={draft.clientId} required={draft.area === 'client'} onChange={e => changeDraft({ clientId: e.target.value })}><option value="">Bitte auswählen</option>{page.clients.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                  <label>Mitarbeitende{draft.area === 'employee' ? ' *' : ' (optional)'}<select value={draft.employeeId} required={draft.area === 'employee'} onChange={e => changeDraft({ employeeId: e.target.value })}><option value="">Bitte auswählen</option>{page.employees.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
                  <label>Dringlichkeit<select value={draft.priority} onChange={e => changeDraft({ priority: e.target.value as DocumentationDraft['priority'] })}><option value="normal">Normal</option><option value="important">Wichtig</option><option value="urgent">Dringend</option></select></label>
                  <label className="cs-doc-full">Zeitpunkt (Berlin)<input type="datetime-local" required value={dateInput(draft.occurredAt)} onChange={e => changeDraft({ occurredAt: berlinInputToIso(e.target.value) })} /></label>
                  <label className="cs-doc-full">Titel *<input required autoFocus maxLength={180} value={draft.title} placeholder="Was möchten Sie festhalten?" onChange={e => changeDraft({ title: e.target.value })} /></label>
                  <label className="cs-doc-full">Dokumentation *<textarea required maxLength={20000} value={draft.body} placeholder="Beobachtungen, Gespräche, Absprachen oder wichtige Veränderungen …" onChange={e => changeDraft({ body: e.target.value })} /></label>
                </div></fieldset>
                {actor.canUpload && <DocumentationFilePicker files={files} disabled={busy || uncertain} onRecording={setRecording} onChange={next => { if (savedId) for (const f of files.filter(f => !f.done && !next.some(n => n.id === f.id))) void discardDocumentationFile(actor, { id: savedId, source: 'manual' }, f).catch(() => {}); setFiles(next); }} />}
                <p className="cs-doc-hint">Verfasser und Erfassungszeit werden automatisch gespeichert. Gespeicherte Inhalte bleiben erhalten; Korrekturen werden als Ergänzung dokumentiert.</p>
                <div className="cs-doc-actions"><button type="submit" className="cs-doc-btn primary" disabled={busy || recording}>{busy ? 'Wird gespeichert …' : uncertain ? 'Speicherbestätigung prüfen' : savedId ? 'Fehlende Anhänge speichern' : 'Eintrag speichern'}</button><button type="button" className="cs-doc-btn" disabled={busy} onClick={() => void close()}>Abbrechen</button></div>
              </form></aside>}

            <section className="cs-doc-list-pane" aria-label="Dokumentationsverlauf" aria-busy={loading}>
              <div className="cs-doc-summary">
                <div className="cs-doc-summary-copy">
                  <h2>Verlauf</h2>
                  <p aria-live="polite"><strong>{loading ? '…' : page.total}</strong> {page.total === 1 ? 'Eintrag' : 'Einträge'}
                    {filters.month ? ` · ${monthLabel(filters.month)}` : ' · alle Monate'}</p>
                </div>
                <div className="cs-doc-actions">
                  <button type="button" className="cs-doc-btn" onClick={reset}>Filter zurücksetzen</button>
                  <button type="button" className="cs-doc-btn" aria-pressed={compact} onClick={() => setCompact(value => !value)}>Kompakte Ansicht</button>
                </div>
              </div>

              {loading ? (
                <div role="status" className="cs-doc-loading">Dokumentationen werden geladen …</div>
              ) : !error && page.items.length === 0 ? (
                <div className="cs-doc-empty">
                  <h3>Keine Einträge für diese Auswahl</h3>
                  <p>Ändern Sie den Zeitraum oder die Filter, oder erfassen Sie einen neuen Eintrag.</p>
                  <button type="button" className="cs-doc-btn primary" onClick={() => void start()}>Dokumentation erfassen</button>
                </div>
              ) : (
                <div className={`cs-doc-list${compact ? ' compact' : ''}`}>
                  {page.items.map(entry => {
                    const category = DOCUMENTATION_CATEGORIES.find(item => item.value === entry.category)!;
                    const person = entry.client_name || entry.employee_name || 'Verwaltung';
                    const date = documentationDateParts(entry.occurred_at);
                    const dateLabel = date ? documentationDateTime(entry.occurred_at) : 'Datum offen';
                    return (
                      <button type="button" className={`cs-doc-card cs-doc-category-${category.value}`}
                        key={`${entry.source}:${entry.id}`} aria-haspopup="dialog" aria-label={`Dokumentation öffnen: ${entry.title}, ${person}, ${dateLabel}`}
                        aria-expanded={selected?.id === entry.id && selected.source === entry.source} onClick={() => void open(entry)}>
                        <span className="cs-doc-card-main">
                          <span className="cs-doc-date" aria-hidden="true">
                            {date ? <>
                              <span>{date.weekday}</span>
                              <strong>{date.day}</strong>
                              <span>{date.month} {date.year}</span>
                              <span className="cs-doc-date-time">{date.time}</span>
                            </> : <span>Datum offen</span>}
                          </span>
                          <span className="cs-doc-card-copy">
                            <span className="cs-doc-card-top">
                              <span className="cs-doc-badge"><span className="cs-doc-dot" aria-hidden="true" />{category.label}</span>
                              {entry.priority !== 'normal' && (
                                <span className={`cs-doc-priority ${entry.priority}`}>{entry.priority === 'urgent' ? 'Dringend' : 'Wichtig'}</span>
                              )}
                            </span>
                            <strong className="cs-doc-card-title">{entry.title}</strong>
                            <span className="cs-doc-preview">{entry.body}</span>
                          </span>
                        </span>
                        <span className="cs-doc-card-bottom">
                          <span className="cs-doc-card-meta">
                            <strong>{person}</strong><span>{entry.author_name}</span>
                            <span>{entry.source === 'visit' ? 'Aus Einsatz übernommen' : 'Freier Eintrag'}</span>
                          </span>
                          <span className="cs-doc-read-label">Groß lesen ↗</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {!loading && page.total > 50 && (
                <nav className="cs-doc-pagination" aria-label="Seiten">
                  <button type="button" className="cs-doc-btn" disabled={!filters.offset} onClick={() => setFilters(f => ({ ...f, offset: Math.max(0, f.offset - 50) }))}>Zurück</button>
                  <span>{filters.offset + 1}–{Math.min(filters.offset + 50, page.total)} von {page.total}</span>
                  <button type="button" className="cs-doc-btn" disabled={filters.offset + 50 >= page.total} onClick={() => setFilters(f => ({ ...f, offset: f.offset + 50 }))}>Weiter</button>
                </nav>
              )}
            </section>
          </div>

          {selected && <DocumentationReader actor={actor} entry={selected} onClose={() => void close()} onAdd={() => void start(selected)} />}
        </div>
      </main>
    </div>
  );
}
