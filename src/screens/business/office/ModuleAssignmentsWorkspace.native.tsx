// Generated native presentation from src/screens/business/office/ModuleAssignmentsWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeDiv,NativeStyle,NativeButton,NativeHeader,NativeP,NativeH1,NativeSpan,NativeStrong,NativeSection,NativeH2,NativeLabel,NativeInput,NativeArticle,NativeH3,NativeAside,NativeSelect,NativeOption,NativeTable,NativeCaption,NativeColgroup,NativeCol,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeNav,NativeFooter,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../../../components/icons/WebActionIcon.native.tsx";
import { useId, useMemo, useState } from 'react';
import type { ProductKey } from '@/types';
import type { ModuleAssignmentWorkspaceSnapshot } from "../../../lib/officeModules/moduleAssignmentWorkspaceService.native.ts";
import { MODULE_ASSIGNMENT_SECTIONS, type ModuleAssignmentSectionDefinition } from "../../../lib/officeModules/moduleAssignmentWorkspaceModel.native.ts";
import { PRODUCT_LABELS } from '@/data/constants/productLabels';
import { DesktopCatalogArtwork } from "../../../liquid-command/components/DesktopCatalogArtwork.tsx";
import { resolveWorkflowStatusLabel, resolveWorkflowStatusVariant } from '@/lib/workflow/workflowStatusPresentation';
import { MODULE_ASSIGNMENTS_WORKSPACE_CSS } from "./moduleAssignmentsWorkspaceCss.native.ts";
const PAGE_SIZE = 25;
type ActivityFilter = 'active' | 'all' | 'inactive';
type ActionIconKind = 'refresh' | 'arrow' | 'back' | 'search' | 'info' | 'lock' | 'check' | 'layers';
function ActionIcon({ kind, spinning = false }: {
    kind: ActionIconKind;
    spinning?: boolean;
}) {
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
    return <NativeWorkspaceStyleScope css={[MODULE_ASSIGNMENTS_WORKSPACE_CSS]}>{<WebActionIcon className={spinning ? 'ma-spin' : undefined}><NativeSvgPath d={paths[kind]}/></WebActionIcon>}</NativeWorkspaceStyleScope>;
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
    const filtered = useMemo(() => data.items.filter(item => (module === 'all' || item.moduleKey === module) &&
        (activity === 'all' || (activity === 'active' ? item.active : !item.active)) &&
        `${item.title} ${item.subtitle} ${item.meta ?? ''} ${moduleName(item.moduleKey)} ${resolveWorkflowStatusLabel(item.status)}`.toLocaleLowerCase('de-DE').includes(term)), [data.items, module, activity, term]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const visibleItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const hasFilters = Boolean(search) || module !== 'all' || activity !== 'active';
    const checkedDate = new Date(data.loadedAt);
    const checkedTime = Number.isNaN(checkedDate.getTime()) ? null : new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(checkedDate);
    const resetFilters = (nextActivity: ActivityFilter = 'active') => { setSearch(''); setModule('all'); setActivity(nextActivity); setPage(1); };
    return <NativeWorkspaceStyleScope css={[MODULE_ASSIGNMENTS_WORKSPACE_CSS, MODULE_ASSIGNMENTS_WORKSPACE_CSS]}>{<NativeDiv className="ma-workspace" data-testid="module-assignments-workspace" aria-busy={loading}>
    <NativeStyle>{MODULE_ASSIGNMENTS_WORKSPACE_CSS}</NativeStyle>
    {selected ? <NativeButton type="button" className="ma-back" onClick={() => onOpen('/business/office/modules')} disabled={disabled}><ActionIcon kind="back"/>Alle Modulzuordnungen</NativeButton> : null}
    <NativeHeader className="ma-heading">
      <NativeDiv><NativeP className="ma-eyebrow">Office · Organisation</NativeP><NativeH1>{selected?.label ?? 'Modulzuordnungen'}</NativeH1><NativeP className="ma-tenant">{data.tenantName}{data.source === 'demo' ? <NativeSpan className="ma-tag">Demo</NativeSpan> : null}</NativeP></NativeDiv>
      <NativeButton type="button" className="ma-button ma-button--quiet" onClick={onRefresh} disabled={loading}><ActionIcon kind="refresh" spinning={loading}/>{loading ? 'Wird aktualisiert…' : 'Aktualisieren'}</NativeButton>
    </NativeHeader>

    {error ? <NativeDiv className="ma-feedback ma-feedback--warning" role="alert"><ActionIcon kind="info"/><NativeDiv><NativeStrong>Aktualisierung fehlgeschlagen</NativeStrong><NativeP>{error} Die angezeigten Angaben stammen vom letzten erfolgreichen Abruf. Bitte erneut aktualisieren.</NativeP></NativeDiv></NativeDiv> : null}
    {data.warnings.length ? <NativeDiv className="ma-feedback ma-feedback--warning" role="status"><ActionIcon kind="info"/><NativeDiv><NativeStrong>Hinweise zu den angezeigten Daten</NativeStrong>{data.warnings.map((warning, index) => <NativeP key={`${index}-${warning}`}>{warning}</NativeP>)}</NativeDiv></NativeDiv> : null}

    {!selected ? <>
      <NativeSection className="ma-overview" aria-labelledby={`${id}-overview`}>
        <NativeDiv className="ma-overview-copy"><NativeSpan className="ma-overview-icon"><ActionIcon kind="layers"/></NativeSpan><NativeDiv><NativeH2 id={`${id}-overview`}>Ihr Bestand und die Modulzuordnungen.</NativeH2><NativeP>Öffnen Sie Ihre Akten, Kataloge und Rechnungen direkt. Gespeicherte Modulzuordnungen werden zusätzlich angezeigt.</NativeP></NativeDiv></NativeDiv>
        <NativeDiv className="ma-overview-facts"><NativeDiv><NativeStrong>{loadedInventories}<NativeSpan className="ma-fact-total"> / {MODULE_ASSIGNMENT_SECTIONS.length}</NativeSpan></NativeStrong><NativeSpan>Bestandsbereiche geladen</NativeSpan></NativeDiv><NativeDiv><NativeStrong>{readySections.length ? formatCount(activeCount) : '—'}</NativeStrong><NativeSpan>Aktive Modulzuordnungen{partial ? ' · geladene Bereiche' : ''}</NativeSpan></NativeDiv></NativeDiv>
      </NativeSection>
      <NativeDiv className="ma-section-heading"><NativeDiv><NativeH2 id={`${id}-sections`}>Bestand nach Bereich</NativeH2><NativeP>Vorhandene Inhalte und zusätzliche Modulzuordnungen auf einen Blick.</NativeP></NativeDiv><NativeLabel className="ma-search"><ActionIcon kind="search"/><NativeSpan className="ma-sr">Zuordnungsbereiche durchsuchen</NativeSpan><NativeInput type="search" value={search} onChange={event => setSearch(event.currentTarget.value)} placeholder="Bereich suchen…"/></NativeLabel></NativeDiv>
      <NativeP className="ma-sr" role="status">{shownSections.length} Zuordnungsbereiche gefunden</NativeP>
      {shownSections.length ? <NativeSection className="ma-grid" aria-labelledby={`${id}-sections`}>{shownSections.map(section => {
                    const state = sectionsByKey.get(section.key);
                    const ready = state?.state === 'ready';
                    const restricted = state?.state === 'restricted';
                    const inventory = state?.inventory;
                    const inventoryReady = inventory?.state === 'ready';
                    const inventoryRestricted = inventory?.state === 'restricted';
                    return <NativeWorkspaceStyleScope key={section.key} css={[MODULE_ASSIGNMENTS_WORKSPACE_CSS]}>{<NativeArticle className={`ma-card ma-card--${section.key}`} key={section.key}>
          <NativeDiv className="ma-card-top"><NativeDiv className="ma-card-art"><DesktopCatalogArtwork route={section.artworkRoute} label={section.label} size={66}/></NativeDiv><NativeDiv className="ma-card-heading"><NativeH3>{section.label}</NativeH3><NativeP className="ma-card-description">{section.description}</NativeP></NativeDiv></NativeDiv>
          {!inventoryReady ? <NativeSpan className={`ma-badge ma-source-state ${inventoryRestricted ? 'ma-badge--muted' : 'ma-badge--warning'}`}>{inventoryRestricted ? <><ActionIcon kind="lock"/>Bestand geschützt</> : 'Bestand nicht geladen'}</NativeSpan> : null}
          <NativeDiv className="ma-inventory-count" aria-label={`Bestand: ${inventoryReady ? formatCount(inventory.count) : 'nicht verfügbar'} ${section.inventoryLabel}`}><NativeStrong>{inventoryReady ? formatCount(inventory.count) : '—'}</NativeStrong><NativeSpan>{inventoryLabel(section, inventoryReady ? inventory.count : null)}</NativeSpan></NativeDiv>
          {!inventoryReady ? <NativeP className="ma-inventory-reason">{inventory?.error || (inventoryRestricted ? 'Für diesen Bestand fehlt Ihrer Rolle die Berechtigung.' : 'Der Bestand konnte nicht geladen werden. Bitte erneut versuchen.')}</NativeP> : null}
          {inventoryReady && inventory.action ? <NativeButton type="button" className="ma-open ma-source-action" disabled={disabled} onClick={() => onOpen(inventory.action!.route)}>{inventory.action.label}<ActionIcon kind="arrow"/></NativeButton> : !inventoryReady && !inventoryRestricted ? <NativeButton type="button" className="ma-link" onClick={onRefresh} disabled={loading}>Bestand erneut laden</NativeButton> : null}
          <NativeDiv className="ma-card-assignments"><NativeP className="ma-assignment-caption">Zusätzliche Modulzuordnungen</NativeP>{ready ? <NativeP className="ma-card-count"><NativeSpan><NativeStrong>{formatCount(state.count)}</NativeStrong> gespeichert</NativeSpan><NativeSpan><NativeStrong>{formatCount(state.activeCount)}</NativeStrong> aktiv</NativeSpan></NativeP> : <NativeP className="ma-card-reason">{state?.error || (restricted ? 'Für die Modulzuordnungen fehlt Ihrer Rolle die Berechtigung.' : 'Die Modulzuordnungen konnten nicht geladen werden.')}</NativeP>}<NativeDiv className="ma-card-footer"><NativeButton type="button" className="ma-link ma-assignment-action" disabled={disabled || !ready} onClick={() => onOpen(section.route)} aria-label={`${section.label} öffnen`}>Zuordnungen ansehen<ActionIcon kind="arrow"/></NativeButton>{!ready && !restricted ? <NativeButton type="button" className="ma-link" onClick={onRefresh} disabled={loading}>Zuordnungen erneut laden</NativeButton> : null}</NativeDiv></NativeDiv>
        </NativeArticle>}</NativeWorkspaceStyleScope>;
                })}</NativeSection> : <NativeDiv className="ma-empty"><ActionIcon kind="search"/><NativeH2>Kein passender Bereich</NativeH2><NativeP>Versuchen Sie einen anderen Suchbegriff.</NativeP><NativeButton type="button" className="ma-button" onClick={() => setSearch('')}>Suche zurücksetzen</NativeButton></NativeDiv>}
      <NativeAside className="ma-explanation"><ActionIcon kind="info"/><NativeP><NativeStrong>Bestand und Modulzuordnungen werden getrennt gezählt.</NativeStrong> Auch ohne zusätzliche Modulzuordnung bleiben Ihre vorhandenen Akten, Unterlagen und Vorlagen in ihrer Verwaltung verfügbar. Persönliche Zugriffsrechte gelten weiterhin.</NativeP></NativeAside>
    </> : <>
      <NativeSection className="ma-detail-intro" aria-labelledby={`${id}-detail`}>
        <NativeDiv className="ma-detail-copy"><NativeDiv className="ma-detail-art"><DesktopCatalogArtwork route={selected.artworkRoute} label={selected.label} size={70}/></NativeDiv><NativeDiv><NativeH2 id={`${id}-detail`}>{selected.description}</NativeH2><NativeP>{selected.managementNote}</NativeP></NativeDiv></NativeDiv>
      </NativeSection>
      <NativeSection className="ma-inventory-summary" aria-labelledby={`${id}-inventory`}>
        <NativeDiv><NativeP className="ma-eyebrow">Bestand</NativeP><NativeH2 id={`${id}-inventory`}>{selected.inventoryDescription}</NativeH2>{selectedInventory?.state === 'ready' ? <NativeP className="ma-inventory-total"><NativeStrong>{formatCount(selectedInventory.count)}</NativeStrong><NativeSpan>{inventoryLabel(selected, selectedInventory.count)}</NativeSpan></NativeP> : <NativeDiv className="ma-inventory-unavailable" role="status"><NativeStrong>—</NativeStrong><NativeP>{selectedInventory?.error || (selectedInventory?.state === 'restricted' ? 'Für diesen Bestand fehlt Ihrer Rolle die Berechtigung.' : 'Der Bestand konnte nicht geladen werden. Bitte erneut versuchen.')}</NativeP></NativeDiv>}</NativeDiv>
        {selectedInventory?.state === 'ready' && selectedInventory.action ? <NativeButton type="button" className="ma-button ma-button--primary" onClick={() => onOpen(selectedInventory.action!.route)} disabled={disabled}>{selectedInventory.action.label}<ActionIcon kind="arrow"/></NativeButton> : selectedInventory?.state !== 'restricted' && selectedInventory?.state !== 'ready' ? <NativeButton type="button" className="ma-button" onClick={onRefresh} disabled={loading}>Bestand erneut laden</NativeButton> : null}
      </NativeSection>
      {!selectedState || selectedState.state !== 'ready' ? <NativeDiv className={`ma-feedback ${selectedState?.state === 'restricted' ? '' : 'ma-feedback--warning'}`} role="alert"><ActionIcon kind={selectedState?.state === 'restricted' ? 'lock' : 'info'}/><NativeDiv><NativeStrong>{selectedState?.state === 'restricted' ? 'Modulzuordnungen sind für Ihre Rolle nicht freigegeben' : 'Modulzuordnungen konnten nicht geladen werden'}</NativeStrong><NativeP>{selectedState?.error || 'Bitte aktualisieren Sie die Ansicht, um die Zuordnungen erneut zu laden.'}</NativeP>{selectedState?.state !== 'restricted' ? <NativeButton type="button" className="ma-button" disabled={loading} onClick={onRefresh}>Erneut versuchen</NativeButton> : null}</NativeDiv></NativeDiv> : <>
        <NativeSection className="ma-list" aria-labelledby={`${id}-list`}>
          <NativeDiv className="ma-list-heading"><NativeDiv><NativeH2 id={`${id}-list`}>Zusätzliche Modulzuordnungen</NativeH2><NativeP><NativeStrong>{formatCount(selectedState.activeCount)}</NativeStrong> aktiv · <NativeStrong>{formatCount(selectedState.count)}</NativeStrong> insgesamt</NativeP></NativeDiv>{hasFilters ? <NativeButton type="button" className="ma-link" onClick={() => resetFilters()}>Filter zurücksetzen</NativeButton> : null}</NativeDiv>
          {data.items.length ? <><NativeDiv className="ma-toolbar"><NativeLabel className="ma-field ma-field--search"><NativeSpan>Suche</NativeSpan><NativeSpan className="ma-search"><ActionIcon kind="search"/><NativeInput type="search" value={search} onChange={event => { setSearch(event.currentTarget.value); setPage(1); }} placeholder="Name, Inhalt oder Status…"/></NativeSpan></NativeLabel><NativeLabel className="ma-field"><NativeSpan>Arbeitsbereich</NativeSpan><NativeSelect value={module} onChange={event => { setModule(event.currentTarget.value as ProductKey | 'all'); setPage(1); }}><NativeOption value="all">Alle Arbeitsbereiche</NativeOption>{modules.map(key => <NativeOption key={key} value={key}>{moduleName(key)}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="ma-field"><NativeSpan>Aktivität</NativeSpan><NativeSelect value={activity} onChange={event => { setActivity(event.currentTarget.value as ActivityFilter); setPage(1); }}><NativeOption value="active">Aktive Zuordnungen</NativeOption><NativeOption value="all">Alle Zuordnungen</NativeOption><NativeOption value="inactive">Nicht aktive Zuordnungen</NativeOption></NativeSelect></NativeLabel></NativeDiv>
          <NativeDiv className="ma-results" role="status">{formatCount(filtered.length)} {filtered.length === 1 ? 'Zuordnung gefunden' : 'Zuordnungen gefunden'}{loading ? ' · Wird aktualisiert…' : ''}</NativeDiv></> : null}
          {visibleItems.length ? <>
            <NativeTable className="ma-table"><NativeCaption className="ma-sr">{selected.label}: gefilterte gespeicherte Zuordnungen</NativeCaption><NativeColgroup><NativeCol className="ma-col-name"/><NativeCol className="ma-col-module"/><NativeCol className="ma-col-status"/><NativeCol className="ma-col-action"/></NativeColgroup><NativeThead><NativeTr><NativeTh scope="col">Zuordnung</NativeTh><NativeTh scope="col">Arbeitsbereich</NativeTh><NativeTh scope="col">Status</NativeTh><NativeTh scope="col">Verwaltung</NativeTh></NativeTr></NativeThead><NativeTbody>{visibleItems.map(item => <NativeTr key={item.id}><NativeTd className="ma-name-cell"><NativeStrong>{item.title}</NativeStrong>{item.subtitle ? <NativeP>{item.subtitle}</NativeP> : null}{item.meta ? <NativeSpan className="ma-item-meta">{item.meta}</NativeSpan> : null}</NativeTd><NativeTd data-label="Arbeitsbereich"><NativeSpan className="ma-module-label">{moduleName(item.moduleKey)}</NativeSpan></NativeTd><NativeTd data-label="Status"><NativeSpan className={`ma-badge ma-badge--${resolveWorkflowStatusVariant(item.status)}`}>{resolveWorkflowStatusLabel(item.status)}</NativeSpan>{item.active && item.status !== 'aktiv' ? <NativeSpan className="ma-assignment-active">Zuordnung aktiv</NativeSpan> : null}</NativeTd><NativeTd className="ma-actions-cell" data-label="Verwaltung">{item.actions.length ? <NativeDiv className="ma-row-actions">{item.actions.map(action => <NativeButton type="button" className="ma-row-action" key={`${action.route}-${action.label}`} disabled={disabled} onClick={() => onOpen(action.route)} aria-label={`${action.label}: ${item.title}`}>{action.label}<ActionIcon kind="arrow"/></NativeButton>)}</NativeDiv> : <NativeSpan className="ma-no-action">Nur Ansicht</NativeSpan>}</NativeTd></NativeTr>)}</NativeTbody></NativeTable>
            {pageCount > 1 ? <NativeNav className="ma-pagination" aria-label="Seiten der Zuordnungen"><NativeSpan>{formatCount((currentPage - 1) * PAGE_SIZE + 1)}–{formatCount(Math.min(currentPage * PAGE_SIZE, filtered.length))} von {formatCount(filtered.length)}</NativeSpan><NativeDiv><NativeButton type="button" className="ma-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ActionIcon kind="back"/>Zurück</NativeButton><NativeSpan aria-live="polite">Seite {currentPage} von {pageCount}</NativeSpan><NativeButton type="button" className="ma-button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Weiter<ActionIcon kind="arrow"/></NativeButton></NativeDiv></NativeNav> : null}
          </> : <NativeDiv className={`ma-empty ${data.items.length ? '' : 'ma-empty--assignments'}`}><ActionIcon kind={data.items.length ? 'search' : 'layers'}/><NativeH3>{data.items.length ? 'Keine passenden Zuordnungen' : 'Keine zusätzlichen Modulzuordnungen gespeichert'}</NativeH3><NativeP>{data.items.length ? 'Ändern Sie Ihre Suche oder zeigen Sie auch nicht aktive Zuordnungen an.' : selected.emptyText}</NativeP>{data.items.length ? <NativeButton type="button" className="ma-button" onClick={() => resetFilters('all')}>Alle Zuordnungen anzeigen</NativeButton> : null}</NativeDiv>}
        </NativeSection>
      </>}
    </>}
    <NativeFooter className="ma-footer"><NativeSpan>{roleLabel || 'Angemeldetes Konto'}</NativeSpan><NativeSpan role="status">{loading ? 'Zuordnungen werden aktualisiert…' : checkedTime ? `Stand: ${checkedTime}` : 'Zuordnungen abgerufen'}{data.source === 'demo' ? ' · Beispieldaten' : ''}</NativeSpan></NativeFooter>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
