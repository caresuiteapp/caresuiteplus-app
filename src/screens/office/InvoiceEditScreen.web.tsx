import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { InvoiceEditor } from '@/components/office/invoices/InvoiceEditor.web';
import { invoiceEditorCss } from '@/components/office/invoices/invoiceEditorStyles.web';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { fetchOfficeInvoice } from '@/lib/office/invoiceWorkspaceService.web';
import type { RoleKey } from '@/types';

export function InvoiceEditScreen() {
  const auth = useAuth(); const { roleKey, can, permissions } = usePermissions();
  const tenantId = useServiceTenantId()?.trim() ?? ''; const params = useLocalSearchParams<{ id?: string | string[] }>();
  const invoiceId = typeof params.id === 'string' ? params.id : '';
  const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('office.invoices.view') && can('office.invoices.create'));
  const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, invoiceId, [...new Set(permissions)].sort()]);
  return <ScreenShell title="Rechnungsentwurf bearbeiten" contentOwnsHeader><style>{invoiceEditorCss}</style>{!auth.authReady ? <div className="ie ie-empty" role="status">Zugang wird geprüft …</div> : allowed && roleKey ? <InvoiceEditLoader key={scopeKey} {...{ tenantId, roleKey, invoiceId, scopeKey }} /> : <section className="ie ie-panel ie-empty"><h1>Rechnung bearbeiten</h1><p>Für die Bearbeitung benötigen Sie einen Verwaltungszugang mit der Berechtigung „Rechnungen anlegen“.</p></section>}</ScreenShell>;
}
function InvoiceEditLoader({ tenantId, roleKey, invoiceId, scopeKey }: { tenantId: string; roleKey: RoleKey; invoiceId: string; scopeKey: string }) {
  const router = useRouter();
  const query = useAsyncQuery(() => fetchOfficeInvoice(tenantId, invoiceId, roleKey), [tenantId, invoiceId, roleKey], { queryKey: scopeKey, retryCount: 0 });
  if (query.loading) return <div className="ie" role="status" aria-label="Rechnungsentwurf wird geladen"><div className="ie-loading" /><div className="ie-loading" /></div>;
  if (query.error || !query.data) return <div className="ie ie-panel ie-empty"><h2>Rechnung nicht verfügbar</h2><p role="alert">{query.error || 'Der Rechnungsentwurf wurde nicht gefunden.'}</p><button onClick={() => void query.refresh()}>Erneut laden</button></div>;
  if (query.data.status !== 'draft') return <section className="ie ie-panel ie-empty"><h2>Diese Rechnung ist abgeschlossen</h2><p>Freigegebene Rechnungen können nicht mehr direkt verändert werden. Die gespeicherten Rechnungsdaten bleiben erhalten.</p><button onClick={() => router.replace(`/business/office/invoices/${invoiceId}` as never)}>Rechnung ansehen</button></section>;
  return <InvoiceEditor key={`${scopeKey}:${query.data.updatedAt}`} {...{ tenantId, roleKey, scopeKey }} initialInvoice={query.data} />;
}
