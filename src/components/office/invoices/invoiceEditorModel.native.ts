// Generated native presentation from src/components/office/invoices/invoiceEditorModel.web.ts. Update through scripts/port-native-workspaces.mjs.
/** Strict input parsing keeps incomplete edits from silently turning into zero amounts. */
export function parseInvoiceEditorDecimal(value: string, decimals = 2): number | null {
    const text = value.trim();
    if (!new RegExp(`^\\d+(?:[.,]\\d{1,${decimals}})?$`).test(text))
        return null;
    const number = Number(text.replace(',', '.'));
    return Number.isFinite(number) && number >= 0 ? number : null;
}
export function invoiceEditorMoney(cents: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
export function invoiceEditorDate(value: string | null | undefined): string {
    if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value))
        return '—';
    const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
}
export function invoiceEditorToday(): string {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function invoiceEditorDueDate(invoiceDate: string, days: number): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) || !Number.isInteger(days) || days < 0 || days > 365)
        return '';
    const date = new Date(`${invoiceDate}T12:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== invoiceDate)
        return '';
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}
export function invoiceEditorMonthPeriod(date: string): {
    start: string;
    end: string;
} {
    const [year, month] = date.split('-').map(Number);
    return { start: `${date.slice(0, 7)}-01`, end: new Date(Date.UTC(year, month, 0, 12)).toISOString().slice(0, 10) };
}
export type InvoiceEditorLineText = {
    quantity: string;
    price: string;
    tax: string;
};
export function validateInvoiceEditorLineText(line: InvoiceEditorLineText): string | null {
    const quantity = parseInvoiceEditorDecimal(line.quantity, 2);
    const price = parseInvoiceEditorDecimal(line.price);
    const tax = parseInvoiceEditorDecimal(line.tax);
    if (quantity == null || quantity <= 0)
        return 'Die Menge muss größer als 0 sein und darf höchstens zwei Nachkommastellen enthalten.';
    if (price == null)
        return 'Den Einzelpreis mit höchstens zwei Nachkommastellen eingeben.';
    if (tax == null || tax > 100)
        return 'Die Umsatzsteuer muss zwischen 0 und 100 Prozent liegen.';
    return null;
}
