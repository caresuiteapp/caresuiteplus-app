import { SemanticArtwork } from '@/components/icons/SemanticArtwork';
import { useMemo, useRef } from 'react';
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
  refreshError?: string | null;
  refreshing?: boolean;
  onRefresh: () => void;
  /** The complete workspace launchers are supplied by the parent page. */
  overviewOnly?: boolean;
  canOpenRoute?: (route: string) => boolean;
  onOpenRoute?: (route: string) => void;
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
  refreshError,
  refreshing = false,
  onRefresh,
  overviewOnly = false,
  canOpenRoute,
  onOpenRoute,
}: PflegeDashboardViewProps) {
  const router = useRouter();
  const shellHostsAurora = useShellHostsAurora();
  const moduleAccent = useMainModuleAccent() ?? moduleColor('pflege');
  const styles = useMemo(
    () => createPflegeDashboardStyles(shellHostsAurora),
    [shellHostsAurora],
  );

  const navigation = useRef({ canOpenRoute, onOpenRoute });
  navigation.current = { canOpenRoute, onOpenRoute };
  const routeAllowed = (route?: string) => Boolean(route &&
    (!navigation.current.canOpenRoute || navigation.current.canOpenRoute(route) === true));
  const navigate = (route?: string) => {
    if (!route || !routeAllowed(route)) return;
    if (navigation.current.onOpenRoute) navigation.current.onOpenRoute(route);
    else router.push(route as never);
  };

  if (loading || refreshing) {
    return <LoadingState message="Pflege-Dashboard wird geladen…" />;
  }

  if (error || refreshError) {
    return (
      <ErrorState title={refreshError ? 'Kennzahlen nicht aktualisiert' : 'Dashboard nicht verfügbar'} message={refreshError ?? error ?? ''} onRetry={onRefresh} />
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

  const workspaceKpis = buildPflegeWorkspaceKpis(stats).filter(kpi => routeAllowed(kpi.route)).slice(0, PFLEGE_WORKSPACE_KPI_COUNT);
  const hasUnavailable = workspaceKpis.some(kpi => kpi.value === '—');
  const hasFailed = workspaceKpis.some(kpi => stats.failedKpiIds?.includes(kpi.id) ||
    kpi.id === 'pflege-ws-kpi-active-plans' && stats.failedKpiIds?.includes('pflege-ws-kpi-plan-total'));
  const priorities = buildPflegeDashboardPriorities(stats).filter(item => routeAllowed(item.route));
  const sections = buildPflegeDashboardSections(stats, activePlans).map(section => ({
    ...section, links: section.links.filter(link => routeAllowed(link.route)),
  })).filter(section => section.links.length > 0);

  return (
    <View style={styles.container}>
      <SectionPanel
        title="Heute in der Pflege"
        subtitle="Heutige Tourstopps und gespeicherte Zustände in den lesbaren Bereichen"
        headerAlign="left"
        accentColor={moduleAccent}
        surface="open"
      >
        {hasFailed ? <ErrorState title="Einige Kennzahlen sind nicht verfügbar" message="Die übrigen Werte wurden geladen. Nicht verfügbare Werte sind gekennzeichnet." onRetry={onRefresh} /> : null}
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
        subtitle="Vorgänge zur Prüfung im eigenen Lesebereich"
        surface="open"
      >
        {priorities.length === 0 ? (
          <EmptyState
            title="Keine Hinweise in dieser Übersicht"
            message={hasUnavailable ? 'Nicht geladene oder nicht freigegebene Bereiche werden hier nicht bewertet.' : 'In den ausgewerteten Bereichen wurden keine Hinweise gefunden.'}
            actionLabel={routeAllowed('/pflege/plans') ? 'Pflegepläne anzeigen' : undefined}
            onAction={routeAllowed('/pflege/plans') ? () => navigate('/pflege/plans') : undefined}
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

      {!overviewOnly && sections.map((section) => (
        <SectionPanel key={section.id} title={section.title} subtitle={section.subtitle} surface="open">
          <View style={styles.sectionLinks}>
            {section.links.map((link, index) => (
              <PremiumListRow
                key={link.id}
                title={link.label}
                subtitle={link.description}
                leading={link.icon ? <SemanticArtwork webSize={24} webColor={moduleAccent} style={styles.leadingIcon}>{link.icon}</SemanticArtwork> : undefined}
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
          {section.id === 'clients' && activePlans.some(plan => routeAllowed(`/pflege/plans/${plan.id}`)) ? (
            <View style={[styles.planList, { marginTop: spacing.sm }]}>
              {activePlans.filter(plan => routeAllowed(`/pflege/plans/${plan.id}`)).slice(0, 4).map((plan) => (
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

      {!overviewOnly && <SectionPanel title="Schnellzugriff" subtitle="Häufige Pflege-Bereiche — nur ambulant">
        <View style={styles.quickGrid}>
          {PFLEGE_QUICK_ACCESS.filter(action => routeAllowed(action.route)).map((action) => (
            <PremiumButton
              key={action.id}
              title={action.label}
              variant="secondary"
              size="sm"
              onPress={() => navigate(action.route)}
            />
          ))}
        </View>
      </SectionPanel>}
    </View>
  );
}
