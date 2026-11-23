import { DesktopCatalogArtwork } from '@/liquid-command/components/DesktopCatalogArtwork';
import { clientPortalArtwork } from './clientPortalDesign';

export function ClientPortalArtwork({ id, label, size = 64 }: { id: string; label: string; size?: number }) {
  const route = clientPortalArtwork[id];
  return route ? <DesktopCatalogArtwork route={route} label={label} size={size} /> : null;
}
