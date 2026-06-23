import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AssistDashboardView } from '@/components/dashboard/AssistDashboardView';
import { AssistDataSourceBanner } from '@/components/assist';
import { ActionToolbar, ModuleDashboardShell } from '@/components/layout/platform';
import { PremiumBadge } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';
import { useActiveExecutions } from '@/hooks/useActiveExecutions';
import { useAssistDashboard } from '@/hooks/useAssistDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { wp258A11y } from '@/lib/a11y/wp258-assist-planning';
import { ASSIST_HEADER_PRIMARY_ACTIONS } from '@/lib/assist/assistDashboardWorkspace';

export function AssistIndexScreen() {
  const router = useRouter();
  const { can } = usePermissions();
  const assistAccent = moduleColor('assist');
  const { stats, todayAssignments, loading, error, refresh, isLiveConnected } = useAssistDashboard();
  const { items: activeExecutions, loading: activeLoading } = useActiveExecutions();

  const canPlan = can('assist.assignments.manage');

  const navigate = (route?: string) => {
    if (route) {
      router.push(route as never);
    }
  };

  const toolbarActions = [
    ...(canPlan
      ? ASSIST_HEADER_PRIMARY_ACTIONS.map((action) => ({
          key: action.id,
          label: `+ ${action.label.replace(/^\+?\s*/, '')}`,
          icon: action.icon,
          variant: 'primary' as const,
          onPress: () => navigate(action.route),
        }))
      : []),
    {
      key: 'refresh',
      label: 'Aktualisieren',
      icon: '🔄',
      variant: 'ghost' as const,
      onPress: refresh,
    },
  ];

  return (
    <ModuleDashboardShell
      moduleLabel="Assist & Alltagsbegleitung"
      title="Assist"
      subtitle="Einsatzplanung, Durchführung und Leistungsnachweise"
      breadcrumbs={[
        { label: 'Start', href: '/business' },
        { label: 'Assist' },
      ]}
    >
      <AssistDataSourceBanner />
      <ActionToolbar
        actions={toolbarActions}
        accentColor={assistAccent}
        leftSlot={
          <View style={styles.headerBadges}>
            <PremiumBadge label="Mandantenbezogen" variant="cyan" dot />
            {isLiveConnected ? (
              <PremiumBadge label="Live-Sync aktiv" variant="green" dot />
            ) : null}
          </View>
        }
      />
      <AssistDashboardView
        stats={stats}
        todayAssignments={todayAssignments}
        activeExecutions={activeExecutions}
        activeLoading={activeLoading}
        loading={loading}
        error={error}
        onRefresh={refresh}
        canPlan={canPlan}
      />
      <View
        accessible
        accessibilityLabel={`${wp258A11y.screenLabel} · WP ${wp258A11y.wpNumber}`}
        accessibilityRole={wp258A11y.headingRole}
        style={styles.a11yAnchor}
      />
    </ModuleDashboardShell>
  );
}

const styles = StyleSheet.create({
  headerBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.sm,
    alignItems: 'center',
  },
  a11yAnchor: { height: 0, width: 0 },
});
