import type { SpaceGlyphKind } from './spaceGlyphs';
import { SPACE_MODULE_KPI_GLYPH_KINDS } from './spaceModuleKpiGlyphs';

/** Every shell-visible icon resolves to exactly one Space-3D glyph — no shared targets. */
export const SPACE_GLYPH_KINDS = [
  'orbit',
  'office',
  'care',
  'medical',
  'ward',
  'holoWave',
  'scholar',
  'gear',
  'addClient',
  'invoice',
  'calendar',
  'uploadFolder',
  'teamGroup',
  'teamRoles',
  'personSingle',
  'kpiChart',
  'trendChart',
  'taskCheck',
  'qmShield',
  'pluginCrystal',
  'connectPlug',
  'subscriptionCard',
  'auditTrail',
  'radarPing',
  'insightScope',
  'bell',
  'mandant',
  'helpOrb',
  'lockShield',
  'dataRights',
  'infoBeacon',
  'employeeBadge',
  'assignmentRoute',
  'taskTick',
  'modulesActive',
  'portalGlobe',
  'docsReview',
  'portalInbox',
  'serviceRecord',
  'budgetWarn',
  'weekPlanner',
  'sparkleNew',
  'clientsRoster',
  'messageWave',
  'homeOrbit',
  'livePulse',
  'opsConsole',
  ...SPACE_MODULE_KPI_GLYPH_KINDS,
] as const satisfies readonly SpaceGlyphKind[];

const GLYPH_SET = new Set<string>(SPACE_GLYPH_KINDS);

export function isSpaceGlyphKind(value: string): value is SpaceGlyphKind {
  return GLYPH_SET.has(value);
}

/** Legacy emoji → unique glyph (1:1). Prefer `SpaceGlyphKind` strings in config directly. */
const EMOJI_TO_GLYPH: Record<string, SpaceGlyphKind> = {
  '🏠': 'homeOrbit',
  '🏢': 'mandant',
  '🤝': 'care',
  '💊': 'medical',
  '🏥': 'ward',
  '💬': 'messageWave',
  '🎓': 'scholar',
  '⚙️': 'gear',
  '➕': 'addClient',
  '🧾': 'invoice',
  '📅': 'calendar',
  '📁': 'uploadFolder',
  '👥': 'teamGroup',
  '👤': 'personSingle',
  '📊': 'kpiChart',
  '📈': 'trendChart',
  '✅': 'taskCheck',
  '🧩': 'pluginCrystal',
  '🔌': 'connectPlug',
  '💳': 'subscriptionCard',
  '📋': 'clientsRoster',
  '🛰️': 'radarPing',
  '📡': 'insightScope',
  '🔔': 'bell',
  '❓': 'helpOrb',
  '🔒': 'lockShield',
  'ℹ️': 'infoBeacon',
  '🧑‍💼': 'employeeBadge',
  '✓': 'taskTick',
  '⬡': 'modulesActive',
  '🌐': 'portalGlobe',
  '📄': 'docsReview',
  '📥': 'portalInbox',
  '📝': 'serviceRecord',
  '⚠️': 'budgetWarn',
  '🗓️': 'weekPlanner',
  '✨': 'sparkleNew',
};

export function resolveSpaceGlyph(icon?: string): SpaceGlyphKind {
  if (!icon) return 'orbit';
  if (isSpaceGlyphKind(icon)) return icon;
  return EMOJI_TO_GLYPH[icon] ?? 'orbit';
}
