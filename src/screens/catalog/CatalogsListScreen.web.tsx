import { useId, useMemo, useState } from 'react';
import { useFlowRouter } from '@/hooks/useFlowRouter';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { TenantServiceCatalogModal } from '@/components/tenant/TenantServiceCatalogModal.web';
import { CatalogIcon, CatalogNotice, CatalogRefresh, CatalogState, CatalogStats, CatalogStatus, CatalogViewToggle, CatalogWorkspace, useCatalogWorkspaceData } from '@/components/catalog/CatalogWorkspace.web';
import { formatCatalogDate, type CatalogWorkspaceCatalog } from '@/lib/catalog/catalogWorkspace.web';
import type { TenantModuleKey } from '@/types/tenant/tenantCenter';

export function CatalogsListScreen() {
  const data = useCatalogWorkspaceData();
  return <ScreenShell title="Kataloge" scroll={false} contentOwnsHeader><CatalogsList key={data.scope} data={data}/></ScreenShell>;
}

function CatalogsList({ data }: { data: ReturnType<typeof useCatalogWorkspaceData> }) {
  const router = useFlowRouter();
  const headingId = useId();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [editor, setEditor] = useState<{ moduleKey: TenantModuleKey; create: boolean; templates: boolean } | null>(null);
  const [saved, setSaved] = useState(false);
  const catalogs = data.snapshot?.catalogs ?? [];
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('de-DE');
    return catalogs.filter(catalog => (!term || `${catalog.name} ${catalog.description} ${catalog.items.map(item => `${item.label} ${item.code}`).join(' ')}`.toLocaleLowerCase('de-DE').includes(term)) &&
      (filter === 'all' || (filter === 'active' && catalog.activeCount > 0) || (filter === 'inactive' && catalog.activeCount === 0) || (filter === 'missing' && catalog.missingPriceCount > 0)))
      .sort((a, b) => sort === 'updated' ? (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.name.localeCompare(b.name, 'de') : a.name.localeCompare(b.name, 'de'));
  }, [catalogs, query, filter, sort]);
  const positions = catalogs.reduce((sum, item) => sum + item.itemCount, 0);
  const active = catalogs.reduce((sum, item) => sum + item.activeCount, 0);
  const missing = catalogs.reduce((sum, item) => sum + item.missingPriceCount, 0);
  const open = (catalog: CatalogWorkspaceCatalog) => router.push({ pathname: '/office/catalogs/[id]', params: { id: catalog.id } });
  const create = (templates = false) => { const first = catalogs[0]; if (first) { setSaved(false); setEditor({ moduleKey: first.moduleKey, create: !templates, templates }); } };
  const reset = () => { setQuery(''); setFilter('all'); };
  const actions = <>
    {data.allowed ? <CatalogRefresh loading={data.loading} onRefresh={() => void data.refresh()}/> : null}
    {data.canEdit && catalogs.length > 0 ? <><button className="cw-button" type="button" onClick={() => create(true)}><CatalogIcon kind="book"/>Standardvorlagen</button><button className="cw-button cw-button--primary" type="button" onClick={() => create()}><CatalogIcon kind="plus"/>Neue Position</button></> : null}
  </>;

  return <>
    <CatalogWorkspace title="Kataloge" subtitle="Leistungen, Fahrtkosten und Zuschläge übersichtlich verwalten." actions={actions} busy={data.loading}>
      {!data.allowed ? <CatalogState kind="locked" title="Kataloge nicht verfügbar" message="Für diesen Bereich benötigen Sie eine Office-Freigabe und die Berechtigung, Kataloge anzusehen."/> :
        data.loading && !data.snapshot ? <CatalogState kind="loading" title="Kataloge werden geladen" message="Leistungen und die aktuell gültigen Preise werden abgerufen."/> :
        data.error && !data.snapshot ? <CatalogState kind="error" title="Kataloge konnten nicht geladen werden" message={data.error} action={<button className="cw-button" type="button" onClick={() => void data.refresh()}>Erneut versuchen</button>}/> :
        data.snapshot ? <>
          {data.error ? <CatalogNotice error>Der letzte geladene Stand bleibt sichtbar. Die Aktualisierung ist fehlgeschlagen: {data.error}</CatalogNotice> : null}
          {saved ? <CatalogNotice>Die Position wurde gespeichert.{data.loading ? ' Der Katalog wird aktualisiert.' : ''}</CatalogNotice> : null}
          <CatalogStats items={[
            { label: 'Kataloge', value: catalogs.length, detail: 'Verfügbare Leistungsbereiche', icon: 'book' },
            { label: 'Positionen', value: positions, detail: 'Leistungen, Fahrten & Zuschläge', icon: 'layers' },
            { label: 'Aktiv', value: active, detail: 'Aktive Katalogpositionen', icon: 'check', tone: 'teal' },
            { label: 'Preis offen', value: missing, detail: 'Aktiv, ohne gültigen Preis', icon: 'alert', tone: missing ? 'amber' : 'slate' },
          ]}/>
          {catalogs.length > 0 && positions === 0 ? <CatalogState title="Die ersten Positionen ergänzen" message={data.canEdit ? 'Standardvorlage auswählen oder eigene Position anlegen. Bezeichnung, Einheit und Preis können Sie vor dem Speichern anpassen.' : 'In Ihren Katalogen wurden noch keine Positionen hinterlegt.'} action={data.canEdit ? <><button className="cw-button cw-button--primary" type="button" onClick={() => create(true)}><CatalogIcon kind="book"/>Standardvorlage auswählen</button><button className="cw-button" type="button" onClick={() => create()}><CatalogIcon kind="plus"/>Eigene Position anlegen</button></> : undefined}/> : null}
          <section className="cw-panel" aria-labelledby={headingId}>
            <div className="cw-panel-heading"><div><h2 id={headingId}>Ihre Leistungskataloge</h2><p>Katalog öffnen, Positionen prüfen und Preise bearbeiten.</p></div><CatalogViewToggle value={view} onChange={setView}/></div>
            <div className="cw-toolbar">
              <label className="cw-search"><CatalogIcon kind="search"/><input type="search" aria-label="Kataloge durchsuchen" value={query} onChange={event => setQuery(event.target.value)} placeholder="Katalog oder Leistung suchen…"/></label>
              <label className="cw-field"><span>Status</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Alle Kataloge</option><option value="active">Mit aktiven Positionen</option><option value="inactive">Ohne aktive Positionen</option><option value="missing">Mit offenen Preisen</option></select></label>
              <label className="cw-field"><span>Sortierung</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="name">Name A–Z</option><option value="updated">Zuletzt geändert</option></select></label>
            </div>
            <div className="cw-list-meta"><span role="status">{filtered.length} von {catalogs.length} {catalogs.length === 1 ? 'Katalog' : 'Katalogen'}</span>{query || filter !== 'all' ? <button className="cw-text-button" type="button" onClick={reset}>Filter zurücksetzen</button> : <span>{data.canEdit ? 'Bearbeitung freigegeben' : 'Lesezugriff'}</span>}</div>
            {catalogs.length === 0 ? <CatalogState title="Noch kein Katalog verfügbar" message="Sobald ein Leistungsbereich für Ihr Unternehmen freigegeben ist, finden Sie dessen Katalog hier."/> : filtered.length === 0 ? <CatalogState title="Keine passenden Kataloge" message="Passen Sie die Suche oder den Statusfilter an." action={<button className="cw-button" type="button" onClick={reset}>Alle Kataloge anzeigen</button>}/> : view === 'cards' ?
              <div className="cw-cards">{filtered.map(catalog => <article className="cw-catalog-card" key={catalog.id}>
                <div className="cw-card-top"><span className="cw-card-symbol"><CatalogIcon/></span><CatalogStatus active={catalog.activeCount > 0}/></div>
                <div className="cw-card-title"><h3>{catalog.name}</h3><p>{catalog.description}</p></div>
                <div className="cw-card-numbers"><span><strong>{catalog.itemCount}</strong>Positionen</span><span><strong>{catalog.activeCount}</strong>Aktiv</span><span><strong>{catalog.missingPriceCount}</strong>Preis offen</span></div>
                <div className="cw-card-footer"><span className="cw-card-date">{catalog.updatedAt ? `Geändert ${formatCatalogDate(catalog.updatedAt)}` : 'Noch keine Positionen'}</span><div className="cw-actions">{data.canEdit ? <button className="cw-button cw-button--small" type="button" aria-label={`${catalog.name} bearbeiten`} onClick={() => { setSaved(false); setEditor({ moduleKey: catalog.moduleKey, create: false, templates: false }); }}><CatalogIcon kind="edit"/>Bearbeiten</button> : null}<button className="cw-button cw-button--primary cw-button--small" type="button" aria-label={`${catalog.name} öffnen`} onClick={() => open(catalog)}>Öffnen<CatalogIcon kind="arrow"/></button></div></div>
              </article>)}</div> : <div className="cw-table-wrap"><table className="cw-table cw-table--catalogs"><colgroup><col style={{ width: '36%' }}/><col style={{ width: '14%' }}/><col style={{ width: '14%' }}/><col style={{ width: '13%' }}/><col style={{ width: '23%' }}/></colgroup><thead><tr><th scope="col">Katalog</th><th scope="col">Positionen</th><th scope="col">Preis offen</th><th scope="col">Status</th><th scope="col">Aktionen</th></tr></thead><tbody>{filtered.map(catalog => <tr key={catalog.id}>
                <td className="cw-main-cell"><strong>{catalog.name}</strong><small>{catalog.description}</small>{catalog.updatedAt ? <small>Geändert {formatCatalogDate(catalog.updatedAt)}</small> : null}</td>
                <td data-label="Positionen"><strong>{catalog.itemCount}</strong><span className="cw-cell-sub">{catalog.activeCount} aktiv</span></td><td data-label="Preis offen"><span className={catalog.missingPriceCount ? 'cw-badge cw-badge--warning' : undefined}>{catalog.missingPriceCount}</span></td><td data-label="Status"><CatalogStatus active={catalog.activeCount > 0}/></td><td><div className="cw-cell-actions">{data.canEdit ? <button className="cw-button cw-button--small" type="button" aria-label={`${catalog.name} bearbeiten`} onClick={() => { setSaved(false); setEditor({ moduleKey: catalog.moduleKey, create: false, templates: false }); }}><CatalogIcon kind="edit"/>Bearbeiten</button> : null}<button className="cw-button cw-button--primary cw-button--small" type="button" aria-label={`${catalog.name} öffnen`} onClick={() => open(catalog)}>Öffnen<CatalogIcon kind="arrow"/></button></div></td>
              </tr>)}</tbody></table></div>}
          </section>
          <p className="cw-footnote">Der Katalog bündelt Ihre abrechenbaren Leistungen und deren Standardpreise. Individuelle Vereinbarungen bleiben beim jeweiligen Klienten hinterlegt. Beträge und Prozentsätze werden passend zur Einheit angezeigt.</p>
        </> : null}
    </CatalogWorkspace>
    {editor && data.canEdit && data.tenantId ? <TenantServiceCatalogModal key={`${data.scope}:${editor.moduleKey}:${editor.create}:${editor.templates}`} visible tenantId={data.tenantId} effectivePermissions={data.permissions} initialModuleKey={editor.moduleKey} startCreating={editor.create} startWithTemplates={editor.templates} onClose={() => setEditor(null)} onSaved={() => { setSaved(true); void data.refresh(); }}/> : null}
  </>;
}
