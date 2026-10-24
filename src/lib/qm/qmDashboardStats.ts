import type { QmDashboardSnapshot } from '@/lib/qm/qm.types';
import { moduleColor } from '@/design/tokens/modules';

export type QmDashboardKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildQmDashboardKpis(data: QmDashboardSnapshot): QmDashboardKpi[] {
  const accent = moduleColor('qm');
  return [
    {
      id: 'chapters',
      label: 'Kapitel',
      value: data.sectionErrors?.chapters ? '—' : String(data.chapterCount),
      subValue: data.sectionErrors?.chapters ? 'Nicht geladen' : 'QM-Handbuch',
      icon: '📖',
      accentColor: accent,
    },
    {
      id: 'documents',
      label: 'Dokumente',
      value: data.sectionErrors?.documents ? '—' : String(data.documentCount),
      subValue: data.sectionErrors?.documents ? 'Nicht geladen' : 'Im Mandanten',
      icon: '📄',
      accentColor: accent,
    },
    {
      id: 'compliance',
      label: 'Compliance offen',
      value: data.sectionErrors?.compliance ? '—' : String(data.complianceOpenCount),
      subValue: data.sectionErrors?.compliance ? 'Nicht geladen' : data.complianceOpenCount > 0 ? 'Prüfung empfohlen' : 'Keine offenen',
      icon: '✅',
      accentColor: data.complianceOpenCount > 0 ? moduleColor('stationaer') : accent,
    },
    {
      id: 'md-packages',
      label: 'MD-Mappen',
      value: data.sectionErrors?.mdPackages ? '—' : String(data.mdPackageCount),
      subValue: data.sectionErrors?.mdPackages ? 'Nicht geladen' : 'Prüfpakete',
      icon: '📁',
      accentColor: accent,
    },
    {
      id: 'approvals',
      label: 'Freigaben offen',
      value: data.sectionErrors?.approvals ? '—' : String(data.pendingApprovals),
      subValue: data.sectionErrors?.approvals ? 'Nicht geladen' : data.pendingApprovals > 0 ? 'Wartet auf Freigabe' : 'Keine offenen',
      icon: '🔔',
      accentColor: data.pendingApprovals > 0 ? moduleColor('akademie') : accent,
    },
  ];
}
