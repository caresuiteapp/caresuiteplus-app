import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PermissionKey, RoleKey } from '@/types';
import type { CompanyDepartment, CompanyEmployeePlacement, CompanyLegalEntity, CompanyOrganizationKind, CompanyOrganizationResult, CompanyOrganizationScope, CompanyOrganizationSnapshot, CompanyRelationship, CompanySite } from '@/types/tenant/companyOrganization';
import { archiveCompanyOrganization, getCompanyOrganizationPermissions, loadCompanyOrganization } from '@/lib/tenant/companyOrganizationService.web';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
import { confirmAction } from '@/lib/platform/confirmAction';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { CompanyIcon } from './CompanyWorkspaceView.web';
import { CompanyOrganizationEditor, type RunOrganizationMutation } from './CompanyOrganizationDialogs.web';
import {
  ORGANIZATION_STATUS, ORGANIZATION_VIEWS, RELATIONSHIP_KINDS, SITE_KINDS,
  organizationDate, organizationEditDialog, organizationEntityName, organizationMatches,
  organizationPersonName, organizationRecordById, organizationRecordTitle, placementPeriod,
  type CompanyOrganizationView, type OrganizationEditDialog, type OrganizationRecord,
} from './companyOrganizationModel.web';
import { companyOrganizationCss } from './companyOrganizationCss.web';

export type { CompanyOrganizationView } from './companyOrganizationModel.web';
export type CompanyOrganizationWorkspaceProps = {
  tenantId: string; roleKey: RoleKey | null; actorProfileId?: string | null; effectivePermissions?: readonly PermissionKey[];
  accessContent?: ReactNode; canManageScopes?: boolean; scopeLimited?: boolean; accessNavigationGuard?: () => Promise<boolean>;
  initialView?: CompanyOrganizationView; onViewChange?: (view: CompanyOrganizationView) => void;
  onNavigationGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
};
type Dialog = { kind: 'detail'; recordKind: CompanyOrganizationKind; id: string } | { kind: 'edit'; edit: OrganizationEditDialog };
export function CompanyOrganizationWorkspace(props: CompanyOrganizationWorkspaceProps) {
  const permissionKey = props.effectivePermissions ? [...props.effectivePermissions].sort().join(',') : 'role';
  return <OrganizationScope key={`${props.tenantId}:${props.roleKey}:${props.actorProfileId ?? ''}:${permissionKey}`} {...props} />;
}

function OrganizationScope({ tenantId, roleKey, actorProfileId, effectivePermissions, initialView = 'sites', onViewChange, onNavigationGuardChange, accessContent, canManageScopes = false, scopeLimited = false, accessNavigationGuard }: CompanyOrganizationWorkspaceProps) {
  const scope = useMemo<CompanyOrganizationScope>(() => ({ tenantId, actorRoleKey: roleKey, actorProfileId, effectivePermissions }), [tenantId, roleKey, actorProfileId, effectivePermissions]);
  const localPermissions = useMemo(() => getCompanyOrganizationPermissions(roleKey, effectivePermissions), [roleKey, effectivePermissions]);
  const [snapshot, setSnapshot] = useState<CompanyOrganizationSnapshot | null>(null);
  const limited = scopeLimited || Boolean(snapshot?.scopeLimited);
  const permissions = { view: localPermissions.view && (snapshot?.permissions.view ?? true), manage: localPermissions.manage && (snapshot?.permissions.manage ?? true), viewEmployees: localPermissions.viewEmployees && (snapshot?.permissions.viewEmployees ?? true), managePlacements: localPermissions.managePlacements && (snapshot?.permissions.managePlacements ?? true) };
  const [view, setView] = useState(initialView);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('current');
  const [entityFilter, setEntityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [dirty, setDirty] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const alive = useRef(true);
  const requestId = useRef(0);
  const writeLock = useRef(false);
  const recovery = useRef(false);
  const confirmLeave = useUnsavedWebChanges(dirty, busy);
  useEffect(() => { alive.current = true; return () => { alive.current = false; requestId.current += 1; }; }, []);
  useEffect(() => { setView(initialView); }, [initialView]);
  const guard = useCallback(async () => { if (view === 'access' && accessNavigationGuard && !(await accessNavigationGuard())) return false; return confirmLeave(); }, [view, accessNavigationGuard, confirmLeave]);
  useEffect(() => { onNavigationGuardChange?.(guard); return () => onNavigationGuardChange?.(null); }, [guard, onNavigationGuardChange]);

  const reload = useCallback(async () => {
    if (!permissions.view) { setLoading(false); return false; }
    const request = ++requestId.current; setLoading(true); setLoadError(null);
    try {
      const result = await loadCompanyOrganization(scope);
      if (!alive.current || request !== requestId.current) return false;
      if (!result.ok) { setLoadError(result.error); return false; }
      setSnapshot(result.data); setReloadRequired(false); setMutationError(null);
      if (recovery.current) { recovery.current = false; setDialog(null); setDirty(false); setNotice({ text: 'Die aktuellen Daten wurden geladen. Bitte prüfen Sie den zuletzt bearbeiteten Eintrag. Der vorherige Entwurf wurde geschlossen.' }); }
      return true;
    } catch {
      if (alive.current && request === requestId.current) setLoadError('Die Unternehmensstruktur konnte nicht geladen werden. Bitte erneut versuchen.');
      return false;
    } finally { if (alive.current && request === requestId.current) setLoading(false); }
  }, [scope, permissions.view]);
  useEffect(() => { void reload(); }, [reload]);
  const run: RunOrganizationMutation = async <T,>(operation: () => Promise<CompanyOrganizationResult<T>>, message: string) => {
    if (!alive.current || writeLock.current || recovery.current || loading || reloadRequired) return false;
    writeLock.current = true; setBusy(true); setMutationError(null); setNotice(null);
    try {
      const result = await operation();
      if (!alive.current) return false;
      if (!result.ok) {
        setMutationError(result.error);
        if (result.conflict || result.reloadRequired) { recovery.current = true; setReloadRequired(true); }
        return false;
      }
      const refreshed = await reload();
      if (!alive.current) return false;
      if (!refreshed) { recovery.current = true; setReloadRequired(true); setNotice({ text: `${message} Die aktualisierte Liste konnte noch nicht geladen werden.`, error: true }); }
      else setNotice({ text: message });
      return true;
    } catch {
      if (alive.current) { recovery.current = true; setReloadRequired(true); setMutationError('Der Speicherstand konnte nicht bestätigt werden. Bitte laden Sie die Unternehmensstruktur neu und prüfen Sie den Vorgang.'); }
      return false;
    } finally { writeLock.current = false; if (alive.current) setBusy(false); }
  };
  const blocked = busy || loading || reloadRequired;
  async function changeView(next: CompanyOrganizationView) {
    if (!(await guard()) || !alive.current) return;
    setDialog(null); setDirty(false); setMutationError(null); setSearch(''); setView(next); onViewChange?.(next);
  }
  async function close() { if (await confirmLeave() && alive.current) { setDialog(null); setDirty(false); setMutationError(null); } }
  function openDetail(kind: CompanyOrganizationKind, id: string) { if (!busy) { setMutationError(null); setDialog({ kind: 'detail', recordKind: kind, id }); } }
  function edit(kind: CompanyOrganizationKind, record?: OrganizationRecord) {
    if (blocked || !permissions.manage || kind === 'entity' && !snapshot?.canManageEntities || kind === 'placement' && !permissions.managePlacements) return;
    setMutationError(null); setDirty(false); setDialog({ kind: 'edit', edit: organizationEditDialog(kind, record) });
  }
  async function archive(kind: CompanyOrganizationKind, record: OrganizationRecord) {
    if (blocked || !snapshot) return;
    const confirmed = await confirmAction({ title: 'Eintrag archivieren?', message: `„${organizationRecordTitle(snapshot, kind, record, permissions.viewEmployees)}“ wird aus der aktiven Übersicht genommen. Bestehende Verknüpfungen bleiben erhalten.`, confirmLabel: 'Archivieren', cancelLabel: 'Abbrechen' });
    if (!confirmed || !alive.current) return;
    const saved = await run(() => archiveCompanyOrganization(scope, kind, record.id, record.version), 'Der Eintrag wurde archiviert.');
    if (saved && alive.current) setDialog(null);
  }
  const frame = (content: ReactNode) => <section className="cg-workspace" aria-label="Unternehmensorganisation" aria-busy={loading || busy}><style>{companyOrganizationCss}</style>{content}</section>;
  if (!permissions.view) return frame(<Empty title="Kein Zugriff auf die Unternehmensstruktur" text="Für diese Ansicht fehlt die Unternehmensberechtigung." icon="shield" />);
  if (!snapshot) return frame(<><div className="cg-heading"><div><h2>Organisation</h2><p>Standorte, Gesellschaften und Zuständigkeiten verbinden.</p></div></div>{loadError ? <Empty title="Unternehmensstruktur nicht verfügbar" text={loadError} icon="info"><button type="button" className="cg-button" disabled={loading} onClick={() => void reload()}>Erneut laden</button></Empty> : <Empty title="Organisation wird geladen …" text="Standorte, Abteilungen und Verknüpfungen werden abgerufen." icon="building" />}</>);

  const availableViews = ORGANIZATION_VIEWS.filter(tab => tab.id !== 'placements' || permissions.viewEmployees && snapshot.employeesVisible);
  const accessActive = view === 'access' && canManageScopes && !limited;
  const activeView = availableViews.find(tab => tab.id === view) ?? availableViews[0];
  const person = (id?: string | null) => organizationPersonName(snapshot, id, permissions.viewEmployees);
  const entityName = (id?: string | null) => organizationEntityName(snapshot, id);
  const siteName = (id?: string | null) => id ? snapshot.sites.find(site => site.id === id)?.name ?? 'Standort nicht verfügbar' : 'Standortübergreifend';
  const departmentName = (id?: string | null) => id ? snapshot.departments.find(department => department.id === id)?.name ?? 'Abteilung nicht verfügbar' : 'Keine Abteilung';
  const count = (id: Exclude<CompanyOrganizationView, 'access'>) => snapshot[id].filter(record => record.status === 'active').length;
  const activePlacements = snapshot.placements.filter(placement => placementPeriod(placement) === 'Aktuell');
  const entityMatch = (id: string | null) => entityFilter === 'all' || (id ?? 'main') === entityFilter;
  const visible = <T extends OrganizationRecord>(record: T) => (status === 'all' || status === 'current' ? status === 'all' || record.status !== 'archived' : record.status === status);
  const sites = snapshot.sites.filter(site => visible(site) && entityMatch(site.entityId) && organizationMatches(search, [site.name, site.code, site.city, site.street, site.email, SITE_KINDS[site.kind], entityName(site.entityId), person(site.leaderEmployeeId)])).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const departments = snapshot.departments.filter(department => visible(department) && entityMatch(department.entityId) && organizationMatches(search, [department.name, department.code, entityName(department.entityId), siteName(department.siteId), person(department.leaderEmployeeId)])).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const entities = snapshot.entities.filter(entity => visible(entity) && organizationMatches(search, [entity.name, entity.code, entity.legalForm, entity.city, entity.registrationNumber, entity.email])).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const relationships = snapshot.relationships.filter(relationship => visible(relationship) && entityMatch(relationship.entityId) && organizationMatches(search, [relationship.partnerName, entityName(relationship.entityId), relationship.territory, relationship.contractReference, RELATIONSHIP_KINDS[relationship.kind]])).sort((a, b) => a.partnerName.localeCompare(b.partnerName, 'de'));
  const placements = snapshot.placements.filter(placement => visible(placement) && entityMatch(placement.entityId) && organizationMatches(search, [person(placement.employeeId), siteName(placement.siteId), departmentName(placement.departmentId), entityName(placement.entityId), placement.roleTitle, placementPeriod(placement)])).sort((a, b) => person(a.employeeId).localeCompare(person(b.employeeId), 'de'));
  const filteredCounts = { sites: sites.length, departments: departments.length, entities: entities.length, relationships: relationships.length, placements: placements.length };
  const detail = dialog?.kind === 'detail' ? organizationRecordById(snapshot, dialog.recordKind, dialog.id) : undefined;
  const scopeAllowsCreation = !limited || (activeView.id === 'sites' || activeView.id === 'relationships' ? snapshot.entities.some(entity => entity.status === 'active') : activeView.id === 'departments' ? snapshot.sites.some(site => site.status === 'active') || snapshot.entities.some(entity => entity.status === 'active') : true);
  const createAllowed = !accessActive && scopeAllowsCreation && (activeView.id === 'placements' ? permissions.managePlacements : activeView.id === 'entities' ? permissions.manage && snapshot.canManageEntities : permissions.manage);
  const resultEmpty = <Empty icon={activeView.icon} title={search || status !== 'current' || entityFilter !== 'all' ? 'Keine passenden Einträge' : `Noch keine ${activeView.label}`} text={search || status !== 'current' || entityFilter !== 'all' ? 'Ändern Sie die Suche oder die Filter, um weitere Einträge anzuzeigen.' : activeView.description}>{search || status !== 'current' || entityFilter !== 'all' ? <button type="button" className="cg-button" onClick={() => { setSearch(''); setStatus('current'); setEntityFilter('all'); }}>Filter zurücksetzen</button> : createAllowed && <button type="button" className="cg-button cg-button--primary" disabled={blocked} onClick={() => edit(activeView.kind)}><CompanyIcon name="plus" size={17} />{activeView.add}</button>}</Empty>;

  return frame(<>
    <div className="cg-heading"><div><span className="cg-eyebrow">Struktur & Verantwortung</span><h2>Ihr Unternehmen. Gut verbunden.</h2><p>Standorte, Gesellschaften und Teams mit klaren Zuständigkeiten verwalten.</p></div><div className="cg-actions"><button type="button" className="cg-button cg-button--quiet" disabled={busy || loading} onClick={() => void reload()}><CompanyIcon name="refresh" size={16} />{loading ? 'Wird geladen …' : 'Aktualisieren'}</button>{createAllowed && <button type="button" className="cg-button cg-button--primary" disabled={blocked} onClick={() => edit(activeView.kind)}><CompanyIcon name="plus" size={17} />{activeView.add}</button>}</div></div>
    {notice && <div className={`cg-banner cg-banner--${notice.error ? 'error' : 'success'}`} role="status"><CompanyIcon name={notice.error ? 'info' : 'check'} size={18} /><div>{notice.text}</div><button type="button" className="cg-text-button" aria-label="Hinweis schließen" onClick={() => setNotice(null)}><CompanyIcon name="close" size={16} /></button></div>}
    {(loadError || mutationError && dialog?.kind !== 'edit') && <div className="cg-banner cg-banner--error" role="alert"><CompanyIcon name="info" size={19} /><div><strong>{loadError ? 'Aktualisierung fehlgeschlagen' : 'Änderung nicht bestätigt'}</strong><p>{loadError ?? mutationError}</p>{reloadRequired && <div className="cg-actions"><button type="button" className="cg-button" disabled={busy || loading} onClick={() => void reload()}>Aktuellen Stand laden</button></div>}</div></div>}
    {limited && <div className="cg-banner" role="status"><CompanyIcon name="shield" size={19} /><div>Sie verwalten die für Sie freigegebenen Standorte und Organisationsbereiche. Übergreifende Gesellschaftsdaten und Zugriffsrechte bleiben bei der Unternehmensadministration.</div></div>}
    <div className="cg-metrics"><Metric label="Standorte" value={count('sites')} note="Aktive Arbeits- und Leistungsorte" icon="pin" onClick={() => void changeView('sites')} /><Metric label="Abteilungen" value={count('departments')} note="Organisatorische Einheiten" icon="grid" onClick={() => void changeView('departments')} /><Metric label="Gesellschaften" value={count('entities')} note="Zusätzlich zum Hauptunternehmen" icon="building" onClick={() => void changeView('entities')} />{permissions.viewEmployees && snapshot.employeesVisible ? <Metric label="Personal zugeordnet" value={new Set(activePlacements.map(placement => placement.employeeId)).size} note="Personen mit aktueller Zuordnung" icon="people" onClick={() => void changeView('placements')} /> : <Metric label="Beziehungen" value={count('relationships')} note="Aktive Beteiligungen und Partnerschaften" icon="transfer" onClick={() => void changeView('relationships')} />}</div>
    <nav className="cg-tabs" aria-label="Organisation"><>{availableViews.map(tab => <button type="button" key={tab.id} aria-pressed={!accessActive && activeView.id === tab.id} onClick={() => void changeView(tab.id)}><CompanyIcon name={tab.icon} size={16} />{tab.label}<small>{count(tab.id)}</small></button>)}{canManageScopes && !limited && <button type="button" aria-pressed={accessActive} onClick={() => void changeView('access')}><CompanyIcon name="shield" size={16} />Zugriffe</button>}</></nav>
    {accessActive ? accessContent : <>
    <div className="cg-toolbar"><label className="cg-search"><CompanyIcon name="search" size={18} /><input aria-label="Organisation durchsuchen" placeholder={`${activeView.label} durchsuchen …`} value={search} onChange={event => setSearch(event.target.value)} /></label>{activeView.id !== 'entities' && <label className="cg-filter"><span>Gesellschaft</span><select value={entityFilter} onChange={event => setEntityFilter(event.target.value)}><option value="all">Alle Gesellschaften</option><option value="main">Hauptunternehmen</option>{snapshot.entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>}<label className="cg-filter"><span>Status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="current">Aktiv & inaktiv</option><option value="active">Aktiv</option><option value="inactive">Inaktiv</option><option value="archived">Archiviert</option><option value="all">Alle Einträge</option></select></label></div>
    <div className="cg-results"><span>{filteredCounts[activeView.id]} {filteredCounts[activeView.id] === 1 ? 'Eintrag' : 'Einträge'}</span><span>{activeView.description}</span></div>
    {!filteredCounts[activeView.id] ? resultEmpty : <>
      {activeView.id === 'sites' && <div className="cg-grid">{sites.map(site => <Card key={site.id} record={site} icon="pin" title={site.name} subtitle={`${SITE_KINDS[site.kind]}${site.code ? ` · ${site.code}` : ''}`} onOpen={() => openDetail('site', site.id)} onEdit={permissions.manage ? () => edit('site', site) : undefined} blocked={blocked} count={`${activePlacements.filter(placement => placement.siteId === site.id).length} aktuelle Zuordnungen`}><Data label="Gesellschaft" value={entityName(site.entityId)} /><Data label="Adresse" value={[site.street, [site.postalCode, site.city].filter(Boolean).join(' ')].filter(Boolean).join('\n') || 'Noch keine Adresse'} /><Data label="Leitung" value={person(site.leaderEmployeeId)} /><Data label="Kontakt" value={site.phone || site.email || 'Noch kein Kontakt'} /></Card>)}</div>}
      {activeView.id === 'departments' && <div className="cg-grid">{departments.map(department => <Card key={department.id} record={department} icon="grid" title={department.name} subtitle={department.code || entityName(department.entityId)} onOpen={() => openDetail('department', department.id)} onEdit={permissions.manage ? () => edit('department', department) : undefined} blocked={blocked} count={`${activePlacements.filter(placement => placement.departmentId === department.id).length} aktuelle Zuordnungen`}><Data label="Standort" value={siteName(department.siteId)} /><Data label="Leitung" value={person(department.leaderEmployeeId)} /><Data label="Übergeordnet" value={department.parentDepartmentId ? departmentName(department.parentDepartmentId) : 'Eigenständige Abteilung'} /><Data label="Kontakt" value={department.email || department.phone || 'Noch kein Kontakt'} /></Card>)}</div>}
      {activeView.id === 'entities' && <div className="cg-grid">{entities.map(entity => <Card key={entity.id} record={entity} icon="building" title={entity.name} subtitle={[entity.legalForm, entity.code].filter(Boolean).join(' · ') || 'Gesellschaft'} onOpen={() => openDetail('entity', entity.id)} onEdit={permissions.manage && snapshot.canManageEntities ? () => edit('entity', entity) : undefined} blocked={blocked} count={`${snapshot.sites.filter(site => site.entityId === entity.id && site.status === 'active').length} aktive Standorte`}><Data label="Sitz" value={[entity.postalCode, entity.city].filter(Boolean).join(' ') || 'Noch kein Sitz hinterlegt'} /><Data label="Übergeordnet" value={entity.parentEntityId ? entityName(entity.parentEntityId) : 'Keine übergeordnete Gesellschaft'} /><Data label="Leitung" value={person(entity.leaderEmployeeId)} /><Data label="Register" value={entity.registrationNumber || 'Nicht hinterlegt'} /></Card>)}</div>}
      {activeView.id === 'relationships' && <div className="cg-grid">{relationships.map(relationship => <article className="cg-card" key={relationship.id}><div className="cg-card-head"><span className="cg-icon"><CompanyIcon name="transfer" /></span><div><h3><button type="button" className="cg-card-name" onClick={() => openDetail('relationship', relationship.id)}>{relationship.partnerName}</button></h3><p>{RELATIONSHIP_KINDS[relationship.kind]}</p></div><Badge record={relationship} /></div><div className="cg-connection"><div><small>Ausgangsgesellschaft</small>{entityName(relationship.entityId)}</div><CompanyIcon name="arrow" size={20} /><div><small>Vertragspartner</small>{relationship.partnerName}</div></div><dl><Data label="Gebiet" value={relationship.territory || 'Kein Gebiet hinterlegt'} /><Data label="Beteiligung" value={relationship.ownershipPercent !== null ? `${relationship.ownershipPercent.toLocaleString('de-DE')} %` : 'Keine Beteiligung hinterlegt'} /><Data label="Vertrag" value={relationship.contractReference || 'Nicht hinterlegt'} /><Data label="Laufzeit" value={relationship.startsOn || relationship.endsOn ? `${relationship.startsOn ? organizationDate(relationship.startsOn) : 'Offener Beginn'} – ${relationship.endsOn ? organizationDate(relationship.endsOn) : 'unbefristet'}` : 'Nicht hinterlegt'} /></dl><div className="cg-card-footer"><button type="button" className="cg-text-button" onClick={() => openDetail('relationship', relationship.id)}>Details ansehen <CompanyIcon name="arrow" size={14} /></button>{permissions.manage && <button type="button" className="cg-button cg-button--quiet" disabled={blocked} onClick={() => edit('relationship', relationship)}>Bearbeiten</button>}</div></article>)}</div>}
      {activeView.id === 'placements' && <div className="cg-table-shell"><table className="cg-table"><colgroup><col style={{ width: '24%' }} /><col style={{ width: '27%' }} /><col style={{ width: '23%' }} /><col style={{ width: '14%' }} /><col style={{ width: '12%' }} /></colgroup><thead><tr><th>Person</th><th>Zuordnung</th><th>Zeitraum</th><th>Umfang</th><th>Aktion</th></tr></thead><tbody>{placements.map(placement => <tr key={placement.id}><td><div className="cg-person"><span className="cg-avatar">{person(placement.employeeId).split(' ').slice(0, 2).map(part => part[0]).join('')}</span><div><button type="button" className="cg-text-button" onClick={() => openDetail('placement', placement.id)}>{person(placement.employeeId)}</button><small>{placement.roleTitle || 'Keine Funktion hinterlegt'}</small></div></div></td><td>{siteName(placement.siteId)}<small>{departmentName(placement.departmentId)}</small><small>{entityName(placement.entityId)}</small></td><td>{organizationDate(placement.startsOn)} – {placement.endsOn ? organizationDate(placement.endsOn) : 'unbefristet'}<small>{placementPeriod(placement)}</small></td><td>{placement.allocationPercent === null ? 'Nicht festgelegt' : `${placement.allocationPercent.toLocaleString('de-DE')} %`}{placement.isPrimary && <small><span className="cg-badge">Hauptzuordnung</span></small>}</td><td>{permissions.managePlacements ? <button type="button" className="cg-button cg-button--quiet" disabled={blocked} onClick={() => edit('placement', placement)}>Bearbeiten</button> : <button type="button" className="cg-text-button" onClick={() => openDetail('placement', placement.id)}>Details</button>}</td></tr>)}</tbody></table></div>}
    </>}
    </>}
    {dialog?.kind === 'edit' && <CompanyOrganizationEditor key={`${dialog.edit.kind}:${dialog.edit.record?.id ?? 'new'}`} dialog={dialog.edit} scope={scope} snapshot={snapshot} permissions={permissions} busy={busy} blocked={reloadRequired} error={mutationError} run={run} onDirtyChange={setDirty} onClose={() => void close()} onSaved={() => { setDialog(null); setDirty(false); }} onReload={reload} />}
    {dialog?.kind === 'detail' && <PlatformModal visible surfaceScope="company" title={detail ? organizationRecordTitle(snapshot, dialog.recordKind, detail, permissions.viewEmployees) : 'Eintrag nicht verfügbar'} subtitle="Unternehmensorganisation" onClose={() => void close()} dismissOnBackdrop={!busy} maxWidth={850} minWidth={260} maxHeightRatio={0.93} bodyStyle={{ backgroundColor: '#0b1d30', padding: 22 }} sheetStyle={{ backgroundColor: '#0b1d30' }} footerContent={<div className="cg-dialog cg-form-footer"><span>{detail ? `Zuletzt geändert am ${organizationDate(detail.updatedAt)}` : 'Bitte die Übersicht aktualisieren.'}</span><div className="cg-actions">{detail && permissions.manage && (dialog.recordKind !== 'entity' || snapshot.canManageEntities) && (dialog.recordKind !== 'placement' || permissions.managePlacements) && <><button type="button" className="cg-button cg-button--quiet" disabled={blocked} onClick={() => edit(dialog.recordKind, detail)}>{detail.status === 'archived' ? 'Bearbeiten & reaktivieren' : 'Bearbeiten'}</button>{detail.status !== 'archived' && <button type="button" className="cg-button cg-button--danger" disabled={blocked} onClick={() => void archive(dialog.recordKind, detail)}>Archivieren</button>}</>}<button type="button" className="cg-button" disabled={busy} onClick={() => void close()}>Schließen</button></div></div>}><style>{companyOrganizationCss}</style><div className="cg-dialog">{mutationError && <div className="cg-banner cg-banner--error" role="alert">{mutationError}</div>}{detail ? <OrganizationDetails snapshot={snapshot} kind={dialog.recordKind} record={detail} employeeAccess={permissions.viewEmployees} onOpen={openDetail} /> : <Empty icon="info" title="Dieser Eintrag ist nicht mehr verfügbar" text="Schließen Sie die Ansicht und laden Sie die Unternehmensstruktur erneut." />}</div></PlatformModal>}
  </>);
}

function Empty({ icon, title, text, children }: { icon: string; title: string; text: string; children?: ReactNode }) { return <div className="cg-empty"><CompanyIcon name={icon} size={30} /><h3>{title}</h3><p>{text}</p>{children && <div className="cg-actions">{children}</div>}</div>; }
function Metric({ icon, label, value, note, onClick }: { icon: string; label: string; value: number; note: string; onClick: () => void }) { return <button type="button" className="cg-metric" onClick={onClick}><span><CompanyIcon name={icon} size={16} />{label}</span><strong>{value}</strong><small>{note}</small></button>; }
function Badge({ record }: { record: OrganizationRecord }) { return <span className={`cg-badge cg-badge--${record.status}`}>{ORGANIZATION_STATUS[record.status]}</span>; }
function Data({ label, value }: { label: string; value: ReactNode }) { return <div><dt>{label}</dt><dd>{value || 'Nicht hinterlegt'}</dd></div>; }
function Card({ record, icon, title, subtitle, count, onOpen, onEdit, blocked, children }: { record: OrganizationRecord; icon: string; title: string; subtitle: string; count: string; onOpen: () => void; onEdit?: () => void; blocked: boolean; children: ReactNode }) {
  return <article className="cg-card"><div className="cg-card-head"><span className="cg-icon"><CompanyIcon name={icon} /></span><div><h3><button type="button" className="cg-card-name" onClick={onOpen}>{title}</button></h3><p>{subtitle}</p></div><Badge record={record} /></div><dl>{children}</dl><div className="cg-card-footer"><span>{count}</span><div className="cg-actions"><button type="button" className="cg-text-button" onClick={onOpen}>Details <CompanyIcon name="arrow" size={14} /></button>{onEdit && <button type="button" className="cg-button cg-button--quiet" disabled={blocked} onClick={onEdit}>Bearbeiten</button>}</div></div></article>;
}

function OrganizationDetails({ snapshot, kind, record, employeeAccess, onOpen }: { snapshot: CompanyOrganizationSnapshot; kind: CompanyOrganizationKind; record: OrganizationRecord; employeeAccess: boolean; onOpen: (kind: CompanyOrganizationKind, id: string) => void }) {
  const entity = record as CompanyLegalEntity;
  const site = record as CompanySite;
  const department = record as CompanyDepartment;
  const placement = record as CompanyEmployeePlacement;
  const relationship = record as CompanyRelationship;
  const named = kind === 'entity' || kind === 'site' || kind === 'department';
  const link = (targetKind: CompanyOrganizationKind, id: string | null | undefined, fallback: string) => {
    const target = id ? organizationRecordById(snapshot, targetKind, id) : undefined;
    return target ? <button type="button" className="cg-text-button" onClick={() => onOpen(targetKind, target.id)}>{organizationRecordTitle(snapshot, targetKind, target, employeeAccess)}</button> : fallback;
  };
  const relatedSites = kind === 'entity' ? snapshot.sites.filter(entry => entry.entityId === record.id) : [];
  const relatedDepartments = snapshot.departments.filter(entry => kind === 'entity' ? entry.entityId === record.id : kind === 'site' ? entry.siteId === record.id : kind === 'department' && entry.parentDepartmentId === record.id);
  const relatedPlacements = employeeAccess && snapshot.employeesVisible ? snapshot.placements.filter(entry => kind === 'entity' ? entry.entityId === record.id : kind === 'site' ? entry.siteId === record.id : kind === 'department' && entry.departmentId === record.id) : [];
  const events = snapshot.audit.filter(entry => entry.kind === kind && entry.recordId === record.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <><div className="cg-detail-heading"><span className="cg-icon"><CompanyIcon name={ORGANIZATION_VIEWS.find(view => view.kind === kind)?.icon ?? 'building'} size={24} /></span><div><h3>{organizationRecordTitle(snapshot, kind, record, employeeAccess)}</h3><p>{kind === 'relationship' ? RELATIONSHIP_KINDS[relationship.kind] : kind === 'site' ? SITE_KINDS[site.kind] : kind === 'placement' ? placement.roleTitle || 'Organisatorische Zuordnung' : named ? entity.code || 'Unternehmensstruktur' : ''}</p></div><Badge record={record} /></div><dl className="cg-details">
    {kind !== 'entity' && <Data label="Gesellschaft" value={link('entity', site.entityId, 'Hauptunternehmen')} />}
    {named && <Data label="Leitung" value={organizationPersonName(snapshot, entity.leaderEmployeeId, employeeAccess)} />}
    {(kind === 'entity' || kind === 'site') && <><Data label="Adresse" value={[entity.street, [entity.postalCode, entity.city].filter(Boolean).join(' '), entity.country].filter(Boolean).join('\n')} />{kind === 'site' && <Data label="Erreichbarkeit" value={site.openingHours} />}</>}
    {kind === 'entity' && <><Data label="Rechtsform" value={entity.legalForm} /><Data label="Übergeordnete Gesellschaft" value={link('entity', entity.parentEntityId, 'Keine übergeordnete Gesellschaft')} /><Data label="Register" value={entity.registrationNumber} /><Data label="Steuernummer" value={entity.taxNumber} /><Data label="Umsatzsteuer-ID" value={entity.vatId} /><Data label="Website" value={entity.website} /></>}
    {kind === 'department' && <><Data label="Standort" value={link('site', department.siteId, 'Standortübergreifend')} /><Data label="Übergeordnete Abteilung" value={link('department', department.parentDepartmentId, 'Eigenständige Abteilung')} /></>}
    {(kind === 'site' || kind === 'department') && <Data label="Kostenstelle" value={snapshot.costCenters.find(entry => entry.id === site.costCenterId)?.name ?? 'Keine Kostenstelle zugeordnet'} />}
    {kind !== 'placement' && <><Data label="Ansprechperson" value={entity.contactName} /><Data label="E-Mail" value={entity.email ? <a className="cg-text-button" href={`mailto:${entity.email}`}>{entity.email}</a> : null} /><Data label="Telefon" value={entity.phone ? <a className="cg-text-button" href={`tel:${entity.phone.replace(/[^+\d]/g, '')}`}>{entity.phone}</a> : null} /></>}
    {kind === 'placement' && <><Data label="Standort" value={link('site', placement.siteId, 'Standortübergreifend')} /><Data label="Abteilung" value={link('department', placement.departmentId, 'Keine Abteilung zugeordnet')} /><Data label="Gültig ab" value={organizationDate(placement.startsOn)} /><Data label="Gültig bis" value={placement.endsOn ? organizationDate(placement.endsOn) : 'Unbefristet'} /><Data label="Anteil" value={placement.allocationPercent === null ? 'Nicht festgelegt' : `${placement.allocationPercent.toLocaleString('de-DE')} %`} /><Data label="Zuordnungsart" value={placement.isPrimary ? 'Hauptzuordnung' : 'Weitere Zuordnung'} /><Data label="Zeitraumstatus" value={placementPeriod(placement)} /></>}
    {kind === 'relationship' && <><Data label="Partner" value={link('entity', relationship.partnerEntityId, relationship.partnerName)} /><Data label="Gebiet / Region" value={relationship.territory} /><Data label="Beteiligung" value={relationship.ownershipPercent !== null ? `${relationship.ownershipPercent.toLocaleString('de-DE')} %` : 'Nicht hinterlegt'} /><Data label="Beginn" value={relationship.startsOn ? organizationDate(relationship.startsOn) : 'Nicht hinterlegt'} /><Data label="Ende" value={relationship.endsOn ? organizationDate(relationship.endsOn) : 'Unbefristet / nicht hinterlegt'} /><Data label="Vertrag / Aktenzeichen" value={relationship.contractReference} /><Data label="Aufgaben und Zuständigkeiten" value={relationship.responsibilities} /></>}
    <Data label="Interne Hinweise" value={entity.notes} />
  </dl>{(relatedSites.length > 0 || relatedDepartments.length > 0 || relatedPlacements.length > 0) && <section className="cg-detail-section"><h3>Verknüpfte Einträge</h3><div className="cg-linked-list">{relatedSites.map(entry => <button type="button" key={entry.id} onClick={() => onOpen('site', entry.id)}><span>{entry.name}<small>Standort · {ORGANIZATION_STATUS[entry.status]}</small></span><CompanyIcon name="arrow" size={16} /></button>)}{relatedDepartments.map(entry => <button type="button" key={entry.id} onClick={() => onOpen('department', entry.id)}><span>{entry.name}<small>Abteilung · {ORGANIZATION_STATUS[entry.status]}</small></span><CompanyIcon name="arrow" size={16} /></button>)}{relatedPlacements.map(entry => <button type="button" key={entry.id} onClick={() => onOpen('placement', entry.id)}><span>{organizationPersonName(snapshot, entry.employeeId, employeeAccess)}<small>{entry.roleTitle || 'Personalzuordnung'} · {placementPeriod(entry)}</small></span><CompanyIcon name="arrow" size={16} /></button>)}</div></section>}{events.length > 0 && <section className="cg-detail-section"><h3>Änderungsverlauf</h3><div className="cg-linked-list">{events.map(event => <p key={event.id} className="cg-note">{organizationDate(event.createdAt)} · {({ created: 'Angelegt', updated: 'Bearbeitet', archived: 'Archiviert', restored: 'Reaktiviert' })[event.action]}</p>)}</div></section>}</>;
}
