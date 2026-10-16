import { useMemo, useState } from 'react';
import { useFlowRouter } from '@/hooks/useFlowRouter';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchModuleAssignmentList } from '@/lib/officeModules/moduleAssignmentService';
import { resolveWorkflowStatusLabel } from '@/lib/workflow/workflowStatusPresentation';
import { PRODUCT_LABELS } from '@/data/constants/productLabels';
import { DocumentsWorkspaceShell } from '@/components/documents/DocumentsWorkspaceShell.web';
import type { ProductKey } from '@/types';

const visibilityLabels: Record<string, string> = { 'module only': 'Im zugeordneten Bereich', 'office and module': 'In Office und im zugeordneten Bereich', portal: 'Im Portal' };

export function DocumentModuleAssignmentsScreen({ section = 'documents' }: { section?: 'documents' | 'templates' }) {
  const router = useFlowRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can } = usePermissions();
  const allowed = can('office.access') && can(section === 'documents' ? 'office.documents.view' : 'office.catalogs.view');
  const [search, setSearch] = useState('');
  const [module, setModule] = useState<ProductKey | 'all'>('all');
  const query = useAsyncQuery(
    () => fetchModuleAssignmentList(tenantId!, section, profile?.roleKey),
    [tenantId, section, profile?.roleKey],
    { enabled: !!tenantId && allowed, queryKey: JSON.stringify([tenantId, section, profile?.roleKey, allowed]) },
  );
  const modules = useMemo(() => [...new Set((query.data ?? []).map(item => item.moduleKey))], [query.data]);
  const rows = (query.data ?? []).filter(item => (module === 'all' || item.moduleKey === module) && `${item.title} ${item.subtitle}`.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE')));
  const title = section === 'documents' ? 'Dokument-Sichtbarkeit' : 'Vorlagen-Zuordnung';
  const canOpenTarget = can('office.documents.view');
  const target = section === 'documents' ? '/business/office/documents' : '/business/office/document-catalog';

  return <DocumentsWorkspaceShell active="settings" title={title} description={section === 'documents' ? 'Gespeicherte Freigaben Ihrer Dokumente für Arbeitsbereiche und Portale.' : 'Gespeicherte Zuordnungen vorhandener Vorlagen zu den Arbeitsbereichen.'} back={{ label: 'Zuordnungsübersicht', onClick: () => router.push('/business/office/modules' as never) }} actions={allowed && canOpenTarget ? <button className="dw-button" onClick={() => router.push(target as never)}>{section === 'documents' ? 'Dokumentenablage öffnen' : 'Dokumentenkatalog öffnen'}</button> : undefined}>
    {!allowed ? <div className="dw-alert" data-tone="danger" role="alert">Für diese Übersicht fehlt Ihrer Rolle die Berechtigung.</div> : !tenantId ? <div className="dw-alert">Bitte zuerst ein Unternehmen auswählen.</div> : <>
      <div className="dw-toolbar"><label className="dw-field" style={{ flex: '1 1 260px' }}><span className="dw-label">Suche</span><input className="dw-input" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={section === 'documents' ? 'Dokument suchen' : 'Vorlage suchen'} /></label><label className="dw-field"><span className="dw-label">Arbeitsbereich</span><select className="dw-select" value={module} onChange={event => setModule(event.target.value as ProductKey | 'all')}><option value="all">Alle Bereiche</option>{modules.map(key => <option key={key} value={key}>{PRODUCT_LABELS[key].replace('CareSuite+ ', '')}</option>)}</select></label><button className="dw-button" disabled={query.loading || query.refreshing} onClick={() => void query.refresh()}>Aktualisieren</button></div>
      {query.error || query.refreshError ? <div className="dw-alert" data-tone="danger" role="alert">{query.error || query.refreshError}</div> : null}
      {query.loading && !query.data ? <div className="dw-empty" role="status">Zuordnungen werden geladen …</div> : rows.length ? <div className="dw-table-wrap"><table className="dw-table"><thead><tr><th>{section === 'documents' ? 'Dokument' : 'Vorlage'}</th><th>Arbeitsbereich</th><th>{section === 'documents' ? 'Sichtbarkeit' : 'Kategorie'}</th><th>Status</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td><strong>{item.title}</strong></td><td>{PRODUCT_LABELS[item.moduleKey].replace('CareSuite+ ', '')}</td><td>{section === 'documents' ? visibilityLabels[item.subtitle.replace(/^Sichtbarkeit:\s*/, '')] ?? 'Gespeicherte Freigabe' : item.subtitle}</td><td><span className="dw-status">{resolveWorkflowStatusLabel(item.status)}</span></td></tr>)}</tbody></table></div> : <div className="dw-empty"><h2>Keine passenden Zuordnungen</h2><p>{search || module !== 'all' ? 'Ändern Sie die Suche oder den ausgewählten Arbeitsbereich.' : 'Für Ihr Unternehmen sind in dieser Übersicht noch keine Zuordnungen hinterlegt.'}</p>{search || module !== 'all' ? <button className="dw-button" onClick={() => { setSearch(''); setModule('all'); }}>Filter zurücksetzen</button> : null}</div>}
    </>}
  </DocumentsWorkspaceShell>;
}

export function TemplateModuleAssignmentsScreen() {
  return <DocumentModuleAssignmentsScreen section="templates" />;
}
