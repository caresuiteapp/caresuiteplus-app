import { useMemo } from 'react';
import { SpaceIconShell, type SpaceIconFrame } from './SpaceIconShell';
import { SpaceGlyph } from './spaceGlyphs';
import { resolveSpaceGlyph } from './spaceIconRegistry';

type SpaceKpiIconProps = {
  icon?: string;
  accentColor: string;
  size?: number;
  active?: boolean;
  frame?: SpaceIconFrame;
};

/** Compact Space-3D icon — one unique glyph per function. */
export function SpaceKpiIcon({
  icon,
  accentColor,
  size = 32,
  active = false,
  frame = 'card',
}: SpaceKpiIconProps) {
  const glyph = useMemo(() => resolveSpaceGlyph(icon), [icon]);
  const borderRadius = size >= 40 ? 16 : 12;

  return (
    <SpaceIconShell
      accentColor={accentColor}
      size={size}
      active={active}
      borderRadius={borderRadius}
      frame={frame}
    >
      <SpaceGlyph kind={glyph} accent={accentColor} size={size} minimal={frame === 'rail'} />
    </SpaceIconShell>
  );
}

/** Notification bell in Space-3D style. */
export function SpaceBellIcon({
  accentColor,
  size = 28,
  active = false,
  frame = 'card',
}: {
  accentColor: string;
  size?: number;
  active?: boolean;
  frame?: SpaceIconFrame;
}) {
  return (
    <SpaceKpiIcon icon="bell" accentColor={accentColor} size={size} active={active} frame={frame} />
  );
}

/** Mandant / tenant chip icon in Space-3D style. */
export function SpaceMandantIcon({
  accentColor,
  size = 28,
  active = false,
}: {
  accentColor: string;
  size?: number;
  active?: boolean;
}) {
  return <SpaceKpiIcon icon="mandant" accentColor={accentColor} size={size} active={active} />;
}
