import { useState } from 'react';
import { useFlowRouter } from '@/hooks/useFlowRouter';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { loadDocumentEngineBindings } from '@/lib/documents/documentEngineService';
import { DocumentsWorkspaceShell } from '@/components/documents/DocumentsWorkspaceShell.web';
import { TEMPLATE_MODULE_LABELS } from '@/components/templates/TemplateWorkspace.web';
import type { PermissionKey } from '@/types/permissions';
import type { TemplateModuleKey } from '@/types/templates';

const sections: { title: string; text: string; route: string; permission: PermissionKey }[] = [
  { title: 'Eigene Textvorlagen', text: 'Gespeicherte Texte bearbeiten, kopieren und archivieren.', route: '/business/templates/tenant', permission: 'office.catalogs.view' },
  { title: 'Nachrichtenvorlagen', text: 'Wiederkehrende Nachrichten für Ihr Team und Ihre Kontakte.', route: '/business/templates/message-templates', permission: 'office.catalogs.view' },
  { title: 'Textbausteine', text: 'Formulierungen für die tägliche Dokumentation.', route: '/business/templates/text-blocks', permission: 'office.catalogs.view' },
  { title: 'Briefkopf & Layout', text: 'Logo, Farben, Seitenränder und Angaben für Ihre Dokumente.', route: '/business/templates/ci-layout', permission: 'office.catalogs.view' },
  { title: 'Vorhandene Dokumentvorlagen', text: 'Bisherige Dokumentvorlagen und gespeicherte Versionen einsehen.', route: '/business/templates/document-templates-html', permission: 'office.catalogs.view' },
  { title: 'Automatische Angaben', text: 'Verfügbare Felder für Klienten, Mitarbeitende und Unternehmen nachschlagen.', route: '/business/templates/placeholders', permission: 'office.catalogs.view' },
];
const areaLabels: Record<string, string> = { client: 'Klientenakte', employee: 'Personalakte', assignment: 'Einsatz', billing: 'Abrechnung', invoice: 'Rechnung', contract: 'Vertrag', service_proof: 'Leistungsnachweis', documentation: 'Dokumentation', intake: 'Aufnahme', onboarding: 'Aufnahme', documents: 'Dokumente', care: 'Pflege', company: 'Unternehmen' };

export function DocumentSettingsHubScreen() {
  const router = useFlowRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can, canAny } = usePermissions();
  const allowed = canAny(['settings.templates.view', 'office.catalogs.view']);
  const canCatalog = can('office.documents.view');
  const canTexts = can('office.catalogs.view');
  const canBindings = canAny(['settings.templates.mapping', 'office.catalogs.view']);
  const [showBindings, setShowBindings] = useState(false);
  const query = useAsyncQuery(
    () => loadDocumentEngineBindings(tenantId!, profile?.roleKey),
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId && allowed && canBindings && showBindings, queryKey: JSON.stringify([tenantId, profile?.roleKey, canBindings]) },
  );

  return <DocumentsWorkspaceShell active="settings" title="Vorlagenverwaltung" description="Eigene Texte und das Erscheinungsbild Ihrer Dokumente verwalten." actions={allowed && canCatalog ? <button className="dw-button dw-button--primary" onClick={() => router.push('/business/office/document-catalog' as never)}>{can('documents.create') ? 'Dokument erstellen' : 'Dokumentenkatalog ansehen'}</button> : undefined}>
    {!allowed ? <div className="dw-alert" data-tone="danger" role="alert">Für die Vorlagenverwaltung fehlt die Berechtigung.</div> : !tenantId ? <div className="dw-alert">Bitte zuerst ein Unternehmen auswählen.</div> : <>
      {canCatalog ? <section className="dw-panel"><div className="dw-toolbar"><div style={{ flex: '1 1 280px' }}><h2>Dokumentenkatalog</h2><p className="dw-muted">Verträge, Formulare und Nachweise finden Sie im zentralen Katalog. Dort werden die passenden Angaben aus Ihren Akten übernommen.</p></div><button className="dw-button" onClick={() => router.push('/business/office/document-catalog' as never)}>Zum Katalog</button></div></section> : null}
      {!canTexts ? <div className="dw-alert" role="status">Sie dürfen die Einstellungsübersicht öffnen. Für Textvorlagen und Dokumentgestaltung fehlt Ihrer Rolle die entsprechende Freigabe.</div> : null}
      <div className="dw-grid">{sections.map(section => {
        const accessible = can(section.permission);
        return <section className="dw-panel" key={section.route} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><h2>{section.title}</h2><p className="dw-muted" style={{ flex: 1 }}>{section.text}</p><button className="dw-button" disabled={!accessible} onClick={() => { if (accessible) router.push(section.route as never); }} aria-label={`${section.title}: ${accessible ? 'öffnen' : 'nicht freigegeben'}`}>{accessible ? 'Öffnen' : 'Nicht freigegeben'}</button></section>;
      })}</div>
      {canBindings ? <section className="dw-panel"><div className="dw-toolbar"><div style={{ flex: '1 1 260px' }}><h2>Automatische Dokumentzuordnung</h2><p className="dw-muted">Vorlagen, die für bestehende Abläufe hinterlegt sind.</p></div><button className="dw-button" aria-expanded={showBindings} onClick={() => setShowBindings(!showBindings)}>{showBindings ? 'Ausblenden' : 'Zuordnungen ansehen'}</button></div>{showBindings ? <>
        {query.loading ? <p role="status">Zuordnungen werden geladen …</p> : null}
        {query.error || query.refreshError ? <div className="dw-alert" data-tone="danger" role="alert">{query.error || query.refreshError}<button className="dw-button" onClick={() => void query.refresh()}>Erneut laden</button></div> : null}
        {!query.loading && !query.error && (query.data ?? []).length === 0 ? <p className="dw-muted">Für Ihr Unternehmen sind keine automatischen Zuordnungen hinterlegt.</p> : null}
        {query.data?.length ? <div className="dw-table-wrap"><table className="dw-table"><thead><tr><th>Vorlage</th><th>Verwendung</th><th>Status</th></tr></thead><tbody>{query.data.map(binding => <tr key={binding.id}><td>{binding.templateName || 'Gespeicherte Dokumentvorlage'}</td><td>{TEMPLATE_MODULE_LABELS[binding.targetModule as TemplateModuleKey] ?? 'Allgemein'} · {areaLabels[binding.targetArea] ?? 'Dokumentablauf'}{binding.isDefault ? ' · Standard' : ''}{binding.isRequired ? ' · Erforderlich' : ''}</td><td><span className="dw-status" data-tone={binding.isActive ? 'success' : 'neutral'}>{binding.isActive ? 'Aktiv' : 'Inaktiv'}</span></td></tr>)}</tbody></table></div> : null}
      </> : null}</section> : null}
      <div className="dw-toolbar">{canTexts ? <><button className="dw-button dw-button--quiet" onClick={() => router.push('/business/templates/settings' as never)}>Einstellungen für Textvorlagen</button><button className="dw-button dw-button--quiet" onClick={() => router.push('/business/templates/categories' as never)}>Vorlagenkategorien</button><button className="dw-button dw-button--quiet" onClick={() => router.push('/business/templates/catalogs' as never)}>Gespeicherte Auswahlwerte</button></> : null}{can('office.catalogs.edit') ? <button className="dw-button" onClick={() => router.push('/business/templates/create' as never)}>Textvorlage anlegen</button> : null}</div>
    </>}
  </DocumentsWorkspaceShell>;
}
