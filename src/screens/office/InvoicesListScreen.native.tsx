// Generated native presentation from src/screens/office/InvoicesListScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeStyle,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { InvoicesWorkspace } from "../../components/office/invoices/InvoicesWorkspace.native.tsx";
import { invoiceWorkspaceCss } from "../../components/office/invoices/invoiceWorkspaceStyles.native.ts";
export function InvoicesListScreen(props: {
    onInvoicePress?: (id: string) => void;
    selectedId?: string | null;
    embedded?: boolean;
    initialView?: 'list' | 'run';
} = {}) {
    const content = <><NativeStyle>{invoiceWorkspaceCss}</NativeStyle><InvoicesWorkspace onInvoicePress={props.onInvoicePress} selectedId={props.selectedId} initialView={props.initialView}/></>;
    return props.embedded ? content : <ScreenShell title="Rechnungen" contentOwnsHeader>{content}</ScreenShell>;
}
export function InvoiceRunsScreen() { return <NativeWorkspaceStyleScope css={[invoiceWorkspaceCss]}>{<InvoicesListScreen initialView="run"/>}</NativeWorkspaceStyleScope>; }
