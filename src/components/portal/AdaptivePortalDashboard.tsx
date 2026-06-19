import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import type { PortalDashboardWidget } from '@/lib/portal/types';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type PortalWidgetCardProps = {
  widget: PortalDashboardWidget;
};

export function PortalWidgetCard({ widget }: PortalWidgetCardProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const hasMetric = widget.metricValue !== null && widget.metricValue !== undefined;

  return (
    <GlassCard style={styles.card}>
      <Text style={[type.caption, styles.eyebrow, { color: text.muted }]} {...noBreakTextProps}>
        {widget.description}
      </Text>
      <Text style={[type.cardTitle, { color: text.primary }]} {...noBreakTextProps}>
        {widget.title}
      </Text>
      {hasMetric ? (
        <Text style={[type.cardTitle, styles.metric, { color: text.primary }]}>{widget.metricValue}</Text>
      ) : (
        <Text style={[type.body, styles.empty, { color: text.secondary }]} {...noBreakTextProps}>
          {widget.emptyState}
        </Text>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 120,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  empty: {
    marginTop: careSpacing.xs,
  },
  metric: {
    fontSize: 32,
    fontWeight: '700',
  },
});

type AdaptivePortalDashboardProps = {
  widgets: PortalDashboardWidget[];
};

export function AdaptivePortalDashboard({ widgets }: AdaptivePortalDashboardProps) {
  if (widgets.length === 0) return null;

  return (
    <View style={gridStyles.grid}>
      {widgets.map((widget) => (
        <View key={widget.widgetKey} style={gridStyles.gridItem}>
          <PortalWidgetCard widget={widget} />
        </View>
      ))}
    </View>
  );
}

const gridStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  gridItem: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 150,
  },
});
