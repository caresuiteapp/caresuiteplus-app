// Generated native presentation from src/components/company/CompanyInventoryWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeStyle,NativeH2,NativeP,NativeButton,NativeH3,NativeSection,NativeStrong,NativeNav,NativeSmall,NativeOption,NativeSpan,NativeTable,NativeColgroup,NativeCol,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeArticle,NativeLabel,NativeInput,NativeSelect,NativeDl,NativeDt,NativeDd,NativeUl,NativeLi,NativeDetails,NativeSummary,NativeOl,NativeTime,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PermissionKey, RoleKey } from '@/types';
import type { InventoryCategoryGroup, InventoryAssignment, InventoryItem, InventoryReturnCapture, OffboardingInventoryCheck } from '@/types/inventory';
import { INVENTORY_CATEGORY_LABELS } from '@/types/inventory';
import { PlatformModal } from "../layout/platform/platformmodal.tsx";
import { confirmAction } from '@/lib/platform/confirmAction';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { acknowledgeCompanyInventoryAssignment, checkCompanyInventoryOffboarding, getCompanyInventoryPermissions, loadCompanyInventory, requestCompanyInventoryReturn, type CompanyInventoryPermissions, type CompanyInventoryResult, type CompanyInventoryScope, type CompanyInventorySnapshot, } from "../../lib/inventory/companyInventoryService.ts";
import { CompanyIcon } from "./CompanyWorkspaceView.native.tsx";
import { CompanyInventoryEditor, type InventoryEditDialog, type RunInventoryMutation } from "./CompanyInventoryDialogs.native.tsx";
import { ASSIGNMENT_STATUS_LABELS, COMPANY_INVENTORY_VIEWS, CONDITION_LABELS, INVENTORY_STATUS_LABELS, inventoryAuditTitle, inventoryDate, inventoryMatches, isAssignmentOpen, isAssignmentOverdue, type CompanyInventoryView, } from "./companyInventoryModel.ts";
import { companyInventoryCss } from "./companyInventoryCss.native.ts";
export type { CompanyInventoryView } from "./companyInventoryModel.ts";
export type CompanyInventoryWorkspaceProps = {
    tenantId: string;
    roleKey: RoleKey | null;
    actorProfileId?: string | null;
    effectivePermissions?: readonly PermissionKey[];
    scopeLimited?: boolean;
    initialView?: CompanyInventoryView;
    categoryGroupFilter?: InventoryCategoryGroup;
    title?: string;
    initialEmployeeId?: string;
    initialItemId?: string;
    onViewChange?: (view: CompanyInventoryView) => void;
    onNavigationGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
};
type Dialog = InventoryEditDialog | {
    kind: 'detail';
    itemId: string;
};
type Notice = {
    text: string;
    error?: boolean;
} | null;
export function CompanyInventoryWorkspace(props: CompanyInventoryWorkspaceProps) {
    const permissionsKey = props.effectivePermissions ? [...props.effectivePermissions].sort().join(',') : 'role';
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<InventoryWorkspaceScope key={`${props.tenantId}:${props.roleKey}:${props.actorProfileId ?? ''}:${permissionsKey}:${Boolean(props.scopeLimited)}`} {...props}/>}</NativeWorkspaceStyleScope>;
}
function InventoryWorkspaceScope({ tenantId, roleKey, actorProfileId, effectivePermissions, scopeLimited = false, initialView = 'stock', categoryGroupFilter, title, initialEmployeeId, initialItemId, onViewChange, onNavigationGuardChange }: CompanyInventoryWorkspaceProps) {
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
    const confirmLeave = useUnsavedWebChanges(dialogDirty, busy);
    const availableViews = COMPANY_INVENTORY_VIEWS.filter(tab => tab.id !== 'history' || permissions.audit)
        .filter(tab => tab.id !== 'offboarding' || permissions.offboarding);
    const activeView = availableViews.some(tab => tab.id === view) ? view : 'stock';
    useEffect(() => { alive.current = true; return () => { alive.current = false; readSequence.current += 1; }; }, []);
    useEffect(() => { setView(initialView); }, [initialView]);
    useEffect(() => { setEmployeeFilter(initialEmployeeId ?? ''); }, [initialEmployeeId]);
    useEffect(() => {
        if (initialItemId)
            setDialog({ kind: 'detail', itemId: initialItemId });
    }, [initialItemId]);
    useEffect(() => {
        onNavigationGuardChange?.(confirmLeave);
        return () => onNavigationGuardChange?.(null);
    }, [confirmLeave, onNavigationGuardChange]);
    const reload = useCallback(async () => {
        const request = ++readSequence.current;
        setLoading(true);
        setLoadError(null);
        try {
            const result = await loadCompanyInventory(scope);
            if (!alive.current || request !== readSequence.current)
                return false;
            if (!result.ok) {
                setLoadError(result.error);
                return false;
            }
            setSnapshot(result.data);
            setReloadRequired(false);
            setMutationError(null);
            if (recovery.current) {
                recovery.current = false;
                setDialog(null);
                setDialogDirty(false);
                setNotice({ text: 'Bestand neu geladen. Bitte prüfen Sie den letzten Vorgang vor weiteren Änderungen. Der vorherige Entwurf wurde geschlossen.' });
            }
            return true;
        }
        catch {
            if (alive.current && request === readSequence.current)
                setLoadError('Das Inventar konnte nicht geladen werden. Bitte versuchen Sie es erneut.');
            return false;
        }
        finally {
            if (alive.current && request === readSequence.current)
                setLoading(false);
        }
    }, [scope]);
    useEffect(() => { void reload(); }, [reload]);
    const run: RunInventoryMutation = async <T,>(operation: () => Promise<CompanyInventoryResult<T>>, message: string) => {
        if (!alive.current || writeLock.current || recovery.current || reloadRequired || loading)
            return false;
        writeLock.current = true;
        setBusy(true);
        setMutationError(null);
        setNotice(null);
        try {
            const result = await operation();
            if (!alive.current)
                return false;
            if (!result.ok) {
                setMutationError(result.error);
                if (result.reloadRequired) {
                    recovery.current = true;
                    setReloadRequired(true);
                }
                return false;
            }
            const refreshed = await reload();
            if (!alive.current)
                return false;
            if (!refreshed) {
                recovery.current = true;
                setReloadRequired(true);
                setNotice({ text: `${message} Die aktualisierte Liste konnte noch nicht geladen werden.`, error: true });
            }
            else
                setNotice({ text: message });
            return true;
        }
        catch {
            if (alive.current) {
                recovery.current = true;
                setReloadRequired(true);
                setMutationError('Der Speicherstand konnte nicht bestätigt werden. Bitte laden Sie das Inventar neu und prüfen Sie den Vorgang.');
            }
            return false;
        }
        finally {
            writeLock.current = false;
            if (alive.current)
                setBusy(false);
        }
    };
    async function switchView(next: CompanyInventoryView) {
        if (!(await confirmLeave()))
            return;
        setDialog(null);
        setDialogDirty(false);
        setSearch('');
        setView(next);
        setMutationError(null);
        onViewChange?.(next);
    }
    function open(next: Dialog) {
        if (busy || loading)
            return;
        if ((next.kind === 'category' || next.kind === 'location') && !permissions.manageCatalogs)
            return;
        if (next.kind === 'item' && !next.item && !permissions.createItems)
            return;
        setMutationError(null);
        setDialogDirty(false);
        setDialog(next);
    }
    async function close() {
        if (!(await confirmLeave()))
            return;
        setDialog(null);
        setDialogDirty(false);
        setMutationError(null);
    }
    function saved() { setDialog(null); setDialogDirty(false); }
    const blocked = busy || reloadRequired || loading;
    const person = (employeeId?: string | null) => {
        if (!employeeId)
            return 'Nicht zugeordnet';
        if (!permissions.viewEmployees || !snapshot?.employeesVisible)
            return 'Personaldaten geschützt';
        const employee = snapshot?.employees.find(entry => entry.id === employeeId);
        return employee ? `${employee.firstName} ${employee.lastName}`.trim() || 'Mitarbeitende Person' : permissions.viewEmployees ? 'Person nicht mehr verfügbar' : 'Personaldaten geschützt';
    };
    if (!permissions.view)
        return <NativeWorkspaceStyleScope css={[companyInventoryCss, companyInventoryCss]}>{<NativeDiv className="ci-workspace">
    <NativeStyle>
      {companyInventoryCss}
    </NativeStyle>
    <Empty title="Kein Zugriff auf das Inventar" text="Für diesen Bereich fehlt die Inventarberechtigung." icon="shield"/>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
    if (!snapshot)
        return <NativeWorkspaceStyleScope css={[companyInventoryCss, companyInventoryCss]}>{<NativeDiv className="ci-workspace" aria-busy={loading}>
    <NativeStyle>
      {companyInventoryCss}
    </NativeStyle>
    <NativeDiv className="ci-heading">
      <NativeDiv>
        <NativeH2>{title ?? 'Inventar'}</NativeH2>
        <NativeP>Ausstattung und Rückgaben Ihres Unternehmens.</NativeP>
      </NativeDiv>
    </NativeDiv>
    {loadError ? <Empty title="Inventar konnte nicht geladen werden" text={loadError} icon="info">
      <NativeButton type="button" className="ci-button" disabled={loading} onClick={() => void reload()}>Erneut laden</NativeButton>
    </Empty> : <NativeDiv className="ci-empty ci-loading" role="status">
      <CompanyIcon name="grid" size={30}/>
      <NativeH3>Inventar wird geladen …</NativeH3>
      <NativeP>Bestand, Ausgaben und Lagerorte werden abgerufen.</NativeP>
    </NativeDiv>}
  </NativeDiv>}</NativeWorkspaceStyleScope>;
    const selectedItems = snapshot.items.filter(item => !categoryGroupFilter || item.categoryGroup === categoryGroupFilter);
    const selectedIds = new Set(selectedItems.map(item => item.id));
    const activeAssignments = snapshot.assignments.filter(item => selectedIds.has(item.itemId)).filter(isAssignmentOpen);
    const overdueAssignments = activeAssignments.filter(assignment => isAssignmentOverdue(assignment));
    const openDamage = snapshot.damageReports.filter(report => selectedIds.has(report.itemId) && !report.resolvedAt);
    const itemName = (itemId: string) => snapshot.items.find(item => item.id === itemId)?.name ?? 'Gegenstand nicht mehr verfügbar';
    const categoryName = (item: InventoryItem) => snapshot.categories.find(category => category.id === item.categoryId)?.label ?? INVENTORY_CATEGORY_LABELS[item.categoryGroup];
    const locationName = (item: InventoryItem) => snapshot.locations.find(location => location.id === item.locationId)?.label ?? (item.locationId ? 'Lagerort nicht mehr verfügbar' : 'Ohne festen Lagerort');
    const items = selectedItems.filter(item => (!categoryFilter || item.categoryId === categoryFilter)
        && (!locationFilter || (locationFilter === 'none' ? !item.locationId : item.locationId === locationFilter))
        && (!statusFilter || item.status === statusFilter)
        && inventoryMatches(search, [item.name, item.sku, item.serialNumber, item.manufacturer, item.model, item.barcode, categoryName(item), locationName(item)]))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const assignments = snapshot.assignments.filter(assignment => selectedIds.has(assignment.itemId) && (assignmentFilter === 'all'
        || (assignmentFilter === 'open' && isAssignmentOpen(assignment))
        || (assignmentFilter === 'overdue' && isAssignmentOverdue(assignment))
        || (assignmentFilter === 'closed' && !isAssignmentOpen(assignment)))
        && (!employeeFilter || assignment.recipientEmployeeId === employeeFilter)
        && inventoryMatches(search, [itemName(assignment.itemId), person(assignment.recipientEmployeeId), ASSIGNMENT_STATUS_LABELS[assignment.status], snapshot.items.find(item => item.id === assignment.itemId)?.sku]))
        .sort((a, b) => Number(isAssignmentOverdue(b)) - Number(isAssignmentOverdue(a)) || b.createdAt.localeCompare(a.createdAt));
    const damageReports = snapshot.damageReports.filter(report => selectedIds.has(report.itemId) && (damageFilter === 'all' || (damageFilter === 'open' ? !report.resolvedAt : report.resolvedAt))
        && inventoryMatches(search, [itemName(report.itemId), report.description, report.reportType === 'loss' ? 'Verlust' : report.reportType === 'missing_return' ? 'Fehlende Rückgabe' : 'Schaden']))
        .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
    const detailItem = dialog?.kind === 'detail' ? snapshot.items.find(item => item.id === dialog.itemId) : null;
    return <NativeWorkspaceStyleScope css={[companyInventoryCss, companyInventoryCss]}>{<NativeSection className="ci-workspace" aria-label="Inventar im Unternehmen" aria-busy={busy || loading} data-testid="company-inventory-workspace">
    <NativeStyle>
      {companyInventoryCss}
    </NativeStyle>
    <NativeDiv className="ci-heading">
      <NativeDiv>
        <NativeH2>{title ?? 'Inventar'}</NativeH2>
        <NativeP>Bestand, Ausgabe und Rücknahme an einem Ort.</NativeP>
      </NativeDiv>
      <NativeDiv className="ci-actions">
        <NativeButton type="button" className="ci-button ci-button--quiet" disabled={busy || loading} onClick={() => void reload()}>
          <CompanyIcon name="refresh" size={16}/>
          {loading ? 'Wird geladen …' : 'Aktualisieren'}
        </NativeButton>
        {permissions.createItems && <NativeButton type="button" className="ci-button ci-button--primary" disabled={blocked} onClick={() => open(snapshot.categories.length ? { kind: 'item' } : { kind: 'category' })}>
          <CompanyIcon name="plus" size={17}/>
          {snapshot.categories.length ? 'Inventar anlegen' : 'Erste Kategorie anlegen'}
        </NativeButton>}
      </NativeDiv>
    </NativeDiv>
    {notice && <NativeDiv className={`ci-banner ${notice.error ? 'ci-banner--error' : 'ci-banner--success'}`} role="status">
      <CompanyIcon name={notice.error ? 'info' : 'check'} size={18}/>
      <NativeDiv>
        {notice.text}
      </NativeDiv>
      <NativeButton type="button" className="ci-icon-button" aria-label="Hinweis schließen" onClick={() => setNotice(null)}>
        <CompanyIcon name="close" size={14}/>
      </NativeButton>
    </NativeDiv>}
    {(loadError || (mutationError && (!dialog || dialog.kind === 'detail'))) && <NativeDiv className="ci-banner ci-banner--error" role="alert">
      <CompanyIcon name="info" size={20}/>
      <NativeDiv>
        <NativeStrong>
          {loadError ? 'Aktualisierung fehlgeschlagen' : 'Änderung nicht bestätigt'}
        </NativeStrong>
        <NativeP>
          {loadError ?? mutationError}
        </NativeP>
      </NativeDiv>
    </NativeDiv>}
    {reloadRequired && <NativeDiv className="ci-banner ci-banner--info" role="alert">
      <CompanyIcon name="refresh" size={20}/>
      <NativeDiv>
        <NativeStrong>Bestand vor der nächsten Änderung prüfen</NativeStrong>
        <NativeP>Der letzte Vorgang ist nicht vollständig bestätigt. Weitere Änderungen sind bis zum erfolgreichen Neuladen gesperrt. Dabei wird der bisherige Entwurf geschlossen, damit Sie den Vorgang nicht versehentlich doppelt speichern.</NativeP>
        <NativeDiv className="ci-actions">
          <NativeButton type="button" className="ci-button" disabled={busy || loading} onClick={() => void reload()}>Bestand neu laden</NativeButton>
        </NativeDiv>
      </NativeDiv>
    </NativeDiv>}
    <NativeDiv className="ci-stats">
      <Stat label="Bestand" value={selectedItems.filter(item => item.status !== 'archived').length} detail="ohne archivierte Einträge" icon="grid" onClick={() => { setStatusFilter(''); void switchView('stock'); }}/>
      <Stat label="Verfügbar" value={selectedItems.filter(item => item.status === 'available').length} detail="bereit zur Ausgabe" icon="check" onClick={() => { setStatusFilter('available'); void switchView('stock'); }}/>
      <Stat label="Offene Ausgaben" value={activeAssignments.length} detail="noch nicht abgeschlossen" icon="transfer" onClick={() => { setAssignmentFilter('open'); void switchView('assignments'); }}/>
      <Stat label="Rückgaben überfällig" value={overdueAssignments.length} detail="Rückgabefrist überschritten" icon="clock" attention={overdueAssignments.length > 0} onClick={() => { setAssignmentFilter('overdue'); void switchView('assignments'); }}/>
    </NativeDiv>
    <NativeNav className="ci-tabs" aria-label="Inventarbereiche">
      {availableViews.map(tab => <NativeButton type="button" key={tab.id} aria-pressed={activeView === tab.id} disabled={busy} onClick={() => void switchView(tab.id)}>
        {tab.label}{tab.id === 'damage' && openDamage.length > 0 && <NativeSmall>
          {openDamage.length}
        </NativeSmall>}
      </NativeButton>)}
    </NativeNav>
    {activeView === 'stock' && <>
      <NativeDiv className="ci-toolbar">
        <Search value={search} onChange={setSearch} placeholder="Gegenstand, Kennung oder Seriennummer suchen"/>
        <Filter label="Kategorie" value={categoryFilter} onChange={setCategoryFilter}>
          <NativeOption value="">Alle Kategorien</NativeOption>
          {snapshot.categories.filter(category => !categoryGroupFilter || category.group === categoryGroupFilter).map(category => <NativeOption key={category.id} value={category.id}>
            {category.label}
          </NativeOption>)}
        </Filter>
        <Filter label="Lagerort" value={locationFilter} onChange={setLocationFilter}>
          <NativeOption value="">Alle Lagerorte</NativeOption>
          <NativeOption value="none">Ohne festen Lagerort</NativeOption>
          {snapshot.locations.map(location => <NativeOption key={location.id} value={location.id}>
            {location.label}
          </NativeOption>)}
        </Filter>
        <Filter label="Status" value={statusFilter} onChange={setStatusFilter}>
          <NativeOption value="">Alle Status</NativeOption>
          {Object.entries(INVENTORY_STATUS_LABELS).map(([key, label]) => <NativeOption key={key} value={key}>
            {label}
          </NativeOption>)}
        </Filter>
      </NativeDiv>
      <NativeDiv className="ci-result-line">
        <NativeSpan>
          {items.length} von {selectedItems.length} Bestandsposten</NativeSpan>
        {Boolean(search || categoryFilter || locationFilter || statusFilter) && <NativeButton type="button" className="ci-text-button" onClick={() => { setSearch(''); setCategoryFilter(''); setLocationFilter(''); setStatusFilter(''); }}>Filter zurücksetzen</NativeButton>}
      </NativeDiv>
      {items.length ? <NativeDiv className="ci-table-shell" tabIndex={0} role="region" aria-label="Inventarbestand, bei Bedarf seitlich scrollen">
        <NativeTable className="ci-table">
          <NativeColgroup>
            <NativeCol style={{ width: '30%' }}/>
            <NativeCol style={{ width: '20%' }}/>
            <NativeCol style={{ width: '19%' }}/>
            <NativeCol style={{ width: '17%' }}/>
            <NativeCol style={{ width: '14%' }}/>
          </NativeColgroup>
          <NativeThead>
            <NativeTr>
              <NativeTh scope="col">Gegenstand</NativeTh>
              <NativeTh scope="col">Kategorie & Zustand</NativeTh>
              <NativeTh scope="col">Lagerort</NativeTh>
              <NativeTh scope="col">Status</NativeTh>
              <NativeTh scope="col">
                <NativeSpan className="ci-sr-only">Aktionen</NativeSpan>
              </NativeTh>
            </NativeTr>
          </NativeThead>
          <NativeTbody>
            {items.map(item => <NativeTr key={item.id}>
              <NativeTd>
                <NativeButton type="button" className="ci-name" onClick={() => open({ kind: 'detail', itemId: item.id })}>
                  {item.name}
                </NativeButton>
                <NativeSmall>
                  {item.sku ? `Nr. ${item.sku}` : 'Keine Inventarnummer'}{item.serialNumber ? ` · SN ${item.serialNumber}` : ''}
                </NativeSmall>
              </NativeTd>
              <NativeTd>
                {categoryName(item)}<NativeSmall>
                  {CONDITION_LABELS[item.condition]}
                </NativeSmall>
              </NativeTd>
              <NativeTd>
                {locationName(item)}
              </NativeTd>
              <NativeTd>
                <Status value={item.status}/>
                {activeAssignments.some(assignment => assignment.itemId === item.id) && <NativeSmall>
                  {person(activeAssignments.find(assignment => assignment.itemId === item.id)?.recipientEmployeeId)}
                </NativeSmall>}
              </NativeTd>
              <NativeTd>
                <NativeButton type="button" className="ci-text-button" onClick={() => open({ kind: 'detail', itemId: item.id })}>Details ansehen</NativeButton>
              </NativeTd>
            </NativeTr>)}
          </NativeTbody>
        </NativeTable>
      </NativeDiv> : <Empty title={snapshot.items.length ? 'Kein passender Bestand' : 'Ihr Inventar beginnt hier'} text={snapshot.items.length ? 'Passen Sie die Suche oder die Filter an.' : 'Erfassen Sie Geräte, Schlüssel, Dienstkleidung und weitere Ausstattung. Kategorien und Lagerorte helfen bei der Zuordnung.'} icon="grid">
        {permissions.createItems && !snapshot.items.length && <NativeButton type="button" className="ci-button ci-button--primary" disabled={blocked} onClick={() => open(snapshot.categories.length ? { kind: 'item' } : { kind: 'category' })}>
          {snapshot.categories.length ? 'Ersten Gegenstand anlegen' : 'Erste Kategorie anlegen'}
        </NativeButton>}
      </Empty>}
    </>}
    {activeView === 'assignments' && <>
      <NativeDiv className="ci-toolbar">
        <Search value={search} onChange={setSearch} placeholder="Gegenstand oder Person suchen"/>
        <Filter label="Anzeigen" value={assignmentFilter} onChange={setAssignmentFilter}>
          <NativeOption value="open">Offene Ausgaben</NativeOption>
          <NativeOption value="overdue">Überfällige Rückgaben</NativeOption>
          <NativeOption value="closed">Abgeschlossene Ausgaben</NativeOption>
          <NativeOption value="all">Alle Ausgaben</NativeOption>
        </Filter>
        {permissions.viewEmployees && <Filter label="Person" value={employeeFilter} onChange={setEmployeeFilter}>
          <NativeOption value="">Alle Personen</NativeOption>
          {snapshot.employees.map(employee => <NativeOption key={employee.id} value={employee.id}>
            {employee.firstName} {employee.lastName}
          </NativeOption>)}{employeeFilter && !snapshot.employees.some(employee => employee.id === employeeFilter) && <NativeOption value={employeeFilter}>Person nicht mehr verfügbar</NativeOption>}
        </Filter>}
      </NativeDiv>
      <NativeDiv className="ci-result-line">
        <NativeSpan>
          {assignments.length} Ausgaben</NativeSpan>
      </NativeDiv>
      {assignments.length ? <AssignmentTable scope={scope} assignments={assignments} snapshot={snapshot} person={person} permissions={permissions} blocked={blocked} open={open} run={run}/> : <Empty title="Keine passenden Ausgaben" text={snapshot.assignments.length ? 'Für diese Auswahl sind keine Ausgaben vorhanden.' : 'Öffnen Sie einen verfügbaren Gegenstand im Bestand, um ihn einer Person auszugeben.'} icon="transfer">
        <NativeButton className="ci-button" type="button" onClick={() => void switchView('stock')}>Bestand öffnen</NativeButton>
      </Empty>}
    </>}
    {activeView === 'locations' && <>
      <NativeDiv className="ci-section-title">
        <NativeDiv>
          <NativeH3>Lagerorte</NativeH3>
          <NativeP>Aufbewahrungsorte mit Gebäude und Raum.</NativeP>
        </NativeDiv>
        {permissions.manageCatalogs && <NativeButton type="button" className="ci-button" disabled={blocked} onClick={() => open({ kind: 'location' })}>
          <CompanyIcon name="plus" size={16}/>Lagerort anlegen</NativeButton>}
      </NativeDiv>
      {snapshot.locations.length ? <NativeDiv className="ci-card-grid">
        {snapshot.locations.map(location => <NativeArticle key={location.id} className="ci-card">
          <NativeDiv className="ci-card-header">
            <NativeDiv>
              <NativeH3>
                {location.label}
              </NativeH3>
              <NativeSmall>
                {[location.building, location.room].filter(Boolean).join(' · ') || 'Gebäude und Raum nicht hinterlegt'}
              </NativeSmall>
            </NativeDiv>
            <CompanyIcon name="pin" size={22}/>
          </NativeDiv>
          {location.notes && <NativeP>
            {location.notes}
          </NativeP>}<NativeDiv className="ci-card-foot">
            <NativeSpan>
              {snapshot.items.filter(item => item.locationId === location.id).length} Bestandsposten</NativeSpan>
            <NativeDiv className="ci-actions">
              <NativeButton type="button" className="ci-text-button" onClick={() => { setLocationFilter(location.id); setStatusFilter(''); setCategoryFilter(''); void switchView('stock'); }}>Bestand anzeigen</NativeButton>
              {permissions.manageCatalogs && <NativeButton type="button" className="ci-text-button" disabled={blocked} onClick={() => open({ kind: 'location', location })}>Bearbeiten</NativeButton>}
            </NativeDiv>
          </NativeDiv>
        </NativeArticle>)}
      </NativeDiv> : <Empty title="Noch keine Lagerorte" text="Hinterlegen Sie die Orte, an denen Ausstattung aufbewahrt wird." icon="pin"/>}
      <NativeDiv className="ci-section-title">
        <NativeDiv>
          <NativeH3>Kategorien</NativeH3>
          <NativeP>Gruppierung und Vorgaben für neue Bestandsposten.</NativeP>
        </NativeDiv>
        {permissions.manageCatalogs && <NativeButton type="button" className="ci-button" disabled={blocked} onClick={() => open({ kind: 'category' })}>
          <CompanyIcon name="plus" size={16}/>Kategorie anlegen</NativeButton>}
      </NativeDiv>
      {snapshot.categories.length ? <NativeDiv className="ci-card-grid">
        {snapshot.categories.filter(category => !categoryGroupFilter || category.group === categoryGroupFilter).map(category => <NativeArticle key={category.id} className="ci-card">
          <NativeDiv className="ci-card-header">
            <NativeDiv>
              <NativeH3>
                {category.label}
              </NativeH3>
              <NativeSmall>
                {INVENTORY_CATEGORY_LABELS[category.group]}
              </NativeSmall>
            </NativeDiv>
            <CompanyIcon name="grid" size={22}/>
          </NativeDiv>
          <NativeDiv className="ci-tags">
            <NativeSpan className="ci-badge">
              {category.requiresReturnOnExit ? 'Rückgabe bei Austritt' : 'Ohne Austrittsrückgabe'}
            </NativeSpan>
            <NativeSpan className="ci-badge">
              {category.portalVisibleToEmployee ? 'Im Mitarbeitendenportal' : 'Nur Verwaltung'}
            </NativeSpan>
          </NativeDiv>
          <NativeDiv className="ci-card-foot">
            <NativeSpan>
              {snapshot.items.filter(item => item.categoryId === category.id).length} Bestandsposten</NativeSpan>
            <NativeDiv className="ci-actions">
              <NativeButton type="button" className="ci-text-button" onClick={() => { setCategoryFilter(category.id); setStatusFilter(''); setLocationFilter(''); void switchView('stock'); }}>Bestand anzeigen</NativeButton>
              {permissions.manageCatalogs && <NativeButton type="button" className="ci-text-button" disabled={blocked} onClick={() => open({ kind: 'category', category })}>Bearbeiten</NativeButton>}
            </NativeDiv>
          </NativeDiv>
        </NativeArticle>)}
      </NativeDiv> : <Empty title="Noch keine Kategorien" text="Legen Sie eine erste Kategorie an, bevor Sie Bestand erfassen." icon="grid"/>}
    </>}
    {activeView === 'damage' && <>
      <NativeDiv className="ci-toolbar">
        <Search value={search} onChange={setSearch} placeholder="Gegenstand oder Meldung suchen"/>
        <Filter label="Meldungen" value={damageFilter} onChange={setDamageFilter}>
          <NativeOption value="open">Offen</NativeOption>
          <NativeOption value="closed">Erledigt</NativeOption>
          <NativeOption value="all">Alle Meldungen</NativeOption>
        </Filter>
        {permissions.reportDamage && <NativeButton type="button" className="ci-button" disabled={blocked || !snapshot.items.length} onClick={() => open({ kind: 'damage' })}>
          <CompanyIcon name="plus" size={16}/>Meldung erfassen</NativeButton>}
      </NativeDiv>
      {damageReports.length ? <NativeDiv className="ci-card-grid">
        {damageReports.map(report => <NativeArticle className="ci-card" key={report.id}>
          <NativeDiv className="ci-card-header">
            <NativeDiv>
              <NativeH3>
                {itemName(report.itemId)}
              </NativeH3>
              <NativeSmall>
                {inventoryDate(report.reportedAt, true)}
              </NativeSmall>
            </NativeDiv>
            <NativeSpan className={`ci-badge ${report.resolvedAt ? 'ci-badge--good' : 'ci-badge--bad'}`}>
              {report.reportType === 'loss' ? 'Verlust' : report.reportType === 'missing_return' ? 'Fehlende Rückgabe' : 'Schaden'}
            </NativeSpan>
          </NativeDiv>
          <NativeP style={{ whiteSpace: 'pre-line' }}>
            {report.description}
          </NativeP>
          <NativeDiv className="ci-card-foot">
            <NativeSpan>
              {report.resolvedAt ? `Erledigt am ${inventoryDate(report.resolvedAt)}` : 'Offene Meldung'} · {CONDITION_LABELS[report.condition]}
            </NativeSpan>
            <NativeDiv className="ci-actions">
              <NativeButton type="button" className="ci-text-button" onClick={() => open({ kind: 'detail', itemId: report.itemId })}>Gegenstand öffnen</NativeButton>
              {permissions.manage && !report.resolvedAt && <NativeButton type="button" className="ci-button" disabled={blocked} onClick={() => open({ kind: 'resolveDamage', report })}>Fall abschließen</NativeButton>}
            </NativeDiv>
          </NativeDiv>
        </NativeArticle>)}
      </NativeDiv> : <Empty title="Keine passenden Meldungen" text="Dokumentierte Schäden, Verluste und fehlende Rückgaben erscheinen hier." icon="shield"/>}
    </>}
    {activeView === 'offboarding' && <PersonnelReturns initialEmployeeId={initialEmployeeId} scope={scope} snapshot={snapshot} person={person} open={open} blocked={blocked} canReturn={permissions.returnItems}/>}
    {activeView === 'history' && <>
      <NativeDiv className="ci-toolbar">
        <Search value={search} onChange={setSearch} placeholder="Aktivität oder Gegenstand suchen"/>
      </NativeDiv>
      <InventoryHistory snapshot={snapshot} search={search}/>
    </>}
    {dialog && dialog.kind !== 'detail' && <CompanyInventoryEditor key={`${dialog.kind}:${'item' in dialog ? dialog.item?.id ?? 'new' : 'assignment' in dialog ? dialog.assignment.id : 'category' in dialog ? dialog.category?.id ?? 'new' : 'location' in dialog ? dialog.location?.id ?? 'new' : 'new'}`} dialog={dialog} scope={scope} snapshot={snapshot} busy={busy || loading} blocked={reloadRequired} error={mutationError} onReload={reload} onDirtyChange={setDialogDirty} onClose={() => void close()} onSaved={saved} run={run}/>}
    {dialog?.kind === 'detail' && !detailItem && <NativeDiv className="ci-banner ci-banner--error" role="alert">
      <NativeDiv>Der ausgewählte Gegenstand ist in diesem Unternehmen nicht verfügbar.<NativeDiv className="ci-actions">
        <NativeButton type="button" className="ci-button" onClick={() => void close()}>Hinweis schließen</NativeButton>
      </NativeDiv>
      </NativeDiv>
    </NativeDiv>}
    {dialog?.kind === 'detail' && detailItem && <ItemDetail scope={scope} run={run} error={mutationError} item={detailItem} snapshot={snapshot} person={person} permissions={permissions} blocked={blocked} onClose={() => void close()} open={open}/>}
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
function Empty({ title, text, icon, children }: {
    title: string;
    text: string;
    icon: string;
    children?: ReactNode;
}) {
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<NativeDiv className="ci-empty">
    <CompanyIcon name={icon} size={29}/>
    <NativeH3>
      {title}
    </NativeH3>
    <NativeP>
      {text}
    </NativeP>
    {children}
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
function Stat({ label, value, detail, icon, attention, onClick }: {
    label: string;
    value: number;
    detail: string;
    icon: string;
    attention?: boolean;
    onClick: () => void;
}) {
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<NativeButton type="button" className={`ci-stat${attention ? ' ci-stat--attention' : ''}`} onClick={onClick}>
    <NativeSpan>
      <CompanyIcon name={icon} size={15}/>
      {label}
    </NativeSpan>
    <NativeStrong>
      {value}
    </NativeStrong>
    <NativeSmall>
      {detail}
    </NativeSmall>
  </NativeButton>}</NativeWorkspaceStyleScope>;
}
function Search({ value, onChange, placeholder }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}) {
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<NativeLabel className="ci-search">
    <CompanyIcon name="search" size={18}/>
    <NativeSpan className="ci-sr-only">
      {placeholder}
    </NativeSpan>
    <NativeInput type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/>
  </NativeLabel>}</NativeWorkspaceStyleScope>;
}
function Filter({ label, value, onChange, children }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: ReactNode;
}) {
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<NativeLabel className="ci-filter">
    <NativeSpan>
      {label}
    </NativeSpan>
    <NativeSelect value={value} onChange={event => onChange(event.target.value)}>
      {children}
    </NativeSelect>
  </NativeLabel>}</NativeWorkspaceStyleScope>;
}
function Status({ value, assignment }: {
    value: string;
    assignment?: InventoryAssignment;
}) {
    const overdue = assignment && isAssignmentOverdue(assignment);
    const tone = overdue || ['damaged', 'lost', 'disputed', 'unusable'].includes(value) ? 'bad'
        : ['maintenance', 'reserved', 'partially_returned', 'return_requested'].includes(value) ? 'warn'
            : ['available', 'returned', 'acknowledged'].includes(value) ? 'good'
                : ['archived', 'decommissioned'].includes(value) ? 'muted' : '';
    const label = assignment ? ASSIGNMENT_STATUS_LABELS[assignment.status] : INVENTORY_STATUS_LABELS[value as InventoryItem['status']] ?? value;
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<NativeSpan className={`ci-badge${tone ? ` ci-badge--${tone}` : ''}`}>
    {overdue && assignment.status !== 'overdue' ? 'Rückgabe überfällig' : label}
  </NativeSpan>}</NativeWorkspaceStyleScope>;
}
function AssignmentTable({ scope, assignments, snapshot, person, permissions, blocked, open, run }: {
    scope: CompanyInventoryScope;
    assignments: InventoryAssignment[];
    snapshot: CompanyInventorySnapshot;
    person: (id?: string | null) => string;
    permissions: CompanyInventoryPermissions;
    blocked: boolean;
    open: (dialog: Dialog) => void;
    run: RunInventoryMutation;
}) {
    // Mutations are supplied by the parent with the current tenant and permission scope.
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<NativeDiv className="ci-table-shell" tabIndex={0} role="region" aria-label="Inventarausgaben, bei Bedarf seitlich scrollen">
    <NativeTable className="ci-table">
      <NativeColgroup>
        <NativeCol style={{ width: '25%' }}/>
        <NativeCol style={{ width: '23%' }}/>
        <NativeCol style={{ width: '18%' }}/>
        <NativeCol style={{ width: '18%' }}/>
        <NativeCol style={{ width: '16%' }}/>
      </NativeColgroup>
      <NativeThead>
        <NativeTr>
          <NativeTh scope="col">Gegenstand</NativeTh>
          <NativeTh scope="col">Person</NativeTh>
          <NativeTh scope="col">Ausgabe & Frist</NativeTh>
          <NativeTh scope="col">Status</NativeTh>
          <NativeTh scope="col">
            <NativeSpan className="ci-sr-only">Aktionen</NativeSpan>
          </NativeTh>
        </NativeTr>
      </NativeThead>
      <NativeTbody>
        {assignments.map(assignment => {
            const item = snapshot.items.find(entry => entry.id === assignment.itemId);
            return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<NativeTr key={assignment.id}>
            <NativeTd>
              <NativeButton type="button" className="ci-name" onClick={() => open({ kind: 'detail', itemId: assignment.itemId })}>
                {item?.name ?? 'Gegenstand nicht verfügbar'}
              </NativeButton>
              <NativeSmall>
                {item?.sku ? `Nr. ${item.sku}` : CONDITION_LABELS[assignment.issueCondition]}
              </NativeSmall>
            </NativeTd>
            <NativeTd>
              {person(assignment.recipientEmployeeId)}{assignment.responsibleEmployeeId && <NativeSmall>Verantwortlich: {person(assignment.responsibleEmployeeId)}
              </NativeSmall>}
            </NativeTd>
            <NativeTd>
              {inventoryDate(assignment.issuedAt)}<NativeSmall>
                {assignment.expectedReturnAt ? `Rückgabe bis ${inventoryDate(assignment.expectedReturnAt)}` : 'Keine Rückgabefrist'}
              </NativeSmall>
            </NativeTd>
            <NativeTd>
              <Status value={assignment.status} assignment={assignment}/>
              {assignment.returnRequired && <NativeSmall>Rückgabepflichtig</NativeSmall>}
            </NativeTd>
            <NativeTd>
              <NativeDiv className="ci-row-actions">
                <AssignmentActions scope={scope} assignment={assignment} permissions={permissions} blocked={blocked} run={run}/>
                {permissions.returnItems && isAssignmentOpen(assignment) && assignment.status !== 'planned' && <NativeButton type="button" className="ci-button" disabled={blocked} onClick={() => open({ kind: 'return', assignment })}>Rücknahme</NativeButton>}<NativeButton type="button" className="ci-text-button" onClick={() => open({ kind: 'detail', itemId: assignment.itemId })}>Details</NativeButton>
              </NativeDiv>
            </NativeTd>
          </NativeTr>}</NativeWorkspaceStyleScope>;
        })}
      </NativeTbody>
    </NativeTable>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
function ItemDetail({ scope, run, error, item, snapshot, person, permissions, blocked, onClose, open }: {
    scope: CompanyInventoryScope;
    run: RunInventoryMutation;
    error: string | null;
    item: InventoryItem;
    snapshot: CompanyInventorySnapshot;
    person: (id?: string | null) => string;
    permissions: CompanyInventoryPermissions;
    blocked: boolean;
    onClose: () => void;
    open: (dialog: Dialog) => void;
}) {
    const router = useRouter();
    const assignments = snapshot.assignments.filter(assignment => assignment.itemId === item.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const openAssignment = assignments.find(isAssignmentOpen);
    const returns = snapshot.returns.filter(entry => entry.itemId === item.id).sort((a, b) => b.returnedAt.localeCompare(a.returnedAt));
    const category = snapshot.categories.find(entry => entry.id === item.categoryId);
    const location = snapshot.locations.find(entry => entry.id === item.locationId);
    const fields: [
        string,
        string | null | undefined
    ][] = [
        ['Inventarnummer', item.sku], ['Seriennummer', item.serialNumber], ['Hersteller', item.manufacturer], ['Modell', item.model],
        ['Barcode-Kennung', item.barcode], ['Kategorie', category?.label ?? INVENTORY_CATEGORY_LABELS[item.categoryGroup]],
        ['Lagerort', location?.label], ['Gebäude / Raum', location ? [location.building, location.room].filter(Boolean).join(' · ') : null],
        ['Zustand', CONDITION_LABELS[item.condition]], ['Kaufdatum', item.purchaseDate ? inventoryDate(item.purchaseDate) : null],
        ['Garantie bis', item.warrantyUntil ? inventoryDate(item.warrantyUntil) : null],
        ['Rückgabe bei Austritt', item.requiresReturnOnExit ? 'Vorgesehen' : 'Nicht vorgesehen'],
        ['Im Mitarbeitendenportal', item.portalVisibleToEmployee ? 'Sichtbar' : 'Nicht sichtbar'],
    ];
    const boolLabel = (value?: boolean | null) => value == null ? 'Nicht geprüft / nicht zutreffend' : value ? 'Ja' : 'Nein';
    const checkLabels: [
        keyof InventoryReturnCapture,
        string
    ][] = [
        ['accessoriesComplete', 'Zubehör vollständig'], ['chargerReturned', 'Ladegerät zurück'],
        ['simRemoved', 'SIM entfernt'], ['deviceReset', 'Gerät zurückgesetzt'], ['dataDeleted', 'Daten gelöscht'],
    ];
    return <NativeWorkspaceStyleScope css={[companyInventoryCss, companyInventoryCss]}>{<PlatformModal visible surfaceScope="company" title="Inventardetails" subtitle={item.sku ? `Inventarnummer ${item.sku}` : 'Bestandsposten im Unternehmen'} onClose={onClose} maxWidth={900} minWidth={260} maxHeightRatio={0.93} bodyStyle={{ backgroundColor: '#f4f8fd', padding: 22 }} sheetStyle={{ backgroundColor: '#f4f8fd' }} footerContent={<NativeDiv className="ci-dialog ci-form-footer">
      <NativeDiv className="ci-footer-row">
        <NativeButton type="button" className="ci-button ci-button--quiet" onClick={onClose}>Schließen</NativeButton>
        <NativeDiv className="ci-actions">
          {scope.effectivePermissions?.includes('business.tenant.manage') && <NativeButton type="button" className="ci-button ci-button--quiet" disabled={blocked} onClick={() => router.push(`/unternehmen/zuordnungen?itemId=${encodeURIComponent(item.id)}` as never)}>Standort & Abteilung</NativeButton>}
          {permissions.reportDamage && !['archived', 'decommissioned'].includes(item.status) && <NativeButton type="button" className="ci-button ci-button--quiet" disabled={blocked} onClick={() => open({ kind: 'damage', item })}>Schaden / Verlust</NativeButton>}
          {permissions.manage && <NativeButton type="button" className="ci-button" disabled={blocked} onClick={() => open({ kind: 'item', item })}>
            <CompanyIcon name="edit" size={16}/>Bearbeiten</NativeButton>}
          {permissions.issue && item.status === 'available' && !openAssignment && <NativeButton type="button" className="ci-button ci-button--primary" disabled={blocked} onClick={() => open({ kind: 'issue', item })}>Ausgeben</NativeButton>}
          {permissions.returnItems && openAssignment && openAssignment.status !== 'planned' && <NativeButton type="button" className="ci-button ci-button--primary" disabled={blocked} onClick={() => open({ kind: 'return', assignment: openAssignment })}>Rücknahme erfassen</NativeButton>}
        </NativeDiv>
      </NativeDiv>
    </NativeDiv>}>
    <NativeStyle>
      {companyInventoryCss}
    </NativeStyle>
    <NativeDiv className="ci-dialog">
      {error && <NativeDiv className="ci-banner ci-banner--error" role="alert">
        {error}
      </NativeDiv>}<NativeDiv className="ci-detail-title">
        <NativeDiv>
          <NativeH3>
            {item.name}
          </NativeH3>
          <NativeP>
            {INVENTORY_CATEGORY_LABELS[item.categoryGroup]}
          </NativeP>
        </NativeDiv>
        <Status value={item.status}/>
      </NativeDiv>
      <NativeDl className="ci-details">
        {fields.map(([label, value]) => <NativeDiv key={label}>
          <NativeDt>
            {label}
          </NativeDt>
          <NativeDd>
            {value || 'Nicht hinterlegt'}
          </NativeDd>
        </NativeDiv>)}
      </NativeDl>
      {item.notes && <NativeSection className="ci-detail-section">
        <NativeH3>Hinweise</NativeH3>
        <NativeP style={{ whiteSpace: 'pre-line' }}>
          {item.notes}
        </NativeP>
      </NativeSection>}
      <NativeSection className="ci-detail-section">
        <NativeH3>Ausgaben</NativeH3>
        {assignments.length ? <NativeUl className="ci-check-list">
          {assignments.map(assignment => <NativeLi key={assignment.id}>
            <NativeDiv className="ci-card-header">
              <NativeStrong>
                {person(assignment.recipientEmployeeId)}
              </NativeStrong>
              <Status value={assignment.status} assignment={assignment}/>
            </NativeDiv>
            <NativeP>Ausgegeben: {inventoryDate(assignment.issuedAt)} · {CONDITION_LABELS[assignment.issueCondition]}
            </NativeP>
            <NativeP>
              {assignment.expectedReturnAt ? `Rückgabe bis ${inventoryDate(assignment.expectedReturnAt)}` : 'Keine Rückgabefrist hinterlegt'}{assignment.returnRequired ? ' · Rückgabepflichtig' : ''}
            </NativeP>
            {assignment.acknowledgedAt && <NativeP>Empfang bestätigt am {inventoryDate(assignment.acknowledgedAt, true)}
            </NativeP>}{assignment.issueNotes && <NativeP>
              {assignment.issueNotes}
            </NativeP>}<NativeDiv className="ci-actions">
              <AssignmentActions scope={scope} assignment={assignment} permissions={permissions} blocked={blocked} run={run}/>
            </NativeDiv>
          </NativeLi>)}
        </NativeUl> : <NativeP className="ci-note">Für diesen Gegenstand ist keine Ausgabe dokumentiert.</NativeP>}
      </NativeSection>
      {returns.length > 0 && <NativeSection className="ci-detail-section">
        <NativeH3>Dokumentierte Rücknahmen</NativeH3>
        <NativeUl className="ci-check-list">
          {returns.map(record => <NativeLi key={record.id}>
            <NativeStrong>
              {inventoryDate(record.returnedAt, true)}
            </NativeStrong>
            <NativeP>
              {person(record.employeeId)}
            </NativeP>
            <NativeP>Zurückgegeben: {boolLabel(record.capture.returned)} · Vollständig: {boolLabel(record.capture.complete)} · {CONDITION_LABELS[record.capture.condition]}
            </NativeP>
            {record.capture.damageDescription && <NativeP>
              {record.capture.damageDescription}
            </NativeP>}{record.capture.notes && <NativeP>
              {record.capture.notes}
            </NativeP>}<NativeDetails style={{ marginTop: 10 }}>
              <NativeSummary>Dokumentierte Einzelprüfungen</NativeSummary>
              <NativeDl className="ci-details" style={{ marginTop: 12 }}>
                {checkLabels.map(([key, label]) => <NativeDiv key={key}>
                  <NativeDt>
                    {label}
                  </NativeDt>
                  <NativeDd>
                    {boolLabel(record.capture[key] as boolean | null | undefined)}
                  </NativeDd>
                </NativeDiv>)}
              </NativeDl>
            </NativeDetails>
          </NativeLi>)}
        </NativeUl>
      </NativeSection>}
      <NativeSection className="ci-detail-section">
        <NativeP className="ci-note">Angelegt: {inventoryDate(item.createdAt, true)} · Zuletzt bearbeitet: {inventoryDate(item.updatedAt, true)}
        </NativeP>
      </NativeSection>
    </NativeDiv>
  </PlatformModal>}</NativeWorkspaceStyleScope>;
}
function PersonnelReturns({ scope, initialEmployeeId, snapshot, person, open, blocked, canReturn }: {
    initialEmployeeId?: string;
    scope: CompanyInventoryScope;
    snapshot: CompanyInventorySnapshot;
    person: (id?: string | null) => string;
    open: (dialog: Dialog) => void;
    blocked: boolean;
    canReturn: boolean;
}) {
    const [employeeId, setEmployeeId] = useState(initialEmployeeId ?? '');
    const [retry, setRetry] = useState(0);
    useEffect(() => { setEmployeeId(initialEmployeeId ?? ''); }, [initialEmployeeId]);
    const [check, setCheck] = useState<OffboardingInventoryCheck | null>(null);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sequence = useRef(0);
    useEffect(() => {
        const request = ++sequence.current;
        setCheck(null);
        setError(null);
        if (!employeeId) {
            setChecking(false);
            return;
        }
        setChecking(true);
        void checkCompanyInventoryOffboarding(scope, employeeId).then(result => {
            if (sequence.current !== request)
                return;
            if (result.ok)
                setCheck(result.data);
            else
                setError(result.error);
        }).catch(() => {
            if (sequence.current === request)
                setError('Die offenen Rückgaben konnten nicht geprüft werden. Bitte erneut versuchen.');
        }).finally(() => { if (sequence.current === request)
            setChecking(false); });
        return () => { sequence.current += 1; };
    }, [scope, employeeId, snapshot, retry]);
    const relevantEmployees = snapshot.employees.slice().sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'de'));
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<>
    <NativeDiv className="ci-section-title">
      <NativeDiv>
        <NativeH3>Ausstattung bei Personalwechsel zurücknehmen</NativeH3>
        <NativeP>Offene rückgabepflichtige Gegenstände einer Person prüfen.</NativeP>
      </NativeDiv>
    </NativeDiv>
    <NativeLabel className="ci-filter ci-person-filter">
      <NativeSpan>Mitarbeitende Person</NativeSpan>
      <NativeSelect value={employeeId} onChange={event => setEmployeeId(event.target.value)}>
        <NativeOption value="">Person auswählen</NativeOption>
        {relevantEmployees.map(employee => <NativeOption key={employee.id} value={employee.id}>
          {employee.firstName} {employee.lastName}
        </NativeOption>)}
      </NativeSelect>
    </NativeLabel>
    {checking ? <NativeDiv className="ci-banner" role="status">Rückgaben werden geprüft …</NativeDiv> : error ? <NativeDiv className="ci-banner ci-banner--error" role="alert">
      <NativeDiv>
        {error}<NativeDiv className="ci-actions">
          <NativeButton type="button" className="ci-button" onClick={() => setRetry(value => value + 1)}>Erneut prüfen</NativeButton>
        </NativeDiv>
      </NativeDiv>
    </NativeDiv> : check ? <>
      <NativeDiv className={`ci-banner ${check.openAssignments.length ? 'ci-banner--info' : 'ci-banner--success'}`}>
        <CompanyIcon name={check.openAssignments.length ? 'info' : 'check'} size={21}/>
        <NativeDiv>
          <NativeStrong>
            {check.openAssignments.length ? `${check.openAssignments.length} offene Rückgaben für ${person(employeeId)}` : 'Keine offenen rückgabepflichtigen Ausgaben'}
          </NativeStrong>
          <NativeP>Diese Prüfung betrifft das Inventar. Andere Schritte beim Personalaustritt bleiben separat zu bearbeiten.</NativeP>
        </NativeDiv>
      </NativeDiv>
      {check.openAssignments.length > 0 && <NativeUl className="ci-check-list">
        {check.openAssignments.map(assignment => <NativeLi key={assignment.id}>
          <NativeDiv className="ci-card-header">
            <NativeStrong>
              {snapshot.items.find(item => item.id === assignment.itemId)?.name ?? 'Gegenstand nicht verfügbar'}
            </NativeStrong>
            <Status value={assignment.status} assignment={assignment}/>
          </NativeDiv>
          <NativeP>Ausgegeben: {inventoryDate(assignment.issuedAt)}{assignment.expectedReturnAt ? ` · Rückgabe bis ${inventoryDate(assignment.expectedReturnAt)}` : ''}
          </NativeP>
          <NativeDiv className="ci-actions">
            <NativeButton type="button" className="ci-button" onClick={() => open({ kind: 'detail', itemId: assignment.itemId })}>Details ansehen</NativeButton>
            {canReturn && assignment.status !== 'planned' && <NativeButton type="button" className="ci-button ci-button--primary" disabled={blocked} onClick={() => open({ kind: 'return', assignment })}>Rücknahme erfassen</NativeButton>}
          </NativeDiv>
        </NativeLi>)}
      </NativeUl>}
    </> : <Empty title={relevantEmployees.length ? 'Person auswählen' : 'Keine Personalauswahl verfügbar'} text={relevantEmployees.length ? 'Wählen Sie eine Person aus, um ihre offenen Rückgaben zu prüfen.' : 'Für die Rückgabeprüfung muss eine Mitarbeitendenakte vorhanden sein.'} icon="people"/>}
  </>}</NativeWorkspaceStyleScope>;
}
function InventoryHistory({ snapshot, search }: {
    snapshot: CompanyInventorySnapshot;
    search: string;
}) {
    function entityLabel(entityId: string, metadata: Record<string, unknown>) {
        const itemId = typeof metadata.itemId === 'string' ? metadata.itemId : entityId;
        return snapshot.items.find(item => item.id === itemId)?.name ?? (typeof metadata.name === 'string' ? metadata.name : 'Inventarvorgang');
    }
    const events = snapshot.audit.filter(event => inventoryMatches(search, [inventoryAuditTitle(event), entityLabel(event.entityId, event.metadata)]));
    return events.length ? <NativeSection className="ci-card">
    <NativeOl className="ci-timeline">
      {events.map(event => <NativeLi key={event.id}>
        <NativeSpan className="ci-timeline-icon">
          <CompanyIcon name="clock" size={17}/>
        </NativeSpan>
        <NativeDiv>
          <NativeStrong>
            {inventoryAuditTitle(event)}
          </NativeStrong>
          <NativeP>
            {entityLabel(event.entityId, event.metadata)}
          </NativeP>
          <NativeTime dateTime={event.createdAt}>
            {inventoryDate(event.createdAt, true)}
          </NativeTime>
        </NativeDiv>
      </NativeLi>)}
    </NativeOl>
  </NativeSection> : <Empty title="Keine passenden Aktivitäten" text="Verfügbare Inventaränderungen werden hier mit Zeitpunkt angezeigt." icon="clock"/>;
}
function AssignmentActions({ scope, assignment, permissions, blocked, run }: {
    scope: CompanyInventoryScope;
    assignment: InventoryAssignment;
    permissions: CompanyInventoryPermissions;
    blocked: boolean;
    run: RunInventoryMutation;
}) {
    async function acknowledge() {
        const accepted = await confirmAction({ title: 'Empfang dokumentieren', message: 'Wurde der Empfang dieses Gegenstands tatsächlich bestätigt? Die Bestätigung wird mit dem aktuellen Zeitpunkt dokumentiert.', confirmLabel: 'Empfang bestätigt', cancelLabel: 'Abbrechen' });
        if (accepted)
            await run(() => acknowledgeCompanyInventoryAssignment(scope, assignment.id, assignment.updatedAt), 'Empfang wurde als bestätigt dokumentiert.');
    }
    async function request() {
        const accepted = await confirmAction({ title: 'Rückgabe anfordern', message: 'Diese Ausgabe als angeforderte Rückgabe kennzeichnen? Die Person wird dadurch nicht automatisch benachrichtigt.', confirmLabel: 'Rückgabe kennzeichnen', cancelLabel: 'Abbrechen' });
        if (accepted)
            await run(() => requestCompanyInventoryReturn(scope, assignment.id, assignment.updatedAt), 'Rückgabe wurde als angefordert gekennzeichnet.');
    }
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<>
    {permissions.issue && assignment.status === 'issued' && <NativeButton type="button" className="ci-text-button" disabled={blocked} onClick={() => void acknowledge()}>Empfang bestätigen</NativeButton>}
    {permissions.returnItems && ['issued', 'acknowledged', 'overdue', 'partially_returned', 'disputed', 'lost'].includes(assignment.status) && <NativeButton type="button" className="ci-text-button" disabled={blocked} onClick={() => void request()}>Rückgabe anfordern</NativeButton>}
  </>}</NativeWorkspaceStyleScope>;
}
