import { useEffect, useMemo, useRef, useState } from 'react';
import { ACADEMY_AUDIENCE_LABELS, type AcademyAudience, type AcademyCommandHandler, type AcademyContent, type AcademyReusableTemplate } from '@/lib/akademie/workspaceModel';
import { ACADEMY_TEMPLATES, createAcademyTemplate } from '@/lib/akademie/workspaceTemplates';

export type AcademyTemplateLibraryProps = {
  templates: AcademyReusableTemplate[];
  busy: boolean;
  onCommand: AcademyCommandHandler;
  onUseContent: (content: AcademyContent) => void;
  onEditTemplate: (template: AcademyReusableTemplate) => void;
  onCreateBlank: () => void;
  onCreateTemplate: () => void;
};
type CatalogItem = { key: string; title: string; description: string; category: string; content: AcademyContent; own: AcademyReusableTemplate | null };
const normalize = (value: string) => value.toLocaleLowerCase('de-DE').trim();
const lessonLabels = { text: 'Lesetext', video: 'Video', document: 'Dokument', quiz: 'Wissenscheck' };

export function AcademyTemplateLibrary({ templates, busy, onCommand, onUseContent, onEditTemplate, onCreateBlank, onCreateTemplate }: AcademyTemplateLibraryProps) {
  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState<AcademyAudience | 'all'>('all');
  const [category, setCategory] = useState('all');
  const [source, setSource] = useState<'all' | 'builtin' | 'own' | 'archived'>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ id: string; revision: number; action: 'archive_template' | 'restore_template' } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const confirmationRef = useRef<HTMLElement>(null);
  const builtins = useMemo<CatalogItem[]>(() => ACADEMY_TEMPLATES.filter(template => template.key !== 'blank').map(template => {
    const content = createAcademyTemplate(template.key);
    return { key: `builtin:${template.key}`, title: template.title, description: template.description, category: content.category, content, own: null };
  }), []);
  const all = [...builtins, ...templates.map((template): CatalogItem => ({ key: `own:${template.id}`, title: template.name, description: template.description,
    category: template.content.category || 'Allgemein', content: template.content, own: template }))];
  const categories = [...new Set(all.map(item => item.category))].sort((a, b) => a.localeCompare(b, 'de-DE'));
  const visible = all.filter(item => (source === 'archived' ? item.own?.status === 'archived' : item.own?.status !== 'archived')
    && (source !== 'builtin' || !item.own) && (source !== 'own' || Boolean(item.own))
    && (audience === 'all' || item.content.audiences.includes(audience)) && (category === 'all' || item.category === category)
    && normalize(`${item.title} ${item.description} ${item.category}`).includes(normalize(query)));
  const selected = visible.find(item => item.key === selectedKey) ?? null;
  const confirmedTemplate = templates.find(template => template.id === confirmation?.id) ?? null;
  const changedElsewhere = Boolean(confirmation && confirmedTemplate && confirmation.revision !== confirmedTemplate.revision);
  useEffect(() => { if (selectedKey) detailsRef.current?.focus(); }, [selectedKey]);
  useEffect(() => { if (confirmation) confirmationRef.current?.focus(); }, [confirmation]);
  const select = (key: string) => { setSelectedKey(key); setConfirmation(null); setError(null); };

  async function changeStatus() {
    if (!confirmation || !confirmedTemplate || busy || changedElsewhere) return;
    setError(null); setNotice(null);
    try {
      const result = await onCommand(confirmation.action, {}, { id: confirmation.id, revision: confirmation.revision });
      if (!result) return;
      setNotice(confirmation.action === 'archive_template' ? 'Die Vorlage wurde archiviert. Vorhandene Kurse bleiben erhalten.' : 'Die Vorlage kann wieder für neue Kurse verwendet werden.');
      setConfirmation(null); setSelectedKey(null);
    } catch { setError('Die Änderung konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.'); }
  }

  return <div className="ac-template-library" aria-label="Kursvorlagen">
    <section className="ac-panel ac-template-intro"><div className="ac-panel-header"><div><p className="ac-eyebrow">VORLAGEN & EIGENE INHALTE</p><h2 className="ac-section-title">Eine gute Grundlage für Ihren nächsten Kurs</h2><p className="ac-muted">Beginnen Sie mit einer Struktur oder Ihrer eigenen Vorlage. Jede Verwendung erzeugt einen eigenständigen Kursentwurf.</p></div><div className="ac-card-actions"><button type="button" className="ac-button primary" disabled={busy} onClick={onCreateBlank}>Eigenen Kurs erstellen</button><button type="button" className="ac-button" disabled={busy} onClick={onCreateTemplate}>Eigene Vorlage erstellen</button></div></div>
      <div className="ac-template-summary"><span><strong>{builtins.length}</strong> Strukturvorlagen</span><span><strong>{templates.filter(template => template.status === 'active').length}</strong> eigene Vorlagen</span><span>Eigene Vorlagen stehen den berechtigten Kursredakteuren Ihrer Einrichtung zur Verfügung.</span></div>
    </section>
    {notice && <div className="ac-message" data-tone="success" role="status">{notice}</div>}
    {error && <div className="ac-message" data-tone="error" role="alert">{error}</div>}
    <section className="ac-panel"><div className="ac-toolbar ac-template-filters">
      <label className="ac-field ac-search">Vorlagen suchen<input className="ac-input" type="search" value={query} disabled={busy} placeholder="Titel, Thema oder Beschreibung…" onChange={event => { setQuery(event.target.value); setSelectedKey(null); }} /></label>
      <label className="ac-field">Herkunft<select className="ac-input" value={source} disabled={busy} onChange={event => { setSource(event.target.value as typeof source); setSelectedKey(null); }}><option value="all">Alle aktiven Vorlagen</option><option value="builtin">Strukturvorlagen</option><option value="own">Eigene Vorlagen</option><option value="archived">Archivierte Vorlagen</option></select></label>
      <label className="ac-field">Vorlagen-Zielgruppe<select className="ac-input" value={audience} disabled={busy} onChange={event => { setAudience(event.target.value as typeof audience); setSelectedKey(null); }}><option value="all">Alle Zielgruppen</option>{Object.entries(ACADEMY_AUDIENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="ac-field">Themenbereich<select className="ac-input" value={category} disabled={busy} onChange={event => { setCategory(event.target.value); setSelectedKey(null); }}><option value="all">Alle Themen</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </div><p className="ac-muted" role="status">{visible.length} {visible.length === 1 ? 'passende Vorlage' : 'passende Vorlagen'}</p>
      {visible.length ? <div className="ac-template-catalog">{visible.map((item, index) => <article className="ac-template-tile" data-selected={selectedKey === item.key || undefined} key={item.key}>
        <div className="ac-template-tile-top" data-tone={index % 4}><span className="ac-eyebrow">{item.category}</span><span className="ac-status" data-tone={item.own?.status === 'archived' ? 'neutral' : item.own ? 'good' : 'neutral'}>{item.own?.status === 'archived' ? 'Archiviert' : item.own ? 'Eigene Vorlage' : 'Strukturvorlage'}</span></div>
        <div className="ac-template-tile-content"><h3>{item.title}</h3><p>{item.description || 'Eigene Kursstruktur zur Wiederverwendung.'}</p><small className="ac-muted">{item.content.lessons.length} Lektionen · {item.content.estimatedMinutes} Minuten</small><small className="ac-muted">{item.content.audiences.map(value => ACADEMY_AUDIENCE_LABELS[value]).join(' · ')}</small>
          <div className="ac-card-actions"><button type="button" className="ac-button subtle small" disabled={busy} aria-label={`Vorlage ansehen: ${item.title}`} aria-expanded={selectedKey === item.key} onClick={() => select(item.key)}>Vorlage ansehen</button>{item.own?.status !== 'archived' && <button type="button" className="ac-button small" disabled={busy} aria-label={`Als Kurs verwenden: ${item.title}`} onClick={() => onUseContent(item.content)}>Als Kurs verwenden</button>}</div>
        </div>
      </article>)}</div> : <div className="ac-empty"><h3>Keine passende Vorlage</h3><p>Ändern Sie die Filter oder erstellen Sie Ihre eigene Vorlage.</p><button type="button" className="ac-button subtle" disabled={busy} onClick={() => { setQuery(''); setAudience('all'); setCategory('all'); setSource('all'); }}>Filter zurücksetzen</button></div>}
    </section>
    {selected && <section ref={detailsRef} tabIndex={-1} className="ac-panel ac-template-detail" aria-label="Vorlagendetails"><div className="ac-panel-header"><div><p className="ac-eyebrow">{selected.own ? 'VORLAGE IHRER EINRICHTUNG' : 'BEARBEITBARE STRUKTUR'}</p><h2 className="ac-section-title">{selected.title}</h2><p>{selected.description}</p></div><button type="button" className="ac-button subtle" disabled={busy} onClick={() => { setSelectedKey(null); setConfirmation(null); }}>Vorschau schließen</button></div>
      <div className="ac-badges"><span className="ac-status">{selected.content.estimatedMinutes} Minuten</span><span className="ac-status">{selected.content.lessons.length} Lektionen</span>{selected.content.mandatory && <span className="ac-status" data-tone="attention">Verpflichtend</span>}</div>
      {selected.content.summary && <p>{selected.content.summary}</p>}
      <ol className="ac-template-outline">{selected.content.lessons.map((lesson, index) => <li key={lesson.id}><span className="ac-lesson-number">{String(index + 1).padStart(2, '0')}</span><div><strong>{lesson.title || 'Unbenannte Lektion'}</strong><span className="ac-muted">{lessonLabels[lesson.kind]}{lesson.kind === 'quiz' ? ` · ${lesson.questions?.length ?? 0} ${lesson.questions?.length === 1 ? 'Frage' : 'Fragen'}` : ''}</span>{lesson.body && <details><summary>Inhalt ansehen</summary><p className="ac-learning-body">{lesson.body}</p></details>}</div></li>)}</ol>
      {!selected.own && <p className="ac-message" data-tone="info">Diese Vorlage liefert den Aufbau. Ergänzen Sie die Inhalte und prüfen Sie diese vor der Veröffentlichung.</p>}
      <div className="ac-card-actions">{selected.own?.status !== 'archived' && <button type="button" className="ac-button primary" disabled={busy} onClick={() => onUseContent(selected.content)}>Neuen Kurs aus dieser Vorlage erstellen</button>}{selected.own && selected.own.status === 'active' && <button type="button" className="ac-button" disabled={busy} onClick={() => onEditTemplate(selected.own!)}>Vorlage bearbeiten</button>}{selected.own && <button type="button" className={`ac-button ${selected.own.status === 'archived' ? '' : 'subtle'}`} disabled={busy} onClick={() => { setConfirmation({ id: selected.own!.id, revision: selected.own!.revision, action: selected.own!.status === 'archived' ? 'restore_template' : 'archive_template' }); setError(null); }}>{selected.own.status === 'archived' ? 'Vorlage wiederherstellen' : 'Vorlage archivieren'}</button>}</div>
    </section>}
    {confirmation && <section ref={confirmationRef} tabIndex={-1} className="ac-panel" aria-label="Vorlagenstatus ändern"><h2 className="ac-section-title">{confirmation.action === 'archive_template' ? 'Vorlage archivieren?' : 'Vorlage wiederherstellen?'}</h2><p>{confirmedTemplate?.name ?? 'Diese Vorlage ist nicht mehr verfügbar.'}</p><p className="ac-muted">{confirmation.action === 'archive_template' ? 'Die Vorlage steht anschließend im Archiv. Bereits daraus erstellte Kurse bleiben erhalten.' : 'Die Vorlage steht anschließend wieder für neue Kursentwürfe zur Verfügung.'}</p>
      {changedElsewhere && <p role="alert" className="ac-message" data-tone="error">Die Vorlage wurde inzwischen geändert. Schließen Sie diese Abfrage und prüfen Sie den aktuellen Stand.</p>}
      <div className="ac-card-actions"><button type="button" className={`ac-button ${confirmation.action === 'archive_template' ? 'danger' : 'primary'}`} disabled={busy || !confirmedTemplate || changedElsewhere} onClick={() => void changeStatus()}>{confirmation.action === 'archive_template' ? 'Jetzt archivieren' : 'Jetzt wiederherstellen'}</button><button type="button" className="ac-button subtle" disabled={busy} onClick={() => setConfirmation(null)}>Abbrechen</button></div>
    </section>}
  </div>;
}
