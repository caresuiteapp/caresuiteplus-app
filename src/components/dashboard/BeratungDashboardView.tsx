import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CounselingCaseListCard } from '@/components/beratung';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumKpiCard,
  PremiumListRow,
  SectionPanel,
} from '@/components/ui';
import type { BeratungDashboardStats, CounselingListItem } from '@/types/modules/beratung';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useMainModuleAccent } from '@/hooks/useMainModuleAccent';
import { moduleColor } from '@/design/tokens/modules';
import { SYSTEM_LIQUID_COLORS } from '@/design/tokens/systemLiquidGlass';
import {
  buildBeratungDashboardPriorities,
  buildBeratungDashboardSections,
  buildBeratungWorkspaceKpis,
  BERATUNG_QUICK_ACCESS,
  BERATUNG_WORKSPACE_KPI_COUNT,
} from '@/lib/beratung/beratungDashboardWorkspace';
import { spacing, typography } from '@/theme';

type BeratungDashboardViewProps = {
  stats: BeratungDashboardStats | null;
  recentCases: CounselingListItem[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

function createBeratungDashboardStyles(shellHostsAurora: boolean) {
  return StyleSheet.create({
    container: {
      width: '100%',
      flexGrow: 1,
      gap: spacing.md,
      backgroundColor: shellHostsAurora ? 'transparent' : undefined,
    },
    sectionLinks: {
      gap: spacing.xs,
    },
    countBadge: {
      ...typography.caption,
      fontWeight: '700',
      minWidth: 24,
      textAlign: 'right',
    },
    leadingIcon: {
      fontSize: 18,
      width: 28,
      textAlign: 'center',
    },
    priorityList: {
      gap: spacing.xs,
    },
    priorityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    priorityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    quickGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    caseList: {
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
  });
}

function priorityColor(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high':
      return '#EF4444';
    case 'medium':
      return '#F59E0B';
    default:
      return SYSTEM_LIQUID_COLORS.electricBlue;
  }
}

export function BeratungDashboardView({
  stats,
  recentCases,
  loading,
  error,
  onRefresh,
}: BeratungDashboardViewProps) {
  const router = useRouter();
  const shellHostsAurora = useShellHostsAurora();
  const moduleAccent = useMainModuleAccent() ?? moduleColor('beratung');
  const styles = useMemo(
    () => createBeratungDashboardStyles(shellHostsAurora),
    [shellHostsAurora],
  );

  const navigate = (route?: string) => {
    if (route) {
      router.push(route as never);
    }
  };

  if (loading && !stats) {
    return <LoadingState message="Beratungs-Dashboard wird geladen…" />;
  }

  if (error && !stats) {
    return (
      <ErrorState title="Dashboard nicht verfügbar" message={error} onRetry={onRefresh} />
    );
  }

  if (!stats) {
    return (
      <EmptyState
        title="Keine Dashboard-Daten"
        message="Für Ihre Rolle sind aktuell keine Beratungs-Übersichtsdaten verfügbar."
        actionLabel="Erneut laden"
        onAction={onRefresh}
      />
    );
  }

  const workspaceKpis = buildBeratungWorkspaceKpis(stats).slice(0, BERATUNG_WORKSPACE_KPI_COUNT);
  const priorities = buildBeratungDashboardPriorities(stats);
  const sections = buildBeratungDashboardSections(stats, recentCases);

  return (
    <View style={styles.container}>
      <SectionPanel
        title="Beratungsstatus heute"
        subtitle="Kennzahlen für Fälle, Termine, Protokolle und Wiedervorlagen"
        headerAlign="left"
        accentColor={moduleAccent}
        surface="open"
      >
        <AdaptiveKpiGrid
          columns={{ phone: 2, tablet: 2, desktop: 4, wide: 4 }}
          items={workspaceKpis.map((kpi) => ({
            id: kpi.id,
            node: (
              <Pressable
                onPress={() => navigate(kpi.route)}
                accessibilityRole="button"
                accessibilityLabel={`${kpi.label}: ${kpi.value}`}
              >
                <PremiumKpiCard
                  label={kpi.label}
                  value={kpi.value}
                  subValue={kpi.subValue}
                  icon={kpi.icon}
                  accentColor={moduleAccent}
                  variant={shellHostsAurora ? 'light' : 'glass'}
                />
              </Pressable>
            ),
          }))}
        />
      </SectionPanel>

      <SectionPanel
        title="Heute in der Beratung wichtig"
        subtitle="Prioritäten und offene Vorgänge"
        surface="open"
      >
        {priorities.length === 0 ? (
          <EmptyState
            title="Keine dringenden Vorgänge"
            message="Alle Beratungsaufgaben sind erledigt oder noch nicht erfasst."
            actionLabel="Alle Fälle anzeigen"
            onAction={() => navigate('/beratung/cases')}
          />
        ) : (
          <View style={styles.priorityList}>
            {priorities.map((item, index) => (
              <PremiumListRow
                key={item.id}
                title={item.label}
                subtitle={item.description}
                leading={
                  <View style={styles.priorityRow}>
                    <View
                      style={[styles.priorityDot, { backgroundColor: priorityColor(item.severity) }]}
                    />
                    <Text style={styles.leadingIcon}>{item.severity === 'high' ? '⚠️' : '📌'}</Text>
                  </View>
                }
                trailing={
                  item.count !== undefined ? (
                    <Text style={[styles.countBadge, { color: moduleAccent }]}>{item.count}</Text>
                  ) : undefined
                }
                showChevron
                showDivider={index < priorities.length - 1}
                onPress={() => navigate(item.route)}
              />
            ))}
          </View>
        )}
      </SectionPanel>

      {sections.map((section) => (
        <SectionPanel key={section.id} title={section.title} subtitle={section.subtitle} surface="open">
          <View style={styles.sectionLinks}>
            {section.links.map((link, index) => (
              <PremiumListRow
                key={link.id}
                title={link.label}
                subtitle={link.description}
                leading={link.icon ? <Text style={styles.leadingIcon}>{link.icon}</Text> : undefined}
                trailing={
                  link.count !== undefined ? (
                    <Text style={[styles.countBadge, { color: moduleAccent }]}>{link.count}</Text>
                  ) : undefined
                }
                showChevron
                showDivider={index < section.links.length - 1}
                onPress={() => navigate(link.route)}
              />
            ))}
          </View>
          {section.id === 'cases' && recentCases.length > 0 ? (
            <View style={styles.caseList}>
              {recentCases.slice(0, 4).map((counselingCase) => (
                <CounselingCaseListCard
                  key={counselingCase.id}
                  counselingCase={counselingCase}
                  onPress={() => navigate(`/beratung/cases/${counselingCase.id}`)}
                />
              ))}
            </View>
          ) : null}
        </SectionPanel>
      ))}

      <SectionPanel title="Schnellzugriff" subtitle="Häufige Beratungs-Bereiche — nur Beratung">
        <View style={styles.quickGrid}>
          {BERATUNG_QUICK_ACCESS.map((action) => (
            <PremiumButton
              key={action.id}
              title={action.label}
              variant="secondary"
              size="sm"
              onPress={() => navigate(action.route)}
            />
          ))}
        </View>
      </SectionPanel>
    </View>
  );
}
