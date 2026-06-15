import type { RoadmapListItem, RoadmapPhase } from '@/types/roadmap';
import { ROADMAP_PHASE_LABELS } from '@/types/roadmap';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type RoadmapListKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildRoadmapListKpis(items: RoadmapListItem[], mode: ColorMode = 'dark'): RoadmapListKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const total = items.length;
  const active = items.filter((i) => i.status === 'aktiv' || i.status === 'in_bearbeitung').length;
  const launchPhase = items.filter((i) => i.phase === 'launch').length;
  const phases: RoadmapPhase[] = ['discovery', 'pilot', 'launch', 'scale'];
  let topPhase: RoadmapPhase = 'discovery';
  let topCount = 0;
  for (const phase of phases) {
    const count = items.filter((i) => i.phase === phase).length;
    if (count > topCount) {
      topPhase = phase;
      topCount = count;
    }
  }

  return [
    {
      id: 'total',
      label: 'Meilensteine',
      value: String(total),
      icon: '🗺️',
      accentColor: colors.violet,
    },
    {
      id: 'active',
      label: 'Aktiv',
      value: String(active),
      subValue: active === 1 ? 'Meilenstein' : 'Meilensteine',
      icon: '🎯',
      accentColor: active > 0 ? colors.success : colors.textMuted,
    },
    {
      id: 'launch',
      label: 'Markteintritt',
      value: String(launchPhase),
      icon: '🚀',
      accentColor: launchPhase > 0 ? colors.orange : colors.textMuted,
    },
    {
      id: 'top-phase',
      label: 'Schwerpunkt',
      value: ROADMAP_PHASE_LABELS[topPhase],
      subValue: `${topCount} Einträge`,
      icon: '📊',
      accentColor: colors.cyan,
    },
  ];
}
