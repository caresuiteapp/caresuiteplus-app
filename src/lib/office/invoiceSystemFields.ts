export const INVOICE_TYPE_OPTIONS = [
  { value: 'service', label: 'Leistungsrechnung', description: 'Abrechnung erbrachter Pflege- und Betreuungsleistungen' },
  { value: 'private', label: 'Privatrechnung', description: 'Direkte Abrechnung mit der Klientin oder dem Klienten' },
  { value: 'correction', label: 'Korrekturrechnung', description: 'Korrektur einer bereits erstellten Rechnung' },
] as const;

export const PAYMENT_TERM_OPTIONS = [
  { value: '7', label: '7 Tage' },
  { value: '14', label: '14 Tage (Standard)' },
  { value: '21', label: '21 Tage' },
  { value: '30', label: '30 Tage' },
] as const;

export function buildBillingPeriodOptions(now = new Date(), count = 13) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      value,
      label: new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(date),
    };
  });
}

export function calculateDueDate(paymentTermDays: string, now = new Date()): string {
  const days = Number.parseInt(paymentTermDays, 10);
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (Number.isFinite(days) ? days : 14));
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
}

export function buildSystemInvoiceNumber(
  invoiceType: string,
  billingPeriod: string,
  now = new Date(),
): string {
  const prefix = invoiceType === 'private' ? 'PR' : invoiceType === 'correction' ? 'KR' : 'RE';
  const suffix = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
  return `${prefix}-${billingPeriod.replace('-', '')}-${suffix}`;
}
