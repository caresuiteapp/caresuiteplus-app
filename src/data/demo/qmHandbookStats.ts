import type { QmHandbook, QmHandbookChapter } from '@/lib/qm';

export type QmHandbookKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildQmHandbookKpis(
  chapters: QmHandbookChapter[],
  handbook: QmHandbook | null,
): QmHandbookKpi[] {
  const published = chapters.filter((c) => c.status === 'published' || c.status === 'approved').length;
  const inReview = chapters.filter((c) => c.status === 'in_review').length;
  const draft = chapters.filter((c) => c.status === 'draft').length;
  const version = handbook?.version ?? '—';

  return [
    {
      id: 'qm-hb-kpi-chapters',
      label: 'Kapitel',
      value: chapters.length,
      subValue: `Handbuch v${version}`,
      icon: '📖',
      accentColor: '#62F3FF',
    },
    {
      id: 'qm-hb-kpi-published',
      label: 'Veröffentlicht',
      value: published,
      subValue: published > 0 ? 'Freigegeben' : 'Keine Freigaben',
      icon: '✅',
      accentColor: '#4ADE80',
    },
    {
      id: 'qm-hb-kpi-review',
      label: 'In Prüfung',
      value: inReview + draft,
      subValue: inReview > 0 ? `${inReview} zur Freigabe` : 'Aktuell keine',
      icon: '🔍',
      accentColor: '#FFD166',
    },
  ];
}
