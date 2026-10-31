// Generated native presentation from src/screens/documents/DocumentSettingsHubScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeDiv,NativeSection,NativeH2,NativeP,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeSpan} from '@/components/layout/NativeWorkspaceElements.native';
import { useState } from 'react';
import { useFlowRouter } from "../../hooks/useFlowRouter.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { loadDocumentEngineBindings } from '@/lib/documents/documentEngineService';
import { DocumentsWorkspaceShell } from "../../components/documents/DocumentsWorkspaceShell.native.tsx";
import { TEMPLATE_MODULE_LABELS } from "../../components/templates/TemplateWorkspace.native.tsx";
import type { PermissionKey } from '@/types/permissions';
import type { TemplateModuleKey } from '@/types/templates';
const sections: {
    title: string;
    text: string;
    route: string;
    permission: PermissionKey;
}[] = [
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
    const query = useAsyncQuery(() => loadDocumentEngineBindings(tenantId!, profile?.roleKey), [tenantId, profile?.roleKey], { enabled: !!tenantId && allowed && canBindings && showBindings, queryKey: JSON.stringify([tenantId, profile?.roleKey, canBindings]) });
    return <DocumentsWorkspaceShell active="settings" title="Vorlagenverwaltung" description="Eigene Texte und das Erscheinungsbild Ihrer Dokumente verwalten." actions={allowed && canCatalog ? <NativeButton className="dw-button dw-button--primary" onClick={() => router.push('/business/office/document-catalog' as never)}>{can('documents.create') ? 'Dokument erstellen' : 'Dokumentenkatalog ansehen'}</NativeButton> : undefined}>
    {!allowed ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">Für die Vorlagenverwaltung fehlt die Berechtigung.</NativeDiv> : !tenantId ? <NativeDiv className="dw-alert">Bitte zuerst ein Unternehmen auswählen.</NativeDiv> : <>
      {canCatalog ? <NativeSection className="dw-panel"><NativeDiv className="dw-toolbar"><NativeDiv style={{ flex: '1 1 280px' }}><NativeH2>Dokumentenkatalog</NativeH2><NativeP className="dw-muted">Verträge, Formulare und Nachweise finden Sie im zentralen Katalog. Dort werden die passenden Angaben aus Ihren Akten übernommen.</NativeP></NativeDiv><NativeButton className="dw-button" onClick={() => router.push('/business/office/document-catalog' as never)}>Zum Katalog</NativeButton></NativeDiv></NativeSection> : null}
      {!canTexts ? <NativeDiv className="dw-alert" role="status">Sie dürfen die Einstellungsübersicht öffnen. Für Textvorlagen und Dokumentgestaltung fehlt Ihrer Rolle die entsprechende Freigabe.</NativeDiv> : null}
      <NativeDiv className="dw-grid">{sections.map(section => {
                const accessible = can(section.permission);
                return <NativeSection className="dw-panel" key={section.route} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><NativeH2>{section.title}</NativeH2><NativeP className="dw-muted" style={{ flex: 1 }}>{section.text}</NativeP><NativeButton className="dw-button" disabled={!accessible} onClick={() => { if (accessible)
                    router.push(section.route as never); }} aria-label={`${section.title}: ${accessible ? 'öffnen' : 'nicht freigegeben'}`}>{accessible ? 'Öffnen' : 'Nicht freigegeben'}</NativeButton></NativeSection>;
            })}</NativeDiv>
      {canBindings ? <NativeSection className="dw-panel"><NativeDiv className="dw-toolbar"><NativeDiv style={{ flex: '1 1 260px' }}><NativeH2>Automatische Dokumentzuordnung</NativeH2><NativeP className="dw-muted">Vorlagen, die für bestehende Abläufe hinterlegt sind.</NativeP></NativeDiv><NativeButton className="dw-button" aria-expanded={showBindings} onClick={() => setShowBindings(!showBindings)}>{showBindings ? 'Ausblenden' : 'Zuordnungen ansehen'}</NativeButton></NativeDiv>{showBindings ? <>
        {query.loading ? <NativeP role="status">Zuordnungen werden geladen …</NativeP> : null}
        {query.error || query.refreshError ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{query.error || query.refreshError}<NativeButton className="dw-button" onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
        {!query.loading && !query.error && (query.data ?? []).length === 0 ? <NativeP className="dw-muted">Für Ihr Unternehmen sind keine automatischen Zuordnungen hinterlegt.</NativeP> : null}
        {query.data?.length ? <NativeDiv className="dw-table-wrap"><NativeTable className="dw-table"><NativeThead><NativeTr><NativeTh>Vorlage</NativeTh><NativeTh>Verwendung</NativeTh><NativeTh>Status</NativeTh></NativeTr></NativeThead><NativeTbody>{query.data.map(binding => <NativeTr key={binding.id}><NativeTd>{binding.templateName || 'Gespeicherte Dokumentvorlage'}</NativeTd><NativeTd>{TEMPLATE_MODULE_LABELS[binding.targetModule as TemplateModuleKey] ?? 'Allgemein'} · {areaLabels[binding.targetArea] ?? 'Dokumentablauf'}{binding.isDefault ? ' · Standard' : ''}{binding.isRequired ? ' · Erforderlich' : ''}</NativeTd><NativeTd><NativeSpan className="dw-status" data-tone={binding.isActive ? 'success' : 'neutral'}>{binding.isActive ? 'Aktiv' : 'Inaktiv'}</NativeSpan></NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv> : null}
      </> : null}</NativeSection> : null}
      <NativeDiv className="dw-toolbar">{canTexts ? <><NativeButton className="dw-button dw-button--quiet" onClick={() => router.push('/business/templates/settings' as never)}>Einstellungen für Textvorlagen</NativeButton><NativeButton className="dw-button dw-button--quiet" onClick={() => router.push('/business/templates/categories' as never)}>Vorlagenkategorien</NativeButton><NativeButton className="dw-button dw-button--quiet" onClick={() => router.push('/business/templates/catalogs' as never)}>Gespeicherte Auswahlwerte</NativeButton></> : null}{can('office.catalogs.edit') ? <NativeButton className="dw-button" onClick={() => router.push('/business/templates/create' as never)}>Textvorlage anlegen</NativeButton> : null}</NativeDiv>
    </>}
  </DocumentsWorkspaceShell>;
}
