import { StyleSheet, View } from 'react-native';
import { MobilePortalKpiCard } from '@/components/portal/assist/MobilePortalKpiCard';
import { PortalGlassHero } from '@/components/portal/assist/PortalGlassHero';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import type { PortalTabHeroProps } from '@/components/portal/PortalTabHero';
import { resolvePortalTabHeroContent } from '@/components/portal/portalTabHeroContent';

/** M.1 tab header — opaque glass hero + readable KPI tiles (WCAG on light LLGAN shell). */
export function PortalTabGlassHero(props: PortalTabHeroProps) {
  const { colors } = useLegacyTheme();
  const { title, subtitle, eyebrow, meta, kpis } = resolvePortalTabHeroContent(props, colors);
  const accent = moduleColor('assist');

  return (
    <View style={styles.root} testID="portal-tab-glass-hero">
      <PortalGlassHero
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        meta={meta}
        showStatusDot
      />
      <View style={styles.kpiRow}>
        {kpis.map((kpi) => (
          <MobilePortalKpiCard
            key={kpi.id}
            icon={kpi.icon}
            label={kpi.label}
            value={kpi.numericValue}
            emptyMessage={kpi.fallbackLabel}
            metricSubtitle={kpi.subValue}
            accentColor={kpi.accentColor ?? accent}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: careSpacing.sm,
    width: '100%',
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: careSpacing.sm,
  },
});
