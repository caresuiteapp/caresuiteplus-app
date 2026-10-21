import { useId, type CSSProperties } from 'react';
import type { DesktopAreaKey } from '../navigation/desktopAreas';
import { DesktopCatalogArtwork } from './DesktopCatalogArtwork.web';
import { desktopAreaSwitcherCss } from './desktopAreaSwitcherCss.web';

export type DesktopAreaOption = {
  key: DesktopAreaKey;
  label: string;
  disabled?: boolean;
};

export type DesktopAreaSwitcherProps = {
  selectedArea: DesktopAreaKey;
  areas: readonly DesktopAreaOption[];
  onSelectArea: (area: DesktopAreaKey) => void;
  scale?: number;
};

const ARTWORK_ROUTES: Record<DesktopAreaKey, string> = {
  office: '/office', assist: '/assist', pflege: '/pflege', stationaer: '/stationaer',
  beratung: '/beratung', akademie: '/akademie', robotics: '/robotics', premium: '/business/subscription', settings: '/settings',
};

/** All catalogue areas stay visible; native buttons retain keyboard and permission behavior. */
export function DesktopAreaSwitcher({
  selectedArea, areas, onSelectArea, scale = 1,
}: DesktopAreaSwitcherProps) {
  const id = useId();
  const selectedLabel = areas.find(area => area.key === selectedArea)?.label ?? selectedArea;
  const style = { '--cs-desktop-area-scale': Math.max(1, Number.isFinite(scale) ? scale : 1) } as CSSProperties;

  return <>
    <style>{desktopAreaSwitcherCss}</style>
    <section className="cs-desktop-area-switcher" style={style} aria-labelledby={`${id}-heading`}>
      <div className="cs-desktop-area-heading">
        <h2 id={`${id}-heading`}>Desktop wechseln</h2>
        <span className="cs-desktop-area-current"><span aria-hidden="true"/>Aktueller Desktop: <strong>{selectedLabel}</strong></span>
      </div>
      <div className="cs-desktop-area-options" role="group" aria-label="Desktop im Katalog wechseln">
        {areas.map(area => {
          const selected = area.key === selectedArea;
          return <button type="button" key={area.key} className="cs-desktop-area-option"
            aria-label={`${area.label}-Desktop auswählen`} aria-pressed={selected} disabled={area.disabled}
            aria-describedby={area.disabled ? `${id}-${area.key}-status` : undefined}
            onClick={() => { if (!area.disabled && !selected) onSelectArea(area.key); }}>
            <DesktopCatalogArtwork route={ARTWORK_ROUTES[area.key]} label={area.label}
              className="cs-desktop-area-artwork" size="2.5em"/>
            <span className="cs-desktop-area-name">{area.label}</span>
            <span className="cs-desktop-area-status" id={`${id}-${area.key}-status`}>
              {area.disabled ? 'Nicht freigegeben' : selected ? 'Aktiv' : ' '}
            </span>
            {selected ? <span className="cs-desktop-area-check" aria-hidden="true">✓</span> : null}
          </button>;
        })}
      </div>
    </section>
  </>;
}
