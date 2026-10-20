import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { InvoiceEditor } from '@/components/office/invoices/InvoiceEditor.web';
import { invoiceEditorCss } from '@/components/office/invoices/invoiceEditorStyles.web';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import type { OfficeInvoiceProductKey } from '@/lib/office/invoiceWorkspaceService.web';

export function InvoiceCreateScreen() {
  const auth = useAuth(); const { roleKey, can, permissions } = usePermissions();
  const tenantId = useServiceTenantId()?.trim() ?? '';
  const params = useLocalSearchParams<{ module?: string; clientId?: string }>();
  const module: OfficeInvoiceProductKey = ['assist', 'pflege', 'stationaer', 'beratung'].includes(params.module ?? '') ? params.module as OfficeInvoiceProductKey : 'assist';
  const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('office.invoices.view') && can('office.invoices.create'));
  const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, [...new Set(permissions)].sort()]);
  return <ScreenShell title="Einzelrechnung" contentOwnsHeader><style>{invoiceEditorCss}</style>{!auth.authReady ? <div className="ie ie-empty" role="status">Zugang wird geprüft …</div> : allowed && roleKey ? <InvoiceEditor key={scopeKey} {...{ tenantId, roleKey, scopeKey }} initialModule={module} initialClientId={typeof params.clientId === 'string' ? params.clientId : undefined} /> : <section className="ie ie-panel ie-empty"><h1>Einzelrechnung erstellen</h1><p>Zum Erstellen einer Rechnung benötigen Sie einen Verwaltungszugang mit der Berechtigung „Rechnungen anlegen“.</p></section>}</ScreenShell>;
}
