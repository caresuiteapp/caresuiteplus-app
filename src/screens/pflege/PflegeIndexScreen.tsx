import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PflegeDashboardView } from '@/components/dashboard/PflegeDashboardView';
import { ActionToolbar, ModuleDashboardShell } from '@/components/layout/platform';
import { moduleColor } from '@/design/tokens/modules';
import { usePflegeDashboard } from '@/hooks/usePflegeDashboard';
import { wp378A11y } from '@/lib/a11y/wp378-pflege';
import { ModuleDocumentsSection } from '@/components/documents/ModuleDocumentsSection';
import {
  PFLEGE_HEADER_PRIMARY_ACTIONS,
  PFLEGE_HEADER_SECONDARY_ACTIONS,
} from '@/lib/pflege/pflegeDashboardWorkspace';

export function PflegeIndexScreen() {
  const router = useRouter();
  const pflegeAccent = moduleColor('pflege');
  const { stats, activePlans, loading, error, refresh } = usePflegeDashboard();

  const navigate = (route?: string) => {
    if (route) {
      router.push(route as never);
    }
  };

  const toolbarActions = [
    ...PFLEGE_HEADER_PRIMARY_ACTIONS.map((action) => ({
      key: action.id,
      label: `+ ${action.label.replace(/^\+?\s*/, '')}`,
      icon: action.icon,
      variant: 'primary' as const,
      onPress: () => navigate(action.route),
    })),
    ...PFLEGE_HEADER_SECONDARY_ACTIONS.map((action) => ({
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
      moduleLabel="Pflege"
      title="Pflege"
      subtitle="Pflegeplanung, Dokumentation und Maßnahmensteuerung"
      breadcrumbs={[
        { label: 'Start', href: '/business' },
        { label: 'Pflege' },
      ]}
    >
      <ActionToolbar actions={toolbarActions} accentColor={pflegeAccent} />
      <PflegeDashboardView
        stats={stats}
        activePlans={activePlans}
        loading={loading}
        error={error}
        onRefresh={refresh}
      />
      <ModuleDocumentsSection
        targetModule="pflege"
        targetArea="record"
        title="Pflegefachliche Vorlagen"
        subtitle="Pflegeanamnese, SIS, Maßnahmenplanung, Pflegebericht u. a."
      />
      <View
        accessible
        accessibilityLabel={`${wp378A11y.screenLabel} · WP ${wp378A11y.wpNumber}`}
        accessibilityRole={wp378A11y.headingRole}
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
