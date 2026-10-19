import { useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter } from '@/hooks/useFlowRouter';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { TenantServiceCatalogModal } from '@/components/tenant/TenantServiceCatalogModal.web';
import { CatalogIcon, CatalogNotice, CatalogRefresh, CatalogState, CatalogStats, CatalogStatus, CatalogViewToggle, CatalogWorkspace, useCatalogWorkspaceData } from '@/components/catalog/CatalogWorkspace.web';
import { CATALOG_CATEGORY_LABELS, formatCatalogDate, formatWorkspaceCatalogPrice, type CatalogWorkspaceItem } from '@/lib/catalog/catalogWorkspace.web';
import { formatServiceTaxMode } from '@/lib/tenant/serviceCatalogLabels';

export function CatalogDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const data = useCatalogWorkspaceData();
  return <ScreenShell title="Katalog" scroll={false} contentOwnsHeader><CatalogDetail key={`${data.scope}:${id ?? ''}`} id={id} data={data}/></ScreenShell>;
}

function PriceInformation({ item }: { item: CatalogWorkspaceItem }) {
  return <>
    <strong className={`cw-price${item.priceNet == null ? ' cw-price--missing' : ''}`}>{formatWorkspaceCatalogPrice(item)}</strong>
    <span className="cw-cell-sub">{item.unitKey === 'percent' ? 'Zuschlag in Prozent' : `Netto je ${item.unit}`}</span>
    {item.priceNet != null && item.defaultTaxMode ? <span className="cw-cell-sub">{formatServiceTaxMode(item.defaultTaxMode)}</span> : null}
    {item.priceState === 'expired' ? <span className="cw-cell-sub">Preis abgelaufen{item.validUntil ? ` am ${formatCatalogDate(item.validUntil)}` : ''}</span> : null}
    {item.priceState === 'missing' ? <span className="cw-cell-sub">Noch keinen Standardpreis hinterlegt</span> : null}
    {item.priceState === 'current' && item.validUntil ? <span className="cw-cell-sub">Gültig bis {formatCatalogDate(item.validUntil)}</span> : null}
    {item.nextPriceNet != null && item.nextValidFrom ? <span className="cw-cell-sub">Ab {formatCatalogDate(item.nextValidFrom)}: {formatWorkspaceCatalogPrice({ priceNet: item.nextPriceNet, unitKey: item.unitKey })}</span> : null}
  </>;
}

function CatalogDetail({ id, data }: { id?: string; data: ReturnType<typeof useCatalogWorkspaceData> }) {
  const router = useFlowRouter();
  const catalog = data.snapshot?.catalogs.find(item => item.id === id);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState<'cards' | 'table'>('table');
  const [editor, setEditor] = useState<{ itemId?: string; create: boolean } | null>(null);
  const [saved, setSaved] = useState(false);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('de-DE');
    return (catalog?.items ?? []).filter(item => (category === 'all' || item.category === category) &&
      (status === 'all' || status === 'active' && item.isActive || status === 'inactive' && !item.isActive || status === 'missing' && item.isActive && item.priceNet == null) &&
      (!term || `${item.label} ${item.code} ${item.description} ${item.unit}`.toLocaleLowerCase('de-DE').includes(term)));
  }, [catalog, category, status, query]);
  const back = () => router.replace('/office/catalogs');
  const reset = () => { setQuery(''); setCategory('all'); setStatus('all'); };
  const edit = (itemId?: string, create = false) => { setSaved(false); setEditor({ itemId, create }); };
  const actions = <>{data.allowed ? <CatalogRefresh loading={data.loading} onRefresh={() => void data.refresh()}/> : null}{catalog && data.canEdit ? <button type="button" className="cw-button cw-button--primary" onClick={() => edit(undefined, true)}><CatalogIcon kind="plus"/>Neue Position</button> : null}</>;
  return <>
    <CatalogWorkspace title={catalog?.name ?? 'Katalog'} subtitle="Leistungen und Standardpreise im Detail." actions={actions} back={back} busy={data.loading}>
      {!data.allowed ? <CatalogState kind="locked" title="Kein Zugriff auf diesen Katalog" message="Für diesen Bereich benötigen Sie eine Office-Freigabe und die Berechtigung, Kataloge anzusehen."/> :
        data.loading && !data.snapshot ? <CatalogState kind="loading" title="Katalog wird geladen" message="Positionen und Preise werden abgerufen."/> :
        data.error && !data.snapshot ? <CatalogState kind="error" title="Katalog konnte nicht geladen werden" message={data.error} action={<button className="cw-button" type="button" onClick={() => void data.refresh()}>Erneut versuchen</button>}/> :
        !catalog ? <CatalogState title="Katalog nicht verfügbar" message="Dieser Katalog wurde nicht gefunden oder ist für Ihr Unternehmen nicht freigegeben." action={<button className="cw-button" type="button" onClick={back}>Zur Katalogübersicht</button>}/> : <>
          {data.error ? <CatalogNotice error>Der letzte geladene Stand bleibt sichtbar. Die Aktualisierung ist fehlgeschlagen: {data.error}</CatalogNotice> : null}
          {saved ? <CatalogNotice>Die Position wurde gespeichert.{data.loading ? ' Die Übersicht wird aktualisiert.' : ''}</CatalogNotice> : null}
          <CatalogStats items={[
            { label: 'Positionen', value: catalog.itemCount, detail: 'In diesem Katalog', icon: 'layers' },
            { label: 'Aktiv', value: catalog.activeCount, detail: 'Aktive Katalogpositionen', icon: 'check', tone: 'teal' },
            { label: 'Inaktiv', value: catalog.inactiveCount, detail: 'Weiterhin nachvollziehbar', icon: 'book', tone: 'slate' },
            { label: 'Preis offen', value: catalog.missingPriceCount, detail: 'Aktiv, ohne gültigen Preis', icon: 'alert', tone: catalog.missingPriceCount ? 'amber' : 'slate' },
          ]}/>
          <div className="cw-summary"><div><h2>Ein Katalog für Ihre Leistungen</h2><p>Prüfen Sie Bezeichnung, Einheit und den aktuell gültigen Standardpreis. Fahrtkosten und Zuschläge sind als eigene Positionen gekennzeichnet. {data.canEdit ? 'Änderungen und Preisverläufe öffnen Sie direkt über „Bearbeiten“.' : 'Ihr Zugang bietet Lesezugriff auf diesen Katalog.'}</p></div><CatalogStatus active={catalog.activeCount > 0}/></div>
          <section className="cw-panel" aria-labelledby="catalog-positions-heading">
            <div className="cw-panel-heading"><div><h2 id="catalog-positions-heading">Katalogpositionen</h2><p>Preisstand {formatCatalogDate(data.snapshot?.asOf)} · {data.canEdit ? 'Bearbeitung freigegeben' : 'Lesezugriff'}</p></div><CatalogViewToggle value={view} onChange={setView}/></div>
            <div className="cw-toolbar">
              <label className="cw-search"><CatalogIcon kind="search"/><input type="search" aria-label="Katalogpositionen durchsuchen" value={query} onChange={event => setQuery(event.target.value)} placeholder="Bezeichnung, Kürzel oder Einheit suchen…"/></label>
              <label className="cw-field"><span>Kategorie</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">Alle Kategorien</option>{Object.entries(CATALOG_CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className="cw-field"><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Alle Positionen</option><option value="active">Aktiv</option><option value="inactive">Inaktiv</option><option value="missing">Aktiv · Preis offen</option></select></label>
            </div>
            <div className="cw-list-meta"><span role="status">{filtered.length} von {catalog.itemCount} Positionen</span>{query || category !== 'all' || status !== 'all' ? <button type="button" className="cw-text-button" onClick={reset}>Filter zurücksetzen</button> : <span>Geldbeträge netto · Zuschläge in Prozent</span>}</div>
            {catalog.itemCount === 0 ? <CatalogState title="Die erste Position anlegen" message={data.canEdit ? 'Hinterlegen Sie eine Leistung mit Bezeichnung, Einheit und Standardpreis. Auch Fahrtkosten und Zuschläge können Sie hier ergänzen.' : 'In diesem Katalog wurden noch keine Positionen hinterlegt.'} action={data.canEdit ? <button type="button" className="cw-button cw-button--primary" onClick={() => edit(undefined, true)}><CatalogIcon kind="plus"/>Position anlegen</button> : undefined}/> : filtered.length === 0 ? <CatalogState title="Keine passenden Positionen" message="Ändern Sie den Suchbegriff oder setzen Sie die Filter zurück." action={<button type="button" className="cw-button" onClick={reset}>Alle Positionen anzeigen</button>}/> : view === 'cards' ?
              <div className="cw-cards cw-position-cards">{filtered.map(item => <article key={item.id} className="cw-position-card">
                <div className="cw-card-top"><span className={`cw-category cw-category--${item.category}`}>{CATALOG_CATEGORY_LABELS[item.category]}</span><CatalogStatus active={item.isActive}/></div>
                <div><h3>{item.label}</h3><span className="cw-code">{item.code}</span></div>{item.description ? <p>{item.description}</p> : null}
                <div className="cw-position-price"><div><PriceInformation item={item}/></div>{data.canEdit ? <button type="button" className="cw-button cw-button--small" aria-label={`${item.label} bearbeiten`} onClick={() => edit(item.id)}><CatalogIcon kind="edit"/>Bearbeiten</button> : null}</div>
              </article>)}</div> : <div className="cw-table-wrap"><table className="cw-table cw-table--positions"><colgroup><col style={{ width: '31%' }}/><col style={{ width: '14%' }}/><col style={{ width: '25%' }}/><col style={{ width: '12%' }}/><col style={{ width: '18%' }}/></colgroup><thead><tr><th scope="col">Position</th><th scope="col">Kategorie</th><th scope="col">Standardpreis</th><th scope="col">Status</th><th scope="col">{data.canEdit ? 'Aktion' : 'Einheit'}</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}>
                <td className="cw-main-cell"><strong>{item.label}</strong><small>{item.code}</small>{item.description ? <small>{item.description}</small> : null}</td><td data-label="Kategorie"><span className={`cw-category cw-category--${item.category}`}>{CATALOG_CATEGORY_LABELS[item.category]}</span></td><td data-label="Standardpreis"><PriceInformation item={item}/></td><td data-label="Status"><CatalogStatus active={item.isActive}/></td><td data-label={data.canEdit ? undefined : 'Einheit'}>{data.canEdit ? <div className="cw-cell-actions"><button className="cw-button cw-button--small" type="button" aria-label={`${item.label} bearbeiten`} onClick={() => edit(item.id)}><CatalogIcon kind="edit"/>Bearbeiten</button></div> : item.unit}</td>
              </tr>)}</tbody></table></div>}
          </section>
          <p className="cw-footnote">„Preis offen“ zählt aktive Positionen ohne heute gültigen Standardpreis. Ein zukünftiger Preis wird separat mit seinem Beginn angezeigt. Ein Preis von 0,00 € ist ein hinterlegter Preis.</p>
        </>}
    </CatalogWorkspace>
    {editor && catalog && data.canEdit && data.tenantId ? <TenantServiceCatalogModal key={`${data.scope}:${catalog.moduleKey}:${editor.itemId ?? ''}:${editor.create}`} visible tenantId={data.tenantId} initialModuleKey={catalog.moduleKey} initialItemId={editor.itemId} startCreating={editor.create} effectivePermissions={data.permissions} onClose={() => setEditor(null)} onSaved={() => { setSaved(true); void data.refresh(); }}/> : null}
  </>;
}
