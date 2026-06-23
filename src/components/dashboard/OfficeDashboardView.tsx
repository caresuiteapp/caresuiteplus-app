import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumKpiCard,
  PremiumListRow,
  SectionPanel,
  Timeline,
} from '@/components/ui';
import type { DashboardSnapshot } from '@/types/dashboard';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { useMainModuleAccent } from '@/hooks/useMainModuleAccent';
import {
  buildOfficeDashboardSections,
  OFFICE_WORKSPACE_KPI_COUNT,
} from '@/lib/office/officeDashboardWorkspace';
import { spacing, typography } from '@/theme';

type OfficeDashboardViewProps = {
  snapshot: DashboardSnapshot | null;
  loading: boolean;
  error: string | null;
  displayName: string;
  onRefresh: () => void;
};

function createOfficeDashboardStyles(shellHostsAurora: boolean) {
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
  });
}

export function OfficeDashboardView({
  snapshot,
  loading,
  error,
  displayName,
  onRefresh,
}: OfficeDashboardViewProps) {
  const router = useRouter();
  const shellHostsAurora = useShellHostsAurora();
  const moduleAccent = useMainModuleAccent();
  const styles = useMemo(
    () => createOfficeDashboardStyles(shellHostsAurora),
    [shellHostsAurora],
  );

  const navigate = (route?: string) => {
    if (route) {
      router.push(route as never);
    }
  };

  if (loading && !snapshot) {
    return <LoadingState message="Office-Dashboard wird geladen…" />;
  }

  if (error && !snapshot) {
    return (
      <ErrorState title="Dashboard nicht verfügbar" message={error} onRetry={onRefresh} />
    );
  }

  if (!snapshot) {
    return (
      <EmptyState
        title="Keine Dashboard-Daten"
        message="Für Ihre Rolle sind aktuell keine Office-Übersichtsdaten verfügbar."
        actionLabel="Erneut laden"
        onAction={onRefresh}
      />
    );
  }

  const sections = buildOfficeDashboardSections(snapshot);

  const workspaceKpis = snapshot.kpis.slice(0, OFFICE_WORKSPACE_KPI_COUNT);

  return (
    <View style={styles.container}>
      <SectionPanel
        title="Heute im Office"
        subtitle={`${snapshot.greeting}, ${displayName} · Verwaltungszentrale`}
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
                  trend={kpi.trend}
                  trendValue={kpi.trendValue}
                  variant={shellHostsAurora ? 'light' : 'glass'}
                />
              </Pressable>
            ),
          }))}
        />
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
        </SectionPanel>
      ))}

      <SectionPanel title="Letzte Aktivitäten" subtitle="Chronologischer Verlauf im Office">
        {snapshot.activities.length > 0 ? (
          <Timeline items={snapshot.activities} />
        ) : (
          <EmptyState
            title="Noch keine Aktivitäten"
            message="Sobald Klient:innen, Dokumente oder Vorgänge bearbeitet werden, erscheinen sie hier."
          />
        )}
      </SectionPanel>
    </View>
  );
}
