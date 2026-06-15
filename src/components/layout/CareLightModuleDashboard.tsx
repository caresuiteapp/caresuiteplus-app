import { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { CareLightKpiCard } from '@/components/ui/CareLightKpiCard';
import { CareLightSection } from '@/components/ui/CareLightSection';
import { CareLightModuleHeader } from './CareLightModuleHeader';
import { type CareModuleKey } from '@/design/tokens/modules';

export type CareLightKpiItem = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

type CareLightModuleDashboardProps = {
  moduleKey: CareModuleKey;
  subtitle?: string;
  kpis?: CareLightKpiItem[];
  kpiTitle?: string;
  recentSection?: ReactNode;
  recentTitle?: string;
  recentSubtitle?: string;
  quickActions?: ReactNode;
  headerSlot?: ReactNode;
  style?: ViewStyle;
};

export function CareLightModuleDashboard({
  moduleKey,
  subtitle,
  kpis = [],
  kpiTitle = 'Kennzahlen',
  recentSection,
  recentTitle = 'Aktuelle Vorgänge',
  recentSubtitle,
  quickActions,
  headerSlot,
  style,
}: CareLightModuleDashboardProps) {
  const { isPhone, isDesktopOrWide } = useDeviceClass();

  return (
    <View style={[styles.root, style]}>
      {headerSlot ?? <CareLightModuleHeader moduleKey={moduleKey} subtitle={subtitle} />}

      {kpis.length > 0 ? (
        <CareLightSection title={kpiTitle} subtitle="Aktuelle Übersicht">
          <View style={[styles.kpiGrid, isDesktopOrWide && styles.kpiGridWide]}>
            {kpis.map((kpi) => (
              <CareLightKpiCard key={kpi.id} {...kpi} />
            ))}
          </View>
        </CareLightSection>
      ) : null}

      <View style={[styles.body, isDesktopOrWide && styles.bodyDesktop]}>
        <View style={styles.main}>
          {recentSection ? (
            <CareLightSection title={recentTitle} subtitle={recentSubtitle}>
              {recentSection}
            </CareLightSection>
          ) : null}
        </View>

        {quickActions ? (
          <View style={[styles.side, isPhone ? styles.sidePhone : styles.sideWide]}>
            <CareLightSection title="Schnellzugriff" subtitle="Häufige Aktionen">
              {quickActions}
            </CareLightSection>
          </View>
        ) : null}
      </View>

      {isPhone ? (
        <Text style={styles.hint} numberOfLines={1}>
          Mobile — geführte Schritt-für-Schritt-Ansicht
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: careSpacing.md,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
  },
  kpiGridWide: {
    flexWrap: 'nowrap',
  },
  body: {
    gap: careSpacing.md,
  },
  bodyDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  side: {
    minWidth: 0,
  },
  sidePhone: {
    width: '100%',
  },
  sideWide: {
    width: 320,
    flexShrink: 0,
  },
  hint: {
    ...careTypography.caption,
    color: careLightColors.muted,
  },
});
