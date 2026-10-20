import { ClientSignatureAttentionProvider } from '@/components/portal/ClientSignatureAttentionProvider';
import { useAuth } from '@/lib/auth/context';
import { LiquidPortalRouteLayout } from '@/liquid-command/shell/LiquidPortalRouteLayout';
import { ClientPortalAttentionPrompt } from '@/components/portal/ClientPortalAttentionPrompt';

export default function ClientPortalLiquidLayout() {
  const { portalSession } = useAuth();
  return (
    <ClientSignatureAttentionProvider key={`${portalSession?.tenantId}:${portalSession?.accountId}`}>
    <LiquidPortalRouteLayout
      kind="client"
      overlay={<ClientPortalAttentionPrompt />}
    />
    </ClientSignatureAttentionProvider>
  );
}
