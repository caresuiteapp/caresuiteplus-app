import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';
import type { PortalClientProfile } from '@/types/portal/client';
import type { PortalEmployeeProfile } from '@/types/portal/employee';

export type PortalProfileKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildEmployeePortalProfileKpis(profile: PortalEmployeeProfile, mode: ColorMode = 'dark'): PortalProfileKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'target-hours',
      label: 'Soll (Woche)',
      value: `${profile.weeklyHoursTarget} h`,
      subValue: 'Arbeitszeit',
      icon: '🎯',
      accentColor: colors.cyan,
    },
    {
      id: 'logged-hours',
      label: 'Ist (Woche)',
      value: `${profile.weeklyHoursLogged} h`,
      subValue: 'Erfasst',
      icon: '⏱️',
      accentColor: colors.violet,
    },
    {
      id: 'shifts',
      label: 'Einsätze',
      value: String(profile.upcomingShifts),
      subValue: 'Anstehend',
      icon: '📅',
      accentColor: colors.amber,
    },
    {
      id: 'requests',
      label: 'Anfragen',
      value: String(profile.openRequests),
      subValue: 'Offen',
      icon: '📬',
      accentColor: colors.success,
    },
  ];
}

export function buildClientPortalProfileKpis(profile: PortalClientProfile, mode: ColorMode = 'dark'): PortalProfileKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'invoices',
      label: 'Rechnungen',
      value: String(profile.openInvoices),
      subValue: 'Offen',
      icon: '🧾',
      accentColor: colors.amber,
    },
    {
      id: 'documents',
      label: 'Dokumente',
      value: String(profile.sharedDocuments),
      subValue: 'Freigegeben',
      icon: '📄',
      accentColor: colors.cyan,
    },
    {
      id: 'care-level',
      label: 'Pflegegrad',
      value: profile.careLevel ?? '—',
      subValue: profile.city ?? 'Portal',
      icon: '🏥',
      accentColor: colors.violet,
    },
  ];
}
