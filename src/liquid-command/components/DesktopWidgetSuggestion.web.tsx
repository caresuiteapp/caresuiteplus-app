import { useId, type CSSProperties } from 'react';
import type { WidgetDefinition } from '../screens/administrationDesktopCatalog';
import { DesktopCatalogArtwork } from './DesktopCatalogArtwork.web';

export type DesktopWidgetSuggestionProps = {
  widget: WidgetDefinition;
  areaLabel: string;
  fontScale: number;
  onAccept: () => void;
  onChooseOther: () => void;
  onDismiss: () => void;
};

const SHORT_DESCRIPTIONS: Readonly<Partial<Record<string, string>>> = {
  '/beratung/arbeitsplatz': 'Pflegeberatung und Schulungen',
  '/business/office/clients': 'Stammdaten und Kontakte im Blick',
  '/business/connect/google-workspace?service=calendar': 'Termine im Blick behalten',
  '/business/office/document-catalog': 'Passende Vorlagen auswählen',
  '/office/notizen': 'Gedanken und Aufgaben festhalten',
  '/business/messages': 'Mit dem Team kommunizieren',
};

/** Suggestions stay decorative until the user adds one to this desktop. */
export function DesktopWidgetSuggestion({
  widget, areaLabel, fontScale, onAccept, onChooseOther, onDismiss,
}: DesktopWidgetSuggestionProps) {
  const id = useId();
  const style = {
    '--cs-desktop-suggestion-scale': Math.max(1, Number.isFinite(fontScale) ? fontScale : 1),
  } as CSSProperties;

  return <article className="cs-desktop-suggestion" style={style} lang="de"
    aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    data-testid="desktop-widget-suggestion" data-widget-id={widget.id}
    data-widget-route={widget.route} data-widget-suggestion-route={widget.route}>
    <div className="cs-desktop-suggestion-heading">
      <button type="button" className="cs-desktop-suggestion-dismiss"
        aria-label={`${widget.label} als Vorschlag auf ${areaLabel} ausblenden`}
        title="Vorschlag ausblenden" onClick={onDismiss}>
        <span aria-hidden="true">×</span>
      </button>
      <span className="cs-desktop-suggestion-badge">Für {areaLabel} empfohlen</span>
      <h3 id={`${id}-title`} className="cs-desktop-suggestion-title">{widget.label}</h3>
    </div>
    <div className="cs-desktop-suggestion-body">
      <p id={`${id}-description`} className="cs-desktop-suggestion-description"
        title={SHORT_DESCRIPTIONS[widget.route] ?? widget.description}>
        {SHORT_DESCRIPTIONS[widget.route] ?? widget.description}
      </p>
      <div className="cs-desktop-suggestion-artwork">
        <DesktopCatalogArtwork route={widget.route} label={widget.label} images={widget.images}/>
      </div>
    </div>
    <div className="cs-desktop-suggestion-actions">
      <button type="button" className="cs-desktop-suggestion-accept"
        aria-label={`${widget.label} auf ${areaLabel} übernehmen`} onClick={onAccept}>
        <span aria-hidden="true">＋</span><span>Übernehmen</span>
      </button>
      <button type="button" className="cs-desktop-suggestion-other"
        aria-label={`Andere Widgets für ${areaLabel} auswählen`} onClick={onChooseOther}>
        Andere Widgets
      </button>
    </div>
  </article>;
}
