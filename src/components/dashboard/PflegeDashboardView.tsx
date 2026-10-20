import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { CareLightCarePlanCard } from '@/components/pflege/CareLightCarePlanCard';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumKpiCard,
  PremiumListRow,
  SectionPanel,
} from '@/components/ui';
import type { CarePlanListItem, PflegeDashboardStats } from '@/types/modules/pflege';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useMainModuleAccent } from '@/hooks/useMainModuleAccent';
import { moduleColor } from '@/design/tokens/modules';
import {
  buildPflegeDashboardPriorities,
  buildPflegeDashboardSections,
  buildPflegeWorkspaceKpis,
  PFLEGE_QUICK_ACCESS,
  PFLEGE_WORKSPACE_KPI_COUNT,
} from '@/lib/pflege/pflegeDashboardWorkspace';
import { spacing, typography } from '@/theme';

type PflegeDashboardViewProps = {
  stats: PflegeDashboardStats | null;
  activePlans: CarePlanListItem[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

function createPflegeDashboardStyles(shellHostsAurora: boolean) {
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
    planList: {
      gap: spacing.sm,
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
      return '#6366F1';
  }
}

export function PflegeDashboardView({
  stats,
  activePlans,
  loading,
  error,
  onRefresh,
}: PflegeDashboardViewProps) {
  const router = useRouter();
  const shellHostsAurora = useShellHostsAurora();
  const moduleAccent = useMainModuleAccent() ?? moduleColor('pflege');
  const styles = useMemo(
    () => createPflegeDashboardStyles(shellHostsAurora),
    [shellHostsAurora],
  );

  const navigate = (route?: string) => {
    if (route) {
      router.push(route as never);
    }
  };

  if (loading && !stats) {
    return <LoadingState message="Pflege-Dashboard wird geladen…" />;
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
        message="Für Ihre Rolle sind aktuell keine Pflege-Übersichtsdaten verfügbar."
        actionLabel="Erneut laden"
        onAction={onRefresh}
      />
    );
  }

  const workspaceKpis = buildPflegeWorkspaceKpis(stats).slice(0, PFLEGE_WORKSPACE_KPI_COUNT);
  const priorities = buildPflegeDashboardPriorities(stats);
  const sections = buildPflegeDashboardSections(stats, activePlans);

  return (
    <View style={styles.container}>
      <SectionPanel
        title="Heute in der Pflege"
        subtitle="Kennzahlen für Einsätze, Pläne, Dokumentation und Maßnahmen"
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
        title="Heute pflegerisch wichtig"
        subtitle="Prioritäten und offene Vorgänge"
        surface="open"
      >
        {priorities.length === 0 ? (
          <EmptyState
            title="Keine dringenden Vorgänge"
            message="Alle Pflegeaufgaben sind erledigt oder noch nicht erfasst."
            actionLabel="Pflegepläne anzeigen"
            onAction={() => navigate('/pflege/plans')}
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
          {section.id === 'clients' && activePlans.length > 0 ? (
            <View style={[styles.planList, { marginTop: spacing.sm }]}>
              {activePlans.slice(0, 4).map((plan) => (
                <CareLightCarePlanCard
                  key={plan.id}
                  plan={plan}
                  accentColor={moduleAccent}
                  onOpen={() => navigate(`/pflege/plans/${plan.id}`)}
                />
              ))}
            </View>
          ) : null}
        </SectionPanel>
      ))}

      <SectionPanel title="Schnellzugriff" subtitle="Häufige Pflege-Bereiche — nur ambulant">
        <View style={styles.quickGrid}>
          {PFLEGE_QUICK_ACCESS.map((action) => (
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
