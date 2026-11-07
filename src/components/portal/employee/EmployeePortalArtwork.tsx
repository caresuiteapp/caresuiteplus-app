import Ionicons from '@expo/vector-icons/Ionicons';
import { DesktopCatalogArtwork } from '@/liquid-command/components/DesktopCatalogArtwork';
import { employeePortalArtwork, employeePortalDesign as c } from './employeePortalDesign';

export function EmployeePortalArtwork({ id, label, size = 40 }: { id: string; label: string; size?: number }) {
  const route = employeePortalArtwork[id];
  if (route) return <DesktopCatalogArtwork route={route} label={label} size={size} />;
  return <Ionicons name="grid-outline" size={Math.min(size, 23)} color={c.accent} accessible={false} />;
}
