import { useId, type CSSProperties } from 'react';
import type { DesktopAreaKey } from '../navigation/desktopAreas';
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
  appearance?: 'header' | 'light';
  label?: string;
  scale?: number;
};

/** Native selection keeps keyboard, touch and disabled-module behavior consistent. */
export function DesktopAreaSwitcher({
  selectedArea, areas, onSelectArea, appearance = 'header', label = 'Desktop wechseln', scale = 1,
}: DesktopAreaSwitcherProps) {
  const id = useId();
  const style = { '--cs-desktop-area-scale': Math.max(1, Number.isFinite(scale) ? scale : 1) } as CSSProperties;

  return <>
    <style>{desktopAreaSwitcherCss}</style>
    <label className="cs-desktop-area-switcher" data-appearance={appearance} htmlFor={id} style={style}>
      <span className="cs-desktop-area-label-row">
        <span>Aktueller Desktop</span>
        <span className="cs-desktop-area-hint" aria-hidden="true">Desktop wechseln</span>
      </span>
      <span className="cs-desktop-area-control">
        <select id={id} aria-label={label} value={selectedArea}
          onChange={event => {
            const next = areas.find(area => area.key === event.currentTarget.value);
            if (next && !next.disabled && next.key !== selectedArea) onSelectArea(next.key);
          }}>
          {areas.map(area => <option key={area.key} value={area.key} disabled={area.disabled}>
            {area.label}{area.disabled ? ' · Nicht freigegeben' : ''}
          </option>)}
        </select>
        <span className="cs-desktop-area-chevron" aria-hidden="true"/>
      </span>
    </label>
  </>;
}
