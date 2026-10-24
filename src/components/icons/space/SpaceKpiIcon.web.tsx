import { useMemo } from 'react';
import { SpaceIconShell, type SpaceIconFrame } from './SpaceIconShell';
import { SpaceGlyph } from './spaceGlyphs';
import { resolveSpaceGlyph } from './spaceIconRegistry';
import { SpaceGlyphStage } from './SpaceGlyphStage.web';
import { SPACE_GLYPH_DRAWING_SIZE } from './spaceGlyphGeometry.web';

type SpaceKpiIconProps = {
  icon?: string;
  accentColor: string;
  size?: number;
  active?: boolean;
  frame?: SpaceIconFrame;
};

/** The same semantic Space glyphs, proportionally scaled for Web/Desktop. */
export function SpaceKpiIcon({
  icon,
  accentColor,
  size = 32,
  active = false,
  frame = 'card',
}: SpaceKpiIconProps) {
  const glyph = useMemo(() => resolveSpaceGlyph(icon), [icon]);
  return (
    <SpaceIconShell
      accentColor={accentColor}
      size={size}
      active={active}
      borderRadius={size >= 40 ? 16 : 12}
      frame={frame}
    >
      <SpaceGlyphStage size={size} glyph={glyph}>
        <SpaceGlyph
          kind={glyph}
          accent={accentColor}
          size={SPACE_GLYPH_DRAWING_SIZE}
          minimal={frame === 'rail'}
        />
      </SpaceGlyphStage>
    </SpaceIconShell>
  );
}

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
  return <SpaceKpiIcon icon="bell" accentColor={accentColor} size={size} active={active} frame={frame} />;
}

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
