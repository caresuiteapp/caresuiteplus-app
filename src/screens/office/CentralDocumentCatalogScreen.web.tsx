import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { CentralCatalogWorkspace } from '@/components/documents/CentralCatalogWorkspace.web';
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
  const { profile } = useAuth(); const tenantId = useServiceTenantId(); const { can, roleKey, permissions: permissionKeys } = usePermissions();
  const permissionScope = useMemo(() => [...permissionKeys].sort().join('|'), [permissionKeys]);
  const params = useLocalSearchParams<{ module?: string; clientId?: string; employeeId?: string; templateKey?: string; assignmentId?: string; invoiceId?: string; medicationId?: string; woundId?: string; period?: string; tab?: string }>();
  const clientId = scalar(params.clientId); const employeeId = scalar(params.employeeId);
  const assignmentId = scalar(params.assignmentId); const invoiceId = scalar(params.invoiceId);
  const medicationId = scalar(params.medicationId); const woundId = scalar(params.woundId); const period = scalar(params.period);
  const recordFilter = useMemo(() => documentRecordScope({ clientId, employeeId }), [clientId, employeeId]);
  const recordScope = JSON.stringify([tenantId, roleKey, profile?.id, recordFilter, permissionScope]);
  const [recordPageState, setRecordPageState] = useState({ scope: recordScope, page: 0 });
  const recordPage = recordPageState.scope === recordScope ? recordPageState.page : 0;
  const [recordsHasMore, setRecordsHasMore] = useState(false);
  const actor = useMemo(() => ({ roleKey, profile }), [roleKey, profile]);
  const canView = can('office.documents.view'); const canClients = can('office.clients.view'); const canEmployees = can('office.employees.view');
  const [clients, setClients] = useState<CentralCatalogEntityOption[]>([]); const [employees, setEmployees] = useState<CentralCatalogEntityOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false); const [entityError, setEntityError] = useState('');
  const [records, setRecords] = useState<CentralDocumentStored[]>([]); const [recordsError, setRecordsError] = useState('');
  const [loadingRecords, setLoadingRecords] = useState(false); const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true; setLoadingEntities(false); setClients([]); setEmployees([]); setEntityError('');
    if (!tenantId || !canView) return;
    setLoadingEntities(true);
    void Promise.allSettled([
      canClients ? fetchClientList(tenantId, roleKey) : Promise.resolve(null),
      canEmployees ? fetchEmployeeList(tenantId, roleKey, profile) : Promise.resolve(null),
    ]).then(([c, e]) => {
      if (!active) return; const failures: string[] = [];
      if (c.status === 'fulfilled' && c.value?.ok) setClients(centralCatalogClientOptions(c.value.data));
      else if (c.status === 'rejected' || (c.status === 'fulfilled' && c.value && !c.value.ok)) failures.push('Klientenakten konnten nicht geladen werden.');
      if (e.status === 'fulfilled' && e.value?.ok) setEmployees(centralCatalogEmployeeOptions(e.value.data));
      else if (e.status === 'rejected' || (e.status === 'fulfilled' && e.value && !e.value.ok)) failures.push('Personalakten konnten nicht geladen werden.');
      setEntityError(failures.join(' ')); setLoadingEntities(false);
    }); return () => { active = false; };
  }, [tenantId, roleKey, profile, canView, canClients, canEmployees]);
  useEffect(() => {
    let active = true; setLoadingRecords(false); if (recordPage === 0) { setRecords([]); setRecordsHasMore(false); } setRecordsError('');
    if (!tenantId || !canView) return; setLoadingRecords(true);
    void withServiceQueryTimeout(listCentralDocuments(tenantId, actor, recordFilter, recordPage * 100), 'Dokumentfassungen', 30000).then((r) => {
      if (!active) return; if (r.ok) { setRecords((current) => recordPage === 0 ? r.data : [...current, ...r.data.filter((entry) => !current.some((old) => old.id === entry.id))]); setRecordsHasMore(r.data.length === 100); } else setRecordsError(r.error);
    }).catch(() => { if (active) setRecordsError('Gespeicherte Fassungen konnten nicht geladen werden.'); }).finally(() => { if (active) setLoadingRecords(false); });
    return () => { active = false; };
  }, [tenantId, actor, canView, refresh, recordFilter, recordPage, recordScope]);
  const loadContext = useCallback((target: CentralDocumentTarget, id: string, definition?: CentralContextRequest['definition'], references?: Record<string, string>) => withServiceQueryTimeout(loadCentralContext(tenantId!, target, id, actor, { definition, ...(target === 'client' ? { assignmentId: references?.assignmentId || (id === clientId ? assignmentId : undefined), invoiceId: references?.invoiceId || (id === clientId ? invoiceId : undefined), medicationId: references?.medicationId || (id === clientId ? medicationId : undefined), woundId: references?.woundId || (id === clientId ? woundId : undefined), period: references?.periodOrigin === 'selected' ? references.period : id === clientId ? period : undefined } : {}) }), 'Dokumentstammdaten', 30000), [tenantId, actor, clientId, assignmentId, invoiceId, medicationId, woundId, period]);
  const save = useCallback((snapshot: CentralDocumentSnapshot, bytes: Uint8Array, original?: { bytes: Uint8Array; fileName: string }) => saveCentralDocument(snapshot, bytes, actor, original), [actor]);
  const download = useCallback((record: CentralDocumentStored, original?: boolean) => downloadCentralDocument(record, actor, original), [actor]);
  const reload = useCallback(() => { setRecordPageState({ scope: recordScope, page: 0 }); setRefresh((v) => v + 1); }, [recordScope]);
  const loadMore = useCallback(() => { if (recordsError) setRefresh((v) => v + 1); else setRecordPageState({ scope: recordScope, page: recordPage + 1 }); }, [recordsError, recordScope, recordPage]);
  return <ScreenShell title="Dokumentenkatalog" subtitle="Office · zentral für alle Module" showBack={false}>
    {!tenantId ? <div role="alert">Für den Dokumentenkatalog ist ein zugeordnetes Unternehmen erforderlich.</div> : !canView ? <div role="alert">Sie haben keine Berechtigung zum Anzeigen des Dokumentenkatalogs.</div> : <CentralCatalogWorkspace
      key={JSON.stringify([tenantId,roleKey,profile?.id,permissionScope,scalar(params.module),clientId,employeeId,scalar(params.templateKey),assignmentId,invoiceId,medicationId,woundId,period,scalar(params.tab)])} tenantId={tenantId} author={profile?.displayName || [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')} demo={getServiceMode() !== 'supabase'}
      clients={clients} employees={employees} loadingEntities={loadingEntities} entityError={entityError}
      records={records.filter((record) => (!record.snapshot.definition.clinicalReviewRequired || can('office.clients.view_sensitive')) && (record.snapshot.context.target === 'company' || record.snapshot.context.target === 'client' && canClients && can('office.clients.view_sensitive') || record.snapshot.context.target === 'employee' && canEmployees))} recordsError={recordsError} loadingRecords={loadingRecords} recordsHasMore={recordsHasMore} onLoadMore={loadMore}
      module={normalizeDocumentModule(scalar(params.module))} clientId={clientId} employeeId={employeeId} templateKey={scalar(params.templateKey)} initialTab={scalar(params.tab) === 'records' ? 'records' : 'catalog'}
      permissions={{ create: can('documents.create'), preview: can('documents.preview'), export: can('documents.pdf_create'), save: can('documents.save_to_file') }}
      loadContext={loadContext} save={save} download={download} onSaved={reload} onRefresh={reload}
    />}
  </ScreenShell>;
}
