import type { ReactNode } from 'react';
import { ConnectPreparedBlockScreen } from '@/components/connect/ConnectPreparedBlockScreen';
import { useConnectFeatureGate } from '@/hooks/useConnectFeatureGate';
import type {
  ConnectFeatureActionKey,
  ConnectFeatureGateContext,
  ConnectFeatureKey,
} from '@/types/connect/featureGate';

type ConnectFeatureRouteGuardProps = {
  featureKey: ConnectFeatureKey;
  actionKey: ConnectFeatureActionKey;
  featureLabel?: string;
  contextOverrides?: Partial<ConnectFeatureGateContext>;
  children: ReactNode;
};

export function ConnectFeatureRouteGuard({
  featureKey,
  actionKey,
  featureLabel,
  contextOverrides,
  children,
}: ConnectFeatureRouteGuardProps) {
  const { result, showBlockPage } = useConnectFeatureGate(featureKey, actionKey, contextOverrides);

  if (!result.allowed && showBlockPage) {
    return (
      <ConnectPreparedBlockScreen
        code={'code' in result ? result.code : undefined}
        message={'message' in result ? result.message : undefined}
        featureLabel={featureLabel}
      />
    );
  }

  if (!result.allowed && !result.visible) {
    return (
      <ConnectPreparedBlockScreen
        code={'code' in result ? result.code : undefined}
        message={'message' in result ? result.message : undefined}
        featureLabel={featureLabel}
      />
    );
  }

  return children;
}
