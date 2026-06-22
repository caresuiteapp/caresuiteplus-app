import type { InvoiceListItem } from '@/types/modules/billing';

export type InvoiceListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

function isOverdue(dueDate: string): boolean {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function buildInvoiceListKpis(items: InvoiceListItem[]): InvoiceListKpi[] {
  const open = items.filter(
    (i) => i.status === 'aktiv' || i.status === 'in_bearbeitung' || i.status === 'entwurf',
  );
  const overdue = open.filter((i) => isOverdue(i.dueDate));
  const openCents = open.reduce((sum, i) => sum + i.amountCents, 0);
  const errorCount = items.filter((i) => i.status === 'fehlerhaft').length;

  return [
    {
      id: 'invoices-kpi-open',
      label: 'Offen',
      value: open.length,
      subValue: `${(openCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`,
      icon: '📄',
      accentColor: '#FF9500',
    },
    {
      id: 'invoices-kpi-overdue',
      label: 'Überfällig',
      value: overdue.length,
      subValue: overdue.length > 0 ? 'Fälligkeit prüfen' : 'Keine überfällig',
      icon: '⚠️',
      accentColor: '#FF4D6A',
    },
    {
      id: 'invoices-kpi-errors',
      label: 'Fehlerhaft',
      value: errorCount,
      subValue: `${items.length} gesamt`,
      icon: '🔍',
      accentColor: '#FFD166',
    },
  ];
}
