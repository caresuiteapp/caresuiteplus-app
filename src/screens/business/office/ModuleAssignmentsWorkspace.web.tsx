import { useId, useMemo, useState } from 'react';
import type { ProductKey } from '@/types';
import type { ModuleAssignmentWorkspaceSnapshot } from '@/lib/officeModules/moduleAssignmentWorkspaceService.web';
import { MODULE_ASSIGNMENT_SECTIONS, type ModuleAssignmentSectionDefinition } from '@/lib/officeModules/moduleAssignmentWorkspaceModel.web';
import { PRODUCT_LABELS } from '@/data/constants/productLabels';
import { DesktopCatalogArtwork } from '@/liquid-command/components/DesktopCatalogArtwork.web';
import { resolveWorkflowStatusLabel, resolveWorkflowStatusVariant } from '@/lib/workflow/workflowStatusPresentation';
import { MODULE_ASSIGNMENTS_WORKSPACE_CSS } from './moduleAssignmentsWorkspaceCss.web';

const PAGE_SIZE = 25;
type ActivityFilter = 'active' | 'all' | 'inactive';
type ActionIconKind = 'refresh' | 'arrow' | 'back' | 'search' | 'info' | 'lock' | 'check' | 'layers';

function ActionIcon({ kind, spinning = false }: { kind: ActionIconKind; spinning?: boolean }) {
  const paths: Record<ActionIconKind, string> = {
    refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    back: 'M20 12H4m6-6-6 6 6 6',
    search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6',
    info: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 11v6M12 7h.01',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
    check: 'm5 12 4 4L19 6',
    layers: 'm12 3 10 6-10 6L2 9l10-6ZM2 13l10 6 10-6M2 17l10 6 10-6',
  };
  return <svg className={spinning ? 'ma-spin' : undefined} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[kind]} /></svg>;
}

function moduleName(key: ProductKey) {
  return PRODUCT_LABELS[key].replace('CareSuite+ ', '');
}

function formatCount(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat('de-DE').format(value);
}

function inventoryLabel(section: ModuleAssignmentSectionDefinition, count: number | null) {
  return count === 1 ? section.inventorySingularLabel : section.inventoryLabel;
}

export type ModuleAssignmentsWorkspaceProps = {
  data: ModuleAssignmentWorkspaceSnapshot;
  loading: boolean;
  error: string | null;
  roleLabel: string | null;
  onRefresh: () => void;
  onOpen: (route: string) => void;
};

/** Presentation only. Identity, access checks and tenant reads belong to the controller. */
export function ModuleAssignmentsWorkspace({ data, loading, error, roleLabel, onRefresh, onOpen }: ModuleAssignmentsWorkspaceProps) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [module, setModule] = useState<ProductKey | 'all'>('all');
  const [activity, setActivity] = useState<ActivityFilter>('active');
  const [page, setPage] = useState(1);
  const selected = MODULE_ASSIGNMENT_SECTIONS.find(section => section.key === data.section);
  const selectedState = data.sections.find(section => section.key === data.section);
  const selectedInventory = selectedState?.inventory;
  const term = search.trim().toLocaleLowerCase('de-DE');
  const disabled = loading || Boolean(error);
  const sectionsByKey = new Map(data.sections.map(section => [section.key, section]));
  const shownSections = MODULE_ASSIGNMENT_SECTIONS.filter(section => `${section.label} ${section.description} ${section.inventoryLabel}`.toLocaleLowerCase('de-DE').includes(term));
  const readySections = data.sections.filter(section => section.state === 'ready');
  const partial = readySections.length !== data.sections.length;
  const activeCount = readySections.reduce((sum, section) => sum + (section.activeCount ?? 0), 0);
  const loadedInventories = data.sections.filter(section => section.inventory.state === 'ready').length;
  const modules = useMemo(() => [...new Set(data.items.map(item => item.moduleKey))].sort((a, b) => moduleName(a).localeCompare(moduleName(b), 'de')), [data.items]);
  const filtered = useMemo(() => data.items.filter(item =>
    (module === 'all' || item.moduleKey === module) &&
    (activity === 'all' || (activity === 'active' ? item.active : !item.active)) &&
    `${item.title} ${item.subtitle} ${item.meta ?? ''} ${moduleName(item.moduleKey)} ${resolveWorkflowStatusLabel(item.status)}`.toLocaleLowerCase('de-DE').includes(term),
  ), [data.items, module, activity, term]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = Boolean(search) || module !== 'all' || activity !== 'active';
  const checkedDate = new Date(data.loadedAt);
  const checkedTime = Number.isNaN(checkedDate.getTime()) ? null : new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(checkedDate);
  const resetFilters = (nextActivity: ActivityFilter = 'active') => { setSearch(''); setModule('all'); setActivity(nextActivity); setPage(1); };

  return <div className="ma-workspace" data-testid="module-assignments-workspace" aria-busy={loading}>
    <style>{MODULE_ASSIGNMENTS_WORKSPACE_CSS}</style>
    {selected ? <button type="button" className="ma-back" onClick={() => onOpen('/business/office/modules')} disabled={disabled}><ActionIcon kind="back" />Alle Modulzuordnungen</button> : null}
    <header className="ma-heading">
      <div><p className="ma-eyebrow">Office · Organisation</p><h1>{selected?.label ?? 'Modulzuordnungen'}</h1><p className="ma-tenant">{data.tenantName}{data.source === 'demo' ? <span className="ma-tag">Demo</span> : null}</p></div>
      <button type="button" className="ma-button ma-button--quiet" onClick={onRefresh} disabled={loading}><ActionIcon kind="refresh" spinning={loading} />{loading ? 'Wird aktualisiert…' : 'Aktualisieren'}</button>
    </header>

    {error ? <div className="ma-feedback ma-feedback--warning" role="alert"><ActionIcon kind="info" /><div><strong>Aktualisierung fehlgeschlagen</strong><p>{error} Die angezeigten Angaben stammen vom letzten erfolgreichen Abruf. Bitte erneut aktualisieren.</p></div></div> : null}
    {data.warnings.length ? <div className="ma-feedback ma-feedback--warning" role="status"><ActionIcon kind="info" /><div><strong>Hinweise zu den angezeigten Daten</strong>{data.warnings.map((warning, index) => <p key={`${index}-${warning}`}>{warning}</p>)}</div></div> : null}

    {!selected ? <>
      <section className="ma-overview" aria-labelledby={`${id}-overview`}>
        <div className="ma-overview-copy"><span className="ma-overview-icon"><ActionIcon kind="layers" /></span><div><h2 id={`${id}-overview`}>Ihr Bestand und die Modulzuordnungen.</h2><p>Öffnen Sie Ihre Akten, Kataloge und Rechnungen direkt. Gespeicherte Modulzuordnungen werden zusätzlich angezeigt.</p></div></div>
        <div className="ma-overview-facts"><div><strong>{loadedInventories}<span className="ma-fact-total"> / {MODULE_ASSIGNMENT_SECTIONS.length}</span></strong><span>Bestandsbereiche geladen</span></div><div><strong>{readySections.length ? formatCount(activeCount) : '—'}</strong><span>Aktive Modulzuordnungen{partial ? ' · geladene Bereiche' : ''}</span></div></div>
      </section>
      <div className="ma-section-heading"><div><h2 id={`${id}-sections`}>Bestand nach Bereich</h2><p>Vorhandene Inhalte und zusätzliche Modulzuordnungen auf einen Blick.</p></div><label className="ma-search"><ActionIcon kind="search" /><span className="ma-sr">Zuordnungsbereiche durchsuchen</span><input type="search" value={search} onChange={event => setSearch(event.currentTarget.value)} placeholder="Bereich suchen…" /></label></div>
      <p className="ma-sr" role="status">{shownSections.length} Zuordnungsbereiche gefunden</p>
      {shownSections.length ? <section className="ma-grid" aria-labelledby={`${id}-sections`}>{shownSections.map(section => {
        const state = sectionsByKey.get(section.key);
        const ready = state?.state === 'ready';
        const restricted = state?.state === 'restricted';
        const inventory = state?.inventory;
        const inventoryReady = inventory?.state === 'ready';
        const inventoryRestricted = inventory?.state === 'restricted';
        return <article className={`ma-card ma-card--${section.key}`} key={section.key}>
          <div className="ma-card-top"><div className="ma-card-art"><DesktopCatalogArtwork route={section.artworkRoute} label={section.label} size={66} /></div><div className="ma-card-heading"><h3>{section.label}</h3><p className="ma-card-description">{section.description}</p></div></div>
          {!inventoryReady ? <span className={`ma-badge ma-source-state ${inventoryRestricted ? 'ma-badge--muted' : 'ma-badge--warning'}`}>{inventoryRestricted ? <><ActionIcon kind="lock" />Bestand geschützt</> : 'Bestand nicht geladen'}</span> : null}
          <div className="ma-inventory-count" aria-label={`Bestand: ${inventoryReady ? formatCount(inventory.count) : 'nicht verfügbar'} ${section.inventoryLabel}`}><strong>{inventoryReady ? formatCount(inventory.count) : '—'}</strong><span>{inventoryLabel(section, inventoryReady ? inventory.count : null)}</span></div>
          {!inventoryReady ? <p className="ma-inventory-reason">{inventory?.error || (inventoryRestricted ? 'Für diesen Bestand fehlt Ihrer Rolle die Berechtigung.' : 'Der Bestand konnte nicht geladen werden. Bitte erneut versuchen.')}</p> : null}
          {inventoryReady && inventory.action ? <button type="button" className="ma-open ma-source-action" disabled={disabled} onClick={() => onOpen(inventory.action!.route)}>{inventory.action.label}<ActionIcon kind="arrow" /></button> : !inventoryReady && !inventoryRestricted ? <button type="button" className="ma-link" onClick={onRefresh} disabled={loading}>Bestand erneut laden</button> : null}
          <div className="ma-card-assignments"><p className="ma-assignment-caption">Zusätzliche Modulzuordnungen</p>{ready ? <p className="ma-card-count"><span><strong>{formatCount(state.count)}</strong> gespeichert</span><span><strong>{formatCount(state.activeCount)}</strong> aktiv</span></p> : <p className="ma-card-reason">{state?.error || (restricted ? 'Für die Modulzuordnungen fehlt Ihrer Rolle die Berechtigung.' : 'Die Modulzuordnungen konnten nicht geladen werden.')}</p>}<div className="ma-card-footer"><button type="button" className="ma-link ma-assignment-action" disabled={disabled || !ready} onClick={() => onOpen(section.route)} aria-label={`${section.label} öffnen`}>Zuordnungen ansehen<ActionIcon kind="arrow" /></button>{!ready && !restricted ? <button type="button" className="ma-link" onClick={onRefresh} disabled={loading}>Zuordnungen erneut laden</button> : null}</div></div>
        </article>;
      })}</section> : <div className="ma-empty"><ActionIcon kind="search" /><h2>Kein passender Bereich</h2><p>Versuchen Sie einen anderen Suchbegriff.</p><button type="button" className="ma-button" onClick={() => setSearch('')}>Suche zurücksetzen</button></div>}
      <aside className="ma-explanation"><ActionIcon kind="info" /><p><strong>Bestand und Modulzuordnungen werden getrennt gezählt.</strong> Auch ohne zusätzliche Modulzuordnung bleiben Ihre vorhandenen Akten, Unterlagen und Vorlagen in ihrer Verwaltung verfügbar. Persönliche Zugriffsrechte gelten weiterhin.</p></aside>
    </> : <>
      <section className="ma-detail-intro" aria-labelledby={`${id}-detail`}>
        <div className="ma-detail-copy"><div className="ma-detail-art"><DesktopCatalogArtwork route={selected.artworkRoute} label={selected.label} size={70} /></div><div><h2 id={`${id}-detail`}>{selected.description}</h2><p>{selected.managementNote}</p></div></div>
      </section>
      <section className="ma-inventory-summary" aria-labelledby={`${id}-inventory`}>
        <div><p className="ma-eyebrow">Bestand</p><h2 id={`${id}-inventory`}>{selected.inventoryDescription}</h2>{selectedInventory?.state === 'ready' ? <p className="ma-inventory-total"><strong>{formatCount(selectedInventory.count)}</strong><span>{inventoryLabel(selected, selectedInventory.count)}</span></p> : <div className="ma-inventory-unavailable" role="status"><strong>—</strong><p>{selectedInventory?.error || (selectedInventory?.state === 'restricted' ? 'Für diesen Bestand fehlt Ihrer Rolle die Berechtigung.' : 'Der Bestand konnte nicht geladen werden. Bitte erneut versuchen.')}</p></div>}</div>
        {selectedInventory?.state === 'ready' && selectedInventory.action ? <button type="button" className="ma-button ma-button--primary" onClick={() => onOpen(selectedInventory.action!.route)} disabled={disabled}>{selectedInventory.action.label}<ActionIcon kind="arrow" /></button> : selectedInventory?.state !== 'restricted' && selectedInventory?.state !== 'ready' ? <button type="button" className="ma-button" onClick={onRefresh} disabled={loading}>Bestand erneut laden</button> : null}
      </section>
      {!selectedState || selectedState.state !== 'ready' ? <div className={`ma-feedback ${selectedState?.state === 'restricted' ? '' : 'ma-feedback--warning'}`} role="alert"><ActionIcon kind={selectedState?.state === 'restricted' ? 'lock' : 'info'} /><div><strong>{selectedState?.state === 'restricted' ? 'Modulzuordnungen sind für Ihre Rolle nicht freigegeben' : 'Modulzuordnungen konnten nicht geladen werden'}</strong><p>{selectedState?.error || 'Bitte aktualisieren Sie die Ansicht, um die Zuordnungen erneut zu laden.'}</p>{selectedState?.state !== 'restricted' ? <button type="button" className="ma-button" disabled={loading} onClick={onRefresh}>Erneut versuchen</button> : null}</div></div> : <>
        <section className="ma-list" aria-labelledby={`${id}-list`}>
          <div className="ma-list-heading"><div><h2 id={`${id}-list`}>Zusätzliche Modulzuordnungen</h2><p><strong>{formatCount(selectedState.activeCount)}</strong> aktiv · <strong>{formatCount(selectedState.count)}</strong> insgesamt</p></div>{hasFilters ? <button type="button" className="ma-link" onClick={() => resetFilters()}>Filter zurücksetzen</button> : null}</div>
          {data.items.length ? <><div className="ma-toolbar"><label className="ma-field ma-field--search"><span>Suche</span><span className="ma-search"><ActionIcon kind="search" /><input type="search" value={search} onChange={event => { setSearch(event.currentTarget.value); setPage(1); }} placeholder="Name, Inhalt oder Status…" /></span></label><label className="ma-field"><span>Arbeitsbereich</span><select value={module} onChange={event => { setModule(event.currentTarget.value as ProductKey | 'all'); setPage(1); }}><option value="all">Alle Arbeitsbereiche</option>{modules.map(key => <option key={key} value={key}>{moduleName(key)}</option>)}</select></label><label className="ma-field"><span>Aktivität</span><select value={activity} onChange={event => { setActivity(event.currentTarget.value as ActivityFilter); setPage(1); }}><option value="active">Aktive Zuordnungen</option><option value="all">Alle Zuordnungen</option><option value="inactive">Nicht aktive Zuordnungen</option></select></label></div>
          <div className="ma-results" role="status">{formatCount(filtered.length)} {filtered.length === 1 ? 'Zuordnung gefunden' : 'Zuordnungen gefunden'}{loading ? ' · Wird aktualisiert…' : ''}</div></> : null}
          {visibleItems.length ? <>
            <table className="ma-table"><caption className="ma-sr">{selected.label}: gefilterte gespeicherte Zuordnungen</caption><colgroup><col className="ma-col-name" /><col className="ma-col-module" /><col className="ma-col-status" /><col className="ma-col-action" /></colgroup><thead><tr><th scope="col">Zuordnung</th><th scope="col">Arbeitsbereich</th><th scope="col">Status</th><th scope="col">Verwaltung</th></tr></thead><tbody>{visibleItems.map(item => <tr key={item.id}><td className="ma-name-cell"><strong>{item.title}</strong>{item.subtitle ? <p>{item.subtitle}</p> : null}{item.meta ? <span className="ma-item-meta">{item.meta}</span> : null}</td><td data-label="Arbeitsbereich"><span className="ma-module-label">{moduleName(item.moduleKey)}</span></td><td data-label="Status"><span className={`ma-badge ma-badge--${resolveWorkflowStatusVariant(item.status)}`}>{resolveWorkflowStatusLabel(item.status)}</span>{item.active && item.status !== 'aktiv' ? <span className="ma-assignment-active">Zuordnung aktiv</span> : null}</td><td className="ma-actions-cell" data-label="Verwaltung">{item.actions.length ? <div className="ma-row-actions">{item.actions.map(action => <button type="button" className="ma-row-action" key={`${action.route}-${action.label}`} disabled={disabled} onClick={() => onOpen(action.route)} aria-label={`${action.label}: ${item.title}`}>{action.label}<ActionIcon kind="arrow" /></button>)}</div> : <span className="ma-no-action">Nur Ansicht</span>}</td></tr>)}</tbody></table>
            {pageCount > 1 ? <nav className="ma-pagination" aria-label="Seiten der Zuordnungen"><span>{formatCount((currentPage - 1) * PAGE_SIZE + 1)}–{formatCount(Math.min(currentPage * PAGE_SIZE, filtered.length))} von {formatCount(filtered.length)}</span><div><button type="button" className="ma-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ActionIcon kind="back" />Zurück</button><span aria-live="polite">Seite {currentPage} von {pageCount}</span><button type="button" className="ma-button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Weiter<ActionIcon kind="arrow" /></button></div></nav> : null}
          </> : <div className={`ma-empty ${data.items.length ? '' : 'ma-empty--assignments'}`}><ActionIcon kind={data.items.length ? 'search' : 'layers'} /><h3>{data.items.length ? 'Keine passenden Zuordnungen' : 'Keine zusätzlichen Modulzuordnungen gespeichert'}</h3><p>{data.items.length ? 'Ändern Sie Ihre Suche oder zeigen Sie auch nicht aktive Zuordnungen an.' : selected.emptyText}</p>{data.items.length ? <button type="button" className="ma-button" onClick={() => resetFilters('all')}>Alle Zuordnungen anzeigen</button> : null}</div>}
        </section>
      </>}
    </>}
    <footer className="ma-footer"><span>{roleLabel || 'Angemeldetes Konto'}</span><span role="status">{loading ? 'Zuordnungen werden aktualisiert…' : checkedTime ? `Stand: ${checkedTime}` : 'Zuordnungen abgerufen'}{data.source === 'demo' ? ' · Beispieldaten' : ''}</span></footer>
  </div>;
}
