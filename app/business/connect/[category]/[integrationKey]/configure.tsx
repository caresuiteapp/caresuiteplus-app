import { ConnectProviderConfigureScreen } from '@/screens/connect/ConnectProviderConfigureScreen';
import { ConnectFeatureRouteGuard } from '@/components/connect';
import { useLocalSearchParams } from 'expo-router';

export default function ConnectProviderConfigureRoute() {
  const { category, integrationKey } = useLocalSearchParams<{
    category: string;
    integrationKey: string;
  }>();
  const featureKey = category && integrationKey ? `${category}.${integrationKey}` : 'connect.configure';

  return (
    <ConnectFeatureRouteGuard
      featureKey={featureKey}
      actionKey="configure"
      featureLabel="Anbieter-Konfiguration"
    >
      <ConnectProviderConfigureScreen />
    </ConnectFeatureRouteGuard>
  );
}
