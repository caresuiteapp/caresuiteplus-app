import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { LockedActionBanner } from '@/components/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useWebFontScale } from '@/design/web/WebFontScaleProvider';
import { WorkspaceDashboard } from '@/components/googleWorkspace/WorkspaceDashboard.web';
export function GoogleWorkspaceScreen() {
  const params = useLocalSearchParams<{service?: string; google?: string}>();
  const { roleKey, roleLabel } = usePermissions(); const { scale } = useWebFontScale();
  const allowed = roleKey === 'business_admin' || roleKey === 'business_manager';
  return <ScreenShell title="Google Workspace" subtitle="Kommunikation · Termine · Dateien · Aufgaben" showBack={false}>
    {allowed ? <ScrollView contentContainerStyle={{paddingBottom:24}} keyboardShouldPersistTaps="handled"><WorkspaceDashboard initialTab={params.service} callbackResult={params.google} fontScale={scale}/></ScrollView> : <LockedActionBanner message="Google Workspace steht der Geschäftsführung und Verwaltung zur Verfügung." roleLabel={roleLabel}/>}
  </ScreenShell>;
}
