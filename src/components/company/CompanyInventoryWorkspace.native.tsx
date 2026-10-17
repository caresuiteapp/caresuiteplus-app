import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PermissionKey, RoleKey } from '@/types';
import type { InventoryAssignment, InventoryCategoryGroup, InventoryItem, InventoryReturnCapture, OffboardingInventoryCheck } from '@/types/inventory';
import { INVENTORY_CATEGORY_LABELS } from '@/types/inventory';
import { Alert, ScrollView, Text, View } from 'react-native';
import { MobileButton, MobileCard, MobileChips, MobileHeading, MobileSearch, MobileSheet, MobileState, m } from '@/components/mobile/MobileWorkspace';
import { MobileSelect } from '@/components/mobile/MobileSelect';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';


import {
  acknowledgeCompanyInventoryAssignment, checkCompanyInventoryOffboarding,
  getCompanyInventoryPermissions, loadCompanyInventory, requestCompanyInventoryReturn,
  type CompanyInventoryPermissions, type CompanyInventoryResult, type CompanyInventoryScope,
  type CompanyInventorySnapshot,
} from '@/lib/inventory/companyInventoryService';

import { CompanyInventoryEditor, type InventoryEditDialog, type RunInventoryMutation } from './CompanyInventoryDialogs.native';
import {
  ASSIGNMENT_STATUS_LABELS, COMPANY_INVENTORY_VIEWS, CONDITION_LABELS, INVENTORY_STATUS_LABELS,
  inventoryAuditTitle, inventoryDate, inventoryMatches, isAssignmentOpen, isAssignmentOverdue,
  type CompanyInventoryView,
} from './companyInventoryModel';


export type { CompanyInventoryView } from './companyInventoryModel';
export type CompanyInventoryWorkspaceProps = {
  tenantId: string;
  roleKey: RoleKey | null;
  actorProfileId?: string | null;
  effectivePermissions?: readonly PermissionKey[];
  scopeLimited?: boolean;
  initialView?: CompanyInventoryView;
  initialEmployeeId?: string;
  initialItemId?: string;
  categoryGroupFilter?: InventoryCategoryGroup;
  title?: string;
  onViewChange?: (view: CompanyInventoryView) => void;
  onNavigationGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
};

type Dialog = InventoryEditDialog | { kind: 'detail'; itemId: string };
type Notice = { text: string; error?: boolean } | null;

export function CompanyInventoryWorkspace(props: CompanyInventoryWorkspaceProps) {
  const permissionsKey = props.effectivePermissions ? [...props.effectivePermissions].sort().join(',') : 'role';
  return <InventoryWorkspaceScope key={`${props.tenantId}:${props.roleKey}:${props.actorProfileId ?? ''}:${permissionsKey}:${Boolean(props.scopeLimited)}`} {...props} />;
}

function InventoryWorkspaceScope({ tenantId, roleKey, actorProfileId, effectivePermissions, scopeLimited = false, initialView = 'stock', initialEmployeeId, initialItemId, categoryGroupFilter, title = 'Inventar', onViewChange, onNavigationGuardChange }: CompanyInventoryWorkspaceProps) {
  const scope = useMemo<CompanyInventoryScope>(() => ({ tenantId, actorRoleKey: roleKey, actorProfileId, effectivePermissions }), [tenantId, roleKey, actorProfileId, effectivePermissions]);
  const [snapshot, setSnapshot] = useState<CompanyInventorySnapshot | null>(null);
  const permissions = useMemo(() => {
    const local = getCompanyInventoryPermissions(roleKey, effectivePermissions, scopeLimited || Boolean(snapshot?.scopeLimited));
    return Object.fromEntries(Object.entries(local).map(([key, value]) => [key, value && (snapshot?.permissions?.[key as keyof CompanyInventoryPermissions] ?? true)])) as CompanyInventoryPermissions;
  }, [roleKey, effectivePermissions, scopeLimited, snapshot]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [view, setView] = useState(initialView);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('open');
  const [employeeFilter, setEmployeeFilter] = useState(initialEmployeeId ?? '');
  const [damageFilter, setDamageFilter] = useState('open');
  const [dialog, setDialog] = useState<Dialog | null>(() => initialItemId ? { kind: 'detail', itemId: initialItemId } : null);
  const [dialogDirty, setDialogDirty] = useState(false);
  const alive = useRef(true);
  const writeLock = useRef(false);
  const readSequence = useRef(0);
  const recovery = useRef(false);
  const confirmLeave = useCallback(async () => !busy, [busy]);
  const availableViews = COMPANY_INVENTORY_VIEWS.filter(tab => tab.id !== 'history' || permissions.audit)
    .filter(tab => tab.id !== 'offboarding' || permissions.offboarding);
  const activeView = availableViews.some(tab => tab.id === view) ? view : 'stock';

  useEffect(() => { alive.current = true; return () => { alive.current = false; readSequence.current += 1; }; }, []);
  useEffect(() => { setView(initialView); }, [initialView]);
  useEffect(() => { setEmployeeFilter(initialEmployeeId ?? ''); }, [initialEmployeeId]);
  useEffect(() => {
    if (initialItemId) setDialog({ kind: 'detail', itemId: initialItemId });
  }, [initialItemId]);
  useEffect(() => {
    onNavigationGuardChange?.(confirmLeave);
    return () => onNavigationGuardChange?.(null);
  }, [confirmLeave, onNavigationGuardChange]);

  const reload = useCallback(async () => {
    const request = ++readSequence.current;
    setLoading(true); setLoadError(null);
    try {
      const result = await loadCompanyInventory(scope);
      if (!alive.current || request !== readSequence.current) return false;
      if (!result.ok) { setLoadError(result.error); return false; }
      setSnapshot(result.data); setReloadRequired(false); setMutationError(null);
      if (recovery.current) {
        recovery.current = false; setDialog(null); setDialogDirty(false);
        setNotice({ text: 'Bestand neu geladen. Bitte prüfen Sie den letzten Vorgang vor weiteren Änderungen. Der vorherige Entwurf wurde geschlossen.' });
      }
      return true;
    } catch {
      if (alive.current && request === readSequence.current) setLoadError('Das Inventar konnte nicht geladen werden. Bitte versuchen Sie es erneut.');
      return false;
    } finally {
      if (alive.current && request === readSequence.current) setLoading(false);
    }
  }, [scope]);
  useEffect(() => { void reload(); }, [reload]);

  const run: RunInventoryMutation = async <T,>(operation: () => Promise<CompanyInventoryResult<T>>, message: string) => {
    if (!alive.current || writeLock.current || recovery.current || reloadRequired || loading) return false;
    writeLock.current = true; setBusy(true); setMutationError(null); setNotice(null);
    try {
      const result = await operation();
      if (!alive.current) return false;
      if (!result.ok) {
        setMutationError(result.error);
        if (result.reloadRequired) { recovery.current = true; setReloadRequired(true); }
        return false;
      }
      const refreshed = await reload();
      if (!alive.current) return false;
      if (!refreshed) {
        recovery.current = true; setReloadRequired(true);
        setNotice({ text: `${message} Die aktualisierte Liste konnte noch nicht geladen werden.`, error: true });
      } else setNotice({ text: message });
      return true;
    } catch {
      if (alive.current) {
        recovery.current = true; setReloadRequired(true);
        setMutationError('Der Speicherstand konnte nicht bestätigt werden. Bitte laden Sie das Inventar neu und prüfen Sie den Vorgang.');
      }
      return false;
    } finally {
      writeLock.current = false;
      if (alive.current) setBusy(false);
    }
  };

  async function switchView(next: CompanyInventoryView) {
    if (!(await confirmLeave())) return;
    setDialog(null); setDialogDirty(false); setSearch(''); setView(next); setMutationError(null);
    onViewChange?.(next);
  }
  function open(next: Dialog) {
    if (busy || loading) return;
    if ((next.kind === 'category' || next.kind === 'location') && !permissions.manageCatalogs) return;
    if (next.kind === 'item' && !next.item && !permissions.createItems) return;
    setMutationError(null); setDialogDirty(false); setDialog(next);
  }
  async function close() {
    if (!(await confirmLeave())) return;
    setDialog(null); setDialogDirty(false); setMutationError(null);
  }
  function saved() { setDialog(null); setDialogDirty(false); }
  const blocked = busy || reloadRequired || loading;
  const person = (employeeId?: string | null) => {
    if (!employeeId) return 'Nicht zugeordnet';
    if (!permissions.viewEmployees || !snapshot?.employeesVisible) return 'Personaldaten geschützt';
    const employee = snapshot?.employees.find(entry => entry.id === employeeId);
    return employee ? `${employee.firstName} ${employee.lastName}`.trim() || 'Mitarbeitende Person' : permissions.viewEmployees ? 'Person nicht mehr verfügbar' : 'Personaldaten geschützt';
  };

  if (!permissions.view) return <MobileState title="Kein Zugriff auf das Inventar" />;
  if (!snapshot) return <MobileState loading={loading} title={loading ? 'Inventar wird geladen' : 'Inventar nicht verfügbar'} message={loadError ?? undefined} onRetry={loading ? undefined : () => void reload()} />;
  const itemName = (id: string) => snapshot.items.find(item => item.id === id)?.name ?? 'Gegenstand nicht verfügbar';
  const items = snapshot.items.filter(item => (!categoryGroupFilter || item.categoryGroup === categoryGroupFilter) && (!categoryFilter || item.categoryId === categoryFilter) && (!locationFilter || item.locationId === locationFilter) && (!statusFilter || item.status === statusFilter) && inventoryMatches(search,[item.name,item.sku,item.serialNumber,item.barcode,item.manufacturer,item.model]));
  const assignments = snapshot.assignments.filter(row => (assignmentFilter !== 'open' || isAssignmentOpen(row)) && (!employeeFilter || row.recipientEmployeeId === employeeFilter) && inventoryMatches(search,[itemName(row.itemId),person(row.recipientEmployeeId)]));
  const damages = snapshot.damageReports.filter(row => (damageFilter !== 'open' || !row.resolvedAt) && inventoryMatches(search,[itemName(row.itemId),row.description]));
  const detail = dialog?.kind === 'detail' ? snapshot.items.find(item => item.id === dialog.itemId) : null;
  const actions = (item: InventoryItem) => { const assignment = snapshot.assignments.find(row => row.itemId === item.id && isAssignmentOpen(row)); return <View style={m.wrap}>
    {permissions.manage ? <MobileButton label="Bearbeiten" disabled={blocked} onPress={() => open({kind:'item',item})} /> : null}
    {permissions.issue && item.status==='available' && !assignment ? <MobileButton primary label="Ausgeben" disabled={blocked || !snapshot.employeesVisible} onPress={() => open({kind:'issue',item})} /> : null}
    {permissions.returnItems && assignment && assignment.status!=='planned' ? <MobileButton label="Rücknahme erfassen" disabled={blocked} onPress={() => open({kind:'return',assignment})} /> : null}
    {permissions.reportDamage && !['archived','decommissioned'].includes(item.status) ? <MobileButton label="Schaden / Verlust" disabled={blocked} onPress={() => open({kind:'damage',item})} /> : null}
  </View>; };
  const assignmentCard = (row: InventoryAssignment) => <MobileCard key={row.id}><Text style={m.section}>{itemName(row.itemId)}</Text><Text style={m.body}>{person(row.recipientEmployeeId)}</Text><Text style={m.muted}>{ASSIGNMENT_STATUS_LABELS[row.status]}{isAssignmentOverdue(row)?' · Überfällig':''} · Rückgabe: {inventoryDate(row.expectedReturnAt)}</Text><View style={m.wrap}>
    <MobileButton label="Details" onPress={() => open({kind:'detail',itemId:row.itemId})} />
    {permissions.returnItems && isAssignmentOpen(row) && row.status!=='planned' ? <MobileButton label="Rücknahme" disabled={blocked} onPress={() => open({kind:'return',assignment:row})} /> : null}
    {permissions.issue && row.status==='issued' ? <MobileButton label="Empfang bestätigen" disabled={blocked} onPress={() => Alert.alert('Empfang dokumentieren?', 'Bestätigen Sie nur einen tatsächlich erfolgten Empfang.', [{text:'Abbrechen',style:'cancel'},{text:'Bestätigen',onPress:()=>void run(()=>acknowledgeCompanyInventoryAssignment(scope,row.id,row.updatedAt),'Empfang bestätigt.')}])} /> : null}
    {permissions.returnItems && ['issued','acknowledged','overdue','partially_returned','disputed','lost'].includes(row.status) ? <MobileButton label="Rückgabe anfordern" disabled={blocked} onPress={() => Alert.alert('Rückgabe anfordern?', 'Die Ausgabe wird als angefordert gekennzeichnet.', [{text:'Abbrechen',style:'cancel'},{text:'Anfordern',onPress:()=>void run(()=>requestCompanyInventoryReturn(scope,row.id,row.updatedAt),'Rückgabe angefordert.')}])} /> : null}
  </View></MobileCard>;
  return <><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[m.stack,{paddingBottom:24}]}><MobileHeading title={title} subtitle={`${snapshot.items.length} Gegenstände · ${snapshot.assignments.filter(isAssignmentOpen).length} offene Ausgaben`} icon="box" />
    <MobileChips label="Inventarbereiche" value={activeView} items={availableViews.map(tab=>({key:tab.id,label:tab.label}))} onChange={next=>void switchView(next)} />
    <MobileSearch value={search} onChangeText={setSearch} label="Inventar suchen" /><View style={m.wrap}><MobileButton label="Aktualisieren" icon="refresh-cw" disabled={busy||loading} onPress={()=>void reload()} />{permissions.createItems?<MobileButton primary label="Gegenstand anlegen" icon="plus" disabled={blocked} onPress={()=>open(snapshot.categories.length?{kind:'item'}:{kind:'category'})} />:null}</View>
    {loadError||mutationError?<MobileState title="Inventar bitte prüfen" message={loadError??mutationError??undefined} onRetry={()=>void reload()} />:null}{notice?<Text accessibilityLiveRegion="polite" style={notice.error?m.error:m.body}>{notice.text}</Text>:null}
    {reloadRequired?<MobileButton label="Aktuellen Bestand laden" disabled={busy} onPress={()=>void reload()} />:null}
    {activeView==='stock'?<><MobileButton label={`Filter${[categoryFilter,locationFilter,statusFilter].filter(Boolean).length ? ` · ${[categoryFilter,locationFilter,statusFilter].filter(Boolean).length} aktiv` : ''}`} icon="sliders" onPress={()=>setFiltersOpen(true)}/><Text style={m.muted}>{items.length} passende Gegenstände</Text>{items.map(item=><MobileCard key={item.id}><Text style={m.section}>{item.name}</Text><Text style={m.muted}>{INVENTORY_STATUS_LABELS[item.status]} · {CONDITION_LABELS[item.condition]}</Text><Text style={m.body}>{[item.sku,item.serialNumber,item.manufacturer,item.model].filter(Boolean).join(' · ')||'Keine zusätzliche Kennzeichnung'}</Text><Text style={m.muted}>{snapshot.locations.find(row=>row.id===item.locationId)?.label??'Ohne Lagerort'}</Text><MobileButton label="Gegenstand ansehen" onPress={()=>open({kind:'detail',itemId:item.id})}/>{actions(item)}</MobileCard>)}{!items.length?<MobileState title="Keine passenden Gegenstände"/>:null}</>:null}
    {activeView==='assignments'?<><MobileChips label="Ausgaben filtern" value={assignmentFilter} onChange={setAssignmentFilter} items={[{key:'open',label:'Offene'},{key:'all',label:'Alle'}]}/>{permissions.viewEmployees&&snapshot.employeesVisible?<MobileSelect label="Person" value={employeeFilter} options={Object.fromEntries(snapshot.employees.map(row=>[row.id,person(row.id)]))} empty="Alle Personen" onChange={setEmployeeFilter}/>:null}{assignments.map(assignmentCard)}{!assignments.length?<MobileState title="Keine passenden Ausgaben"/>:null}</>:null}
    {activeView==='locations'?<><Text style={m.section}>Lagerorte</Text>{permissions.manageCatalogs?<MobileButton label="Lagerort anlegen" disabled={blocked} onPress={()=>open({kind:'location'})}/>:null}{snapshot.locations.filter(row=>inventoryMatches(search,[row.label,row.building,row.room])).map(location=><MobileCard key={location.id}><Text style={m.section}>{location.label}</Text><Text style={m.muted}>{[location.building,location.room,location.notes].filter(Boolean).join(' · ')}</Text>{permissions.manageCatalogs?<MobileButton label="Lagerort bearbeiten" disabled={blocked} onPress={()=>open({kind:'location',location})}/>:null}</MobileCard>)}<Text style={m.section}>Kategorien</Text>{permissions.manageCatalogs?<MobileButton label="Kategorie anlegen" disabled={blocked} onPress={()=>open({kind:'category'})}/>:null}{snapshot.categories.filter(row=>inventoryMatches(search,[row.label])).map(category=><MobileCard key={category.id}><Text style={m.section}>{category.label}</Text><Text style={m.muted}>{INVENTORY_CATEGORY_LABELS[category.group]} · {category.requiresReturnOnExit?'Rückgabe bei Austritt':'Keine Austrittsrückgabe'}</Text>{permissions.manageCatalogs?<MobileButton label="Kategorie bearbeiten" disabled={blocked} onPress={()=>open({kind:'category',category})}/>:null}</MobileCard>)}</>:null}
    {activeView==='damage'?<><MobileChips label="Schadenmeldungen filtern" value={damageFilter} onChange={setDamageFilter} items={[{key:'open',label:'Offene'},{key:'all',label:'Alle'}]}/>{permissions.reportDamage?<MobileButton label="Vorfall melden" disabled={blocked||!snapshot.items.length} onPress={()=>open({kind:'damage'})}/>:null}{damages.map(report=><MobileCard key={report.id}><Text style={m.section}>{itemName(report.itemId)}</Text><Text style={m.body}>{report.description}</Text><Text style={m.muted}>{report.reportType==='loss'?'Verlust':report.reportType==='missing_return'?'Fehlende Rückgabe':'Schaden'} · {report.resolvedAt?'Abgeschlossen':'Offen'}</Text>{permissions.manage&&!report.resolvedAt?<MobileButton label="Fall abschließen" disabled={blocked} onPress={()=>open({kind:'resolveDamage',report})}/>:null}</MobileCard>)}{!damages.length?<MobileState title="Keine passenden Meldungen"/>:null}</>:null}
    {activeView==='history'?snapshot.audit.filter(row=>inventoryMatches(search,[inventoryAuditTitle(row),row.entityType])).map(row=><MobileCard key={row.id}><Text style={m.section}>{inventoryAuditTitle(row)}</Text><Text style={m.muted}>{inventoryDate(row.createdAt,true)}</Text></MobileCard>):null}
    {activeView==='offboarding'?<PersonnelReturns key={`${snapshot.items.length}:${snapshot.assignments.map(row=>row.updatedAt).join()}`} scope={scope} snapshot={snapshot} initialEmployeeId={initialEmployeeId} person={person} renderAssignment={assignmentCard}/>:null}
  </ScrollView>
  <MobileSheet visible={filtersOpen} title="Inventar filtern" onClose={()=>setFiltersOpen(false)} footer={<MobileButton primary label="Ergebnisse anzeigen" onPress={()=>setFiltersOpen(false)}/>}><MobileSelect label="Kategorie" value={categoryFilter} options={Object.fromEntries(snapshot.categories.filter(row=>!categoryGroupFilter || row.group===categoryGroupFilter).map(row=>[row.id,row.label]))} empty="Alle Kategorien" onChange={setCategoryFilter}/><MobileSelect label="Lagerort" value={locationFilter} options={Object.fromEntries(snapshot.locations.map(row=>[row.id,row.label]))} empty="Alle Lagerorte" onChange={setLocationFilter}/><MobileSelect label="Bestandsstatus" value={statusFilter} options={INVENTORY_STATUS_LABELS} empty="Alle Status" onChange={setStatusFilter}/><MobileButton label="Filter zurücksetzen" onPress={()=>{setCategoryFilter('');setLocationFilter('');setStatusFilter('');}}/></MobileSheet>
  {detail?<MobileSheet visible title={detail.name} onClose={()=>void close()}>{[['Inventarnummer',detail.sku],['Seriennummer',detail.serialNumber],['Barcode',detail.barcode],['Hersteller',detail.manufacturer],['Modell',detail.model],['Kaufdatum',inventoryDate(detail.purchaseDate)],['Garantie bis',inventoryDate(detail.warrantyUntil)],['Hinweise',detail.notes]].map(([label,value])=><View key={label}><Text style={m.label}>{label}</Text><Text selectable style={m.body}>{value||'Nicht hinterlegt'}</Text></View>)}{actions(detail)}<Text style={m.section}>Ausgaben & Rücknahmen</Text>{snapshot.assignments.filter(row=>row.itemId===detail.id).map(assignmentCard)}{snapshot.returns.filter(row=>snapshot.assignments.some(assignment=>assignment.itemId===detail.id&&assignment.id===row.assignmentId)).map(row=><MobileCard key={row.id}><Text style={m.section}>Rücknahme · {inventoryDate(row.createdAt,true)}</Text>{Object.entries(row.capture).map(([key,value])=><Text key={key} style={m.body}>{({returned:'Zurückgegeben',complete:'Vollständig',condition:'Zustand',damageDescription:'Schaden',accessoriesComplete:'Zubehör vollständig',chargerReturned:'Ladegerät zurückgegeben',simRemoved:'SIM entfernt',deviceReset:'Gerät zurückgesetzt',dataDeleted:'Daten gelöscht',notes:'Hinweise'} as Record<string,string>)[key]??key}: {value===true?'Ja':value===false?'Nein':value==null?'Nicht geprüft':key==='condition'?CONDITION_LABELS[value as keyof typeof CONDITION_LABELS]:String(value)}</Text>)}</MobileCard>)}</MobileSheet>:null}
  {dialog&&dialog.kind!=='detail'?<CompanyInventoryEditor key={`${dialog.kind}:${'item' in dialog?dialog.item?.id??'new':'assignment' in dialog?dialog.assignment.id:'new'}`} dialog={dialog} scope={scope} snapshot={snapshot} busy={busy} blocked={reloadRequired||loading} error={mutationError} onDirtyChange={setDialogDirty} onClose={()=>void close()} onSaved={saved} onReload={async()=>{recovery.current=true;return reload();}} run={run}/>:null}
  </>;
}
function PersonnelReturns({scope,snapshot,initialEmployeeId,person,renderAssignment}:{scope:CompanyInventoryScope;snapshot:CompanyInventorySnapshot;initialEmployeeId?:string;person:(id?:string|null)=>string;renderAssignment:(row:InventoryAssignment)=>ReactNode}) {
 const [employeeId,setEmployeeId]=useState(initialEmployeeId??'');
 const query=useAsyncQuery(()=>checkCompanyInventoryOffboarding(scope,employeeId),[scope,employeeId],{enabled:!!employeeId,queryKey:`native-offboarding:${scope.tenantId}:${scope.actorProfileId}:${employeeId}`});
 return <><MobileSelect label="Mitarbeitende Person" value={employeeId} options={Object.fromEntries(snapshot.employees.map(row=>[row.id,person(row.id)]))} onChange={setEmployeeId}/>{query.loading?<MobileState loading title="Rückgaben werden geprüft"/>:query.error?<MobileState title="Rückgaben konnten nicht geprüft werden" message={query.error} onRetry={()=>void query.refresh()}/>:query.data?<><Text style={m.section}>{query.data.openAssignments.length} offene rückgabepflichtige Ausgaben</Text>{query.data.openAssignments.map(renderAssignment)}</>:null}</>;
}
