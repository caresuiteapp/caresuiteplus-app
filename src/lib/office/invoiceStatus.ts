import type { WorkflowStatus } from '@/types/core/base';
import type { InvoiceStatus } from '@/types/modules/billing';

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Entwurf',
  ready: 'Bereit',
  sent: 'Versendet',
  partly_paid: 'Teilbezahlt',
  paid: 'Bezahlt',
  overdue: 'Überfällig',
  cancelled: 'Storniert',
  written_off: 'Abgeschrieben',
};

export const INVOICE_STATUS_HINTS: Record<InvoiceStatus, string> = {
  draft: 'Positionen prüfen und Rechnung zur Freigabe vorbereiten.',
  ready: 'Rechnung ist geprüft und kann versendet werden.',
  sent: 'Zahlungseingang überwachen.',
  partly_paid: 'Offenen Restbetrag überwachen.',
  paid: 'Rechnung ist vollständig bezahlt.',
  overdue: 'Zahlung prüfen und gegebenenfalls Mahnlauf starten.',
  cancelled: 'Rechnung wurde storniert und kann nicht weiterbearbeitet werden.',
  written_off: 'Forderung wurde abgeschrieben.',
};

export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['ready', 'cancelled'],
  ready: ['sent', 'draft', 'cancelled'],
  sent: ['partly_paid', 'paid', 'overdue', 'cancelled'],
  partly_paid: ['paid', 'overdue'],
  overdue: ['partly_paid', 'paid', 'written_off'],
  paid: [],
  cancelled: [],
  written_off: [],
};

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return value in INVOICE_STATUS_LABELS;
}

export function getAllowedInvoiceStatusActions(status: InvoiceStatus): InvoiceStatus[] {
  return INVOICE_STATUS_TRANSITIONS[status] ?? [];
}

export function canTransitionInvoiceStatus(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return getAllowedInvoiceStatusActions(from).includes(to);
}

export function mapLegacyWorkflowToInvoiceStatus(status: WorkflowStatus): InvoiceStatus {
  switch (status) {
    case 'entwurf': return 'draft';
    case 'in_bearbeitung': return 'ready';
    case 'aktiv': return 'sent';
    case 'abgeschlossen': return 'paid';
    case 'fehlerhaft': return 'overdue';
    case 'gesperrt': return 'cancelled';
    case 'archiviert': return 'written_off';
    default: return 'draft';
  }
}
