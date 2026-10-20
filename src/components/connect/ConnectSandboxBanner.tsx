import { InfoBanner } from '@/components/ui';
import type { ConnectDisplayStatus } from '@/lib/connect/connectPresentation';
import { CONNECT_DISPLAY_STATUS_LABELS } from '@/lib/connect/connectPresentation';

type ConnectSandboxBannerProps = {
  status: ConnectDisplayStatus;
};

export function ConnectSandboxBanner({ status }: ConnectSandboxBannerProps) {
  if (status !== 'sandbox') return null;
  return (
    <InfoBanner
      variant="warning"
      title="Sandbox"
      message={CONNECT_DISPLAY_STATUS_LABELS.sandbox}
    />
  );
}
