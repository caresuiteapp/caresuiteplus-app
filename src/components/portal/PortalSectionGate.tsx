import { ReactNode } from 'react';
import { ClientPortalGuide } from '@/components/portal/ClientPortalGuide';
import type { ClientPortalFeatureKey } from '@/types/clientCore';
import type { ClientPortalSettingsResolved } from '@/types/clientCore';
import { canClientPortalSeeFeature } from '@/lib/client/clientPortalSettingsService';

type PortalSectionGateProps = {
  settings: ClientPortalSettingsResolved | null | undefined;
  feature: ClientPortalFeatureKey;
  lockedTitle?: string;
  lockedMessage?: string;
  children: ReactNode;
};

/** Hides portal sections unless Office/Akte settings allow them. */
export function PortalSectionGate({
  settings,
  feature,
  lockedTitle = 'Hier gibt es noch nichts zu sehen',
  lockedMessage = 'Sobald neue Informationen für Sie bereitstehen, erscheinen sie automatisch an dieser Stelle.',
  children,
}: PortalSectionGateProps) {
  if (!settings || !canClientPortalSeeFeature(settings, feature)) {
    return (
      <ClientPortalGuide compact title={lockedTitle} message={lockedMessage} />
    );
  }

  return <>{children}</>;
}
