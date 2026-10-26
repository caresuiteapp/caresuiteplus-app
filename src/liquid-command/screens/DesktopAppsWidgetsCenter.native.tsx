// Generated native presentation from src/liquid-command/screens/DesktopAppsWidgetsCenter.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeSpan,NativeImg,NativeButton,NativeStyle,NativeLabel,NativeInput,NativeSection,NativeH2,NativeP,NativeStrong,NativeH3,NativeArticle,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import { PlatformModal } from "../../components/layout/platform/platformmodal.tsx";
import { DesktopAreaSwitcher, type DesktopAreaOption } from "../components/DesktopAreaSwitcher.native.tsx";
import { DesktopCatalogArtwork } from "../components/DesktopCatalogArtwork.tsx";
import type { DesktopAreaKey } from '../navigation/desktopAreas';
import type { DesktopApp } from "../navigation/desktopAppCatalog.native.ts";
import { DESKTOP_SLOT_COUNT, type BackgroundDefinition, type WidgetDefinition } from './administrationDesktopCatalog';
import { desktopAppsWidgetsCenterCss } from "./desktopAppsWidgetsCenterCss.native.ts";
export type DesktopCenterTab = 'apps' | 'widgets' | 'workflows' | 'backgrounds';
type DesktopWorkflow = {
    id: string;
    label: string;
    text: string;
    route: string;
    glyph: string;
};
export type DesktopAppsWidgetsCenterProps = {
    visible: boolean;
    onClose: () => void;
    areaLabel: string;
    selectedArea: DesktopAreaKey;
    areas: readonly DesktopAreaOption[];
    onSelectArea: (area: DesktopAreaKey) => void;
    initialTab: DesktopCenterTab;
    onTabChange?: (tab: DesktopCenterTab) => void;
    apps: readonly DesktopApp[];
    widgets: readonly WidgetDefinition[];
    workflows: readonly DesktopWorkflow[];
    backgrounds: readonly BackgroundDefinition[];
    desktopIds: readonly string[];
    backgroundId: string;
    recoverableCount: number;
    onRecover: () => void;
    onOpen: (route: string) => void;
    onToggleWidget: (id: string) => void;
    onMoveWidget: (id: string, direction: -1 | 1) => void;
    onBackground: (id: string) => void;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    onRetrySave: () => void;
};
const TABS = [
    { id: 'apps', label: 'Apps' }, { id: 'widgets', label: 'Widgets' },
    { id: 'workflows', label: 'Workflows' }, { id: 'backgrounds', label: 'Hintergründe' },
] as const;
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('de-DE').trim();
/** Metro exposes URI assets on web; retain the native Image fallback for numeric assets. */
function assetUri(source: ImageSourcePropType): string | undefined {
    if (typeof source === 'string')
        return source;
    if (source && typeof source === 'object' && !Array.isArray(source) && typeof source.uri === 'string')
        return source.uri;
    return undefined;
}
function BackgroundPreview({ background }: {
    background: BackgroundDefinition;
}) {
    const [failed, setFailed] = useState(false);
    const source = background.thumbnail ?? background.image;
    const uri = assetUri(source);
    return <NativeWorkspaceStyleScope css={[desktopAppsWidgetsCenterCss]}>{<NativeDiv className="cs-center-background-preview" aria-hidden="true">
    {failed ? <NativeSpan className="cs-center-preview-unavailable">Vorschau nicht verfügbar</NativeSpan> : uri ? <NativeImg src={uri} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)}/> : <Image source={source} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessible={false} onError={() => setFailed(true)}/>}
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
export function DesktopAppsWidgetsCenter({ visible, onClose, areaLabel, selectedArea, areas, onSelectArea, initialTab, onTabChange, apps, widgets, workflows, backgrounds, desktopIds, backgroundId, recoverableCount, onRecover, onOpen, onToggleWidget, onMoveWidget, onBackground, saveStatus, onRetrySave, }: DesktopAppsWidgetsCenterProps) {
    const effectiveScale = 1;
    const [tab, setTab] = useState<DesktopCenterTab>(initialTab);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('Alle');
    const [selectedOnly, setSelectedOnly] = useState(false);
    const tabs = useRef<Partial<Record<DesktopCenterTab, HTMLButtonElement | null>>>({});
    const id = useId();
    useEffect(() => {
        if (!visible)
            return;
        setTab(initialTab);
    }, [visible, initialTab]);
    useEffect(() => {
        if (!visible)
            return;
        setQuery('');
        setCategory('Alle');
        setSelectedOnly(false);
    }, [visible, selectedArea, initialTab]);
    const resetFilters = () => { setQuery(''); setCategory('Alle'); setSelectedOnly(false); };
    const selectTab = (next: DesktopCenterTab) => { setTab(next); onTabChange?.(next); resetFilters(); };
    const tabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: DesktopCenterTab) => {
        const index = TABS.findIndex(item => item.id === current);
        let next: DesktopCenterTab;
        if (event.key === 'ArrowRight')
            next = TABS[(index + 1) % TABS.length].id;
        else if (event.key === 'ArrowLeft')
            next = TABS[(index + TABS.length - 1) % TABS.length].id;
        else if (event.key === 'Home')
            next = TABS[0].id;
        else if (event.key === 'End')
            next = TABS[TABS.length - 1].id;
        else
            return;
        event.preventDefault();
        selectTab(next);
        tabs.current[next]?.focus();
    };
    const needle = normalize(query);
    const matches = (...values: (string | undefined)[]) => !needle || normalize(values.filter(Boolean).join(' ')).includes(needle);
    const categoryItems = tab === 'apps' ? apps : tab === 'widgets' ? widgets : [];
    const categories = ['Alle', ...Array.from(new Set(categoryItems.map(item => item.category)))];
    const activeCategory = categories.includes(category) ? category : 'Alle';
    const inCategory = (value: string) => !!needle || activeCategory === 'Alle' || activeCategory === value;
    const filteredApps = apps.filter(app => inCategory(app.category) && matches(app.label, app.description, app.group, app.category));
    const filteredWidgets = widgets.filter(widget => inCategory(widget.category) && matches(widget.label, widget.description, widget.category) && (!selectedOnly || desktopIds.includes(widget.id)));
    if (selectedOnly)
        filteredWidgets.sort((left, right) => desktopIds.indexOf(left.id) - desktopIds.indexOf(right.id));
    const filteredWorkflows = workflows.filter(workflow => matches(workflow.label, workflow.text));
    const filteredBackgrounds = backgrounds.filter(background => matches(background.label));
    const counts: Record<DesktopCenterTab, number> = { apps: apps.length, widgets: widgets.length, workflows: workflows.length, backgrounds: backgrounds.length };
    const resultCount = { apps: filteredApps.length, widgets: filteredWidgets.length, workflows: filteredWorkflows.length, backgrounds: filteredBackgrounds.length }[tab];
    const hasFilters = !!needle || activeCategory !== 'Alle' || (tab === 'widgets' && selectedOnly);
    const tabLabel = TABS.find(item => item.id === tab)!.label;
    const style = { '--cs-center-scale': Math.max(1, Number.isFinite(effectiveScale) ? effectiveScale : 1) } as CSSProperties;
    const pages = Math.ceil(desktopIds.length / DESKTOP_SLOT_COUNT);
    const descriptions: Record<DesktopCenterTab, string> = {
        apps: selectedArea === 'office' ? 'Öffnen Sie Ihre Office-Arbeitsbereiche.' : `Arbeitsbereiche für ${areaLabel} und gemeinsame Office-Apps.`,
        widgets: `Fügen Sie Widgets zu „Mein Desktop · ${areaLabel}“ hinzu. Office-Widgets können Sie auf mehreren Desktops verwenden. Auswahl und Reihenfolge speichern Sie für jeden Desktop getrennt.`,
        workflows: selectedArea === 'office' ? 'Häufige Abläufe für Office.' : `Häufige Abläufe für ${areaLabel} und gemeinsame Office-Abläufe.`,
        backgrounds: 'Wählen Sie den Hintergrund für Ihren Desktop. Die Änderung ist sofort sichtbar.',
    };
    if (!visible)
        return null;
    return <NativeWorkspaceStyleScope css={[desktopAppsWidgetsCenterCss, desktopAppsWidgetsCenterCss]}>{<PlatformModal surfaceScope="company" visible={visible} title="Apps & Widgets" onClose={onClose} maxWidth={1180} minWidth={260} maxHeightRatio={0.94} glowColor="#1764d4" bodyStyle={{ padding: 20, backgroundColor: '#f4f8fd', flexGrow: 0 }} sheetStyle={{ backgroundColor: '#f4f8fd' }} footerContent={<NativeDiv className="cs-apps-center-footer" style={style}>
      <NativeDiv className="cs-center-save-status" data-status={saveStatus} role={saveStatus === 'error' ? 'alert' : 'status'} aria-live="polite">
        <NativeSpan aria-hidden="true">{saveStatus === 'saved' ? '✓' : saveStatus === 'error' ? '!' : saveStatus === 'saving' ? '◷' : '○'}</NativeSpan>
        <NativeSpan>{saveStatus === 'saving' ? 'Auswahl wird gespeichert …' : saveStatus === 'saved' ? 'Auswahl auf diesem Gerät gespeichert.' : saveStatus === 'error' ? 'Die Auswahl konnte nicht gespeichert werden.' : 'Änderungen werden auf diesem Gerät automatisch gespeichert.'}</NativeSpan>
        {saveStatus === 'error' ? <NativeButton type="button" className="cs-center-retry" onClick={onRetrySave}>Speichern erneut versuchen</NativeButton> : null}
      </NativeDiv>
      <NativeButton type="button" className="cs-center-button" aria-label="Center schließen" onClick={onClose}>Fertig</NativeButton>
    </NativeDiv>}>
    <NativeStyle>{desktopAppsWidgetsCenterCss}</NativeStyle>
    <NativeDiv className="cs-apps-center" style={style} data-testid="desktop-apps-widgets-center">
      <DesktopAreaSwitcher selectedArea={selectedArea} areas={areas} onSelectArea={onSelectArea} scale={effectiveScale}/>
      <NativeDiv className="cs-center-toolbar">
        <NativeDiv className="cs-center-tabs" role="tablist" aria-label="Apps und Widgets">
          {TABS.map(item => <NativeButton type="button" className="cs-center-tab" key={item.id} id={`${id}-${item.id}-tab`} ref={node => { tabs.current[item.id] = node; }} role="tab" aria-selected={tab === item.id} aria-controls={`${id}-${item.id}-panel`} tabIndex={tab === item.id ? 0 : -1} onClick={() => selectTab(item.id)} onKeyDown={event => tabKeyDown(event, item.id)}>
            {item.label}<NativeSpan className="cs-center-tab-count" aria-hidden="true">{counts[item.id]}</NativeSpan>
          </NativeButton>)}
        </NativeDiv>
        <NativeLabel className="cs-center-search">
          <NativeSpan aria-hidden="true">⌕</NativeSpan>
          <NativeInput id={`${id}-center-search`} type="search" aria-label={`${tabLabel} durchsuchen`} placeholder={`${tabLabel} durchsuchen …`} value={query} onChange={event => { setQuery(event.target.value); setCategory('Alle'); }} autoComplete="off"/>
        </NativeLabel>
      </NativeDiv>

      {tab === 'apps' || tab === 'widgets' ? <NativeDiv className="cs-center-filters">
        <NativeDiv className="cs-center-chips" role="group" aria-label="Kategorien">
          {categories.map(item => <NativeButton type="button" key={item} className="cs-center-chip" aria-pressed={item === activeCategory} onClick={() => { setCategory(item); setQuery(''); }}>{item}<NativeSpan className="cs-center-chip-count" aria-hidden="true">{item === 'Alle' ? categoryItems.length : categoryItems.filter(entry => entry.category === item).length}</NativeSpan></NativeButton>)}
        </NativeDiv>
        {tab === 'widgets' ? <NativeDiv className="cs-center-selected-filter" role="group" aria-label="Widget-Auswahl">
          <NativeButton type="button" aria-pressed={!selectedOnly} onClick={() => setSelectedOnly(false)}>Alle</NativeButton>
          <NativeButton type="button" aria-pressed={selectedOnly} onClick={() => setSelectedOnly(true)}>Auf diesem Desktop</NativeButton>
        </NativeDiv> : null}
      </NativeDiv> : null}

      <NativeSection className="cs-center-panel" id={`${id}-${tab}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}-tab`} tabIndex={0}>
        <NativeDiv className="cs-center-section-heading">
          <NativeDiv><NativeH2>{tab === 'widgets' ? 'Ihr Desktop, Ihre Auswahl' : tab === 'workflows' ? 'Häufige Abläufe' : tab === 'backgrounds' ? 'Hintergrund auswählen' : 'Ihre Arbeitsbereiche'}</NativeH2><NativeP>{descriptions[tab]}</NativeP></NativeDiv>
          <NativeSpan className="cs-center-result-count" role="status" aria-live="polite">{resultCount} von {counts[tab]} {tabLabel}</NativeSpan>
        </NativeDiv>

        {tab === 'widgets' ? <NativeDiv className="cs-center-desktop-summary"><NativeStrong>{desktopIds.length} {desktopIds.length === 1 ? 'Widget' : 'Widgets'} auf „Mein Desktop · {areaLabel}“</NativeStrong><NativeSpan>{pages > 1 ? `Auf ${pages} Seiten verteilt.` : 'Neue Widgets werden am Ende ergänzt.'} Die Reihenfolge lässt sich unten ändern.</NativeSpan></NativeDiv> : null}
        {tab === 'widgets' && recoverableCount > 0 ? <NativeDiv className="cs-center-recovery"><NativeP>{recoverableCount} weitere {recoverableCount === 1 ? 'Widget ist' : 'Widgets sind'} aus Ihrer früheren Auswahl verfügbar.</NativeP><NativeButton type="button" className="cs-center-button" onClick={onRecover}>Gespeicherte Widgets wiederherstellen</NativeButton></NativeDiv> : null}

        {resultCount === 0 ? <NativeDiv className="cs-center-empty">
          <NativeSpan className="cs-center-glyph" aria-hidden="true">{hasFilters ? '⌕' : '▦'}</NativeSpan>
          <NativeH3>{hasFilters ? `Keine passenden ${tabLabel}` : `Keine ${tabLabel} in diesem Bereich`}</NativeH3>
          <NativeP>{hasFilters ? 'Versuchen Sie einen anderen Suchbegriff oder setzen Sie die Filter zurück.' : tab === 'workflows' ? `Für ${areaLabel} sind derzeit keine Ablaufvorschläge hinterlegt. Die verfügbaren Arbeitsbereiche finden Sie unter Apps.` : `Für ${areaLabel} sind derzeit keine ${tabLabel} verfügbar.`}</NativeP>
          {hasFilters ? <NativeButton type="button" className="cs-center-button" onClick={resetFilters}>Filter zurücksetzen</NativeButton> : tab === 'workflows' && apps.length > 0 ? <NativeButton type="button" className="cs-center-button" onClick={() => selectTab('apps')}>Apps ansehen</NativeButton> : null}
        </NativeDiv> : null}

        {tab === 'apps' ? <NativeDiv className="cs-center-grid" data-testid="center-app-catalog">
          {filteredApps.map(app => <NativeButton key={app.id} type="button" className="cs-center-card cs-center-app-card" aria-label={`App ${app.label} öffnen`} onClick={() => onOpen(app.route)}>
            <NativeDiv className="cs-center-card-heading"><NativeH3>{app.label}</NativeH3><NativeSpan className="cs-center-card-kind">{app.group ?? app.category}</NativeSpan></NativeDiv>
            <NativeDiv className="cs-center-artwork-preview"><DesktopCatalogArtwork route={app.route} label={app.label}/></NativeDiv>
            <NativeDiv className="cs-center-card-body"><NativeP className="cs-center-card-description">{app.description}</NativeP><NativeSpan className="cs-center-card-link">Arbeitsbereich öffnen <NativeSpan aria-hidden="true">↗</NativeSpan></NativeSpan></NativeDiv>
          </NativeButton>)}
        </NativeDiv> : null}

        {tab === 'widgets' ? <NativeDiv className="cs-center-grid" data-testid="center-widget-catalog">
          {filteredWidgets.map(widget => {
                const position = desktopIds.indexOf(widget.id);
                const pinned = position >= 0;
                return <NativeWorkspaceStyleScope css={[desktopAppsWidgetsCenterCss]}>{<NativeArticle key={widget.id} className="cs-center-card cs-center-widget-card" data-selected={pinned}>
              <NativeDiv className="cs-center-card-heading cs-center-widget-heading"><NativeDiv><NativeH3>{widget.label}</NativeH3><NativeSpan className="cs-center-card-kind">{widget.category}</NativeSpan></NativeDiv><NativeSpan className={`cs-center-badge${pinned ? '' : ' cs-center-badge-muted'}`}>{pinned ? '✓ Auf diesem Desktop' : widget.workspaceService ? 'Live-Widget' : 'Schnellzugriff'}</NativeSpan></NativeDiv>
              <NativeDiv className="cs-center-artwork-preview cs-center-widget-preview"><DesktopCatalogArtwork route={widget.route} label={widget.label} images={widget.images}/></NativeDiv>
              <NativeDiv className="cs-center-card-body cs-center-widget-body"><NativeP className="cs-center-card-description">{widget.description}</NativeP>
                <NativeDiv className="cs-center-widget-actions"><NativeButton type="button" className={`cs-center-button${pinned ? ' cs-center-button-neutral' : ''}`} aria-label={`${widget.label} ${pinned ? 'vom Desktop entfernen' : 'zum Desktop hinzufügen'}`} onClick={() => onToggleWidget(widget.id)}>{pinned ? '− Vom Desktop entfernen' : '+ Zum Desktop hinzufügen'}</NativeButton>
                  {pinned ? <NativeDiv className="cs-center-reorder"><NativeSpan>Position {position + 1}</NativeSpan><NativeButton type="button" aria-label={`${widget.label} nach vorne verschieben`} title="Nach vorne verschieben" disabled={position === 0} onClick={() => onMoveWidget(widget.id, -1)}>↑</NativeButton><NativeButton type="button" aria-label={`${widget.label} nach hinten verschieben`} title="Nach hinten verschieben" disabled={position === desktopIds.length - 1} onClick={() => onMoveWidget(widget.id, 1)}>↓</NativeButton></NativeDiv> : null}
                </NativeDiv>
              </NativeDiv>
            </NativeArticle>}</NativeWorkspaceStyleScope>;
            })}
        </NativeDiv> : null}

        {tab === 'workflows' ? <NativeDiv className="cs-center-grid" data-testid="center-workflow-catalog">
          {filteredWorkflows.map(workflow => <NativeButton key={workflow.id} type="button" className="cs-center-card cs-center-workflow-card" aria-label={`${workflow.label}: Ablauf öffnen`} onClick={() => onOpen(workflow.route)}>
            <NativeDiv className="cs-center-card-heading"><NativeH3>{workflow.label}</NativeH3><NativeSpan className="cs-center-card-kind">{areaLabel}</NativeSpan></NativeDiv>
            <NativeDiv className="cs-center-artwork-preview"><DesktopCatalogArtwork route={workflow.route} label={workflow.label}/></NativeDiv>
            <NativeDiv className="cs-center-card-body"><NativeP className="cs-center-card-description">{workflow.text}</NativeP><NativeSpan className="cs-center-card-link">Ablauf öffnen <NativeSpan aria-hidden="true">↗</NativeSpan></NativeSpan></NativeDiv>
          </NativeButton>)}
        </NativeDiv> : null}

        {tab === 'backgrounds' ? <NativeDiv className="cs-center-grid" data-testid="center-background-catalog">
          {filteredBackgrounds.map(background => <NativeButton key={background.id} type="button" className="cs-center-card cs-center-background-card" data-selected={background.id === backgroundId} aria-pressed={background.id === backgroundId} aria-label={`${background.label} als Desktop-Hintergrund verwenden`} onClick={() => onBackground(background.id)}>
            <BackgroundPreview background={background}/><NativeDiv className="cs-center-background-footer"><NativeDiv><NativeH3>{background.label}</NativeH3><NativeSpan className="cs-center-card-kind">{background.id === backgroundId ? 'Aktiver Hintergrund' : 'Auswählen'}</NativeSpan></NativeDiv><NativeSpan className="cs-center-background-check" aria-hidden="true">{background.id === backgroundId ? '✓' : '+'}</NativeSpan></NativeDiv>
          </NativeButton>)}
        </NativeDiv> : null}
      </NativeSection>
      {TABS.filter(item => item.id !== tab).map(item => <NativeSection key={item.id} id={`${id}-${item.id}-panel`} role="tabpanel" aria-labelledby={`${id}-${item.id}-tab`} hidden/>)}
    </NativeDiv>
  </PlatformModal>}</NativeWorkspaceStyleScope>;
}
