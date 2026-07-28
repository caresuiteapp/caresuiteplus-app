import { Redirect } from 'expo-router';
import { BodyMapMeshWorkbenchScreen } from '@/screens/pflege/BodyMapMeshWorkbenchScreen';

export default function BodyMapMeshWorkbenchRoute() {
  if (__DEV__ || process.env.EXPO_PUBLIC_BODYMAP_MESH_WORKBENCH === 'true') {
    return <BodyMapMeshWorkbenchScreen />;
  }
  return <Redirect href="/" />;
}
