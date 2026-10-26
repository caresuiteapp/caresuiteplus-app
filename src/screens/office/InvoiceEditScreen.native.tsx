// Generated native presentation from src/screens/office/InvoiceEditScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeStyle,NativeDiv,NativeSection,NativeH1,NativeP,NativeH2,NativeButton,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenShell } from "../../components/layout/ScreenShell.tsx";
import { InvoiceEditor } from "../../components/office/invoices/InvoiceEditor.native.tsx";
import { invoiceEditorCss } from "../../components/office/invoices/invoiceEditorStyles.native.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { fetchOfficeInvoice } from "../../lib/office/invoiceWorkspaceService.native.ts";
import type { RoleKey } from '@/types';
export function InvoiceEditScreen() {
    const auth = useAuth();
    const { roleKey, can, permissions } = usePermissions();
    const tenantId = useServiceTenantId()?.trim() ?? '';
    const params = useLocalSearchParams<{
        id?: string | string[];
    }>();
    const invoiceId = typeof params.id === 'string' ? params.id : '';
    const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('office.invoices.view') && can('office.invoices.create'));
    const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, invoiceId, [...new Set(permissions)].sort()]);
    return <NativeWorkspaceStyleScope css={[invoiceEditorCss, invoiceEditorCss]}>{<ScreenShell title="Rechnungsentwurf bearbeiten" contentOwnsHeader><NativeStyle>{invoiceEditorCss}</NativeStyle>{!auth.authReady ? <NativeDiv className="ie ie-empty" role="status">Zugang wird geprüft …</NativeDiv> : allowed && roleKey ? <InvoiceEditLoader key={scopeKey} {...{ tenantId, roleKey, invoiceId, scopeKey }}/> : <NativeSection className="ie ie-panel ie-empty"><NativeH1>Rechnung bearbeiten</NativeH1><NativeP>Für die Bearbeitung benötigen Sie einen Verwaltungszugang mit der Berechtigung „Rechnungen anlegen“.</NativeP></NativeSection>}</ScreenShell>}</NativeWorkspaceStyleScope>;
}
function InvoiceEditLoader({ tenantId, roleKey, invoiceId, scopeKey }: {
    tenantId: string;
    roleKey: RoleKey;
    invoiceId: string;
    scopeKey: string;
}) {
    const router = useRouter();
    const [reloadVersion, setReloadVersion] = useState(0);
    const query = useAsyncQuery(() => fetchOfficeInvoice(tenantId, invoiceId, roleKey), [tenantId, invoiceId, roleKey], { queryKey: scopeKey, retryCount: 0 });
    if (query.loading)
        return <NativeWorkspaceStyleScope css={[invoiceEditorCss]}>{<NativeDiv className="ie" role="status" aria-label="Rechnungsentwurf wird geladen"><NativeDiv className="ie-loading"/><NativeDiv className="ie-loading"/></NativeDiv>}</NativeWorkspaceStyleScope>;
    if (query.error || !query.data)
        return <NativeWorkspaceStyleScope css={[invoiceEditorCss]}>{<NativeDiv className="ie ie-panel ie-empty"><NativeH2>Rechnung nicht verfügbar</NativeH2><NativeP role="alert">{query.error || 'Der Rechnungsentwurf wurde nicht gefunden.'}</NativeP><NativeButton onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv>}</NativeWorkspaceStyleScope>;
    if (query.data.status !== 'draft')
        return <NativeWorkspaceStyleScope css={[invoiceEditorCss]}>{<NativeSection className="ie ie-panel ie-empty"><NativeH2>Diese Rechnung ist abgeschlossen</NativeH2><NativeP>Freigegebene Rechnungen können nicht mehr direkt verändert werden. Die gespeicherten Rechnungsdaten bleiben erhalten.</NativeP><NativeButton onClick={() => router.replace(`/business/office/invoices/${invoiceId}` as never)}>Rechnung ansehen</NativeButton></NativeSection>}</NativeWorkspaceStyleScope>;
    return <NativeWorkspaceStyleScope key={`${scopeKey}:${query.data.updatedAt}:${reloadVersion}`} css={[invoiceEditorCss]}>{<InvoiceEditor key={`${scopeKey}:${query.data.updatedAt}:${reloadVersion}`} {...{ tenantId, roleKey, scopeKey }} initialInvoice={query.data} onReload={async () => { if (!await query.refreshWithResult())
        throw new Error('Der aktuelle Rechnungsstand konnte nicht geladen werden. Ihre Eingaben bleiben erhalten.'); setReloadVersion(value => value + 1); }}/>}</NativeWorkspaceStyleScope>;
}
