import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { useWebFontScale } from '@/design/web/WebFontScaleProvider';
import { DesktopAreaSwitcher, type DesktopAreaOption } from '../components/DesktopAreaSwitcher.web';
import { DesktopCatalogArtwork } from '../components/DesktopCatalogArtwork.web';
import type { DesktopAreaKey } from '../navigation/desktopAreas';
import type { DesktopApp } from '../navigation/desktopAppCatalog.web';
import { DESKTOP_SLOT_COUNT, type BackgroundDefinition, type WidgetDefinition } from './administrationDesktopCatalog';
import { desktopAppsWidgetsCenterCss } from './desktopAppsWidgetsCenterCss.web';

export type DesktopCenterTab = 'apps' | 'widgets' | 'workflows' | 'backgrounds';
type DesktopWorkflow = { id: string; label: string; text: string; route: string; glyph: string };

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
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && !Array.isArray(source) && typeof source.uri === 'string') return source.uri;
  return undefined;
}

function BackgroundPreview({ background }: { background: BackgroundDefinition }) {
  const [failed, setFailed] = useState(false);
  const source = background.thumbnail ?? background.image;
  const uri = assetUri(source);
  return <div className="cs-center-background-preview" aria-hidden="true">
    {failed ? <span className="cs-center-preview-unavailable">Vorschau nicht verfügbar</span> : uri ? <img src={uri} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)}/> : <Image source={source} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessible={false} onError={() => setFailed(true)}/>}
  </div>;
}

export function DesktopAppsWidgetsCenter({
  visible, onClose, areaLabel, selectedArea, areas, onSelectArea, initialTab, onTabChange, apps, widgets, workflows, backgrounds,
  desktopIds, backgroundId, recoverableCount, onRecover, onOpen, onToggleWidget,
  onMoveWidget, onBackground, saveStatus, onRetrySave,
}: DesktopAppsWidgetsCenterProps) {
  const { effectiveScale } = useWebFontScale();
  const [tab, setTab] = useState<DesktopCenterTab>(initialTab);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Alle');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const tabs = useRef<Partial<Record<DesktopCenterTab, HTMLButtonElement | null>>>({});
  const id = useId();

  useEffect(() => {
    if (!visible) return;
    setTab(initialTab);
  }, [visible, initialTab]);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setCategory('Alle');
    setSelectedOnly(false);
  }, [visible, selectedArea, initialTab]);

  const resetFilters = () => { setQuery(''); setCategory('Alle'); setSelectedOnly(false); };
  const selectTab = (next: DesktopCenterTab) => { setTab(next); onTabChange?.(next); resetFilters(); };
  const tabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: DesktopCenterTab) => {
    const index = TABS.findIndex(item => item.id === current);
    let next: DesktopCenterTab;
    if (event.key === 'ArrowRight') next = TABS[(index + 1) % TABS.length].id;
    else if (event.key === 'ArrowLeft') next = TABS[(index + TABS.length - 1) % TABS.length].id;
    else if (event.key === 'Home') next = TABS[0].id;
    else if (event.key === 'End') next = TABS[TABS.length - 1].id;
    else return;
    event.preventDefault(); selectTab(next); tabs.current[next]?.focus();
  };

  const needle = normalize(query);
  const matches = (...values: (string | undefined)[]) => !needle || normalize(values.filter(Boolean).join(' ')).includes(needle);
  const categoryItems = tab === 'apps' ? apps : tab === 'widgets' ? widgets : [];
  const categories = ['Alle', ...Array.from(new Set(categoryItems.map(item => item.category)))];
  const activeCategory = categories.includes(category) ? category : 'Alle';
  const inCategory = (value: string) => !!needle || activeCategory === 'Alle' || activeCategory === value;
  const filteredApps = apps.filter(app => inCategory(app.category) && matches(app.label, app.description, app.group, app.category));
  const filteredWidgets = widgets.filter(widget => inCategory(widget.category) && matches(widget.label, widget.description, widget.category) && (!selectedOnly || desktopIds.includes(widget.id)));
  if (selectedOnly) filteredWidgets.sort((left, right) => desktopIds.indexOf(left.id) - desktopIds.indexOf(right.id));
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

  if (!visible) return null;

  return <PlatformModal surfaceScope="company" visible={visible} title="Apps & Widgets"
    onClose={onClose} maxWidth={1180} minWidth={260} maxHeightRatio={0.94} glowColor="#1764d4"
    bodyStyle={{ padding: 20, backgroundColor: '#f4f8fd', flexGrow: 0 }} sheetStyle={{ backgroundColor: '#f4f8fd' }}
    footerContent={<div className="cs-apps-center-footer" style={style}>
      <div className="cs-center-save-status" data-status={saveStatus} role={saveStatus === 'error' ? 'alert' : 'status'} aria-live="polite">
        <span aria-hidden="true">{saveStatus === 'saved' ? '✓' : saveStatus === 'error' ? '!' : saveStatus === 'saving' ? '◷' : '○'}</span>
        <span>{saveStatus === 'saving' ? 'Auswahl wird gespeichert …' : saveStatus === 'saved' ? 'Auswahl auf diesem Gerät gespeichert.' : saveStatus === 'error' ? 'Die Auswahl konnte nicht gespeichert werden.' : 'Änderungen werden auf diesem Gerät automatisch gespeichert.'}</span>
        {saveStatus === 'error' ? <button type="button" className="cs-center-retry" onClick={onRetrySave}>Speichern erneut versuchen</button> : null}
      </div>
      <button type="button" className="cs-center-button" aria-label="Center schließen" onClick={onClose}>Fertig</button>
    </div>}>
    <style>{desktopAppsWidgetsCenterCss}</style>
    <div className="cs-apps-center" style={style} data-testid="desktop-apps-widgets-center">
      <DesktopAreaSwitcher selectedArea={selectedArea} areas={areas} onSelectArea={onSelectArea} scale={effectiveScale}/>
      <div className="cs-center-toolbar">
        <div className="cs-center-tabs" role="tablist" aria-label="Apps und Widgets">
          {TABS.map(item => <button type="button" className="cs-center-tab" key={item.id} id={`${id}-${item.id}-tab`}
            ref={node => { tabs.current[item.id] = node; }} role="tab" aria-selected={tab === item.id}
            aria-controls={`${id}-${item.id}-panel`} tabIndex={tab === item.id ? 0 : -1}
            onClick={() => selectTab(item.id)} onKeyDown={event => tabKeyDown(event, item.id)}>
            {item.label}<span className="cs-center-tab-count" aria-hidden="true">{counts[item.id]}</span>
          </button>)}
        </div>
        <label className="cs-center-search">
          <span aria-hidden="true">⌕</span>
          <input id={`${id}-center-search`} type="search" aria-label={`${tabLabel} durchsuchen`} placeholder={`${tabLabel} durchsuchen …`}
            value={query} onChange={event => { setQuery(event.target.value); setCategory('Alle'); }} autoComplete="off"/>
        </label>
      </div>

      {tab === 'apps' || tab === 'widgets' ? <div className="cs-center-filters">
        <div className="cs-center-chips" role="group" aria-label="Kategorien">
          {categories.map(item => <button type="button" key={item} className="cs-center-chip" aria-pressed={item === activeCategory}
            onClick={() => { setCategory(item); setQuery(''); }}>{item}<span className="cs-center-chip-count" aria-hidden="true">{item === 'Alle' ? categoryItems.length : categoryItems.filter(entry => entry.category === item).length}</span></button>)}
        </div>
        {tab === 'widgets' ? <div className="cs-center-selected-filter" role="group" aria-label="Widget-Auswahl">
          <button type="button" aria-pressed={!selectedOnly} onClick={() => setSelectedOnly(false)}>Alle</button>
          <button type="button" aria-pressed={selectedOnly} onClick={() => setSelectedOnly(true)}>Auf diesem Desktop</button>
        </div> : null}
      </div> : null}

      <section className="cs-center-panel" id={`${id}-${tab}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}-tab`} tabIndex={0}>
        <div className="cs-center-section-heading">
          <div><h2>{tab === 'widgets' ? 'Ihr Desktop, Ihre Auswahl' : tab === 'workflows' ? 'Häufige Abläufe' : tab === 'backgrounds' ? 'Hintergrund auswählen' : 'Ihre Arbeitsbereiche'}</h2><p>{descriptions[tab]}</p></div>
          <span className="cs-center-result-count" role="status" aria-live="polite">{resultCount} von {counts[tab]} {tabLabel}</span>
        </div>

        {tab === 'widgets' ? <div className="cs-center-desktop-summary"><strong>{desktopIds.length} {desktopIds.length === 1 ? 'Widget' : 'Widgets'} auf „Mein Desktop · {areaLabel}“</strong><span>{pages > 1 ? `Auf ${pages} Seiten verteilt.` : 'Neue Widgets werden am Ende ergänzt.'} Die Reihenfolge lässt sich unten ändern.</span></div> : null}
        {tab === 'widgets' && recoverableCount > 0 ? <div className="cs-center-recovery"><p>{recoverableCount} weitere {recoverableCount === 1 ? 'Widget ist' : 'Widgets sind'} aus Ihrer früheren Auswahl verfügbar.</p><button type="button" className="cs-center-button" onClick={onRecover}>Gespeicherte Widgets wiederherstellen</button></div> : null}

        {resultCount === 0 ? <div className="cs-center-empty">
          <span className="cs-center-glyph" aria-hidden="true">{hasFilters ? '⌕' : '▦'}</span>
          <h3>{hasFilters ? `Keine passenden ${tabLabel}` : `Keine ${tabLabel} in diesem Bereich`}</h3>
          <p>{hasFilters ? 'Versuchen Sie einen anderen Suchbegriff oder setzen Sie die Filter zurück.' : tab === 'workflows' ? `Für ${areaLabel} sind derzeit keine Ablaufvorschläge hinterlegt. Die verfügbaren Arbeitsbereiche finden Sie unter Apps.` : `Für ${areaLabel} sind derzeit keine ${tabLabel} verfügbar.`}</p>
          {hasFilters ? <button type="button" className="cs-center-button" onClick={resetFilters}>Filter zurücksetzen</button> : tab === 'workflows' && apps.length > 0 ? <button type="button" className="cs-center-button" onClick={() => selectTab('apps')}>Apps ansehen</button> : null}
        </div> : null}

        {tab === 'apps' ? <div className="cs-center-grid" data-testid="center-app-catalog">
          {filteredApps.map(app => <button key={app.id} type="button" className="cs-center-card cs-center-app-card" aria-label={`App ${app.label} öffnen`} onClick={() => onOpen(app.route)}>
            <div className="cs-center-card-heading"><h3>{app.label}</h3><span className="cs-center-card-kind">{app.group ?? app.category}</span></div>
            <div className="cs-center-artwork-preview"><DesktopCatalogArtwork route={app.route} label={app.label}/></div>
            <div className="cs-center-card-body"><p className="cs-center-card-description">{app.description}</p><span className="cs-center-card-link">Arbeitsbereich öffnen <span aria-hidden="true">↗</span></span></div>
          </button>)}
        </div> : null}

        {tab === 'widgets' ? <div className="cs-center-grid" data-testid="center-widget-catalog">
          {filteredWidgets.map(widget => {
            const position = desktopIds.indexOf(widget.id);
            const pinned = position >= 0;
            return <article key={widget.id} className="cs-center-card cs-center-widget-card" data-selected={pinned}>
              <div className="cs-center-card-heading cs-center-widget-heading"><div><h3>{widget.label}</h3><span className="cs-center-card-kind">{widget.category}</span></div><span className={`cs-center-badge${pinned ? '' : ' cs-center-badge-muted'}`}>{pinned ? '✓ Auf diesem Desktop' : widget.workspaceService ? 'Live-Widget' : 'Schnellzugriff'}</span></div>
              <div className="cs-center-artwork-preview cs-center-widget-preview"><DesktopCatalogArtwork route={widget.route} label={widget.label} images={widget.images}/></div>
              <div className="cs-center-card-body cs-center-widget-body"><p className="cs-center-card-description">{widget.description}</p>
                <div className="cs-center-widget-actions"><button type="button" className={`cs-center-button${pinned ? ' cs-center-button-neutral' : ''}`}
                  aria-label={`${widget.label} ${pinned ? 'vom Desktop entfernen' : 'zum Desktop hinzufügen'}`} onClick={() => onToggleWidget(widget.id)}>{pinned ? '− Vom Desktop entfernen' : '+ Zum Desktop hinzufügen'}</button>
                  {pinned ? <div className="cs-center-reorder"><span>Position {position + 1}</span><button type="button" aria-label={`${widget.label} nach vorne verschieben`} title="Nach vorne verschieben" disabled={position === 0} onClick={() => onMoveWidget(widget.id, -1)}>↑</button><button type="button" aria-label={`${widget.label} nach hinten verschieben`} title="Nach hinten verschieben" disabled={position === desktopIds.length - 1} onClick={() => onMoveWidget(widget.id, 1)}>↓</button></div> : null}
                </div>
              </div>
            </article>;
          })}
        </div> : null}

        {tab === 'workflows' ? <div className="cs-center-grid" data-testid="center-workflow-catalog">
          {filteredWorkflows.map(workflow => <button key={workflow.id} type="button" className="cs-center-card cs-center-workflow-card" aria-label={`${workflow.label}: Ablauf öffnen`} onClick={() => onOpen(workflow.route)}>
            <div className="cs-center-card-heading"><h3>{workflow.label}</h3><span className="cs-center-card-kind">{areaLabel}</span></div>
            <div className="cs-center-artwork-preview"><DesktopCatalogArtwork route={workflow.route} label={workflow.label}/></div>
            <div className="cs-center-card-body"><p className="cs-center-card-description">{workflow.text}</p><span className="cs-center-card-link">Ablauf öffnen <span aria-hidden="true">↗</span></span></div>
          </button>)}
        </div> : null}

        {tab === 'backgrounds' ? <div className="cs-center-grid" data-testid="center-background-catalog">
          {filteredBackgrounds.map(background => <button key={background.id} type="button" className="cs-center-card cs-center-background-card" data-selected={background.id === backgroundId} aria-pressed={background.id === backgroundId} aria-label={`${background.label} als Desktop-Hintergrund verwenden`} onClick={() => onBackground(background.id)}>
            <BackgroundPreview background={background}/><div className="cs-center-background-footer"><div><h3>{background.label}</h3><span className="cs-center-card-kind">{background.id === backgroundId ? 'Aktiver Hintergrund' : 'Auswählen'}</span></div><span className="cs-center-background-check" aria-hidden="true">{background.id === backgroundId ? '✓' : '+'}</span></div>
          </button>)}
        </div> : null}
      </section>
      {TABS.filter(item => item.id !== tab).map(item => <section key={item.id} id={`${id}-${item.id}-panel`} role="tabpanel" aria-labelledby={`${id}-${item.id}-tab`} hidden/>)}
    </div>
  </PlatformModal>;
}

