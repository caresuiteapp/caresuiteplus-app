import type { MainModuleKey } from '@/types/navigation/platform';
import { SpaceIconShell, type SpaceIconFrame } from './SpaceIconShell';
import { SpaceGlyph, type SpaceGlyphKind } from './spaceGlyphs';
import { ModuleRailGlyph } from './spaceModuleRailGlyphs';

type SpaceModuleIconProps = {
  moduleKey: MainModuleKey;
  accentColor: string;
  active?: boolean;
  size?: number;
  frame?: SpaceIconFrame;
};

/** Karten-/Allgemein-Ansicht — bestehende Modul-Glyphen. */
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

/** Epic Space-3D module glyph for the main rail. */
export function SpaceModuleIcon({
  moduleKey,
  accentColor,
  active = false,
  size = 40,
  frame = 'card',
}: SpaceModuleIconProps) {
  const rail = frame === 'rail';
  const iconSize = rail ? Math.round(size * 0.78) : size;

  return (
    <SpaceIconShell
      accentColor={accentColor}
      size={size}
      active={active}
      borderRadius={16}
      frame={frame}
    >
      {rail ? (
        <ModuleRailGlyph moduleKey={moduleKey} accent={accentColor} size={iconSize} />
      ) : (
        <SpaceGlyph kind={MODULE_GLYPH[moduleKey]} accent={accentColor} size={size} minimal={false} />
      )}
    </SpaceIconShell>
  );
}
