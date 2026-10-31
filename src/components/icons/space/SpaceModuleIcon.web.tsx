import type { MainModuleKey } from '@/types/navigation/platform';
import { SpaceIconShell, type SpaceIconFrame } from './SpaceIconShell';
import { SpaceGlyph, type SpaceGlyphKind } from './spaceGlyphs';
import { ModuleRailGlyph } from './spaceModuleRailGlyphs';
import { SpaceGlyphStage } from './SpaceGlyphStage.web';
import { SPACE_GLYPH_DRAWING_SIZE } from './spaceGlyphGeometry.web';

type SpaceModuleIconProps = {
  moduleKey: MainModuleKey;
  accentColor: string;
  active?: boolean;
  size?: number;
  frame?: SpaceIconFrame;
};

const MODULE_GLYPH: Record<MainModuleKey, SpaceGlyphKind> = {
  zentrale: 'homeOrbit',
  office: 'office',
  assist: 'assignmentRoute',
  pflege: 'medical',
  stationaer: 'ward',
  beratung: 'messageWave',
  akademie: 'scholar',
  admin: 'gear',
};

/** Keep module-specific motifs and glass states at every supported Web size. */
export function SpaceModuleIcon({
  moduleKey,
  accentColor,
  active = false,
  size = 40,
  frame = 'card',
}: SpaceModuleIconProps) {
  const rail = frame === 'rail';
  const glyph = MODULE_GLYPH[moduleKey];
  return (
    <SpaceIconShell accentColor={accentColor} size={size} active={active} borderRadius={16} frame={frame}>
      <SpaceGlyphStage size={size} glyph={rail ? undefined : glyph}>
        {rail ? (
          <ModuleRailGlyph moduleKey={moduleKey} accent={accentColor} size={SPACE_GLYPH_DRAWING_SIZE} />
        ) : (
          <SpaceGlyph kind={glyph} accent={accentColor} size={SPACE_GLYPH_DRAWING_SIZE} minimal={false} />
        )}
      </SpaceGlyphStage>
    </SpaceIconShell>
  );
}
