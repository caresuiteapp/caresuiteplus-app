import { Redirect } from 'expo-router';
import { BodyMapVisualQaScreen } from '@/screens/pflege/BodyMapVisualQaScreen';

export default function BodyMapVisualQaRoute() {
  const visualQaEnabled =
    __DEV__ || process.env.EXPO_PUBLIC_BODYMAP_VISUAL_QA === 'true';
  if (!visualQaEnabled) return <Redirect href="/" />;
  return <BodyMapVisualQaScreen />;
}
