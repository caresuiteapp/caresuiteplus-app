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
import type { CentralDocumentSnapshot, CentralDocumentStored, CentralDocumentTarget } from '@/types/documents/centralCatalog';

const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export function CentralDocumentCatalogScreen() {
  const { profile } = useAuth(); const tenantId = useServiceTenantId(); const { can, roleKey } = usePermissions();
  const params = useLocalSearchParams<{ module?: string; clientId?: string; employeeId?: string; templateKey?: string }>();
  const actor = useMemo(() => ({ roleKey, profile }), [roleKey, profile]);
  const canView = can('office.documents.view'); const canClients = can('office.clients.view'); const canEmployees = can('office.employees.view');
  const [clients, setClients] = useState<{ id: string; label: string }[]>([]); const [employees, setEmployees] = useState<{ id: string; label: string }[]>([]);
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
      if (c.status === 'fulfilled' && c.value?.ok) setClients(c.value.data.map((r) => ({ id: r.id, label: `${r.firstName} ${r.lastName}`.trim() })));
      else if (c.status === 'rejected' || (c.status === 'fulfilled' && c.value && !c.value.ok)) failures.push('Klientenakten konnten nicht geladen werden.');
      if (e.status === 'fulfilled' && e.value?.ok) setEmployees(e.value.data.map((r) => ({ id: r.id, label: `${r.firstName} ${r.lastName}`.trim() })));
      else if (e.status === 'rejected' || (e.status === 'fulfilled' && e.value && !e.value.ok)) failures.push('Personalakten konnten nicht geladen werden.');
      setEntityError(failures.join(' ')); setLoadingEntities(false);
    }); return () => { active = false; };
  }, [tenantId, roleKey, profile, canView, canClients, canEmployees]);
  useEffect(() => {
    let active = true; setLoadingRecords(false); setRecords([]); setRecordsError('');
    if (!tenantId || !canView) return; setLoadingRecords(true);
    void listCentralDocuments(tenantId, actor).then((r) => {
      if (!active) return; if (r.ok) setRecords(r.data); else setRecordsError(r.error);
    }).catch(() => { if (active) setRecordsError('Gespeicherte Fassungen konnten nicht geladen werden.'); }).finally(() => { if (active) setLoadingRecords(false); });
    return () => { active = false; };
  }, [tenantId, actor, canView, refresh]);
  const loadContext = useCallback((target: CentralDocumentTarget, id: string) => loadCentralContext(tenantId!, target, id, actor), [tenantId, actor]);
  const save = useCallback((snapshot: CentralDocumentSnapshot, bytes: Uint8Array, original?: { bytes: Uint8Array; fileName: string }) => saveCentralDocument(snapshot, bytes, actor, original), [actor]);
  const download = useCallback((record: CentralDocumentStored, original?: boolean) => downloadCentralDocument(record, actor, original), [actor]);
  const reload = useCallback(() => setRefresh((v) => v + 1), []);
  return <ScreenShell title="Dokumentenkatalog" subtitle="Office · zentral für alle Module" showBack={false}>
    {!tenantId ? <div role="alert">Für den Dokumentenkatalog ist ein zugeordnetes Unternehmen erforderlich.</div> : !canView ? <div role="alert">Sie haben keine Berechtigung zum Anzeigen des Dokumentenkatalogs.</div> : <CentralCatalogWorkspace
      key={JSON.stringify([tenantId,roleKey,profile?.id,scalar(params.module),scalar(params.clientId),scalar(params.employeeId),scalar(params.templateKey)])} tenantId={tenantId} author={profile?.displayName || [profile?.firstName, profile?.lastName].filter(Boolean).join(' ')} demo={getServiceMode() !== 'supabase'}
      clients={clients} employees={employees} loadingEntities={loadingEntities} entityError={entityError}
      records={records} recordsError={recordsError} loadingRecords={loadingRecords}
      module={scalar(params.module)} clientId={scalar(params.clientId)} employeeId={scalar(params.employeeId)} templateKey={scalar(params.templateKey)}
      permissions={{ create: can('documents.create'), preview: can('documents.preview'), export: can('documents.pdf_create'), save: can('documents.save_to_file') }}
      loadContext={loadContext} save={save} download={download} onSaved={reload} onRefresh={reload}
    />}
  </ScreenShell>;
}
