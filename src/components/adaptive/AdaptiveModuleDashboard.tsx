import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { AdaptiveKpiGrid, type KpiGridItem } from '@/components/adaptive/AdaptiveKpiGrid';
import { CareSuiteModuleHeader, PlanPilotPanel } from '@/components/brand';
import { SectionPanel } from '@/components/ui';
import { planPilotRoutes, useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { type CareModuleKey } from '@/design/tokens/modules';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type AdaptiveModuleDashboardProps = {
  moduleKey: CareModuleKey;
  subtitle?: string;
  heroSection?: ReactNode;
  afterHero?: ReactNode;
  /** Show PlanPilot on tablet/desktop — defaults to true with module route. */
  showPlanPilot?: boolean;
  planPilotRoute?: string;
  kpis: KpiGridItem[];
  kpiTitle?: string;
  kpiSubtitle?: string;
  quickActions?: ReactNode;
  recentSection?: ReactNode;
  recentTitle?: string;
  recentSubtitle?: string;
  tasksSection?: ReactNode;
  style?: ViewStyle;
};

export function AdaptiveModuleDashboard({
  moduleKey,
  subtitle,
  heroSection,
  afterHero,
  showPlanPilot = true,
  planPilotRoute,
  kpis,
  kpiTitle = 'Kennzahlen',
  kpiSubtitle = 'Aktuelle Übersicht',
  quickActions,
  recentSection,
  recentTitle = 'Aktuelle Vorgänge',
  recentSubtitle = 'Chronologisch',
  tasksSection,
  style,
}: AdaptiveModuleDashboardProps) {
  const router = useRouter();
  const { isPhone, isTablet, isDesktopOrWide } = useDeviceClass();
  const { colors, typography } = useLegacyTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: careSpacing.md,
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
          gap: careSpacing.md,
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
          ...typography.caption,
          color: colors.textMuted,
        },
        afterHero: {
          gap: careSpacing.sm,
        },
      }),
    [colors.textMuted, typography.caption],
  );

  const pilotRoute = planPilotRoute ?? planPilotRoutes[moduleKey];
  const planPilotSlot =
    showPlanPilot && !isPhone && pilotRoute ? (
      <PlanPilotPanel
        compact={isTablet}
        onOpen={() => router.push(pilotRoute as never)}
      />
    ) : null;

  const afterHeroBlock =
    afterHero || planPilotSlot ? (
      <View style={styles.afterHero}>
        {afterHero}
        {planPilotSlot}
      </View>
    ) : null;

  return (
    <View style={[styles.root, style]}>
      {heroSection ?? <CareSuiteModuleHeader moduleKey={moduleKey} subtitle={subtitle} />}

      {afterHeroBlock}

      {kpis.length > 0 ? (
        <SectionPanel title={kpiTitle} subtitle={kpiSubtitle}>
          <AdaptiveKpiGrid items={kpis} />
        </SectionPanel>
      ) : null}

      <View style={[styles.body, isDesktopOrWide && styles.bodyDesktop]}>
        <View style={styles.main}>
          {recentSection ? (
            <SectionPanel title={recentTitle} subtitle={recentSubtitle}>
              {recentSection}
            </SectionPanel>
          ) : null}
          {tasksSection ? (
            <SectionPanel title="Offene Aufgaben" subtitle="Priorisiert">
              {tasksSection}
            </SectionPanel>
          ) : null}
        </View>

        {quickActions ? (
          <View style={[styles.side, isPhone ? styles.sidePhone : styles.sideWide]}>
            <SectionPanel title="Schnellzugriff" subtitle="Häufige Aktionen">
              {quickActions}
            </SectionPanel>
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
