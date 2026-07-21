import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  HealthOSBreadcrumbs,
} from '@/components/healthos';
import { HealthOSOfficeCommandCenterView } from '@/components/healthos/office';
import { ActionToolbar } from '@/components/layout/platform';
import { ScreenShell } from '@/components/layout/ScreenShell';
import { moduleColor } from '@/design/tokens/modules';
import { useOfficeDashboard } from '@/hooks/useOfficeDashboard';
import { useAuth } from '@/lib/auth/context';
import { wp158A11y } from '@/lib/a11y/wp158-office';
import {
  OFFICE_HEADER_OPTIONAL_ACTIONS,
  OFFICE_HEADER_PRIMARY_ACTIONS,
  OFFICE_HEADER_SECONDARY_ACTIONS,
} from '@/lib/office/officeDashboardWorkspace';

export function OfficeIndexScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { data, loading, error, refresh } = useOfficeDashboard();
  const officeAccent = moduleColor('office');
  const displayName = profile?.displayName ?? user?.displayName ?? 'Verwaltung';

  const navigate = (route?: string) => {
    if (route) {
      router.push(route as never);
    }
  };

  const toolbarActions = [
    ...OFFICE_HEADER_PRIMARY_ACTIONS.map((action) => ({
      key: action.id,
      label: `+ ${action.label.replace(/^\+?\s*/, '')}`,
      icon: action.icon,
      variant: 'primary' as const,
      onPress: () => navigate(action.route),
    })),
    ...OFFICE_HEADER_SECONDARY_ACTIONS.map((action) => ({
      key: action.id,
      label: action.label,
      icon: action.icon,
      variant: 'secondary' as const,
      onPress: () => navigate(action.route),
    })),
    ...OFFICE_HEADER_OPTIONAL_ACTIONS.map((action) => ({
      key: action.id,
      label: action.label,
      icon: action.icon,
      variant: 'ghost' as const,
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
    <ScreenShell
      title="Office"
      subtitle="Steuerungszentrale für Geschäftsführung, Verwaltung und Qualität"
      showBack={false}
    >
      <HealthOSBreadcrumbs
        segments={[
          { label: 'Start', href: '/business' },
          { label: 'Office', href: '/office' },
          { label: 'Übersicht' },
        ]}
      />
      <ActionToolbar actions={toolbarActions} accentColor={officeAccent} />
      <HealthOSOfficeCommandCenterView
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  a11yAnchor: { height: 0, width: 0 },
});
