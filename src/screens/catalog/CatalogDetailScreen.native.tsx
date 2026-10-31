// Generated native presentation from src/screens/catalog/CatalogDetailScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeStrong,NativeSpan,NativeButton,NativeDiv,NativeH2,NativeP,NativeSection,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeArticle,NativeH3,NativeTable,NativeColgroup,NativeCol,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeSmall} from '@/components/layout/NativeWorkspaceElements.native';
import { useId, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter } from "../../hooks/useFlowRouter.ts";
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { TenantServiceCatalogModal } from "../../components/tenant/TenantServiceCatalogModal.native.tsx";
import { CatalogIcon, CatalogNotice, CatalogRefresh, CatalogState, CatalogStats, CatalogStatus, CatalogViewToggle, CatalogWorkspace, useCatalogWorkspaceData } from "../../components/catalog/CatalogWorkspace.native.tsx";
import { CATALOG_CATEGORY_LABELS, formatCatalogDate, formatWorkspaceCatalogPrice, type CatalogWorkspaceItem } from "../../lib/catalog/catalogWorkspace.native.ts";
import { formatServiceTaxMode } from '@/lib/tenant/serviceCatalogLabels';
export function CatalogDetailScreen() {
    const params = useLocalSearchParams<{
        id?: string | string[];
    }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const data = useCatalogWorkspaceData();
    return <ScreenShell title="Katalog" scroll={false} contentOwnsHeader><CatalogDetail key={`${data.scope}:${id ?? ''}`} id={id} data={data}/></ScreenShell>;
}
function PriceInformation({ item }: {
    item: CatalogWorkspaceItem;
}) {
    return <>
    <NativeStrong className={`cw-price${item.priceNet == null ? ' cw-price--missing' : ''}`}>{formatWorkspaceCatalogPrice(item)}</NativeStrong>
    <NativeSpan className="cw-cell-sub">{item.unitKey === 'percent' ? 'Zuschlag in Prozent' : `Netto je ${item.unit}`}</NativeSpan>
    {item.priceNet != null && item.defaultTaxMode ? <NativeSpan className="cw-cell-sub">{formatServiceTaxMode(item.defaultTaxMode)}</NativeSpan> : null}
    {item.priceState === 'expired' ? <NativeSpan className="cw-cell-sub">Preis abgelaufen{item.validUntil ? ` am ${formatCatalogDate(item.validUntil)}` : ''}</NativeSpan> : null}
    {item.priceState === 'missing' ? <NativeSpan className="cw-cell-sub">Noch keinen Standardpreis hinterlegt</NativeSpan> : null}
    {item.priceState === 'current' && item.validUntil ? <NativeSpan className="cw-cell-sub">Gültig bis {formatCatalogDate(item.validUntil)}</NativeSpan> : null}
    {item.nextPriceNet != null && item.nextValidFrom ? <NativeSpan className="cw-cell-sub">Ab {formatCatalogDate(item.nextValidFrom)}: {formatWorkspaceCatalogPrice({ priceNet: item.nextPriceNet, unitKey: item.unitKey })}</NativeSpan> : null}
  </>;
}
function CatalogDetail({ id, data }: {
    id?: string;
    data: ReturnType<typeof useCatalogWorkspaceData>;
}) {
    const router = useFlowRouter();
    const headingId = useId();
    const catalog = data.snapshot?.catalogs.find(item => item.id === id);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('all');
    const [status, setStatus] = useState('all');
    const [view, setView] = useState<'cards' | 'table'>('table');
    const [editor, setEditor] = useState<{
        itemId?: string;
        create: boolean;
        templates: boolean;
    } | null>(null);
    const [saved, setSaved] = useState(false);
    const filtered = useMemo(() => {
        const term = query.trim().toLocaleLowerCase('de-DE');
        return (catalog?.items ?? []).filter(item => (category === 'all' || item.category === category) &&
            (status === 'all' || status === 'active' && item.isActive || status === 'inactive' && !item.isActive || status === 'missing' && item.isActive && item.priceNet == null) &&
            (!term || `${item.label} ${item.code} ${item.description} ${item.unit}`.toLocaleLowerCase('de-DE').includes(term)));
    }, [catalog, category, status, query]);
    const back = () => router.replace('/office/catalogs');
    const reset = () => { setQuery(''); setCategory('all'); setStatus('all'); };
    const edit = (itemId?: string, create = false, templates = false) => { setSaved(false); setEditor({ itemId, create, templates }); };
    const actions = <>{data.allowed ? <CatalogRefresh loading={data.loading} onRefresh={() => void data.refresh()}/> : null}{catalog && data.canEdit ? <><NativeButton type="button" className="cw-button" onClick={() => edit(undefined, false, true)}><CatalogIcon kind="book"/>Standardvorlagen</NativeButton><NativeButton type="button" className="cw-button cw-button--primary" onClick={() => edit(undefined, true)}><CatalogIcon kind="plus"/>Neue Position</NativeButton></> : null}</>;
    return <>
    <CatalogWorkspace title={catalog?.name ?? 'Katalog'} subtitle="Leistungen und Standardpreise im Detail." actions={actions} back={back} busy={data.loading}>
      {!data.allowed ? <CatalogState kind="locked" title="Kein Zugriff auf diesen Katalog" message="Für diesen Bereich benötigen Sie eine Office-Freigabe und die Berechtigung, Kataloge anzusehen."/> :
            data.loading && !data.snapshot ? <CatalogState kind="loading" title="Katalog wird geladen" message="Positionen und Preise werden abgerufen."/> :
                data.error && !data.snapshot ? <CatalogState kind="error" title="Katalog konnte nicht geladen werden" message={data.error} action={<NativeButton className="cw-button" type="button" onClick={() => void data.refresh()}>Erneut versuchen</NativeButton>}/> :
                    !catalog ? <CatalogState title="Katalog nicht verfügbar" message="Dieser Katalog wurde nicht gefunden oder ist für Ihr Unternehmen nicht freigegeben." action={<NativeButton className="cw-button" type="button" onClick={back}>Zur Katalogübersicht</NativeButton>}/> : <>
          {data.error ? <CatalogNotice error>Der letzte geladene Stand bleibt sichtbar. Die Aktualisierung ist fehlgeschlagen: {data.error}</CatalogNotice> : null}
          {saved ? <CatalogNotice>Die Position wurde gespeichert.{data.loading ? ' Die Übersicht wird aktualisiert.' : ''}</CatalogNotice> : null}
          <CatalogStats items={[
                            { label: 'Positionen', value: catalog.itemCount, detail: 'In diesem Katalog', icon: 'layers' },
                            { label: 'Aktiv', value: catalog.activeCount, detail: 'Aktive Katalogpositionen', icon: 'check', tone: 'teal' },
                            { label: 'Inaktiv', value: catalog.inactiveCount, detail: 'Weiterhin nachvollziehbar', icon: 'book', tone: 'slate' },
                            { label: 'Preis offen', value: catalog.missingPriceCount, detail: 'Aktiv, ohne gültigen Preis', icon: 'alert', tone: catalog.missingPriceCount ? 'amber' : 'slate' },
                        ]}/>
          <NativeDiv className="cw-summary"><NativeDiv><NativeH2>Ein Katalog für Ihre Leistungen</NativeH2><NativeP>Prüfen Sie Bezeichnung, Einheit und den aktuell gültigen Standardpreis. Fahrtkosten und Zuschläge sind als eigene Positionen gekennzeichnet. {data.canEdit ? 'Änderungen und Preisverläufe öffnen Sie direkt über „Bearbeiten“.' : 'Ihr Zugang bietet Lesezugriff auf diesen Katalog.'}</NativeP></NativeDiv><CatalogStatus active={catalog.activeCount > 0}/></NativeDiv>
          <NativeSection className="cw-panel" aria-labelledby={headingId}>
            <NativeDiv className="cw-panel-heading"><NativeDiv><NativeH2 id={headingId}>Katalogpositionen</NativeH2><NativeP>Preisstand {formatCatalogDate(data.snapshot?.asOf)} · {data.canEdit ? 'Bearbeitung freigegeben' : 'Lesezugriff'}</NativeP></NativeDiv><CatalogViewToggle value={view} onChange={setView}/></NativeDiv>
            <NativeDiv className="cw-toolbar">
              <NativeLabel className="cw-search"><CatalogIcon kind="search"/><NativeInput type="search" aria-label="Katalogpositionen durchsuchen" value={query} onChange={event => setQuery(event.target.value)} placeholder="Bezeichnung, Kürzel oder Einheit suchen…"/></NativeLabel>
              <NativeLabel className="cw-field"><NativeSpan>Kategorie</NativeSpan><NativeSelect value={category} onChange={event => setCategory(event.target.value)}><NativeOption value="all">Alle Kategorien</NativeOption>{Object.entries(CATALOG_CATEGORY_LABELS).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel>
              <NativeLabel className="cw-field"><NativeSpan>Status</NativeSpan><NativeSelect value={status} onChange={event => setStatus(event.target.value)}><NativeOption value="all">Alle Positionen</NativeOption><NativeOption value="active">Aktiv</NativeOption><NativeOption value="inactive">Inaktiv</NativeOption><NativeOption value="missing">Aktiv · Preis offen</NativeOption></NativeSelect></NativeLabel>
            </NativeDiv>
            <NativeDiv className="cw-list-meta"><NativeSpan role="status">{filtered.length} von {catalog.itemCount} Positionen</NativeSpan>{query || category !== 'all' || status !== 'all' ? <NativeButton type="button" className="cw-text-button" onClick={reset}>Filter zurücksetzen</NativeButton> : <NativeSpan>Geldbeträge netto · Zuschläge in Prozent</NativeSpan>}</NativeDiv>
            {catalog.itemCount === 0 ? <CatalogState title="Die erste Position anlegen" message={data.canEdit ? 'Standardvorlage auswählen oder eigene Position anlegen. Bezeichnung, Einheit und Preis können Sie vor dem Speichern anpassen.' : 'In diesem Katalog wurden noch keine Positionen hinterlegt.'} action={data.canEdit ? <><NativeButton type="button" className="cw-button cw-button--primary" onClick={() => edit(undefined, false, true)}><CatalogIcon kind="book"/>Standardvorlage auswählen</NativeButton><NativeButton type="button" className="cw-button" onClick={() => edit(undefined, true)}><CatalogIcon kind="plus"/>Eigene Position anlegen</NativeButton></> : undefined}/> : filtered.length === 0 ? <CatalogState title="Keine passenden Positionen" message="Ändern Sie den Suchbegriff oder setzen Sie die Filter zurück." action={<NativeButton type="button" className="cw-button" onClick={reset}>Alle Positionen anzeigen</NativeButton>}/> : view === 'cards' ?
                            <NativeDiv className="cw-cards cw-position-cards">{filtered.map(item => <NativeArticle key={item.id} className="cw-position-card">
                <NativeDiv className="cw-card-top"><NativeSpan className={`cw-category cw-category--${item.category}`}>{CATALOG_CATEGORY_LABELS[item.category]}</NativeSpan><CatalogStatus active={item.isActive}/></NativeDiv>
                <NativeDiv><NativeH3>{item.label}</NativeH3><NativeSpan className="cw-code">{item.code}</NativeSpan></NativeDiv>{item.description ? <NativeP>{item.description}</NativeP> : null}
                <NativeDiv className="cw-position-price"><NativeDiv><PriceInformation item={item}/></NativeDiv>{data.canEdit ? <NativeButton type="button" className="cw-button cw-button--small" aria-label={`${item.label} bearbeiten`} onClick={() => edit(item.id)}><CatalogIcon kind="edit"/>Bearbeiten</NativeButton> : null}</NativeDiv>
              </NativeArticle>)}</NativeDiv> : <NativeDiv className="cw-table-wrap"><NativeTable className="cw-table cw-table--positions"><NativeColgroup><NativeCol style={{ width: '31%' }}/><NativeCol style={{ width: '14%' }}/><NativeCol style={{ width: '25%' }}/><NativeCol style={{ width: '12%' }}/><NativeCol style={{ width: '18%' }}/></NativeColgroup><NativeThead><NativeTr><NativeTh scope="col">Position</NativeTh><NativeTh scope="col">Kategorie</NativeTh><NativeTh scope="col">Standardpreis</NativeTh><NativeTh scope="col">Status</NativeTh><NativeTh scope="col">{data.canEdit ? 'Aktion' : 'Einheit'}</NativeTh></NativeTr></NativeThead><NativeTbody>{filtered.map(item => <NativeTr key={item.id}>
                <NativeTd className="cw-main-cell"><NativeStrong>{item.label}</NativeStrong><NativeSmall>{item.code}</NativeSmall>{item.description ? <NativeSmall>{item.description}</NativeSmall> : null}</NativeTd><NativeTd data-label="Kategorie"><NativeSpan className={`cw-category cw-category--${item.category}`}>{CATALOG_CATEGORY_LABELS[item.category]}</NativeSpan></NativeTd><NativeTd data-label="Standardpreis"><PriceInformation item={item}/></NativeTd><NativeTd data-label="Status"><CatalogStatus active={item.isActive}/></NativeTd><NativeTd data-label={data.canEdit ? undefined : 'Einheit'}>{data.canEdit ? <NativeDiv className="cw-cell-actions"><NativeButton className="cw-button cw-button--small" type="button" aria-label={`${item.label} bearbeiten`} onClick={() => edit(item.id)}><CatalogIcon kind="edit"/>Bearbeiten</NativeButton></NativeDiv> : item.unit}</NativeTd>
              </NativeTr>)}</NativeTbody></NativeTable></NativeDiv>}
          </NativeSection>
          <NativeP className="cw-footnote">„Preis offen“ zählt aktive Positionen ohne heute gültigen Standardpreis. Ein zukünftiger Preis wird separat mit seinem Beginn angezeigt. Ein Preis von 0,00 € ist ein hinterlegter Preis.</NativeP>
        </>}
    </CatalogWorkspace>
    {editor && catalog && data.canEdit && data.tenantId ? <TenantServiceCatalogModal key={`${data.scope}:${catalog.moduleKey}:${editor.itemId ?? ''}:${editor.create}:${editor.templates}`} visible tenantId={data.tenantId} initialModuleKey={catalog.moduleKey} initialItemId={editor.itemId} startCreating={editor.create} startWithTemplates={editor.templates} effectivePermissions={data.permissions} onClose={() => setEditor(null)} onSaved={() => { setSaved(true); void data.refresh(); }}/> : null}
  </>;
}
