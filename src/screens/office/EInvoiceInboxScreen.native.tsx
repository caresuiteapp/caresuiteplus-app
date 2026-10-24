// Generated native presentation from src/screens/office/EInvoiceInboxScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeStyle,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { EInvoiceInbox } from "../../components/office/invoices/EInvoiceInbox.native.tsx";
import { invoiceWorkspaceCss } from "../../components/office/invoices/invoiceWorkspaceStyles.native.ts";
export function EInvoiceInboxScreen() {
    return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss, invoiceWorkspaceCss]}>{<ScreenShell title="Rechnungseingang" contentOwnsHeader><NativeStyle>{invoiceWorkspaceCss}</NativeStyle><EInvoiceInbox /></ScreenShell>}</NativeWorkspaceStyleScope>;
}
