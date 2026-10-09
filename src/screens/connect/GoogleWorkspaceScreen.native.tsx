import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { WorkspaceDashboard } from '@/components/googleWorkspace/WorkspaceDashboard.native';
export function GoogleWorkspaceScreen() {
  const params = useLocalSearchParams<{ service?: string; google?: string }>(); const { roleKey, roleLabel } = usePermissions();
  const allowed = roleKey === 'business_admin' || roleKey === 'business_manager';
  return <ScreenShell title="Google Workspace" subtitle="Kommunikation · Termine · Dateien · Aufgaben" showBack>
    {allowed ? <ScrollView contentContainerStyle={{ paddingBottom: 32, gap: 16 }} keyboardShouldPersistTaps="handled"><WorkspaceDashboard initialTab={params.service} callbackResult={params.google} /></ScrollView> : <LockedActionBanner message="Google Workspace steht der Geschäftsführung und Verwaltung zur Verfügung." roleLabel={roleLabel} />}
  </ScreenShell>;
}
