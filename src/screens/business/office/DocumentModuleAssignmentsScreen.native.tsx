// Generated native presentation from src/screens/business/office/DocumentModuleAssignmentsScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeButton,NativeDiv,NativeLabel,NativeSpan,NativeInput,NativeSelect,NativeOption,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeStrong,NativeH2,NativeP} from '@/components/layout/NativeWorkspaceElements.native';
import { useMemo, useState } from 'react';
import { useFlowRouter } from "../../../hooks/useFlowRouter.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchModuleAssignmentList } from '@/lib/officeModules/moduleAssignmentService';
import { resolveWorkflowStatusLabel } from '@/lib/workflow/workflowStatusPresentation';
import { PRODUCT_LABELS } from '@/data/constants/productLabels';
import { DocumentsWorkspaceShell } from "../../../components/documents/DocumentsWorkspaceShell.native.tsx";
import type { ProductKey } from '@/types';
const visibilityLabels: Record<string, string> = { 'module only': 'Im zugeordneten Bereich', 'office and module': 'In Office und im zugeordneten Bereich', portal: 'Im Portal' };
export function DocumentModuleAssignmentsScreen({ section = 'documents' }: {
    section?: 'documents' | 'templates';
}) {
    const router = useFlowRouter();
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const { can } = usePermissions();
    const allowed = can('office.access') && can(section === 'documents' ? 'office.documents.view' : 'office.catalogs.view');
    const [search, setSearch] = useState('');
    const [module, setModule] = useState<ProductKey | 'all'>('all');
    const query = useAsyncQuery(() => fetchModuleAssignmentList(tenantId!, section, profile?.roleKey), [tenantId, section, profile?.roleKey], { enabled: !!tenantId && allowed, queryKey: JSON.stringify([tenantId, section, profile?.roleKey, allowed]) });
    const modules = useMemo(() => [...new Set((query.data ?? []).map(item => item.moduleKey))], [query.data]);
    const rows = (query.data ?? []).filter(item => (module === 'all' || item.moduleKey === module) && `${item.title} ${item.subtitle}`.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE')));
    const title = section === 'documents' ? 'Dokument-Sichtbarkeit' : 'Vorlagen-Zuordnung';
    const canOpenTarget = can('office.documents.view');
    const target = section === 'documents' ? '/business/office/documents' : '/business/office/document-catalog';
    return <DocumentsWorkspaceShell active="settings" title={title} description={section === 'documents' ? 'Gespeicherte Freigaben Ihrer Dokumente für Arbeitsbereiche und Portale.' : 'Gespeicherte Zuordnungen vorhandener Vorlagen zu den Arbeitsbereichen.'} back={{ label: 'Zuordnungsübersicht', onClick: () => router.push('/business/office/modules' as never) }} actions={allowed && canOpenTarget ? <NativeButton className="dw-button" onClick={() => router.push(target as never)}>{section === 'documents' ? 'Dokumentenablage öffnen' : 'Dokumentenkatalog öffnen'}</NativeButton> : undefined}>
    {!allowed ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">Für diese Übersicht fehlt Ihrer Rolle die Berechtigung.</NativeDiv> : !tenantId ? <NativeDiv className="dw-alert">Bitte zuerst ein Unternehmen auswählen.</NativeDiv> : <>
      <NativeDiv className="dw-toolbar"><NativeLabel className="dw-field" style={{ flex: '1 1 260px' }}><NativeSpan className="dw-label">Suche</NativeSpan><NativeInput className="dw-input" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={section === 'documents' ? 'Dokument suchen' : 'Vorlage suchen'}/></NativeLabel><NativeLabel className="dw-field"><NativeSpan className="dw-label">Arbeitsbereich</NativeSpan><NativeSelect className="dw-select" value={module} onChange={event => setModule(event.target.value as ProductKey | 'all')}><NativeOption value="all">Alle Bereiche</NativeOption>{modules.map(key => <NativeOption key={key} value={key}>{PRODUCT_LABELS[key].replace('CareSuite+ ', '')}</NativeOption>)}</NativeSelect></NativeLabel><NativeButton className="dw-button" disabled={query.loading || query.refreshing} onClick={() => void query.refresh()}>Aktualisieren</NativeButton></NativeDiv>
      {query.error || query.refreshError ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{query.error || query.refreshError}</NativeDiv> : null}
      {query.loading && !query.data ? <NativeDiv className="dw-empty" role="status">Zuordnungen werden geladen …</NativeDiv> : rows.length ? <NativeDiv className="dw-table-wrap"><NativeTable className="dw-table"><NativeThead><NativeTr><NativeTh>{section === 'documents' ? 'Dokument' : 'Vorlage'}</NativeTh><NativeTh>Arbeitsbereich</NativeTh><NativeTh>{section === 'documents' ? 'Sichtbarkeit' : 'Kategorie'}</NativeTh><NativeTh>Status</NativeTh></NativeTr></NativeThead><NativeTbody>{rows.map(item => <NativeTr key={item.id}><NativeTd><NativeStrong>{item.title}</NativeStrong></NativeTd><NativeTd>{PRODUCT_LABELS[item.moduleKey].replace('CareSuite+ ', '')}</NativeTd><NativeTd>{section === 'documents' ? visibilityLabels[item.subtitle.replace(/^Sichtbarkeit:\s*/, '')] ?? 'Gespeicherte Freigabe' : item.subtitle}</NativeTd><NativeTd><NativeSpan className="dw-status">{resolveWorkflowStatusLabel(item.status)}</NativeSpan></NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv> : <NativeDiv className="dw-empty"><NativeH2>Keine passenden Zuordnungen</NativeH2><NativeP>{search || module !== 'all' ? 'Ändern Sie die Suche oder den ausgewählten Arbeitsbereich.' : 'Für Ihr Unternehmen sind in dieser Übersicht noch keine Zuordnungen hinterlegt.'}</NativeP>{search || module !== 'all' ? <NativeButton className="dw-button" onClick={() => { setSearch(''); setModule('all'); }}>Filter zurücksetzen</NativeButton> : null}</NativeDiv>}
    </>}
  </DocumentsWorkspaceShell>;
}
export function TemplateModuleAssignmentsScreen() {
    return <DocumentModuleAssignmentsScreen section="templates"/>;
}
