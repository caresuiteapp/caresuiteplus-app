import type { ClientDetail } from '@/types/detail';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type ClientDetailHeroInput = Pick<
  ClientDetail,
  | 'firstName'
  | 'lastName'
  | 'status'
  | 'careLevel'
  | 'city'
  | 'sensitivity'
  | 'nextActionHint'
  | 'contextCounts'
>;

export type ClientDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildClientDetailSubtitle(client: ClientDetailHeroInput, mode: ColorMode = 'dark'): string  {
  const colors = legacyColorsFromPalette(mode);
  if (client.nextActionHint) return client.nextActionHint;
  if (client.city) return client.city;
  return 'Digitale Klient:innen-Akte';
}

export function buildClientDetailKpis(client: ClientDetailHeroInput, mode: ColorMode = 'dark'): ClientDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const { contextCounts } = client;

  return [
    {
      id: 'documents',
      label: 'Dokumente',
      value: String(contextCounts.documents),
      icon: '📄',
      accentColor: colors.cyan,
    },
    {
      id: 'appointments',
      label: 'Termine',
      value: String(contextCounts.appointments),
      icon: '📅',
      accentColor: colors.violet,
    },
    {
      id: 'invoices',
      label: 'Rechnungen',
      value: String(contextCounts.invoices),
      icon: '💶',
      accentColor: colors.orange,
    },
    {
      id: 'assignments',
      label: 'Einsätze',
      value: String(contextCounts.assignments),
      icon: '🧑‍⚕️',
      accentColor: colors.success,
    },
  ];
}
