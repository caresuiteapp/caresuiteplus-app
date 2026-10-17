import { useLocalSearchParams } from 'expo-router';
import { ModuleWorkspaceScreen } from '@/liquid-command/screens/ModuleWorkspaceScreen';
import { AssistClientsWorkspace } from '@/liquid-command/screens/AssistClientsWorkspace.web';

/** Keep the client workspace independent of unrelated Office datasets. */
export default function AssistIndexRoute() {
  const params = useLocalSearchParams<{ area?: string | string[] }>();
  const area = Array.isArray(params.area) ? params.area[0] : params.area;
  return !area || area === 'clients'
    ? <AssistClientsWorkspace />
    : <ModuleWorkspaceScreen moduleKey="assist" areaId={area} />;
}
