// Generated native presentation from src/screens/catalog/CatalogsListScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeSection,NativeDiv,NativeH2,NativeP,NativeLabel,NativeInput,NativeSpan,NativeSelect,NativeOption,NativeArticle,NativeH3,NativeStrong,NativeTable,NativeColgroup,NativeCol,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeSmall} from '@/components/layout/NativeWorkspaceElements.native';
import { useId, useMemo, useState } from 'react';
import { useFlowRouter } from "../../hooks/useFlowRouter.ts";
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { TenantServiceCatalogModal } from "../../components/tenant/TenantServiceCatalogModal.native.tsx";
import { CatalogIcon, CatalogNotice, CatalogRefresh, CatalogState, CatalogStats, CatalogStatus, CatalogViewToggle, CatalogWorkspace, useCatalogWorkspaceData } from "../../components/catalog/CatalogWorkspace.native.tsx";
import { formatCatalogDate, type CatalogWorkspaceCatalog } from "../../lib/catalog/catalogWorkspace.native.ts";
import type { TenantModuleKey } from '@/types/tenant/tenantCenter';
export function CatalogsListScreen() {
    const data = useCatalogWorkspaceData();
    return <ScreenShell title="Kataloge" scroll={false} contentOwnsHeader><CatalogsList key={data.scope} data={data}/></ScreenShell>;
}
function CatalogsList({ data }: {
    data: ReturnType<typeof useCatalogWorkspaceData>;
}) {
    const router = useFlowRouter();
    const headingId = useId();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [sort, setSort] = useState('name');
    const [view, setView] = useState<'cards' | 'table'>('cards');
    const [editor, setEditor] = useState<{
        moduleKey: TenantModuleKey;
        create: boolean;
        templates: boolean;
    } | null>(null);
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
    const create = (templates = false) => { const first = catalogs[0]; if (first) {
        setSaved(false);
        setEditor({ moduleKey: first.moduleKey, create: !templates, templates });
    } };
    const reset = () => { setQuery(''); setFilter('all'); };
    const actions = <>
    {data.allowed ? <CatalogRefresh loading={data.loading} onRefresh={() => void data.refresh()}/> : null}
    {data.canEdit && catalogs.length > 0 ? <><NativeButton className="cw-button" type="button" onClick={() => create(true)}><CatalogIcon kind="book"/>Standardvorlagen</NativeButton><NativeButton className="cw-button cw-button--primary" type="button" onClick={() => create()}><CatalogIcon kind="plus"/>Neue Position</NativeButton></> : null}
  </>;
    return <>
    <CatalogWorkspace title="Kataloge" subtitle="Leistungen, Fahrtkosten und Zuschläge übersichtlich verwalten." actions={actions} busy={data.loading}>
      {!data.allowed ? <CatalogState kind="locked" title="Kataloge nicht verfügbar" message="Für diesen Bereich benötigen Sie eine Office-Freigabe und die Berechtigung, Kataloge anzusehen."/> :
            data.loading && !data.snapshot ? <CatalogState kind="loading" title="Kataloge werden geladen" message="Leistungen und die aktuell gültigen Preise werden abgerufen."/> :
                data.error && !data.snapshot ? <CatalogState kind="error" title="Kataloge konnten nicht geladen werden" message={data.error} action={<NativeButton className="cw-button" type="button" onClick={() => void data.refresh()}>Erneut versuchen</NativeButton>}/> :
                    data.snapshot ? <>
          {data.error ? <CatalogNotice error>Der letzte geladene Stand bleibt sichtbar. Die Aktualisierung ist fehlgeschlagen: {data.error}</CatalogNotice> : null}
          {saved ? <CatalogNotice>Die Position wurde gespeichert.{data.loading ? ' Der Katalog wird aktualisiert.' : ''}</CatalogNotice> : null}
          <CatalogStats items={[
                            { label: 'Kataloge', value: catalogs.length, detail: 'Verfügbare Leistungsbereiche', icon: 'book' },
                            { label: 'Positionen', value: positions, detail: 'Leistungen, Fahrten & Zuschläge', icon: 'layers' },
                            { label: 'Aktiv', value: active, detail: 'Aktive Katalogpositionen', icon: 'check', tone: 'teal' },
                            { label: 'Preis offen', value: missing, detail: 'Aktiv, ohne gültigen Preis', icon: 'alert', tone: missing ? 'amber' : 'slate' },
                        ]}/>
          {catalogs.length > 0 && positions === 0 ? <CatalogState title="Die ersten Positionen ergänzen" message={data.canEdit ? 'Standardvorlage auswählen oder eigene Position anlegen. Bezeichnung, Einheit und Preis können Sie vor dem Speichern anpassen.' : 'In Ihren Katalogen wurden noch keine Positionen hinterlegt.'} action={data.canEdit ? <><NativeButton className="cw-button cw-button--primary" type="button" onClick={() => create(true)}><CatalogIcon kind="book"/>Standardvorlage auswählen</NativeButton><NativeButton className="cw-button" type="button" onClick={() => create()}><CatalogIcon kind="plus"/>Eigene Position anlegen</NativeButton></> : undefined}/> : null}
          <NativeSection className="cw-panel" aria-labelledby={headingId}>
            <NativeDiv className="cw-panel-heading"><NativeDiv><NativeH2 id={headingId}>Ihre Leistungskataloge</NativeH2><NativeP>Katalog öffnen, Positionen prüfen und Preise bearbeiten.</NativeP></NativeDiv><CatalogViewToggle value={view} onChange={setView}/></NativeDiv>
            <NativeDiv className="cw-toolbar">
              <NativeLabel className="cw-search"><CatalogIcon kind="search"/><NativeInput type="search" aria-label="Kataloge durchsuchen" value={query} onChange={event => setQuery(event.target.value)} placeholder="Katalog oder Leistung suchen…"/></NativeLabel>
              <NativeLabel className="cw-field"><NativeSpan>Status</NativeSpan><NativeSelect value={filter} onChange={event => setFilter(event.target.value)}><NativeOption value="all">Alle Kataloge</NativeOption><NativeOption value="active">Mit aktiven Positionen</NativeOption><NativeOption value="inactive">Ohne aktive Positionen</NativeOption><NativeOption value="missing">Mit offenen Preisen</NativeOption></NativeSelect></NativeLabel>
              <NativeLabel className="cw-field"><NativeSpan>Sortierung</NativeSpan><NativeSelect value={sort} onChange={event => setSort(event.target.value)}><NativeOption value="name">Name A–Z</NativeOption><NativeOption value="updated">Zuletzt geändert</NativeOption></NativeSelect></NativeLabel>
            </NativeDiv>
            <NativeDiv className="cw-list-meta"><NativeSpan role="status">{filtered.length} von {catalogs.length} {catalogs.length === 1 ? 'Katalog' : 'Katalogen'}</NativeSpan>{query || filter !== 'all' ? <NativeButton className="cw-text-button" type="button" onClick={reset}>Filter zurücksetzen</NativeButton> : <NativeSpan>{data.canEdit ? 'Bearbeitung freigegeben' : 'Lesezugriff'}</NativeSpan>}</NativeDiv>
            {catalogs.length === 0 ? <CatalogState title="Noch kein Katalog verfügbar" message="Sobald ein Leistungsbereich für Ihr Unternehmen freigegeben ist, finden Sie dessen Katalog hier."/> : filtered.length === 0 ? <CatalogState title="Keine passenden Kataloge" message="Passen Sie die Suche oder den Statusfilter an." action={<NativeButton className="cw-button" type="button" onClick={reset}>Alle Kataloge anzeigen</NativeButton>}/> : view === 'cards' ?
                            <NativeDiv className="cw-cards">{filtered.map(catalog => <NativeArticle className="cw-catalog-card" key={catalog.id}>
                <NativeDiv className="cw-card-top"><NativeSpan className="cw-card-symbol"><CatalogIcon /></NativeSpan><CatalogStatus active={catalog.activeCount > 0}/></NativeDiv>
                <NativeDiv className="cw-card-title"><NativeH3>{catalog.name}</NativeH3><NativeP>{catalog.description}</NativeP></NativeDiv>
                <NativeDiv className="cw-card-numbers"><NativeSpan><NativeStrong>{catalog.itemCount}</NativeStrong>Positionen</NativeSpan><NativeSpan><NativeStrong>{catalog.activeCount}</NativeStrong>Aktiv</NativeSpan><NativeSpan><NativeStrong>{catalog.missingPriceCount}</NativeStrong>Preis offen</NativeSpan></NativeDiv>
                <NativeDiv className="cw-card-footer"><NativeSpan className="cw-card-date">{catalog.updatedAt ? `Geändert ${formatCatalogDate(catalog.updatedAt)}` : 'Noch keine Positionen'}</NativeSpan><NativeDiv className="cw-actions">{data.canEdit ? <NativeButton className="cw-button cw-button--small" type="button" aria-label={`${catalog.name} bearbeiten`} onClick={() => { setSaved(false); setEditor({ moduleKey: catalog.moduleKey, create: false, templates: false }); }}><CatalogIcon kind="edit"/>Bearbeiten</NativeButton> : null}<NativeButton className="cw-button cw-button--primary cw-button--small" type="button" aria-label={`${catalog.name} öffnen`} onClick={() => open(catalog)}>Öffnen<CatalogIcon kind="arrow"/></NativeButton></NativeDiv></NativeDiv>
              </NativeArticle>)}</NativeDiv> : <NativeDiv className="cw-table-wrap"><NativeTable className="cw-table cw-table--catalogs"><NativeColgroup><NativeCol style={{ width: '36%' }}/><NativeCol style={{ width: '14%' }}/><NativeCol style={{ width: '14%' }}/><NativeCol style={{ width: '13%' }}/><NativeCol style={{ width: '23%' }}/></NativeColgroup><NativeThead><NativeTr><NativeTh scope="col">Katalog</NativeTh><NativeTh scope="col">Positionen</NativeTh><NativeTh scope="col">Preis offen</NativeTh><NativeTh scope="col">Status</NativeTh><NativeTh scope="col">Aktionen</NativeTh></NativeTr></NativeThead><NativeTbody>{filtered.map(catalog => <NativeTr key={catalog.id}>
                <NativeTd className="cw-main-cell"><NativeStrong>{catalog.name}</NativeStrong><NativeSmall>{catalog.description}</NativeSmall>{catalog.updatedAt ? <NativeSmall>Geändert {formatCatalogDate(catalog.updatedAt)}</NativeSmall> : null}</NativeTd>
                <NativeTd data-label="Positionen"><NativeStrong>{catalog.itemCount}</NativeStrong><NativeSpan className="cw-cell-sub">{catalog.activeCount} aktiv</NativeSpan></NativeTd><NativeTd data-label="Preis offen"><NativeSpan className={catalog.missingPriceCount ? 'cw-badge cw-badge--warning' : undefined}>{catalog.missingPriceCount}</NativeSpan></NativeTd><NativeTd data-label="Status"><CatalogStatus active={catalog.activeCount > 0}/></NativeTd><NativeTd><NativeDiv className="cw-cell-actions">{data.canEdit ? <NativeButton className="cw-button cw-button--small" type="button" aria-label={`${catalog.name} bearbeiten`} onClick={() => { setSaved(false); setEditor({ moduleKey: catalog.moduleKey, create: false, templates: false }); }}><CatalogIcon kind="edit"/>Bearbeiten</NativeButton> : null}<NativeButton className="cw-button cw-button--primary cw-button--small" type="button" aria-label={`${catalog.name} öffnen`} onClick={() => open(catalog)}>Öffnen<CatalogIcon kind="arrow"/></NativeButton></NativeDiv></NativeTd>
              </NativeTr>)}</NativeTbody></NativeTable></NativeDiv>}
          </NativeSection>
          <NativeP className="cw-footnote">Der Katalog bündelt Ihre abrechenbaren Leistungen und deren Standardpreise. Individuelle Vereinbarungen bleiben beim jeweiligen Klienten hinterlegt. Beträge und Prozentsätze werden passend zur Einheit angezeigt.</NativeP>
        </> : null}
    </CatalogWorkspace>
    {editor && data.canEdit && data.tenantId ? <TenantServiceCatalogModal key={`${data.scope}:${editor.moduleKey}:${editor.create}:${editor.templates}`} visible tenantId={data.tenantId} effectivePermissions={data.permissions} initialModuleKey={editor.moduleKey} startCreating={editor.create} startWithTemplates={editor.templates} onClose={() => setEditor(null)} onSaved={() => { setSaved(true); void data.refresh(); }}/> : null}
  </>;
}
