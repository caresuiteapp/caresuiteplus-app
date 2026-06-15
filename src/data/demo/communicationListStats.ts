import type { ThreadListItem } from '@/features/communication/communication.types';

export type CommunicationListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildCommunicationListKpis(items: ThreadListItem[]): CommunicationListKpi[] {
  const unread = items.reduce((sum, item) => sum + item.unreadCountBusiness, 0);
  const open = items.filter(
    (item) => item.status === 'open' || item.status === 'waiting_for_business',
  ).length;
  const withAttachments = items.filter((item) => item.hasAttachments).length;

  return [
    {
      id: 'comm-kpi-unread',
      label: 'Ungelesen',
      value: unread,
      subValue: unread > 0 ? 'Threads prüfen' : 'Alles gelesen',
      icon: '📬',
      accentColor: '#62F3FF',
    },
    {
      id: 'comm-kpi-open',
      label: 'Offen',
      value: open,
      subValue: `${items.length} Threads`,
      icon: '💬',
      accentColor: '#4ADE80',
    },
    {
      id: 'comm-kpi-attachments',
      label: 'Anhänge',
      value: withAttachments,
      subValue: withAttachments > 0 ? 'Mit Dateien' : 'Keine Anhänge',
      icon: '📎',
      accentColor: '#FF9500',
    },
  ];
}
