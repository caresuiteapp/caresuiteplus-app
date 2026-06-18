import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { OfficeDashboardView } from '@/components/dashboard/OfficeDashboardView';
import { ActionToolbar, ModuleDashboardShell } from '@/components/layout/platform';
import { moduleColor } from '@/design/tokens/modules';
import { useOfficeDashboard } from '@/hooks/useOfficeDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { wp158A11y } from '@/lib/a11y/wp158-office';

export function OfficeIndexScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { roleLabel } = usePermissions();
  const { data, loading, error, refresh } = useOfficeDashboard();
  const officeAccent = moduleColor('office');

  const displayName = profile?.displayName ?? user?.displayName ?? 'Verwaltung';

  const toolbarActions = data
    ? [
        {
          key: 'refresh',
          label: 'Aktualisieren',
          icon: '🔄',
          variant: 'ghost' as const,
          onPress: refresh,
        },
        {
          key: 'primary',
          label: `${data.primaryAction.icon} ${data.primaryAction.label}`,
          icon: data.primaryAction.icon,
          variant: 'primary' as const,
          onPress: () => {
            if (data.primaryAction.route) {
              router.push(data.primaryAction.route as never);
            }
          },
        },
      ]
    : [
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
      moduleLabel="Office"
      title="Dashboard"
      subtitle={`${roleLabel ?? 'Verwaltung'} · ${displayName}`}
    >
      <ActionToolbar actions={toolbarActions} accentColor={officeAccent} />
      <OfficeDashboardView
        snapshot={data}
        loading={loading}
        error={error}
        displayName={displayName}
        onRefresh={refresh}
      />
      <View
        accessible
        accessibilityLabel={`${wp158A11y.screenLabel} · WP ${wp158A11y.wpNumber}`}
        accessibilityRole={wp158A11y.headingRole}
        style={styles.a11yAnchor}
      />
    </ModuleDashboardShell>
  );
}

const styles = StyleSheet.create({
  a11yAnchor: { height: 0, width: 0 },
});
