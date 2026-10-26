import { ClientSignatureAttentionProvider } from '@/components/portal/ClientSignatureAttentionProvider';
import { useAuth } from '@/lib/auth/context';
import { RequireAuth, RequireRole } from '@/lib/auth';
import { LiquidPortalRouteLayout } from '@/liquid-command/shell/LiquidPortalRouteLayout';
import { ClientPortalAttentionPrompt } from '@/components/portal/ClientPortalAttentionPrompt';
import { isAcademyOnlyPortal } from '@/lib/akademie/portalAccess.shared';
import { LoadingState } from '@/components/ui';
import { NativeAcademyPortalEntry } from '@/screens/portal/NativeAcademyPortalEntry.native';

export default function ClientPortalLiquidLayout() {
  const auth = useAuth();
  const { portalSession } = auth;
  if (!auth.authReady) return <LoadingState message="Sitzung wird geprüft…" />;
  if (isAcademyOnlyPortal(portalSession, auth.session, auth.user)) {
    return <RequireAuth redirectTo="/auth/client-login"><RequireRole><NativeAcademyPortalEntry academyOnly /></RequireRole></RequireAuth>;
  }
  return (
    <ClientSignatureAttentionProvider key={`${portalSession?.tenantId}:${portalSession?.accountId}`}>
    <LiquidPortalRouteLayout
      kind="client"
      overlay={<ClientPortalAttentionPrompt />}
    />
    </ClientSignatureAttentionProvider>
  );
}
