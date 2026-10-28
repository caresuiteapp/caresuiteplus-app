// Generated native presentation from src/liquid-command/components/DesktopAreaSwitcher.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeStyle,NativeSection,NativeDiv,NativeH2,NativeSpan,NativeStrong,NativeButton,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useId, type CSSProperties } from 'react';
import type { DesktopAreaKey } from '../navigation/desktopAreas';
import { DesktopCatalogArtwork } from "./DesktopCatalogArtwork.tsx";
import { desktopAreaSwitcherCss } from "./desktopAreaSwitcherCss.native.ts";
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
export function DesktopAreaSwitcher({ selectedArea, areas, onSelectArea, scale = 1, }: DesktopAreaSwitcherProps) {
    const id = useId();
    const selectedLabel = areas.find(area => area.key === selectedArea)?.label ?? selectedArea;
    const style = { '--cs-desktop-area-scale': Math.max(1, Number.isFinite(scale) ? scale : 1) } as CSSProperties;
    return <NativeWorkspaceStyleScope css={[desktopAreaSwitcherCss, desktopAreaSwitcherCss]}>{<>
    <NativeStyle>{desktopAreaSwitcherCss}</NativeStyle>
    <NativeSection className="cs-desktop-area-switcher" style={style} aria-labelledby={`${id}-heading`}>
      <NativeDiv className="cs-desktop-area-heading">
        <NativeH2 id={`${id}-heading`}>Desktop wechseln</NativeH2>
        <NativeSpan className="cs-desktop-area-current"><NativeSpan aria-hidden="true"/>Aktueller Desktop: <NativeStrong>{selectedLabel}</NativeStrong></NativeSpan>
      </NativeDiv>
      <NativeDiv className="cs-desktop-area-options" role="group" aria-label="Desktop im Katalog wechseln">
        {areas.map(area => {
            const selected = area.key === selectedArea;
            return <NativeWorkspaceStyleScope key={area.key} css={[desktopAreaSwitcherCss]}>{<NativeButton type="button" key={area.key} className="cs-desktop-area-option" aria-label={`${area.label}-Desktop auswählen`} aria-pressed={selected} disabled={area.disabled} aria-describedby={area.disabled ? `${id}-${area.key}-status` : undefined} onClick={() => { if (!area.disabled && !selected)
                onSelectArea(area.key); }}>
            <DesktopCatalogArtwork route={ARTWORK_ROUTES[area.key]} label={area.label} size={40}/>
            <NativeSpan className="cs-desktop-area-name">{area.label}</NativeSpan>
            <NativeSpan className="cs-desktop-area-status" id={`${id}-${area.key}-status`}>
              {area.disabled ? 'Nicht freigegeben' : selected ? 'Aktiv' : ' '}
            </NativeSpan>
            {selected ? <NativeSpan className="cs-desktop-area-check" aria-hidden="true">✓</NativeSpan> : null}
          </NativeButton>}</NativeWorkspaceStyleScope>;
        })}
      </NativeDiv>
    </NativeSection>
  </>}</NativeWorkspaceStyleScope>;
}
