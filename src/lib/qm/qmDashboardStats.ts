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
      value: String(data.chapterCount),
      subValue: 'QM-Handbuch',
      icon: '📖',
      accentColor: accent,
    },
    {
      id: 'documents',
      label: 'Dokumente',
      value: String(data.documentCount),
      subValue: 'Im Mandanten',
      icon: '📄',
      accentColor: accent,
    },
    {
      id: 'compliance',
      label: 'Compliance offen',
      value: String(data.complianceOpenCount),
      subValue: data.complianceOpenCount > 0 ? 'Prüfung empfohlen' : 'Keine offenen',
      icon: '✅',
      accentColor: data.complianceOpenCount > 0 ? moduleColor('stationaer') : accent,
    },
    {
      id: 'md-packages',
      label: 'MD-Mappen',
      value: String(data.mdPackageCount),
      subValue: 'Prüfpakete',
      icon: '📁',
      accentColor: accent,
    },
    {
      id: 'approvals',
      label: 'Freigaben offen',
      value: String(data.pendingApprovals),
      subValue: data.pendingApprovals > 0 ? 'Wartet auf Freigabe' : 'Keine offenen',
      icon: '🔔',
      accentColor: data.pendingApprovals > 0 ? moduleColor('akademie') : accent,
    },
  ];
}
