import { Redirect, useLocalSearchParams } from 'expo-router';
import { ModuleWorkspaceScreen } from '@/liquid-command/screens/ModuleWorkspaceScreen';

/** Preserve saved company links while keeping other Office work areas reachable. */
export default function OfficeIndexRoute() {
  const { area, ...params } = useLocalSearchParams<{ area?: string }>();
  if (!area || area === 'company') {
    return <Redirect href={{ pathname: '/unternehmen', params } as never} />;
  }
  return <ModuleWorkspaceScreen moduleKey="office" />;
}
