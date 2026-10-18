import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { EInvoiceInbox } from '@/components/office/invoices/EInvoiceInbox.web';
import { invoiceWorkspaceCss } from '@/components/office/invoices/invoiceWorkspaceStyles.web';

export function EInvoiceInboxScreen() {
  return <ScreenShell title="Rechnungseingang" contentOwnsHeader><style>{invoiceWorkspaceCss}</style><EInvoiceInbox /></ScreenShell>;
}
