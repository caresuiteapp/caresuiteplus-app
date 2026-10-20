import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CourseListCard } from '@/components/akademie';
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
import type { AkademieDashboardStats, CourseListItem } from '@/types/modules/akademie';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useMainModuleAccent } from '@/hooks/useMainModuleAccent';
import { moduleColor } from '@/design/tokens/modules';
import {
  AKADEMIE_QUICK_ACCESS,
  AKADEMIE_WORKSPACE_KPI_COUNT,
  buildAkademieDashboardPriorities,
  buildAkademieDashboardSections,
  buildAkademieWorkspaceKpis,
} from '@/lib/akademie/akademieDashboardWorkspace';
import { spacing, typography } from '@/theme';

type AkademieDashboardViewProps = {
  stats: AkademieDashboardStats | null;
  upcomingCourses: CourseListItem[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

function createAkademieDashboardStyles(shellHostsAurora: boolean) {
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
    courseList: {
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
      return '#FACC15';
  }
}

export function AkademieDashboardView({
  stats,
  upcomingCourses,
  loading,
  error,
  onRefresh,
}: AkademieDashboardViewProps) {
  const router = useRouter();
  const shellHostsAurora = useShellHostsAurora();
  const moduleAccent = useMainModuleAccent() ?? moduleColor('akademie');
  const styles = useMemo(
    () => createAkademieDashboardStyles(shellHostsAurora),
    [shellHostsAurora],
  );

  const navigate = (route?: string) => {
    if (route) {
      router.push(route as never);
    }
  };

  if (loading && !stats) {
    return <LoadingState message="Akademie-Dashboard wird geladen…" />;
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
        message="Für Ihre Rolle sind aktuell keine Akademie-Übersichtsdaten verfügbar."
        actionLabel="Erneut laden"
        onAction={onRefresh}
      />
    );
  }

  const workspaceKpis = buildAkademieWorkspaceKpis(stats).slice(0, AKADEMIE_WORKSPACE_KPI_COUNT);
  const priorities = buildAkademieDashboardPriorities(stats);
  const sections = buildAkademieDashboardSections(stats, upcomingCourses);

  return (
    <View style={styles.container}>
      <SectionPanel
        title="Akademiestatus heute"
        subtitle="Kurse, Pflichtschulungen, Fortschritt, Prüfungen und Zertifikate"
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
        title="Heute in der Akademie wichtig"
        subtitle="Prioritäten und offene Lern- und Compliance-Vorgänge"
        surface="open"
      >
        {priorities.length === 0 ? (
          <EmptyState
            title="Keine dringenden Vorgänge"
            message="Alle Schulungsaufgaben sind erledigt oder noch nicht erfasst."
            actionLabel="Alle Kurse anzeigen"
            onAction={() => navigate('/akademie/courses')}
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
          {section.id === 'courses' && upcomingCourses.length > 0 ? (
            <View style={styles.courseList}>
              {upcomingCourses.slice(0, 4).map((course) => (
                <CourseListCard
                  key={course.id}
                  course={course}
                  onPress={() => navigate(`/akademie/courses/${course.id}`)}
                />
              ))}
            </View>
          ) : null}
        </SectionPanel>
      ))}

      <SectionPanel title="Schnellzugriff" subtitle="Häufige Akademie-Bereiche — nur Akademie">
        <View style={styles.quickGrid}>
          {AKADEMIE_QUICK_ACCESS.map((action) => (
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
