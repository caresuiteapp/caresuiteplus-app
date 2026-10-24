// Generated native presentation from src/screens/office/InvoiceCreateScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeStyle,NativeDiv,NativeSection,NativeH1,NativeP,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { InvoiceEditor } from "../../components/office/invoices/InvoiceEditor.native.tsx";
import { invoiceEditorCss } from "../../components/office/invoices/invoiceEditorStyles.native.ts";
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import type { OfficeInvoiceProductKey } from "../../lib/office/invoiceWorkspaceService.native.ts";
export function InvoiceCreateScreen() {
    const auth = useAuth();
    const { roleKey, can, permissions } = usePermissions();
    const tenantId = useServiceTenantId()?.trim() ?? '';
    const params = useLocalSearchParams<{
        module?: string;
        clientId?: string;
    }>();
    const module: OfficeInvoiceProductKey = ['assist', 'pflege', 'stationaer', 'beratung'].includes(params.module ?? '') ? params.module as OfficeInvoiceProductKey : 'assist';
    const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('office.invoices.view') && can('office.invoices.create'));
    const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, [...new Set(permissions)].sort()]);
    return <NativeWorkspaceStyleScope css={[invoiceEditorCss, invoiceEditorCss]}>{<ScreenShell title="Einzelrechnung" contentOwnsHeader><NativeStyle>{invoiceEditorCss}</NativeStyle>{!auth.authReady ? <NativeDiv className="ie ie-empty" role="status">Zugang wird geprüft …</NativeDiv> : allowed && roleKey ? <InvoiceEditor key={scopeKey} {...{ tenantId, roleKey, scopeKey }} initialModule={module} initialClientId={typeof params.clientId === 'string' ? params.clientId : undefined}/> : <NativeSection className="ie ie-panel ie-empty"><NativeH1>Einzelrechnung erstellen</NativeH1><NativeP>Zum Erstellen einer Rechnung benötigen Sie einen Verwaltungszugang mit der Berechtigung „Rechnungen anlegen“.</NativeP></NativeSection>}</ScreenShell>}</NativeWorkspaceStyleScope>;
}
