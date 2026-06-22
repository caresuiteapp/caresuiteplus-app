import type { ReportListItem } from '@/types/reporting';

export type ReportListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildReportListKpis(items: ReportListItem[]): ReportListKpi[] {
  const active = items.filter((item) => item.status === 'aktiv').length;
  const inProgress = items.filter((item) => item.status === 'in_bearbeitung' || item.status === 'entwurf').length;
  const completed = items.filter((item) => item.status === 'abgeschlossen').length;

  return [
    {
      id: 'report-kpi-active',
      label: 'Aktiv',
      value: active,
      subValue: `${items.length} gesamt`,
      icon: '📊',
      accentColor: '#62F3FF',
    },
    {
      id: 'report-kpi-progress',
      label: 'In Arbeit',
      value: inProgress,
      subValue: inProgress > 0 ? 'Entwurf / Bearbeitung' : 'Keine offenen',
      icon: '📝',
      accentColor: '#FFD166',
    },
    {
      id: 'report-kpi-done',
      label: 'Abgeschlossen',
      value: completed,
      subValue: completed > 0 ? 'Archiviert' : 'Noch keine',
      icon: '✅',
      accentColor: '#4ADE80',
    },
  ];
}

export const REPORT_CATEGORY_LABELS = {
  pdl: 'PDL',
  quality: 'Qualität',
  finance: 'Finanzen',
  operations: 'Betrieb',
} as const;
