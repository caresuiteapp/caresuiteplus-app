import { AdaptiveKpiGrid } from '@/components/adaptive';
import { SectionPanel } from '@/components/ui';
import { dashboardKpisToGridItems } from '@/lib/adaptive/kpiGridItems';
import { buildAssistDashboardKpis } from '@/lib/assist/assistDashboardStats';
import { moduleColor } from '@/design/tokens/modules';

import type { AssistDashboardStats } from '@/types/modules/assist';

type AssistDashboardHeroProps = {
  stats: AssistDashboardStats;
  onKpiPress?: (navigationTarget: string) => void;
};

/** “Heute im Assist” KPI grid — calm glass cards, no gradient hero blob. */
export function AssistDashboardHero({ stats, onKpiPress }: AssistDashboardHeroProps) {
  const kpis = buildAssistDashboardKpis(stats);
  const accent = moduleColor('assist');

  return (
    <SectionPanel
      title="Heute im Assist"
      subtitle="Kennzahlen für Planung, Durchführung und Nachweise"
      surface="open"
      accentColor={accent}
    >
      <AdaptiveKpiGrid
        columns={{ phone: 2, tablet: 2, desktop: 4, wide: 4 }}
        items={dashboardKpisToGridItems(kpis, onKpiPress)}
      />
    </SectionPanel>
  );
}
