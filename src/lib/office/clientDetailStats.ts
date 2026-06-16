import type { CareKpiIconKey } from '@/components/ui/CareKpiIcon';
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
> & {
  documents?: readonly unknown[];
};

export type ClientDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  iconKey?: CareKpiIconKey;
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
  const documentCount = client.documents?.length ?? contextCounts.documents;

  return [
    {
      id: 'documents',
      label: 'Dokumente',
      value: String(documentCount),
      iconKey: 'document',
      accentColor: colors.cyan,
    },
    {
      id: 'assignments',
      label: 'Einsätze',
      value: String(contextCounts.assignments),
      iconKey: 'assignments',
      accentColor: colors.success,
    },
    {
      id: 'invoices',
      label: 'Rechnungen',
      value: String(contextCounts.invoices),
      iconKey: 'invoice',
      accentColor: colors.orange,
    },
    {
      id: 'appointments',
      label: 'Termine',
      value: String(contextCounts.appointments),
      iconKey: 'calendar',
      accentColor: colors.violet,
    },
  ];
}
