import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import { DOCUMENTATION_AREAS, DOCUMENTATION_CATEGORIES, berlinMonth, documentationDateTime, documentationDraft, newDocumentationId, shiftDocumentationMonth, validateDocumentation } from '@/lib/office/documentation/model';
import type { DocumentationActor, DocumentationDraft, DocumentationEntry, DocumentationFilters, DocumentationPage } from '@/lib/office/documentation/model';
import { createDocumentation, listDocumentation } from '@/lib/office/documentation/service';
import { documentationCss } from './documentationCss.web';

const initialFilters = (): DocumentationFilters => ({ month: berlinMonth(), area: '', clientId: '', employeeId: '', category: '', source: '', priority: '', query: '', offset: 0 });
const emptyPage: DocumentationPage = { items: [], total: 0, months: [], clients: [], employees: [] };
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

export function DocumentationWorkspace({ actor }: { actor: DocumentationActor }) {
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
    const request = ++requestNumber.current; setLoading(true); setError('');
    const result = await listDocumentation(actor, filters);
    if (!alive.current || request !== requestNumber.current) return;
    if (result.ok) {
      setPage(result.data);
      setSelected(current => current ? result.data.items.find(e => e.id === current.id && e.source === current.source) ?? null : null);
    } else { setPage(emptyPage); setSelected(null); setError(result.error); }
    setLoading(false);
  }, [actor.tenantId, actor.userId, filters]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; requestNumber.current++; }; }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const id = setTimeout(() => setFilters(f => f.query === search.trim() ? f : { ...f, query: search.trim(), offset: 0 }), 280); return () => clearTimeout(id); }, [search]);
  const filter = (patch: Partial<DocumentationFilters>) => { setSelected(null); setFilters(f => ({ ...f, ...patch, offset: 0 })); };
  const months = useMemo(() => [...new Set([berlinMonth(), filters.month, ...page.months].filter(Boolean))].sort().reverse(), [page.months, filters.month]);
  const start = async (entry?: DocumentationEntry) => {
    if (locked.current || !(await confirmLeave()) || !alive.current) return;
    setDraft(documentationDraft(entry ? { area: entry.area, clientId: entry.client_id ?? '', employeeId: entry.employee_id ?? '', category: entry.category,
      title: `Ergänzung: ${entry.title}`.slice(0, 180), body: `Bezug: ${entry.title}, ${documentationDateTime(entry.occurred_at)}\n\n` }
      : { area: (filters.area || (filters.clientId ? 'client' : filters.employeeId ? 'employee' : 'administration')) as DocumentationDraft['area'], clientId: filters.clientId, employeeId: filters.employeeId }));
    setDraftId(newDocumentationId()); setSelected(null); setSaveError(''); setUncertain(false); setNotice('');
  };
  const close = async () => { if (locked.current || !(await confirmLeave()) || !alive.current) return; setDraft(null); setSelected(null); setSaveError(''); setUncertain(false); };
  const open = async (entry: DocumentationEntry) => { if (locked.current || !(await confirmLeave()) || !alive.current) return; setDraft(null); setSelected(entry); setSaveError(''); setUncertain(false); };
  const save = async () => {
    if (!draft || locked.current) return;
    const invalid = validateDocumentation(draft); if (invalid) { setSaveError(invalid); return; }
    locked.current = true; setBusy(true); setSaveError('');
    try {
      const result = await createDocumentation(actor, draftId, draft);
      if (!alive.current) return;
      if (result.ok) {
        setDraft(null); setUncertain(false); setSearch(''); setSelected(null);
        setFilters({ ...initialFilters(), month: berlinMonth(new Date(draft.occurredAt)) });
        setNotice('Dokumentation gespeichert. Der Eintrag ist für das gesamte Team verfügbar.');
      } else { setSaveError(result.error); setUncertain(Boolean(result.uncertain)); }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  const changeDraft = (patch: Partial<DocumentationDraft>) => { if (!busy && !uncertain) setDraft(d => d ? { ...d, ...patch } : d); };
  const reset = () => { setSearch(''); setSelected(null); setFilters({ ...initialFilters(), month: '' }); };
  const hasPanel = Boolean(draft || selected);
  return <main className="cs-doc" aria-label="Gemeinsame Dokumentation">
    <style>{documentationCss}</style>
    <header className="cs-doc-head"><div><p className="cs-doc-eyebrow">Office · Gemeinsamer Verlauf</p><h1>Dokumentation</h1>
      <p className="cs-doc-intro">Was passiert ist. Was das Team wissen muss. Für Klienten, Mitarbeitende und die Verwaltung, auch ohne Einsatz.</p></div>
      <div className="cs-doc-actions"><button type="button" className="cs-doc-btn" disabled={loading} onClick={() => void refresh()}>Aktualisieren</button>
        <button type="button" className="cs-doc-btn primary" disabled={busy} onClick={() => void start()}><span aria-hidden="true">＋</span> Neuer Eintrag</button></div></header>
    {notice && <div role="status" className="cs-doc-notice">{notice}</div>}
    <div className="cs-doc-toolbar"><div className="cs-doc-tabs" aria-label="Bereich">
      {[{ value: '', label: 'Alle' }, ...DOCUMENTATION_AREAS].map(a => <button key={a.value} type="button" aria-pressed={filters.area === a.value} onClick={() => filter({ area: a.value })}>{a.label}</button>)}</div>
      <div className="cs-doc-month"><button type="button" className="cs-doc-btn icon" aria-label="Vorheriger Monat" onClick={() => filter({ month: shiftDocumentationMonth(filters.month, -1) })}>‹</button>
        <select aria-label="Monat" value={filters.month} onChange={e => filter({ month: e.target.value })}><option value="">Alle Monate</option>{months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
        <button type="button" className="cs-doc-btn icon" aria-label="Nächster Monat" onClick={() => filter({ month: shiftDocumentationMonth(filters.month, 1) })}>›</button></div></div>
    <button type="button" className="cs-doc-btn cs-doc-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)}>Suche & Filter{[filters.clientId, filters.employeeId, filters.category, filters.source, filters.priority, filters.query].filter(Boolean).length > 0 ? ` (${[filters.clientId, filters.employeeId, filters.category, filters.source, filters.priority, filters.query].filter(Boolean).length})` : ''}<span aria-hidden="true">{filtersOpen ? '⌃' : '⌄'}</span></button>
    <div className={`cs-doc-filter-block${filtersOpen ? ' open' : ''}`}>
    <section className="cs-doc-filters" aria-label="Dokumentationen filtern"><label>Suche<input type="search" maxLength={200} value={search} placeholder="Inhalt, Name oder Stichwort …" onChange={e => setSearch(e.target.value)} /></label>
      <label>Klient<select value={filters.clientId} onChange={e => filter({ clientId: e.target.value })}><option value="">Alle Klienten</option>{page.clients.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <label>Mitarbeitende<select value={filters.employeeId} onChange={e => filter({ employeeId: e.target.value })}><option value="">Alle Mitarbeitenden</option>{page.employees.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <label>Quelle<select value={filters.source} onChange={e => filter({ source: e.target.value })}><option value="">Alle Einträge</option><option value="manual">Freie Dokumentation</option><option value="visit">Abgeschlossene Einsätze</option></select></label>
      <label>Dringlichkeit<select value={filters.priority} onChange={e => filter({ priority: e.target.value })}><option value="">Jede Dringlichkeit</option><option value="normal">Normal</option><option value="important">Wichtig</option><option value="urgent">Dringend</option></select></label></section>
    <div className="cs-doc-categories" aria-label="Kategorien"><button type="button" className="cs-doc-chip" style={{ color: '#405d71', background: '#e5edf2' }} aria-pressed={!filters.category} onClick={() => filter({ category: '' })}>Alle Kategorien</button>
      {DOCUMENTATION_CATEGORIES.map(c => <button key={c.value} type="button" className="cs-doc-chip" style={{ color: c.color, background: c.tint }} aria-pressed={filters.category === c.value} onClick={() => filter({ category: c.value })}><span className="cs-doc-dot" />{c.label}</button>)}</div>
    </div>
    <div className="cs-doc-summary"><p aria-live="polite"><strong>{loading ? '…' : page.total}</strong> {page.total === 1 ? 'Eintrag' : 'Einträge'}{filters.month ? ` · ${monthLabel(filters.month)}` : ' · alle Monate'}</p>
      <div className="cs-doc-actions"><button type="button" className="cs-doc-btn" onClick={reset}>Filter zurücksetzen</button><button type="button" className={`cs-doc-btn${compact ? ' active' : ''}`} aria-pressed={compact} onClick={() => setCompact(c => !c)}>Kompakte Ansicht</button></div></div>
    {error && <div role="alert" className="cs-doc-error">{error} <button type="button" className="cs-doc-btn" onClick={() => void refresh()}>Erneut laden</button></div>}
    <div className={`cs-doc-layout${hasPanel ? ' has-panel' : ''}`}>
      <section aria-label="Dokumentationsverlauf" aria-busy={loading}>
        {loading ? <div role="status" aria-label="Dokumentationen werden geladen" className="cs-doc-loading"><div /><div /><div /></div>
          : !error && page.items.length === 0 ? <div className="cs-doc-empty"><h2>Hier beginnt der Überblick.</h2><p>Für diese Auswahl gibt es noch keine Einträge. Sie können jederzeit frei dokumentieren. Gespeicherte Berichte erscheinen automatisch nach Abschluss des Einsatzes.</p><button type="button" className="cs-doc-btn primary" onClick={() => void start()}>Dokumentation erfassen</button></div>
          : <div className={`cs-doc-list${compact ? ' compact' : ''}`}>{page.items.map(entry => {
            const c = DOCUMENTATION_CATEGORIES.find(c => c.value === entry.category)!;
            return <button type="button" className="cs-doc-card" key={`${entry.source}:${entry.id}`} style={{ '--category': c.color } as React.CSSProperties} aria-pressed={selected?.id === entry.id && selected.source === entry.source} onClick={() => void open(entry)}>
              <div className="cs-doc-card-top"><span className="cs-doc-badge" style={{ color: c.color, background: c.tint }}><span className="cs-doc-dot" />{c.label}</span>
                <span className="cs-doc-subtle">{documentationDateTime(entry.occurred_at)}</span></div>
              <h3>{entry.title}</h3><p className="cs-doc-preview">{entry.body}</p><div className="cs-doc-card-bottom">
                <strong>{entry.client_name || entry.employee_name || 'Verwaltung'}</strong><span>{entry.author_name}</span><span>{entry.source === 'visit' ? '↳ Aus Einsatz übernommen' : 'Freier Eintrag'}</span>
                {entry.priority !== 'normal' && <span className="cs-doc-badge cs-doc-priority">{entry.priority === 'urgent' ? 'Dringend' : 'Wichtig'}</span>}</div></button>;
          })}</div>}
        {!loading && page.total > 50 && <nav className="cs-doc-pagination" aria-label="Seiten"><button type="button" className="cs-doc-btn" disabled={!filters.offset} onClick={() => setFilters(f => ({ ...f, offset: Math.max(0, f.offset - 50) }))}>Zurück</button>
          <span>{filters.offset + 1}–{Math.min(filters.offset + 50, page.total)} von {page.total}</span><button type="button" className="cs-doc-btn" disabled={filters.offset + 50 >= page.total} onClick={() => setFilters(f => ({ ...f, offset: f.offset + 50 }))}>Weiter</button></nav>}
      </section>
      {draft && <aside className="cs-doc-panel" aria-label="Neuen Eintrag erfassen"><div className="cs-doc-panel-head"><div><p className="cs-doc-eyebrow">Jederzeit dokumentieren</p><h2>Neuer Eintrag</h2></div><button type="button" className="cs-doc-btn icon" aria-label="Editor schließen" disabled={busy} onClick={() => void close()}>×</button></div>
        <form className="cs-doc-panel-body" onSubmit={e => { e.preventDefault(); void save(); }}>
          <p className="cs-doc-hint">Dieser Eintrag ist für das gesamte Team Ihres Unternehmens sichtbar. Vertrauliche Personalakten bleiben in der Personalverwaltung.</p>
          {saveError && <div role="alert" className="cs-doc-error">{saveError}</div>}
          <fieldset disabled={busy || uncertain} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}><div className="cs-doc-form-grid">
            <label>Bereich<select value={draft.area} onChange={e => changeDraft({ area: e.target.value as DocumentationDraft['area'] })}>{DOCUMENTATION_AREAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}</select></label>
            <label>Kategorie<select value={draft.category} onChange={e => changeDraft({ category: e.target.value as DocumentationDraft['category'] })}>{DOCUMENTATION_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
            <label>Klient{draft.area === 'client' ? ' *' : ' (optional)'}<select value={draft.clientId} required={draft.area === 'client'} onChange={e => changeDraft({ clientId: e.target.value })}><option value="">Bitte auswählen</option>{page.clients.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
            <label>Mitarbeitende{draft.area === 'employee' ? ' *' : ' (optional)'}<select value={draft.employeeId} required={draft.area === 'employee'} onChange={e => changeDraft({ employeeId: e.target.value })}><option value="">Bitte auswählen</option>{page.employees.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
            <label>Zeitpunkt (Berlin)<input type="datetime-local" required value={dateInput(draft.occurredAt)} onChange={e => changeDraft({ occurredAt: berlinInputToIso(e.target.value) })} /></label>
            <label>Dringlichkeit<select value={draft.priority} onChange={e => changeDraft({ priority: e.target.value as DocumentationDraft['priority'] })}><option value="normal">Normal</option><option value="important">Wichtig</option><option value="urgent">Dringend</option></select></label>
            <label className="cs-doc-full">Titel *<input required autoFocus maxLength={180} value={draft.title} placeholder="Was möchten Sie festhalten?" onChange={e => changeDraft({ title: e.target.value })} /></label>
            <label className="cs-doc-full">Dokumentation *<textarea required maxLength={20000} value={draft.body} placeholder="Beobachtungen, Gespräche, Absprachen oder wichtige Veränderungen …" onChange={e => changeDraft({ body: e.target.value })} /></label>
          </div></fieldset>
          <p className="cs-doc-hint">Verfasser und Erfassungszeit werden automatisch gespeichert. Gespeicherte Inhalte bleiben erhalten; Korrekturen werden als Ergänzung dokumentiert.</p>
          <div className="cs-doc-actions"><button type="submit" className="cs-doc-btn primary" disabled={busy}>{busy ? 'Wird gespeichert …' : uncertain ? 'Speicherbestätigung prüfen' : 'Eintrag speichern'}</button><button type="button" className="cs-doc-btn" disabled={busy} onClick={() => void close()}>Abbrechen</button></div>
        </form></aside>}
      {selected && <aside className="cs-doc-panel" aria-label="Dokumentation im Detail"><div className="cs-doc-panel-head"><div><p className="cs-doc-eyebrow">{selected.source === 'visit' ? 'Aus abgeschlossenem Einsatz' : 'Freie Dokumentation'}</p><h2>{selected.title}</h2></div><button type="button" className="cs-doc-btn icon" aria-label="Details schließen" onClick={() => void close()}>×</button></div>
        <div className="cs-doc-panel-body"><dl className="cs-doc-meta"><div><dt>Zeitpunkt</dt><dd>{documentationDateTime(selected.occurred_at)}</dd></div><div><dt>Verfasst von</dt><dd>{selected.author_name}</dd></div>
          <div><dt>Klient</dt><dd>{selected.client_name || 'Keine Zuordnung'}</dd></div><div><dt>Mitarbeitende</dt><dd>{selected.employee_name || 'Keine Zuordnung'}</dd></div>
          <div><dt>Kategorie</dt><dd>{DOCUMENTATION_CATEGORIES.find(c => c.value === selected.category)?.label}</dd></div><div><dt>Erfasst am</dt><dd>{documentationDateTime(selected.created_at)}</dd></div></dl>
          <div className="cs-doc-copy">{selected.body}</div><p className="cs-doc-hint">{selected.source === 'visit' ? 'Dieser Bericht stammt aus dem Einsatz. Das Original bleibt dort gespeichert. Ergänzungen können Sie hier als neuen Eintrag festhalten.' : 'Der gespeicherte Eintrag bleibt erhalten. Ergänzen Sie neue Informationen oder Korrekturen mit einem weiteren Eintrag.'}</p>
          <button type="button" className="cs-doc-btn primary" onClick={() => void start(selected)}>Ergänzung erfassen</button></div></aside>}
    </div>
    <p className="cs-doc-hint" style={{ marginTop: 22 }}>Gemeinsam im Team · Abgeschlossene Einsätze werden automatisch eingebunden · Freie Einträge sind unabhängig vom Einsatzplan</p>
  </main>;
}
