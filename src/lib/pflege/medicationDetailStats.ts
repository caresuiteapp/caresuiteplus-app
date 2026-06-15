import type { MedicationListItem } from '@/data/demo/medications';
import { getDemoMedicationListItems } from '@/data/demo/medications';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type MedicationDetail = MedicationListItem & {
  instructions: string;
  interactions: string[];
  lastAdministeredAt: string | null;
  empSyncStatus: 'prepared' | 'synced' | 'pending';
  notes: string;
};

export type MedicationDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

const DETAIL_EXTRAS: Record<string, Omit<MedicationDetail, keyof MedicationListItem>> = {
  'med-001': {
    instructions: 'Mit ausreichend Flüssigkeit einnehmen. Blutdruck regelmäßig kontrollieren.',
    interactions: ['Kaliumsparende Diuretika', 'NSAR'],
    lastAdministeredAt: new Date(Date.now() - 1 * 86_400_000).toISOString(),
    empSyncStatus: 'prepared',
    notes: 'eMP-Abgleich steht aus — Verordnung manuell gepflegt.',
  },
  'med-002': {
    instructions: 'Zu den Mahlzeiten einnehmen. Auf Hypoglykämie-Zeichen achten.',
    interactions: ['Alkohol', 'Kontrastmittel'],
    lastAdministeredAt: new Date(Date.now() - 0.5 * 86_400_000).toISOString(),
    empSyncStatus: 'prepared',
    notes: 'Blutzucker-Protokoll im Pflegeplan verlinkt.',
  },
  'med-003': {
    instructions: 'Subkutan spritzen. Rotationsprinzip beachten.',
    interactions: ['Beta-Blocker'],
    lastAdministeredAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    empSyncStatus: 'prepared',
    notes: 'Insulinpen im Medikamentenschrank — Kühlkette dokumentiert.',
  },
  'med-004': {
    instructions: 'Max. 3× täglich 400 mg. Nüchtern-Magen beachten.',
    interactions: ['Antikoagulantien'],
    lastAdministeredAt: null,
    empSyncStatus: 'prepared',
    notes: 'Bedarfsmedikation — Schmerzskala vor Gabe erfassen.',
  },
};

export function buildMedicationDetail(item: MedicationListItem, mode: ColorMode = 'dark'): MedicationDetail  {
  const colors = legacyColorsFromPalette(mode);
  const extras = DETAIL_EXTRAS[item.id] ?? {
    instructions: 'Keine speziellen Hinweise hinterlegt.',
    interactions: [],
    lastAdministeredAt: null,
    empSyncStatus: 'prepared' as const,
    notes: 'Demo-Verordnung — eMP-Anbindung folgt.',
  };
  return { ...item, ...extras };
}

export function getDemoMedicationDetail(id: string): MedicationDetail | null {
  const item = getDemoMedicationListItems().find((entry) => entry.id === id);
  return item ? buildMedicationDetail(item) : null;
}

export function buildMedicationDetailKpis(detail: MedicationDetail, mode: ColorMode = 'dark'): MedicationDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const lastAdmin = detail.lastAdministeredAt
    ? new Date(detail.lastAdministeredAt).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return [
    {
      id: 'dosage',
      label: 'Dosierung',
      value: detail.dosage,
      subValue: detail.schedule,
      icon: '💊',
      accentColor: colors.cyan,
    },
    {
      id: 'route',
      label: 'Applikation',
      value: detail.route,
      subValue: detail.prescribedBy,
      icon: '🩺',
      accentColor: colors.success,
    },
    {
      id: 'last',
      label: 'Letzte Gabe',
      value: lastAdmin,
      subValue: detail.empSyncStatus === 'prepared' ? 'eMP ausstehend' : 'Synchronisiert',
      icon: '🕐',
      accentColor: colors.amber,
    },
  ];
}
