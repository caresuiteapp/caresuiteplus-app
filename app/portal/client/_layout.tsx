import { LiquidPortalRouteLayout } from '@/liquid-command/shell/LiquidPortalRouteLayout';
import { ClientPortalAttentionPrompt } from '@/components/portal/ClientPortalAttentionPrompt';

export default function ClientPortalLiquidLayout() {
  return (
    <LiquidPortalRouteLayout
      kind="client"
      overlay={<ClientPortalAttentionPrompt />}
    />
  );
}
