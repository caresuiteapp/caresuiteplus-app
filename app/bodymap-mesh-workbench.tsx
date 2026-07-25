import { Redirect } from 'expo-router';
import { BodyMapMeshWorkbenchScreen } from '@/screens/pflege/BodyMapMeshWorkbenchScreen';

export default function BodyMapMeshWorkbenchRoute() {
  const enabled =
    __DEV__ || process.env.EXPO_PUBLIC_BODYMAP_MESH_WORKBENCH === 'true';
  if (!enabled) return <Redirect href="/" />;
  return <BodyMapMeshWorkbenchScreen />;
}
