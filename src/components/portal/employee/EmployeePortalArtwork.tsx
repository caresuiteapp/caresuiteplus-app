import Ionicons from '@expo/vector-icons/Ionicons';
import { DesktopCatalogArtwork } from '@/liquid-command/components/DesktopCatalogArtwork';
import { employeePortalArtwork, employeePortalDesign as c } from './employeePortalDesign';

export function EmployeePortalArtwork({ id, label, size = 40 }: { id: string; label: string; size?: number }) {
  const route = employeePortalArtwork[id];
  if (route) return <DesktopCatalogArtwork route={route} label={label} size={size} />;
  const icons = { home: 'home-outline', 'open-assignments': 'time-outline', leave: 'airplane-outline', absence: 'calendar-outline', uploads: 'cloud-upload-outline', announcements: 'megaphone-outline', payroll: 'wallet-outline' } as const;
  return <Ionicons name={icons[id as keyof typeof icons] ?? 'grid-outline'} size={Math.min(size, 23)} color={c.accent} accessible={false} />;
}
