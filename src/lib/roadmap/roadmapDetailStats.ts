import type { RoadmapDetail } from '@/types/roadmap';
import { ROADMAP_PHASE_LABELS } from '@/types/roadmap';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type RoadmapDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildRoadmapDetailKpis(detail: RoadmapDetail, mode: ColorMode = 'dark'): RoadmapDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'phase',
      label: 'Phase',
      value: ROADMAP_PHASE_LABELS[detail.phase],
      icon: '📍',
      accentColor: colors.violet,
    },
    {
      id: 'quarter',
      label: 'Quartal',
      value: detail.quarter,
      icon: '📅',
      accentColor: colors.cyan,
    },
    {
      id: 'owner',
      label: 'Owner',
      value: detail.owner,
      subValue: detail.market,
      icon: '👤',
      accentColor: colors.orange,
    },
    {
      id: 'criteria',
      label: 'Erfolgskriterien',
      value: String(detail.successCriteria.length),
      subValue: detail.successCriteria.length === 1 ? 'Kriterium' : 'Kriterien',
      icon: '🎯',
      accentColor: colors.success,
    },
  ];
}
