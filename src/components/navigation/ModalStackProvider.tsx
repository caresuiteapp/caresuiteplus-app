import { ModalStackProvider as ModalStackStateProvider } from '@/hooks/useModalStack';
import { useAuth } from '@/lib/auth/context';
import { ModalStackRenderer } from './ModalStackRenderer';

/** App-level modal stack — nested glass overlays for in-page actions. */
export function ModalStackProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, portalSession } = useAuth();
  const scope = JSON.stringify([user?.id, profile?.id, profile?.tenantId, profile?.roleKey, portalSession?.accountId]);
  return (
    <ModalStackStateProvider scope={scope}>
      {children}
      <ModalStackRenderer />
    </ModalStackStateProvider>
  );
}
