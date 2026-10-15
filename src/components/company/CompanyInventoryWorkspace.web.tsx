import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PermissionKey, RoleKey } from '@/types';
import type { InventoryAssignment, InventoryItem, InventoryReturnCapture, OffboardingInventoryCheck } from '@/types/inventory';
import { INVENTORY_CATEGORY_LABELS } from '@/types/inventory';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { confirmAction } from '@/lib/platform/confirmAction';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import {
  acknowledgeCompanyInventoryAssignment, checkCompanyInventoryOffboarding,
  getCompanyInventoryPermissions, loadCompanyInventory, requestCompanyInventoryReturn,
  type CompanyInventoryPermissions, type CompanyInventoryResult, type CompanyInventoryScope,
  type CompanyInventorySnapshot,
} from '@/lib/inventory/companyInventoryService.web';
import { CompanyIcon } from './CompanyWorkspaceView.web';
import { CompanyInventoryEditor, type InventoryEditDialog, type RunInventoryMutation } from './CompanyInventoryDialogs.web';
import {
  ASSIGNMENT_STATUS_LABELS, COMPANY_INVENTORY_VIEWS, CONDITION_LABELS, INVENTORY_STATUS_LABELS,
  inventoryAuditTitle, inventoryDate, inventoryMatches, isAssignmentOpen, isAssignmentOverdue,
  type CompanyInventoryView,
} from './companyInventoryModel.web';
import { companyInventoryCss } from './companyInventoryCss.web';

export type { CompanyInventoryView } from './companyInventoryModel.web';
export type CompanyInventoryWorkspaceProps = {
  tenantId: string;
  roleKey: RoleKey | null;
  actorProfileId?: string | null;
  effectivePermissions?: readonly PermissionKey[];
  scopeLimited?: boolean;
  initialView?: CompanyInventoryView;
  initialEmployeeId?: string;
  initialItemId?: string;
  onViewChange?: (view: CompanyInventoryView) => void;
  onNavigationGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
};

type Dialog = InventoryEditDialog | { kind: 'detail'; itemId: string };
type Notice = { text: string; error?: boolean } | null;

export function CompanyInventoryWorkspace(props: CompanyInventoryWorkspaceProps) {
  const permissionsKey = props.effectivePermissions ? [...props.effectivePermissions].sort().join(',') : 'role';
  return <InventoryWorkspaceScope key={`${props.tenantId}:${props.roleKey}:${props.actorProfileId ?? ''}:${permissionsKey}:${Boolean(props.scopeLimited)}`} {...props} />;
}

function InventoryWorkspaceScope({ tenantId, roleKey, actorProfileId, effectivePermissions, scopeLimited = false, initialView = 'stock', initialEmployeeId, initialItemId, onViewChange, onNavigationGuardChange }: CompanyInventoryWorkspaceProps) {
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

  if (!permissions.view) return <div className="ci-workspace">
    <style>
      {companyInventoryCss}
    </style>
    <Empty title="Kein Zugriff auf das Inventar" text="Für diesen Bereich fehlt die Inventarberechtigung." icon="shield" />
  </div>;
  if (!snapshot) return <div className="ci-workspace" aria-busy={loading}>
    <style>
      {companyInventoryCss}
    </style>
    <div className="ci-heading">
      <div>
        <h2>Inventar</h2>
        <p>Ausstattung und Rückgaben Ihres Unternehmens.</p>
      </div>
    </div>
    {loadError ? <Empty title="Inventar konnte nicht geladen werden" text={loadError} icon="info">
      <button type="button" className="ci-button" disabled={loading} onClick={() => void reload()}>Erneut laden</button>
    </Empty> : <div className="ci-empty ci-loading" role="status">
      <CompanyIcon name="grid" size={30} />
      <h3>Inventar wird geladen …</h3>
      <p>Bestand, Ausgaben und Lagerorte werden abgerufen.</p>
    </div>}
  </div>;

  const activeAssignments = snapshot.assignments.filter(isAssignmentOpen);
  const overdueAssignments = activeAssignments.filter(assignment => isAssignmentOverdue(assignment));
  const openDamage = snapshot.damageReports.filter(report => !report.resolvedAt);
  const itemName = (itemId: string) => snapshot.items.find(item => item.id === itemId)?.name ?? 'Gegenstand nicht mehr verfügbar';
  const categoryName = (item: InventoryItem) => snapshot.categories.find(category => category.id === item.categoryId)?.label ?? INVENTORY_CATEGORY_LABELS[item.categoryGroup];
  const locationName = (item: InventoryItem) => snapshot.locations.find(location => location.id === item.locationId)?.label ?? (item.locationId ? 'Lagerort nicht mehr verfügbar' : 'Ohne festen Lagerort');
  const items = snapshot.items.filter(item => (!categoryFilter || item.categoryId === categoryFilter)
    && (!locationFilter || (locationFilter === 'none' ? !item.locationId : item.locationId === locationFilter))
    && (!statusFilter || item.status === statusFilter)
    && inventoryMatches(search, [item.name, item.sku, item.serialNumber, item.manufacturer, item.model, item.barcode, categoryName(item), locationName(item)]))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const assignments = snapshot.assignments.filter(assignment => (assignmentFilter === 'all'
    || (assignmentFilter === 'open' && isAssignmentOpen(assignment))
    || (assignmentFilter === 'overdue' && isAssignmentOverdue(assignment))
    || (assignmentFilter === 'closed' && !isAssignmentOpen(assignment)))
    && (!employeeFilter || assignment.recipientEmployeeId === employeeFilter)
    && inventoryMatches(search, [itemName(assignment.itemId), person(assignment.recipientEmployeeId), ASSIGNMENT_STATUS_LABELS[assignment.status], snapshot.items.find(item => item.id === assignment.itemId)?.sku]))
    .sort((a, b) => Number(isAssignmentOverdue(b)) - Number(isAssignmentOverdue(a)) || b.createdAt.localeCompare(a.createdAt));
  const damageReports = snapshot.damageReports.filter(report => (damageFilter === 'all' || (damageFilter === 'open' ? !report.resolvedAt : report.resolvedAt))
    && inventoryMatches(search, [itemName(report.itemId), report.description, report.reportType === 'loss' ? 'Verlust' : report.reportType === 'missing_return' ? 'Fehlende Rückgabe' : 'Schaden']))
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
  const detailItem = dialog?.kind === 'detail' ? snapshot.items.find(item => item.id === dialog.itemId) : null;

  return <section className="ci-workspace" aria-label="Inventar im Unternehmen" aria-busy={busy || loading} data-testid="company-inventory-workspace">
    <style>
      {companyInventoryCss}
    </style>
    <div className="ci-heading">
      <div>
        <h2>Inventar</h2>
        <p>Bestand, Ausgabe und Rücknahme an einem Ort.</p>
      </div>
      <div className="ci-actions">
        <button type="button" className="ci-button ci-button--quiet" disabled={busy || loading} onClick={() => void reload()}>
          <CompanyIcon name="refresh" size={16} />
          {loading ? 'Wird geladen …' : 'Aktualisieren'}
        </button>
        {permissions.createItems && <button type="button" className="ci-button ci-button--primary" disabled={blocked} onClick={() => open(snapshot.categories.length ? { kind: 'item' } : { kind: 'category' })}>
          <CompanyIcon name="plus" size={17} />
          {snapshot.categories.length ? 'Inventar anlegen' : 'Erste Kategorie anlegen'}
        </button>}
      </div>
    </div>
    {notice && <div className={`ci-banner ${notice.error ? 'ci-banner--error' : 'ci-banner--success'}`} role="status">
      <CompanyIcon name={notice.error ? 'info' : 'check'} size={18} />
      <div>
        {notice.text}
      </div>
      <button type="button" className="ci-icon-button" aria-label="Hinweis schließen" onClick={() => setNotice(null)}>
        <CompanyIcon name="close" size={14} />
      </button>
    </div>}
    {(loadError || (mutationError && (!dialog || dialog.kind === 'detail'))) && <div className="ci-banner ci-banner--error" role="alert">
      <CompanyIcon name="info" size={20} />
      <div>
        <strong>
          {loadError ? 'Aktualisierung fehlgeschlagen' : 'Änderung nicht bestätigt'}
        </strong>
        <p>
          {loadError ?? mutationError}
        </p>
      </div>
    </div>}
    {reloadRequired && <div className="ci-banner ci-banner--info" role="alert">
      <CompanyIcon name="refresh" size={20} />
      <div>
        <strong>Bestand vor der nächsten Änderung prüfen</strong>
        <p>Der letzte Vorgang ist nicht vollständig bestätigt. Weitere Änderungen sind bis zum erfolgreichen Neuladen gesperrt. Dabei wird der bisherige Entwurf geschlossen, damit Sie den Vorgang nicht versehentlich doppelt speichern.</p>
        <div className="ci-actions">
          <button type="button" className="ci-button" disabled={busy || loading} onClick={() => void reload()}>Bestand neu laden</button>
        </div>
      </div>
    </div>}
    <div className="ci-stats">
      <Stat label="Bestand" value={snapshot.items.filter(item => item.status !== 'archived').length} detail="ohne archivierte Einträge" icon="grid" onClick={() => { setStatusFilter(''); void switchView('stock'); }} />
      <Stat label="Verfügbar" value={snapshot.items.filter(item => item.status === 'available').length} detail="bereit zur Ausgabe" icon="check" onClick={() => { setStatusFilter('available'); void switchView('stock'); }} />
      <Stat label="Offene Ausgaben" value={activeAssignments.length} detail="noch nicht abgeschlossen" icon="transfer" onClick={() => { setAssignmentFilter('open'); void switchView('assignments'); }} />
      <Stat label="Rückgaben überfällig" value={overdueAssignments.length} detail="Rückgabefrist überschritten" icon="clock" attention={overdueAssignments.length > 0} onClick={() => { setAssignmentFilter('overdue'); void switchView('assignments'); }} />
    </div>
    <nav className="ci-tabs" aria-label="Inventarbereiche">
      {availableViews.map(tab => <button type="button" key={tab.id} aria-pressed={activeView === tab.id} disabled={busy} onClick={() => void switchView(tab.id)}>
        {tab.label}{tab.id === 'damage' && openDamage.length > 0 && <small>
          {openDamage.length}
        </small>}
      </button>)}
    </nav>
    {activeView === 'stock' && <>
      <div className="ci-toolbar">
        <Search value={search} onChange={setSearch} placeholder="Gegenstand, Kennung oder Seriennummer suchen" />
        <Filter label="Kategorie" value={categoryFilter} onChange={setCategoryFilter}>
          <option value="">Alle Kategorien</option>
          {snapshot.categories.map(category => <option key={category.id} value={category.id}>
            {category.label}
          </option>)}
        </Filter>
        <Filter label="Lagerort" value={locationFilter} onChange={setLocationFilter}>
          <option value="">Alle Lagerorte</option>
          <option value="none">Ohne festen Lagerort</option>
          {snapshot.locations.map(location => <option key={location.id} value={location.id}>
            {location.label}
          </option>)}
        </Filter>
        <Filter label="Status" value={statusFilter} onChange={setStatusFilter}>
          <option value="">Alle Status</option>
          {Object.entries(INVENTORY_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>
            {label}
          </option>)}
        </Filter>
      </div>
      <div className="ci-result-line">
        <span>
          {items.length} von {snapshot.items.length} Bestandsposten</span>
        {Boolean(search || categoryFilter || locationFilter || statusFilter) && <button type="button" className="ci-text-button" onClick={() => { setSearch(''); setCategoryFilter(''); setLocationFilter(''); setStatusFilter(''); }}>Filter zurücksetzen</button>}
      </div>
      {items.length ? <div className="ci-table-shell" tabIndex={0} role="region" aria-label="Inventarbestand, bei Bedarf seitlich scrollen">
        <table className="ci-table">
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '19%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Gegenstand</th>
              <th scope="col">Kategorie & Zustand</th>
              <th scope="col">Lagerort</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="ci-sr-only">Aktionen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => <tr key={item.id}>
              <td>
                <button type="button" className="ci-name" onClick={() => open({ kind: 'detail', itemId: item.id })}>
                  {item.name}
                </button>
                <small>
                  {item.sku ? `Nr. ${item.sku}` : 'Keine Inventarnummer'}{item.serialNumber ? ` · SN ${item.serialNumber}` : ''}
                </small>
              </td>
              <td>
                {categoryName(item)}<small>
                  {CONDITION_LABELS[item.condition]}
                </small>
              </td>
              <td>
                {locationName(item)}
              </td>
              <td>
                <Status value={item.status} />
                {activeAssignments.some(assignment => assignment.itemId === item.id) && <small>
                  {person(activeAssignments.find(assignment => assignment.itemId === item.id)?.recipientEmployeeId)}
                </small>}
              </td>
              <td>
                <button type="button" className="ci-text-button" onClick={() => open({ kind: 'detail', itemId: item.id })}>Details ansehen</button>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div> : <Empty title={snapshot.items.length ? 'Kein passender Bestand' : 'Ihr Inventar beginnt hier'} text={snapshot.items.length ? 'Passen Sie die Suche oder die Filter an.' : 'Erfassen Sie Geräte, Schlüssel, Dienstkleidung und weitere Ausstattung. Kategorien und Lagerorte helfen bei der Zuordnung.'} icon="grid">
        {permissions.createItems && !snapshot.items.length && <button type="button" className="ci-button ci-button--primary" disabled={blocked} onClick={() => open(snapshot.categories.length ? { kind: 'item' } : { kind: 'category' })}>
          {snapshot.categories.length ? 'Ersten Gegenstand anlegen' : 'Erste Kategorie anlegen'}
        </button>}
      </Empty>}
    </>}
    {activeView === 'assignments' && <>
      <div className="ci-toolbar">
        <Search value={search} onChange={setSearch} placeholder="Gegenstand oder Person suchen" />
        <Filter label="Anzeigen" value={assignmentFilter} onChange={setAssignmentFilter}>
          <option value="open">Offene Ausgaben</option>
          <option value="overdue">Überfällige Rückgaben</option>
          <option value="closed">Abgeschlossene Ausgaben</option>
          <option value="all">Alle Ausgaben</option>
        </Filter>
        {permissions.viewEmployees && <Filter label="Person" value={employeeFilter} onChange={setEmployeeFilter}>
          <option value="">Alle Personen</option>
          {snapshot.employees.map(employee => <option key={employee.id} value={employee.id}>
            {employee.firstName} {employee.lastName}
          </option>)}{employeeFilter && !snapshot.employees.some(employee => employee.id === employeeFilter) && <option value={employeeFilter}>Person nicht mehr verfügbar</option>}
        </Filter>}
      </div>
      <div className="ci-result-line">
        <span>
          {assignments.length} Ausgaben</span>
      </div>
      {assignments.length ? <AssignmentTable scope={scope} assignments={assignments} snapshot={snapshot} person={person} permissions={permissions} blocked={blocked} open={open} run={run} /> : <Empty title="Keine passenden Ausgaben" text={snapshot.assignments.length ? 'Für diese Auswahl sind keine Ausgaben vorhanden.' : 'Öffnen Sie einen verfügbaren Gegenstand im Bestand, um ihn einer Person auszugeben.'} icon="transfer">
        <button className="ci-button" type="button" onClick={() => void switchView('stock')}>Bestand öffnen</button>
      </Empty>}
    </>}
    {activeView === 'locations' && <>
      <div className="ci-section-title">
        <div>
          <h3>Lagerorte</h3>
          <p>Aufbewahrungsorte mit Gebäude und Raum.</p>
        </div>
        {permissions.manageCatalogs && <button type="button" className="ci-button" disabled={blocked} onClick={() => open({ kind: 'location' })}>
          <CompanyIcon name="plus" size={16} />Lagerort anlegen</button>}
      </div>
      {snapshot.locations.length ? <div className="ci-card-grid">
        {snapshot.locations.map(location => <article key={location.id} className="ci-card">
          <div className="ci-card-header">
            <div>
              <h3>
                {location.label}
              </h3>
              <small>
                {[location.building, location.room].filter(Boolean).join(' · ') || 'Gebäude und Raum nicht hinterlegt'}
              </small>
            </div>
            <CompanyIcon name="pin" size={22} />
          </div>
          {location.notes && <p>
            {location.notes}
          </p>}<div className="ci-card-foot">
            <span>
              {snapshot.items.filter(item => item.locationId === location.id).length} Bestandsposten</span>
            <div className="ci-actions">
              <button type="button" className="ci-text-button" onClick={() => { setLocationFilter(location.id); setStatusFilter(''); setCategoryFilter(''); void switchView('stock'); }}>Bestand anzeigen</button>
              {permissions.manageCatalogs && <button type="button" className="ci-text-button" disabled={blocked} onClick={() => open({ kind: 'location', location })}>Bearbeiten</button>}
            </div>
          </div>
        </article>)}
      </div> : <Empty title="Noch keine Lagerorte" text="Hinterlegen Sie die Orte, an denen Ausstattung aufbewahrt wird." icon="pin" />}
      <div className="ci-section-title">
        <div>
          <h3>Kategorien</h3>
          <p>Gruppierung und Vorgaben für neue Bestandsposten.</p>
        </div>
        {permissions.manageCatalogs && <button type="button" className="ci-button" disabled={blocked} onClick={() => open({ kind: 'category' })}>
          <CompanyIcon name="plus" size={16} />Kategorie anlegen</button>}
      </div>
      {snapshot.categories.length ? <div className="ci-card-grid">
        {snapshot.categories.map(category => <article key={category.id} className="ci-card">
          <div className="ci-card-header">
            <div>
              <h3>
                {category.label}
              </h3>
              <small>
                {INVENTORY_CATEGORY_LABELS[category.group]}
              </small>
            </div>
            <CompanyIcon name="grid" size={22} />
          </div>
          <div className="ci-tags">
            <span className="ci-badge">
              {category.requiresReturnOnExit ? 'Rückgabe bei Austritt' : 'Ohne Austrittsrückgabe'}
            </span>
            <span className="ci-badge">
              {category.portalVisibleToEmployee ? 'Im Mitarbeitendenportal' : 'Nur Verwaltung'}
            </span>
          </div>
          <div className="ci-card-foot">
            <span>
              {snapshot.items.filter(item => item.categoryId === category.id).length} Bestandsposten</span>
            <div className="ci-actions">
              <button type="button" className="ci-text-button" onClick={() => { setCategoryFilter(category.id); setStatusFilter(''); setLocationFilter(''); void switchView('stock'); }}>Bestand anzeigen</button>
              {permissions.manageCatalogs && <button type="button" className="ci-text-button" disabled={blocked} onClick={() => open({ kind: 'category', category })}>Bearbeiten</button>}
            </div>
          </div>
        </article>)}
      </div> : <Empty title="Noch keine Kategorien" text="Legen Sie eine erste Kategorie an, bevor Sie Bestand erfassen." icon="grid" />}
    </>}
    {activeView === 'damage' && <>
      <div className="ci-toolbar">
        <Search value={search} onChange={setSearch} placeholder="Gegenstand oder Meldung suchen" />
        <Filter label="Meldungen" value={damageFilter} onChange={setDamageFilter}>
          <option value="open">Offen</option>
          <option value="closed">Erledigt</option>
          <option value="all">Alle Meldungen</option>
        </Filter>
        {permissions.reportDamage && <button type="button" className="ci-button" disabled={blocked || !snapshot.items.length} onClick={() => open({ kind: 'damage' })}>
          <CompanyIcon name="plus" size={16} />Meldung erfassen</button>}
      </div>
      {damageReports.length ? <div className="ci-card-grid">
        {damageReports.map(report => <article className="ci-card" key={report.id}>
          <div className="ci-card-header">
            <div>
              <h3>
                {itemName(report.itemId)}
              </h3>
              <small>
                {inventoryDate(report.reportedAt, true)}
              </small>
            </div>
            <span className={`ci-badge ${report.resolvedAt ? 'ci-badge--good' : 'ci-badge--bad'}`}>
              {report.reportType === 'loss' ? 'Verlust' : report.reportType === 'missing_return' ? 'Fehlende Rückgabe' : 'Schaden'}
            </span>
          </div>
          <p style={{ whiteSpace: 'pre-line' }}>
            {report.description}
          </p>
          <div className="ci-card-foot">
            <span>
              {report.resolvedAt ? `Erledigt am ${inventoryDate(report.resolvedAt)}` : 'Offene Meldung'} · {CONDITION_LABELS[report.condition]}
            </span>
            <div className="ci-actions">
              <button type="button" className="ci-text-button" onClick={() => open({ kind: 'detail', itemId: report.itemId })}>Gegenstand öffnen</button>
              {permissions.manage && !report.resolvedAt && <button type="button" className="ci-button" disabled={blocked} onClick={() => open({ kind: 'resolveDamage', report })}>Fall abschließen</button>}
            </div>
          </div>
        </article>)}
      </div> : <Empty title="Keine passenden Meldungen" text="Dokumentierte Schäden, Verluste und fehlende Rückgaben erscheinen hier." icon="shield" />}
    </>}
    {activeView === 'offboarding' && <PersonnelReturns initialEmployeeId={initialEmployeeId} scope={scope} snapshot={snapshot} person={person} open={open} blocked={blocked} canReturn={permissions.returnItems} />}
    {activeView === 'history' && <>
      <div className="ci-toolbar">
        <Search value={search} onChange={setSearch} placeholder="Aktivität oder Gegenstand suchen" />
      </div>
      <InventoryHistory snapshot={snapshot} search={search} />
    </>}
    {dialog && dialog.kind !== 'detail' && <CompanyInventoryEditor key={`${dialog.kind}:${'item' in dialog ? dialog.item?.id ?? 'new' : 'assignment' in dialog ? dialog.assignment.id : 'category' in dialog ? dialog.category?.id ?? 'new' : 'location' in dialog ? dialog.location?.id ?? 'new' : 'new'}`}
      dialog={dialog} scope={scope} snapshot={snapshot} busy={busy || loading} blocked={reloadRequired}
      error={mutationError} onReload={reload} onDirtyChange={setDialogDirty} onClose={() => void close()} onSaved={saved} run={run} />}
    {dialog?.kind === 'detail' && !detailItem && <div className="ci-banner ci-banner--error" role="alert">
      <div>Der ausgewählte Gegenstand ist in diesem Unternehmen nicht verfügbar.<div className="ci-actions">
        <button type="button" className="ci-button" onClick={() => void close()}>Hinweis schließen</button>
      </div>
      </div>
    </div>}
    {dialog?.kind === 'detail' && detailItem && <ItemDetail scope={scope} run={run} error={mutationError} item={detailItem} snapshot={snapshot} person={person} permissions={permissions}
      blocked={blocked} onClose={() => void close()} open={open} />}
  </section>;
}

function Empty({ title, text, icon, children }: { title: string; text: string; icon: string; children?: ReactNode }) {
  return <div className="ci-empty">
    <CompanyIcon name={icon} size={29} />
    <h3>
      {title}
    </h3>
    <p>
      {text}
    </p>
    {children}
  </div>;
}
function Stat({ label, value, detail, icon, attention, onClick }: {
  label: string; value: number; detail: string; icon: string; attention?: boolean; onClick: () => void;
}) {
  return <button type="button" className={`ci-stat${attention ? ' ci-stat--attention' : ''}`} onClick={onClick}>
    <span>
      <CompanyIcon name={icon} size={15} />
      {label}
    </span>
    <strong>
      {value}
    </strong>
    <small>
      {detail}
    </small>
  </button>;
}
function Search({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="ci-search">
    <CompanyIcon name="search" size={18} />
    <span className="ci-sr-only">
      {placeholder}
    </span>
    <input type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
  </label>;
}
function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="ci-filter">
    <span>
      {label}
    </span>
    <select value={value} onChange={event => onChange(event.target.value)}>
      {children}
    </select>
  </label>;
}
function Status({ value, assignment }: { value: string; assignment?: InventoryAssignment }) {
  const overdue = assignment && isAssignmentOverdue(assignment);
  const tone = overdue || ['damaged', 'lost', 'disputed', 'unusable'].includes(value) ? 'bad'
    : ['maintenance', 'reserved', 'partially_returned', 'return_requested'].includes(value) ? 'warn'
      : ['available', 'returned', 'acknowledged'].includes(value) ? 'good'
        : ['archived', 'decommissioned'].includes(value) ? 'muted' : '';
  const label = assignment ? ASSIGNMENT_STATUS_LABELS[assignment.status] : INVENTORY_STATUS_LABELS[value as InventoryItem['status']] ?? value;
  return <span className={`ci-badge${tone ? ` ci-badge--${tone}` : ''}`}>
    {overdue && assignment.status !== 'overdue' ? 'Rückgabe überfällig' : label}
  </span>;
}

function AssignmentTable({ scope, assignments, snapshot, person, permissions, blocked, open, run }: {
  scope: CompanyInventoryScope;
  assignments: InventoryAssignment[]; snapshot: CompanyInventorySnapshot; person: (id?: string | null) => string;
  permissions: CompanyInventoryPermissions; blocked: boolean; open: (dialog: Dialog) => void; run: RunInventoryMutation;
}) {
  // Mutations are supplied by the parent with the current tenant and permission scope.
  return <div className="ci-table-shell" tabIndex={0} role="region" aria-label="Inventarausgaben, bei Bedarf seitlich scrollen">
    <table className="ci-table">
      <colgroup>
        <col style={{ width: '25%' }} />
        <col style={{ width: '23%' }} />
        <col style={{ width: '18%' }} />
        <col style={{ width: '18%' }} />
        <col style={{ width: '16%' }} />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Gegenstand</th>
          <th scope="col">Person</th>
          <th scope="col">Ausgabe & Frist</th>
          <th scope="col">Status</th>
          <th scope="col">
            <span className="ci-sr-only">Aktionen</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {assignments.map(assignment => {
          const item = snapshot.items.find(entry => entry.id === assignment.itemId);
          return <tr key={assignment.id}>
            <td>
              <button type="button" className="ci-name" onClick={() => open({ kind: 'detail', itemId: assignment.itemId })}>
                {item?.name ?? 'Gegenstand nicht verfügbar'}
              </button>
              <small>
                {item?.sku ? `Nr. ${item.sku}` : CONDITION_LABELS[assignment.issueCondition]}
              </small>
            </td>
            <td>
              {person(assignment.recipientEmployeeId)}{assignment.responsibleEmployeeId && <small>Verantwortlich: {person(assignment.responsibleEmployeeId)}
              </small>}
            </td>
            <td>
              {inventoryDate(assignment.issuedAt)}<small>
                {assignment.expectedReturnAt ? `Rückgabe bis ${inventoryDate(assignment.expectedReturnAt)}` : 'Keine Rückgabefrist'}
              </small>
            </td>
            <td>
              <Status value={assignment.status} assignment={assignment} />
              {assignment.returnRequired && <small>Rückgabepflichtig</small>}
            </td>
            <td>
              <div className="ci-row-actions">
                <AssignmentActions scope={scope} assignment={assignment} permissions={permissions} blocked={blocked} run={run} />
                {permissions.returnItems && isAssignmentOpen(assignment) && assignment.status !== 'planned' && <button type="button" className="ci-button" disabled={blocked} onClick={() => open({ kind: 'return', assignment })}>Rücknahme</button>}<button type="button" className="ci-text-button" onClick={() => open({ kind: 'detail', itemId: assignment.itemId })}>Details</button>
              </div>
            </td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}

function ItemDetail({ scope, run, error, item, snapshot, person, permissions, blocked, onClose, open }: {
  scope: CompanyInventoryScope; run: RunInventoryMutation; error: string | null;
  item: InventoryItem; snapshot: CompanyInventorySnapshot; person: (id?: string | null) => string;
  permissions: CompanyInventoryPermissions; blocked: boolean; onClose: () => void; open: (dialog: Dialog) => void;
}) {
  const router = useRouter();
  const assignments = snapshot.assignments.filter(assignment => assignment.itemId === item.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const openAssignment = assignments.find(isAssignmentOpen);
  const returns = snapshot.returns.filter(entry => entry.itemId === item.id).sort((a, b) => b.returnedAt.localeCompare(a.returnedAt));
  const category = snapshot.categories.find(entry => entry.id === item.categoryId);
  const location = snapshot.locations.find(entry => entry.id === item.locationId);
  const fields: [string, string | null | undefined][] = [
    ['Inventarnummer', item.sku], ['Seriennummer', item.serialNumber], ['Hersteller', item.manufacturer], ['Modell', item.model],
    ['Barcode-Kennung', item.barcode], ['Kategorie', category?.label ?? INVENTORY_CATEGORY_LABELS[item.categoryGroup]],
    ['Lagerort', location?.label], ['Gebäude / Raum', location ? [location.building, location.room].filter(Boolean).join(' · ') : null],
    ['Zustand', CONDITION_LABELS[item.condition]], ['Kaufdatum', item.purchaseDate ? inventoryDate(item.purchaseDate) : null],
    ['Garantie bis', item.warrantyUntil ? inventoryDate(item.warrantyUntil) : null],
    ['Rückgabe bei Austritt', item.requiresReturnOnExit ? 'Vorgesehen' : 'Nicht vorgesehen'],
    ['Im Mitarbeitendenportal', item.portalVisibleToEmployee ? 'Sichtbar' : 'Nicht sichtbar'],
  ];
  const boolLabel = (value?: boolean | null) => value == null ? 'Nicht geprüft / nicht zutreffend' : value ? 'Ja' : 'Nein';
  const checkLabels: [keyof InventoryReturnCapture, string][] = [
    ['accessoriesComplete', 'Zubehör vollständig'], ['chargerReturned', 'Ladegerät zurück'],
    ['simRemoved', 'SIM entfernt'], ['deviceReset', 'Gerät zurückgesetzt'], ['dataDeleted', 'Daten gelöscht'],
  ];
  return <PlatformModal visible surfaceScope="company" title="Inventardetails" subtitle={item.sku ? `Inventarnummer ${item.sku}` : 'Bestandsposten im Unternehmen'} onClose={onClose}
    maxWidth={900} minWidth={260} maxHeightRatio={0.93} bodyStyle={{ backgroundColor: '#f4f8fd', padding: 22 }} sheetStyle={{ backgroundColor: '#f4f8fd' }}
    footerContent={<div className="ci-dialog ci-form-footer">
      <div className="ci-footer-row">
        <button type="button" className="ci-button ci-button--quiet" onClick={onClose}>Schließen</button>
        <div className="ci-actions">
          {scope.effectivePermissions?.includes('business.tenant.manage') && <button type="button" className="ci-button ci-button--quiet" disabled={blocked} onClick={() => router.push(`/unternehmen/zuordnungen?itemId=${encodeURIComponent(item.id)}` as never)}>Standort & Abteilung</button>}
          {permissions.reportDamage && !['archived', 'decommissioned'].includes(item.status) && <button type="button" className="ci-button ci-button--quiet" disabled={blocked} onClick={() => open({ kind: 'damage', item })}>Schaden / Verlust</button>}
          {permissions.manage && <button type="button" className="ci-button" disabled={blocked} onClick={() => open({ kind: 'item', item })}>
            <CompanyIcon name="edit" size={16} />Bearbeiten</button>}
          {permissions.issue && item.status === 'available' && !openAssignment && <button type="button" className="ci-button ci-button--primary" disabled={blocked} onClick={() => open({ kind: 'issue', item })}>Ausgeben</button>}
          {permissions.returnItems && openAssignment && openAssignment.status !== 'planned' && <button type="button" className="ci-button ci-button--primary" disabled={blocked} onClick={() => open({ kind: 'return', assignment: openAssignment })}>Rücknahme erfassen</button>}
        </div>
      </div>
    </div>}>
    <style>
      {companyInventoryCss}
    </style>
    <div className="ci-dialog">
      {error && <div className="ci-banner ci-banner--error" role="alert">
        {error}
      </div>}<div className="ci-detail-title">
        <div>
          <h3>
            {item.name}
          </h3>
          <p>
            {INVENTORY_CATEGORY_LABELS[item.categoryGroup]}
          </p>
        </div>
        <Status value={item.status} />
      </div>
      <dl className="ci-details">
        {fields.map(([label, value]) => <div key={label}>
          <dt>
            {label}
          </dt>
          <dd>
            {value || 'Nicht hinterlegt'}
          </dd>
        </div>)}
      </dl>
      {item.notes && <section className="ci-detail-section">
        <h3>Hinweise</h3>
        <p style={{ whiteSpace: 'pre-line' }}>
          {item.notes}
        </p>
      </section>}
      <section className="ci-detail-section">
        <h3>Ausgaben</h3>
        {assignments.length ? <ul className="ci-check-list">
          {assignments.map(assignment => <li key={assignment.id}>
            <div className="ci-card-header">
              <strong>
                {person(assignment.recipientEmployeeId)}
              </strong>
              <Status value={assignment.status} assignment={assignment} />
            </div>
            <p>Ausgegeben: {inventoryDate(assignment.issuedAt)} · {CONDITION_LABELS[assignment.issueCondition]}
            </p>
            <p>
              {assignment.expectedReturnAt ? `Rückgabe bis ${inventoryDate(assignment.expectedReturnAt)}` : 'Keine Rückgabefrist hinterlegt'}{assignment.returnRequired ? ' · Rückgabepflichtig' : ''}
            </p>
            {assignment.acknowledgedAt && <p>Empfang bestätigt am {inventoryDate(assignment.acknowledgedAt, true)}
            </p>}{assignment.issueNotes && <p>
              {assignment.issueNotes}
            </p>}<div className="ci-actions">
              <AssignmentActions scope={scope} assignment={assignment} permissions={permissions} blocked={blocked} run={run} />
            </div>
          </li>)}
        </ul> : <p className="ci-note">Für diesen Gegenstand ist keine Ausgabe dokumentiert.</p>}
      </section>
      {returns.length > 0 && <section className="ci-detail-section">
        <h3>Dokumentierte Rücknahmen</h3>
        <ul className="ci-check-list">
          {returns.map(record => <li key={record.id}>
            <strong>
              {inventoryDate(record.returnedAt, true)}
            </strong>
            <p>
              {person(record.employeeId)}
            </p>
            <p>Zurückgegeben: {boolLabel(record.capture.returned)} · Vollständig: {boolLabel(record.capture.complete)} · {CONDITION_LABELS[record.capture.condition]}
            </p>
            {record.capture.damageDescription && <p>
              {record.capture.damageDescription}
            </p>}{record.capture.notes && <p>
              {record.capture.notes}
            </p>}<details style={{ marginTop: 10 }}>
              <summary>Dokumentierte Einzelprüfungen</summary>
              <dl className="ci-details" style={{ marginTop: 12 }}>
                {checkLabels.map(([key, label]) => <div key={key}>
                  <dt>
                    {label}
                  </dt>
                  <dd>
                    {boolLabel(record.capture[key] as boolean | null | undefined)}
                  </dd>
                </div>)}
              </dl>
            </details>
          </li>)}
        </ul>
      </section>}
      <section className="ci-detail-section">
        <p className="ci-note">Angelegt: {inventoryDate(item.createdAt, true)} · Zuletzt bearbeitet: {inventoryDate(item.updatedAt, true)}
        </p>
      </section>
    </div>
  </PlatformModal>;
}

function PersonnelReturns({ scope, initialEmployeeId, snapshot, person, open, blocked, canReturn }: {
  initialEmployeeId?: string;
  scope: CompanyInventoryScope; snapshot: CompanyInventorySnapshot; person: (id?: string | null) => string;
  open: (dialog: Dialog) => void; blocked: boolean; canReturn: boolean;
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
    setCheck(null); setError(null);
    if (!employeeId) { setChecking(false); return; }
    setChecking(true);
    void checkCompanyInventoryOffboarding(scope, employeeId).then(result => {
      if (sequence.current !== request) return;
      if (result.ok) setCheck(result.data); else setError(result.error);
    }).catch(() => {
      if (sequence.current === request) setError('Die offenen Rückgaben konnten nicht geprüft werden. Bitte erneut versuchen.');
    }).finally(() => { if (sequence.current === request) setChecking(false); });
    return () => { sequence.current += 1; };
  }, [scope, employeeId, snapshot, retry]);
  const relevantEmployees = snapshot.employees.slice().sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'de'));
  return <>
    <div className="ci-section-title">
      <div>
        <h3>Ausstattung bei Personalwechsel zurücknehmen</h3>
        <p>Offene rückgabepflichtige Gegenstände einer Person prüfen.</p>
      </div>
    </div>
    <label className="ci-filter ci-person-filter">
      <span>Mitarbeitende Person</span>
      <select value={employeeId} onChange={event => setEmployeeId(event.target.value)}>
        <option value="">Person auswählen</option>
        {relevantEmployees.map(employee => <option key={employee.id} value={employee.id}>
          {employee.firstName} {employee.lastName}
        </option>)}
      </select>
    </label>
    {checking ? <div className="ci-banner" role="status">Rückgaben werden geprüft …</div> : error ? <div className="ci-banner ci-banner--error" role="alert">
      <div>
        {error}<div className="ci-actions">
          <button type="button" className="ci-button" onClick={() => setRetry(value => value + 1)}>Erneut prüfen</button>
        </div>
      </div>
    </div> : check ? <>
      <div className={`ci-banner ${check.openAssignments.length ? 'ci-banner--info' : 'ci-banner--success'}`}>
        <CompanyIcon name={check.openAssignments.length ? 'info' : 'check'} size={21} />
        <div>
          <strong>
            {check.openAssignments.length ? `${check.openAssignments.length} offene Rückgaben für ${person(employeeId)}` : 'Keine offenen rückgabepflichtigen Ausgaben'}
          </strong>
          <p>Diese Prüfung betrifft das Inventar. Andere Schritte beim Personalaustritt bleiben separat zu bearbeiten.</p>
        </div>
      </div>
      {check.openAssignments.length > 0 && <ul className="ci-check-list">
        {check.openAssignments.map(assignment => <li key={assignment.id}>
          <div className="ci-card-header">
            <strong>
              {snapshot.items.find(item => item.id === assignment.itemId)?.name ?? 'Gegenstand nicht verfügbar'}
            </strong>
            <Status value={assignment.status} assignment={assignment} />
          </div>
          <p>Ausgegeben: {inventoryDate(assignment.issuedAt)}{assignment.expectedReturnAt ? ` · Rückgabe bis ${inventoryDate(assignment.expectedReturnAt)}` : ''}
          </p>
          <div className="ci-actions">
            <button type="button" className="ci-button" onClick={() => open({ kind: 'detail', itemId: assignment.itemId })}>Details ansehen</button>
            {canReturn && assignment.status !== 'planned' && <button type="button" className="ci-button ci-button--primary" disabled={blocked} onClick={() => open({ kind: 'return', assignment })}>Rücknahme erfassen</button>}
          </div>
        </li>)}
      </ul>}
    </> : <Empty title={relevantEmployees.length ? 'Person auswählen' : 'Keine Personalauswahl verfügbar'} text={relevantEmployees.length ? 'Wählen Sie eine Person aus, um ihre offenen Rückgaben zu prüfen.' : 'Für die Rückgabeprüfung muss eine Mitarbeitendenakte vorhanden sein.'} icon="people" />}
  </>;
}

function InventoryHistory({ snapshot, search }: { snapshot: CompanyInventorySnapshot; search: string }) {
  function entityLabel(entityId: string, metadata: Record<string, unknown>) {
    const itemId = typeof metadata.itemId === 'string' ? metadata.itemId : entityId;
    return snapshot.items.find(item => item.id === itemId)?.name ?? (typeof metadata.name === 'string' ? metadata.name : 'Inventarvorgang');
  }
  const events = snapshot.audit.filter(event => inventoryMatches(search, [inventoryAuditTitle(event), entityLabel(event.entityId, event.metadata)]));
  return events.length ? <section className="ci-card">
    <ol className="ci-timeline">
      {events.map(event => <li key={event.id}>
        <span className="ci-timeline-icon">
          <CompanyIcon name="clock" size={17} />
        </span>
        <div>
          <strong>
            {inventoryAuditTitle(event)}
          </strong>
          <p>
            {entityLabel(event.entityId, event.metadata)}
          </p>
          <time dateTime={event.createdAt}>
            {inventoryDate(event.createdAt, true)}
          </time>
        </div>
      </li>)}
    </ol>
  </section> : <Empty title="Keine passenden Aktivitäten" text="Verfügbare Inventaränderungen werden hier mit Zeitpunkt angezeigt." icon="clock" />;
}

function AssignmentActions({ scope, assignment, permissions, blocked, run }: {
  scope: CompanyInventoryScope; assignment: InventoryAssignment; permissions: CompanyInventoryPermissions;
  blocked: boolean; run: RunInventoryMutation;
}) {
  async function acknowledge() {
    const accepted = await confirmAction({ title: 'Empfang dokumentieren', message: 'Wurde der Empfang dieses Gegenstands tatsächlich bestätigt? Die Bestätigung wird mit dem aktuellen Zeitpunkt dokumentiert.', confirmLabel: 'Empfang bestätigt', cancelLabel: 'Abbrechen' });
    if (accepted) await run(() => acknowledgeCompanyInventoryAssignment(scope, assignment.id, assignment.updatedAt), 'Empfang wurde als bestätigt dokumentiert.');
  }
  async function request() {
    const accepted = await confirmAction({ title: 'Rückgabe anfordern', message: 'Diese Ausgabe als angeforderte Rückgabe kennzeichnen? Die Person wird dadurch nicht automatisch benachrichtigt.', confirmLabel: 'Rückgabe kennzeichnen', cancelLabel: 'Abbrechen' });
    if (accepted) await run(() => requestCompanyInventoryReturn(scope, assignment.id, assignment.updatedAt), 'Rückgabe wurde als angefordert gekennzeichnet.');
  }
  return <>
    {permissions.issue && assignment.status === 'issued' && <button type="button" className="ci-text-button" disabled={blocked} onClick={() => void acknowledge()}>Empfang bestätigen</button>}
    {permissions.returnItems && ['issued', 'acknowledged', 'overdue', 'partially_returned', 'disputed', 'lost'].includes(assignment.status) && <button type="button" className="ci-text-button" disabled={blocked} onClick={() => void request()}>Rückgabe anfordern</button>}
  </>;
}
