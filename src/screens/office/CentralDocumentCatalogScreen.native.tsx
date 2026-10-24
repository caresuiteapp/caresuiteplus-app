// Generated native presentation from src/screens/office/CentralDocumentCatalogScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeStrong,NativeSpan} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { DocumentsWorkspaceShell } from "../../components/documents/DocumentsWorkspaceShell.native.tsx";
import { CENTRAL_DOCUMENT_CATALOG } from '@/data/seeds/documentCatalog/centralCatalog';
import { CENTRAL_CATALOG_GROUPS } from '@/data/seeds/documentCatalog/centralCatalogTitles';
import { CentralCatalogWorkspace } from "../../components/documents/CentralCatalogWorkspace.native.tsx";
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchClientList } from '@/lib/office/clientListService';
import { fetchEmployeeList } from '@/lib/office/employeeListService';
import { downloadCentralDocument, listCentralDocuments, loadCentralContext, saveCentralDocument } from '@/lib/documents/centralCatalogService';
import { getServiceMode } from '@/lib/services/mode';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { documentRecordScope, normalizeDocumentModule } from '@/lib/documents/documentRecommendations';
import { centralCatalogClientOptions, centralCatalogEmployeeOptions, type CentralCatalogEntityOption } from '@/lib/documents/centralCatalogEntities';
import type { CentralContextRequest } from '@/lib/documents/centralCatalogService';
import type { CentralDocumentSnapshot, CentralDocumentStored, CentralDocumentTarget } from '@/types/documents/centralCatalog';
const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
export function CentralDocumentCatalogScreen() {
    const navigationGuard = useRef<() => boolean | Promise<boolean>>(() => true);
    const registerNavigationGuard = useCallback((guard: (() => boolean | Promise<boolean>) | null) => { navigationGuard.current = guard ?? (() => true); }, []);
    const { profile } = useAuth();
    const tenantId = useServiceTenantId();
    const { can, roleKey, permissions: permissionKeys } = usePermissions();
    const permissionScope = useMemo(() => [...permissionKeys].sort().join('|'), [permissionKeys]);
    const params = useLocalSearchParams<{
        module?: string;
        category?: string;
        clientId?: string;
        employeeId?: string;
        templateKey?: string;
        assignmentId?: string;
        invoiceId?: string;
        medicationId?: string;
        woundId?: string;
        period?: string;
        tab?: string;
    }>();
    const clientId = scalar(params.clientId);
    const employeeId = scalar(params.employeeId);
    const assignmentId = scalar(params.assignmentId);
    const invoiceId = scalar(params.invoiceId);
    const medicationId = scalar(params.medicationId);
    const woundId = scalar(params.woundId);
    const period = scalar(params.period);
    const recordFilter = useMemo(() => documentRecordScope({ clientId, employeeId }), [clientId, employeeId]);
    const recordScope = JSON.stringify([tenantId, roleKey, profile?.id, recordFilter, permissionScope]);
    const [recordPageState, setRecordPageState] = useState({ scope: recordScope, page: 0 });
    const recordPage = recordPageState.scope === recordScope ? recordPageState.page : 0;
    const [recordsHasMore, setRecordsHasMore] = useState(false);
    const actor = useMemo(() => ({ roleKey, profile }), [roleKey, profile]);
    const canView = can('office.documents.view');
    const canClients = can('office.clients.view');
    const canEmployees = can('office.employees.view');
    const [clients, setClients] = useState<CentralCatalogEntityOption[]>([]);
    const [employees, setEmployees] = useState<CentralCatalogEntityOption[]>([]);
    const [loadingEntities, setLoadingEntities] = useState(false);
    const [entityError, setEntityError] = useState('');
    const [entityAttempt, setEntityAttempt] = useState(0);
    const [records, setRecords] = useState<CentralDocumentStored[]>([]);
    const [recordsError, setRecordsError] = useState('');
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        let active = true;
        setLoadingEntities(false);
        setClients([]);
        setEmployees([]);
        setEntityError('');
        if (!tenantId || !canView)
            return;
        setLoadingEntities(true);
        void Promise.allSettled([
            canClients ? withServiceQueryTimeout(fetchClientList(tenantId, roleKey), 'Klientenakten', 30000) : Promise.resolve(null),
            canEmployees ? withServiceQueryTimeout(fetchEmployeeList(tenantId, roleKey, profile), 'Personalakten', 30000) : Promise.resolve(null),
        ]).then(([c, e]) => {
            if (!active)
                return;
            const failures: string[] = [];
            if (c.status === 'fulfilled' && c.value?.ok)
                setClients(centralCatalogClientOptions(c.value.data));
            else if (c.status === 'rejected' || (c.status === 'fulfilled' && c.value && !c.value.ok))
                failures.push('Klientenakten konnten nicht geladen werden.');
            if (e.status === 'fulfilled' && e.value?.ok)
                setEmployees(centralCatalogEmployeeOptions(e.value.data));
            else if (e.status === 'rejected' || (e.status === 'fulfilled' && e.value && !e.value.ok))
                failures.push('Personalakten konnten nicht geladen werden.');
            setEntityError(failures.join(' '));
            setLoadingEntities(false);
        });
        return () => { active = false; };
    }, [tenantId, roleKey, profile, canView, canClients, canEmployees, entityAttempt]);
    useEffect(() => {
        let active = true;
        setLoadingRecords(false);
        if (recordPage === 0) {
            setRecords([]);
            setRecordsHasMore(false);
        }
        setRecordsError('');
        if (!tenantId || !canView)
            return;
        setLoadingRecords(true);
        void withServiceQueryTimeout(listCentralDocuments(tenantId, actor, recordFilter, recordPage * 100), 'Dokumentfassungen', 30000).then((r) => {
            if (!active)
                return;
            if (r.ok) {
                setRecords((current) => recordPage === 0 ? r.data : [...current, ...r.data.filter((entry) => !current.some((old) => old.id === entry.id))]);
                setRecordsHasMore(r.data.length === 100);
            }
            else
                setRecordsError(r.error);
        }).catch(() => { if (active)
            setRecordsError('Gespeicherte Fassungen konnten nicht geladen werden.'); }).finally(() => { if (active)
            setLoadingRecords(false); });
        return () => { active = false; };
    }, [tenantId, actor, canView, refresh, recordFilter, recordPage, recordScope]);
    const loadContext = useCallback((target: CentralDocumentTarget, id: string, definition?: CentralContextRequest['definition'], references?: Record<string, string>) => withServiceQueryTimeout(loadCentralContext(tenantId!, target, id, actor, { definition, ...(target === 'client' ? { assignmentId: references?.assignmentId || (id === clientId ? assignmentId : undefined), invoiceId: references?.invoiceId || (id === clientId ? invoiceId : undefined), medicationId: references?.medicationId || (id === clientId ? medicationId : undefined), woundId: references?.woundId || (id === clientId ? woundId : undefined), period: references?.periodOrigin === 'selected' ? references.period : id === clientId ? period : undefined } : {}) }), 'Dokumentstammdaten', 30000), [tenantId, actor, clientId, assignmentId, invoiceId, medicationId, woundId, period]);
    const save = useCallback((snapshot: CentralDocumentSnapshot, bytes: Uint8Array, original?: {
        bytes: Uint8Array;
        fileName: string;
    }) => saveCentralDocument(snapshot, bytes, actor, original), [actor]);
    const download = useCallback((record: CentralDocumentStored, original?: boolean) => downloadCentralDocument(record, actor, original), [actor]);
    const reload = useCallback(() => { setRecordPageState({ scope: recordScope, page: 0 }); setRefresh((v) => v + 1); }, [recordScope]);
    const loadMore = useCallback(() => { if (recordsError)
        setRefresh((v) => v + 1);
    else
        setRecordPageState({ scope: recordScope, page: recordPage + 1 }); }, [recordsError, recordScope, recordPage]);
    return <DocumentsWorkspaceShell active="catalog" title="Dokumentenkatalog" description="Vorlagen auswählen, gespeicherte Angaben übernehmen und Dokumente in der zugehörigen Akte ablegen." beforeNavigate={async () => await navigationGuard.current()} stats={<><NativeDiv className="dw-metric"><NativeStrong>{CENTRAL_DOCUMENT_CATALOG.length}</NativeStrong><NativeSpan>Vorlagen</NativeSpan></NativeDiv><NativeDiv className="dw-metric"><NativeStrong>{CENTRAL_CATALOG_GROUPS.length}</NativeStrong><NativeSpan>Fachbereiche</NativeSpan></NativeDiv><NativeDiv className="dw-metric"><NativeStrong>A4</NativeStrong><NativeSpan>Hoch- und Querformat</NativeSpan></NativeDiv></>}>
    {!tenantId ? <NativeDiv role="alert" className="dw-alert">Für den Dokumentenkatalog ist ein zugeordnetes Unternehmen erforderlich.</NativeDiv> : !canView ? <NativeDiv role="alert" className="dw-alert">Sie haben keine Berechtigung zum Anzeigen des Dokumentenkatalogs.</NativeDiv> : <CentralCatalogWorkspace key={JSON.stringify([tenantId, roleKey, profile?.id, permissionScope, scalar(params.module), scalar(params.category), clientId, employeeId, scalar(params.templateKey), assignmentId, invoiceId, medicationId, woundId, period, scalar(params.tab)])} tenantId={tenantId} author={profile?.displayName || [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')} demo={getServiceMode() !== 'supabase'} clients={clients} employees={employees} loadingEntities={loadingEntities} entityError={entityError} onRefreshEntities={() => setEntityAttempt((value) => value + 1)} records={records.filter((record) => (!record.snapshot.definition.clinicalReviewRequired || can('office.clients.view_sensitive')) && (record.snapshot.context.target === 'company' || record.snapshot.context.target === 'client' && canClients && can('office.clients.view_sensitive') || record.snapshot.context.target === 'employee' && canEmployees))} recordsError={recordsError} loadingRecords={loadingRecords} recordsHasMore={recordsHasMore} onLoadMore={loadMore} module={normalizeDocumentModule(scalar(params.module))} category={scalar(params.category)} clientId={clientId} employeeId={employeeId} templateKey={scalar(params.templateKey)} initialTab={scalar(params.tab) === 'records' ? 'records' : 'catalog'} permissions={{ create: can('documents.create'), preview: can('documents.preview'), export: can('documents.pdf_create'), save: can('documents.save_to_file') }} loadContext={loadContext} save={save} download={download} onSaved={reload} onRefresh={reload} onNavigationGuardChange={registerNavigationGuard}/>}
  </DocumentsWorkspaceShell>;
}
