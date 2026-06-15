import type { InvoiceDetail } from '@/types/modules/invoiceDetail';
import { formatCurrency } from './invoiceListService';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type InvoiceDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function daysUntil(iso: string): number {
  const due = new Date(iso);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function buildInvoiceDetailKpis(invoice: InvoiceDetail, mode: ColorMode = 'dark'): InvoiceDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const days = daysUntil(invoice.dueDate);
  const lineCount = invoice.lineItems.length;

  return [
    {
      id: 'amount',
      label: 'Betrag',
      value: formatCurrency(invoice.amountCents, invoice.currency),
      subValue: lineCount === 1 ? '1 Position' : `${lineCount} Positionen`,
      icon: '💶',
      accentColor: colors.orange,
    },
    {
      id: 'due',
      label: 'Fällig',
      value: formatShortDate(invoice.dueDate),
      subValue: days < 0 ? `${Math.abs(days)} Tage überfällig` : days === 0 ? 'Heute' : `in ${days} Tagen`,
      icon: '📆',
      accentColor: days < 0 ? colors.danger : days <= 7 ? colors.orange : colors.cyan,
    },
    {
      id: 'issued',
      label: 'Rechnungsdatum',
      value: formatShortDate(invoice.issuedDate),
      icon: '📋',
      accentColor: colors.violet,
    },
    {
      id: 'audit',
      label: 'Audit',
      value: String(invoice.auditEntries.length),
      subValue: invoice.auditEntries.length === 1 ? 'Eintrag' : 'Einträge',
      icon: '🔍',
      accentColor: colors.success,
    },
  ];
}
