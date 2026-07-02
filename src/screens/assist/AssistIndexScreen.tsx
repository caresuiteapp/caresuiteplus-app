import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AssistDataSourceBanner } from '@/components/assist';
import {
  HealthOSBreadcrumbs,
  HealthOSModuleShell,
  HealthOSTopBar,
} from '@/components/healthos';
import { HealthOSAssistOperationsView } from '@/components/healthos/assist';
import { ActionToolbar } from '@/components/layout/platform';
import { PremiumBadge } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';
import { useActiveExecutions } from '@/hooks/useActiveExecutions';
import { useAssistDashboard } from '@/hooks/useAssistDashboard';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { wp258A11y } from '@/lib/a11y/wp258-assist-planning';
import { ASSIST_HEADER_PRIMARY_ACTIONS } from '@/lib/assist/assistDashboardWorkspace';

export function AssistIndexScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { can } = usePermissions();
  const assistAccent = moduleColor('assist');
  const { stats, todayAssignments, loading, error, refresh, isLiveConnected } = useAssistDashboard();
  const { items: activeExecutions, loading: activeLoading } = useActiveExecutions();
  const displayName =
    profile?.displayName ?? user?.displayName ?? 'Assist & Alltagsbegleitung';

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
    <HealthOSModuleShell
      moduleLabel="Assist & Alltagsbegleitung"
      testID="healthos-assist-operations-shell"
      topBar={
        <HealthOSTopBar
          title="Assist Operations"
          subtitle="Einsatzplanung, Durchführung und Leistungsnachweise"
          compact={false}
        />
      }
      breadcrumbs={
        <HealthOSBreadcrumbs
          segments={[
            { label: 'Start', href: '/business' },
            { label: 'Assist', href: '/assist' },
            { label: 'Operations' },
          ]}
        />
      }
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
      <HealthOSAssistOperationsView
        stats={stats}
        todayAssignments={todayAssignments}
        activeExecutions={activeExecutions}
        activeLoading={activeLoading}
        loading={loading}
        error={error}
        displayName={displayName}
        onRefresh={refresh}
      />
      <View
        accessible
        accessibilityLabel={`${wp258A11y.screenLabel} · WP ${wp258A11y.wpNumber}`}
        accessibilityRole={wp258A11y.headingRole}
        style={styles.a11yAnchor}
      />
    </HealthOSModuleShell>
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
