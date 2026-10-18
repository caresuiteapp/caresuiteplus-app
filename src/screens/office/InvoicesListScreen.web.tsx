import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { InvoicesWorkspace } from '@/components/office/invoices/InvoicesWorkspace.web';
import { invoiceWorkspaceCss } from '@/components/office/invoices/invoiceWorkspaceStyles.web';

export function InvoicesListScreen(props: { onInvoicePress?: (id: string) => void; selectedId?: string | null; embedded?: boolean; initialView?: 'list' | 'run' } = {}) {
  const content = <><style>{invoiceWorkspaceCss}</style><InvoicesWorkspace onInvoicePress={props.onInvoicePress} selectedId={props.selectedId} initialView={props.initialView} /></>;
  return props.embedded ? content : <ScreenShell title="Rechnungen" contentOwnsHeader>{content}</ScreenShell>;
}

export function InvoiceRunsScreen() { return <InvoicesListScreen initialView="run" />; }
