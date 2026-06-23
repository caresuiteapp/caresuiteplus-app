import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BeratungDashboardView } from '@/components/dashboard/BeratungDashboardView';
import { ActionToolbar, ModuleDashboardShell } from '@/components/layout/platform';
import { InfoBanner } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useBeratungDashboard } from '@/hooks/useBeratungDashboard';
import { wp418A11y } from '@/lib/a11y/wp418-beratung';
import {
  BERATUNG_EXTENSION_PREPARED_MESSAGE,
  isBeratungExtensionLiveReady,
} from '@/lib/beratung/beratungModuleConfig';
import {
  BERATUNG_HEADER_PRIMARY_ACTIONS,
  BERATUNG_HEADER_SECONDARY_ACTIONS,
} from '@/lib/beratung/beratungDashboardWorkspace';

export function BeratungIndexScreen() {
  const router = useRouter();
  const beratungAccent = moduleColor('beratung');
  const { stats, recentCases, loading, error, refresh } = useBeratungDashboard();

  const navigate = (route?: string) => {
    if (route) {
      router.push(route as never);
    }
  };

  const toolbarActions = [
    ...BERATUNG_HEADER_PRIMARY_ACTIONS.map((action) => ({
      key: action.id,
      label: `+ ${action.label.replace(/^\+?\s*/, '')}`,
      icon: action.icon,
      variant: 'primary' as const,
      onPress: () => navigate(action.route),
    })),
    ...BERATUNG_HEADER_SECONDARY_ACTIONS.map((action) => ({
      key: action.id,
      label: action.label,
      icon: action.icon,
      variant: 'secondary' as const,
      onPress: () => navigate(action.route),
    })),
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
      moduleLabel="Beratung"
      title="Beratung"
      subtitle="Fälle, Protokolle und Wiedervorlagen im Überblick"
      breadcrumbs={[
        { label: 'Start', href: '/business' },
        { label: 'Beratung' },
      ]}
    >
      {!isBeratungExtensionLiveReady() ? (
        <InfoBanner title="Demo-funktional" message={BERATUNG_EXTENSION_PREPARED_MESSAGE} />
      ) : null}
      <ActionToolbar actions={toolbarActions} accentColor={beratungAccent} />
      <BeratungDashboardView
        stats={stats}
        recentCases={recentCases}
        loading={loading}
        error={error}
        onRefresh={refresh}
      />
      <View
        accessible
        accessibilityLabel={`${wp418A11y.screenLabel} · WP ${wp418A11y.wpNumber}`}
        accessibilityRole={wp418A11y.headingRole}
        style={styles.a11yAnchor}
      />
    </ModuleDashboardShell>
  );
}

const styles = StyleSheet.create({
  a11yAnchor: {
    height: 0,
    width: 0,
  },
});
