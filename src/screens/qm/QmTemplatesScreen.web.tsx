import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { CatalogIcon } from '@/components/catalog/CatalogWorkspace.web';
import { QmSectionShell } from '@/components/qm/QmSectionShell.web';
import { QmDocumentState } from '@/components/qm/QmDocumentUi.web';
import { qmDocumentWorkspaceCss } from '@/components/qm/qmDocumentWorkspaceCss.web';
import { DesktopCatalogArtwork } from '@/liquid-command/components/DesktopCatalogArtwork.web';
import { usePermissions } from '@/hooks/usePermissions';
import { CENTRAL_CATALOG_INDEX } from '@/data/seeds/documentCatalog/centralCatalogIndex';
import { documentCatalogRoute } from '@/lib/documents/documentRecommendations';
import { qmMatchesSearch } from '@/lib/qm/qmDocumentWorkspace.web';
import type { CentralDocumentDefinition } from '@/types/documents/centralCatalog';

const templates = CENTRAL_CATALOG_INDEX.filter(item => item.categoryKey === 'qm' || item.categoryKey === 'hygiene');

/** This catalogue reuses the existing central definitions and editor, never the legacy demo-only QM template endpoint. */
export function QmTemplatesScreen() {
  const router = useRouter();
  const { can, check } = usePermissions();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('qm');
  const [selectedKey, setSelectedKey] = useState('');
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState<{ key: string; data: CentralDocumentDefinition | null; error: string | null } | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const canView = can('qm.view');
  const canCatalog = can('office.documents.view');
  const canPreview = canView && canCatalog && can('documents.preview');
  const canCreate = canView && canCatalog && can('documents.create');
  const visible = useMemo(() => templates.filter(item => (!category || item.categoryKey === category)
    && qmMatchesSearch(`${item.title} ${item.categoryName}`, search)), [category, search]);
  const selected = templates.find(item => item.key === selectedKey);
  const currentPreview = preview?.key === selectedKey ? preview : null;

  useEffect(() => {
    if (!selectedKey || !canPreview) return;
    let current = true;
    setPreview(null);
    void import('@/data/seeds/documentCatalog/centralCatalog').then(module => {
      if (!current) return;
      const data = module.findCentralDocument(selectedKey);
      setPreview({ key: selectedKey, data: data ?? null, error: data ? null : 'Die ausgewählte Vorlage ist nicht mehr im Katalog enthalten.' });
    }).catch(() => {
      if (current) setPreview({ key: selectedKey, data: null, error: 'Die Vorlagenvorschau konnte nicht geladen werden. Bitte erneut versuchen.' });
    });
    return () => { current = false; };
  }, [selectedKey, revision, canPreview]);

  useEffect(() => {
    if (!selectedKey || !canPreview) return;
    previewRef.current?.focus({ preventScroll: true });
    previewRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedKey, canPreview]);

  function closePreview() {
    setSelectedKey('');
    requestAnimationFrame(() => { if (returnFocus.current?.isConnected) returnFocus.current.focus(); });
  }
  function openEditor(key?: string) {
    if (!canView || !canCatalog || (key && !canCreate)) return;
    router.push(documentCatalogRoute({ module: 'office', workflow: 'quality', templateKey: key }) as never);
  }

  return <QmSectionShell title="QM-Vorlagen" subtitle="Vorhandene Vorlagen für Qualität, Betriebsorganisation und Hygiene ansehen und im Dokumentenkatalog bearbeiten." actions={canView && canCatalog ? <button className="qm-button" type="button" onClick={() => openEditor()}>Dokumentenkatalog öffnen <CatalogIcon kind="arrow"/></button> : undefined}>
    <style>{qmDocumentWorkspaceCss}</style>
    {!canView ? <QmDocumentState title="Zugriff nicht freigegeben" message={check('qm.view').reason ?? 'Für QM-Vorlagen fehlt die Berechtigung.'}/> : <>
      <section className="qm-panel"><div className="qm-panel-head"><div><span className="qm-eyebrow">Zentraler Vorlagenbestand</span><h2>{templates.length} Vorlagen für QM und Hygiene</h2><p>Eine gemeinsame Quelle. Ausgewählte Vorlagen öffnen sich direkt im bestehenden Dokumenteneditor.</p></div><DesktopCatalogArtwork route="/business/office/document-catalog" label="Dokumentenkatalog" size={76}/></div><div className="qmd-toolbar"><label className="qmd-field qmd-field--search">Vorlagen suchen<input className="qmd-input" type="search" placeholder="Zum Beispiel Audit, Beschwerde oder Hygieneplan" value={search} onChange={event => setSearch(event.target.value)}/></label><div className="qmd-tabs" role="group" aria-label="Vorlagenbereich">{[['qm', 'Qualitätsmanagement'], ['hygiene', 'Hygiene'], ['', 'Alle']].map(([key, label]) => <button key={key} className="qm-button" type="button" aria-pressed={category === key} onClick={() => setCategory(key)}>{label}</button>)}</div></div><div className="qmd-result"><span role="status">{visible.length} passende Vorlagen</span>{search ? <button className="qm-button" type="button" onClick={() => setSearch('')}>Suche zurücksetzen</button> : null}</div></section>
      {!canCatalog ? <div className="qm-notice" data-tone="warning"><strong>Dokumentenkatalog nicht freigegeben</strong><p>Zum Öffnen und Bearbeiten benötigen Sie Zugriff auf Office-Dokumente.</p></div> : !canPreview || !canCreate ? <div className="qm-notice" data-tone="warning"><strong>Eingeschränkte Dokumentenrechte</strong><p>{!canPreview ? 'Die Vorschau ist für Ihr Konto nicht freigegeben. ' : ''}{!canCreate ? 'Neue Dokumententwürfe können mit Ihren aktuellen Rechten nicht erstellt werden.' : ''}</p></div> : null}
      {selected && canPreview ? <section className="qm-panel qmd-preview" aria-label={`Vorschau: ${selected.title}`} ref={previewRef} tabIndex={-1} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closePreview(); } }}><header className="qm-panel-head"><div><span className="qm-eyebrow">Vorlagenvorschau</span><h2>{selected.title}</h2></div><button className="qm-button" type="button" aria-label="Vorlagenvorschau schließen" onClick={closePreview}>Schließen <span aria-hidden="true">×</span></button></header>
        {!currentPreview ? <QmDocumentState title="Vorschau wird geladen" message="Der bestehende Vorlagentext wird geöffnet …"/> : currentPreview.error ? <QmDocumentState title="Vorschau nicht verfügbar" message={currentPreview.error} error><button className="qm-button" type="button" onClick={() => setRevision(value => value + 1)}>Erneut laden</button></QmDocumentState> : currentPreview.data ? <div className="qmd-paper"><div className="qm-notice" data-tone="warning"><strong>Vorlage zur individuellen Bearbeitung</strong><p>Diese Vorschau enthält keine ausgefüllten Unternehmensdaten und ist kein freigegebenes QM-Dokument. {currentPreview.data.instructions}</p></div>{currentPreview.data.sections.map(section => <section key={section.key}><h3>{section.heading}</h3><p>{section.text}</p></section>)}<h3>Angaben im Dokument</h3><ul>{currentPreview.data.fields.map(field => <li key={field.key}>{field.label}{field.required ? ' · Pflichtangabe' : ''}</li>)}</ul></div> : null}
        <div className="qm-panel-footer"><button className="qm-button qm-button--primary" type="button" disabled={!canCreate} onClick={() => openEditor(selected.key)}>{selected.sourceMode === 'original' ? 'Originalunterlage im Katalog zuordnen' : 'Im Dokumentenkatalog bearbeiten'} <CatalogIcon kind="arrow"/></button></div>
      </section> : null}
      {visible.length ? <div className="qmd-grid">{visible.map(item => <article className="qmd-template" key={item.key}><div className="qmd-template-mark"><span className="qmd-mark" aria-hidden="true"><CatalogIcon kind={item.categoryKey === 'hygiene' ? 'check' : 'book'}/></span><span>{item.categoryKey === 'hygiene' ? 'Hygiene' : 'Qualitätsmanagement'}</span></div><h2>{item.title}</h2><p>{item.sourceMode === 'original' ? 'Vorhandene Originalunterlage mit Begleitblatt zuordnen.' : 'Mit eigenen Angaben ergänzen und als Dokumententwurf weiterbearbeiten.'}</p><div className="qm-actions"><button className="qm-button" type="button" disabled={!canPreview} onClick={event => { returnFocus.current = event.currentTarget; setSelectedKey(item.key); }}>Vorschau</button><button className="qm-button qm-button--primary" type="button" disabled={!canCreate} onClick={() => openEditor(item.key)}>{item.sourceMode === 'original' ? 'Zuordnen' : 'Bearbeiten'} <CatalogIcon kind="arrow"/></button></div></article>)}</div> : <QmDocumentState title="Keine passende Vorlage" message="Ändern Sie den Suchbegriff oder wählen Sie einen anderen Vorlagenbereich."/>}
    </>}
  </QmSectionShell>;
}
