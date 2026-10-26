// Generated native presentation from src/components/company/CompanyOrganizationWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeStyle,NativeDiv,NativeH2,NativeP,NativeButton,NativeSpan,NativeStrong,NativeNav,NativeSmall,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeArticle,NativeH3,NativeDl,NativeTable,NativeColgroup,NativeCol,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeDt,NativeDd,NativeA,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PermissionKey, RoleKey } from '@/types';
import type { CompanyDepartment, CompanyEmployeePlacement, CompanyLegalEntity, CompanyOrganizationKind, CompanyOrganizationResult, CompanyOrganizationScope, CompanyOrganizationSnapshot, CompanyRelationship, CompanySite } from '@/types/tenant/companyOrganization';
import { archiveCompanyOrganization, getCompanyOrganizationPermissions, loadCompanyOrganization } from "../../lib/tenant/companyOrganizationService.ts";
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { confirmAction } from '@/lib/platform/confirmAction';
import { PlatformModal } from "../layout/platform/platformmodal.tsx";
import { CompanyIcon } from "./CompanyWorkspaceView.native.tsx";
import { CompanyOrganizationEditor, type RunOrganizationMutation } from "./CompanyOrganizationDialogs.native.tsx";
import { ORGANIZATION_STATUS, ORGANIZATION_VIEWS, RELATIONSHIP_KINDS, SITE_KINDS, organizationDate, organizationEditDialog, organizationEntityName, organizationMatches, organizationPersonName, organizationRecordById, organizationRecordTitle, placementPeriod, type CompanyOrganizationView, type OrganizationEditDialog, type OrganizationRecord, } from "./companyOrganizationModel.ts";
import { companyOrganizationCss } from "./companyOrganizationCss.native.ts";
export type { CompanyOrganizationView } from "./companyOrganizationModel.ts";
export type CompanyOrganizationWorkspaceProps = {
    tenantId: string;
    roleKey: RoleKey | null;
    actorProfileId?: string | null;
    effectivePermissions?: readonly PermissionKey[];
    accessContent?: ReactNode;
    canManageScopes?: boolean;
    scopeLimited?: boolean;
    accessNavigationGuard?: () => Promise<boolean>;
    initialView?: CompanyOrganizationView;
    onViewChange?: (view: CompanyOrganizationView) => void;
    onNavigationGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
};
type Dialog = {
    kind: 'detail';
    recordKind: CompanyOrganizationKind;
    id: string;
} | {
    kind: 'edit';
    edit: OrganizationEditDialog;
};
export function CompanyOrganizationWorkspace(props: CompanyOrganizationWorkspaceProps) {
    const permissionKey = props.effectivePermissions ? [...props.effectivePermissions].sort().join(',') : 'role';
    return <NativeWorkspaceStyleScope key={`${props.tenantId}:${props.roleKey}:${props.actorProfileId ?? ''}:${permissionKey}`} css={[companyOrganizationCss]}>{<OrganizationScope key={`${props.tenantId}:${props.roleKey}:${props.actorProfileId ?? ''}:${permissionKey}`} {...props}/>}</NativeWorkspaceStyleScope>;
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
    const [notice, setNotice] = useState<{
        text: string;
        error?: boolean;
    } | null>(null);
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
    const guard = useCallback(async () => { if (view === 'access' && accessNavigationGuard && !(await accessNavigationGuard()))
        return false; return await confirmLeave(); }, [view, accessNavigationGuard, confirmLeave]);
    useEffect(() => { onNavigationGuardChange?.(guard); return () => onNavigationGuardChange?.(null); }, [guard, onNavigationGuardChange]);
    const reload = useCallback(async () => {
        if (!permissions.view) {
            setLoading(false);
            return false;
        }
        const request = ++requestId.current;
        setLoading(true);
        setLoadError(null);
        try {
            const result = await loadCompanyOrganization(scope);
            if (!alive.current || request !== requestId.current)
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
                setDirty(false);
                setNotice({ text: 'Die aktuellen Daten wurden geladen. Bitte prüfen Sie den zuletzt bearbeiteten Eintrag. Der vorherige Entwurf wurde geschlossen.' });
            }
            return true;
        }
        catch {
            if (alive.current && request === requestId.current)
                setLoadError('Die Unternehmensstruktur konnte nicht geladen werden. Bitte erneut versuchen.');
            return false;
        }
        finally {
            if (alive.current && request === requestId.current)
                setLoading(false);
        }
    }, [scope, permissions.view]);
    useEffect(() => { void reload(); }, [reload]);
    const run: RunOrganizationMutation = async <T,>(operation: () => Promise<CompanyOrganizationResult<T>>, message: string) => {
        if (!alive.current || writeLock.current || recovery.current || loading || reloadRequired)
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
                if (result.conflict || result.reloadRequired) {
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
                setMutationError('Der Speicherstand konnte nicht bestätigt werden. Bitte laden Sie die Unternehmensstruktur neu und prüfen Sie den Vorgang.');
            }
            return false;
        }
        finally {
            writeLock.current = false;
            if (alive.current)
                setBusy(false);
        }
    };
    const blocked = busy || loading || reloadRequired;
    async function changeView(next: CompanyOrganizationView) {
        if (!(await guard()) || !alive.current)
            return;
        setDialog(null);
        setDirty(false);
        setMutationError(null);
        setSearch('');
        setView(next);
        onViewChange?.(next);
    }
    async function close() { if (await confirmLeave() && alive.current) {
        setDialog(null);
        setDirty(false);
        setMutationError(null);
    } }
    function openDetail(kind: CompanyOrganizationKind, id: string) { if (!busy) {
        setMutationError(null);
        setDialog({ kind: 'detail', recordKind: kind, id });
    } }
    function edit(kind: CompanyOrganizationKind, record?: OrganizationRecord) {
        if (blocked || !permissions.manage || kind === 'entity' && !snapshot?.canManageEntities || kind === 'placement' && !permissions.managePlacements)
            return;
        setMutationError(null);
        setDirty(false);
        setDialog({ kind: 'edit', edit: organizationEditDialog(kind, record) });
    }
    async function archive(kind: CompanyOrganizationKind, record: OrganizationRecord) {
        if (blocked || !snapshot)
            return;
        const confirmed = await confirmAction({ title: 'Eintrag archivieren?', message: `„${organizationRecordTitle(snapshot, kind, record, permissions.viewEmployees)}“ wird aus der aktiven Übersicht genommen. Bestehende Verknüpfungen bleiben erhalten.`, confirmLabel: 'Archivieren', cancelLabel: 'Abbrechen' });
        if (!confirmed || !alive.current)
            return;
        const saved = await run(() => archiveCompanyOrganization(scope, kind, record.id, record.version), 'Der Eintrag wurde archiviert.');
        if (saved && alive.current)
            setDialog(null);
    }
    const frame = (content: ReactNode) => <NativeWorkspaceStyleScope css={[companyOrganizationCss, companyOrganizationCss]}>{<NativeSection className="cg-workspace" aria-label="Unternehmensorganisation" aria-busy={loading || busy}><NativeStyle>{companyOrganizationCss}</NativeStyle>{content}</NativeSection>}</NativeWorkspaceStyleScope>;
    if (!permissions.view)
        return frame(<Empty title="Kein Zugriff auf die Unternehmensstruktur" text="Für diese Ansicht fehlt die Unternehmensberechtigung." icon="shield"/>);
    if (!snapshot)
        return frame(<><NativeDiv className="cg-heading"><NativeDiv><NativeH2>Organisation</NativeH2><NativeP>Standorte, Gesellschaften und Zuständigkeiten verbinden.</NativeP></NativeDiv></NativeDiv>{loadError ? <Empty title="Unternehmensstruktur nicht verfügbar" text={loadError} icon="info"><NativeButton type="button" className="cg-button" disabled={loading} onClick={() => void reload()}>Erneut laden</NativeButton></Empty> : <Empty title="Organisation wird geladen …" text="Standorte, Abteilungen und Verknüpfungen werden abgerufen." icon="building"/>}</>);
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
    const resultEmpty = <Empty icon={activeView.icon} title={search || status !== 'current' || entityFilter !== 'all' ? 'Keine passenden Einträge' : `Noch keine ${activeView.label}`} text={search || status !== 'current' || entityFilter !== 'all' ? 'Ändern Sie die Suche oder die Filter, um weitere Einträge anzuzeigen.' : activeView.description}>{search || status !== 'current' || entityFilter !== 'all' ? <NativeButton type="button" className="cg-button" onClick={() => { setSearch(''); setStatus('current'); setEntityFilter('all'); }}>Filter zurücksetzen</NativeButton> : createAllowed && <NativeButton type="button" className="cg-button cg-button--primary" disabled={blocked} onClick={() => edit(activeView.kind)}><CompanyIcon name="plus" size={17}/>{activeView.add}</NativeButton>}</Empty>;
    return frame(<>
    <NativeDiv className="cg-heading"><NativeDiv><NativeSpan className="cg-eyebrow">Struktur & Verantwortung</NativeSpan><NativeH2>Ihr Unternehmen. Gut verbunden.</NativeH2><NativeP>Standorte, Gesellschaften und Teams mit klaren Zuständigkeiten verwalten.</NativeP></NativeDiv><NativeDiv className="cg-actions"><NativeButton type="button" className="cg-button cg-button--quiet" disabled={busy || loading} onClick={() => void reload()}><CompanyIcon name="refresh" size={16}/>{loading ? 'Wird geladen …' : 'Aktualisieren'}</NativeButton>{createAllowed && <NativeButton type="button" className="cg-button cg-button--primary" disabled={blocked} onClick={() => edit(activeView.kind)}><CompanyIcon name="plus" size={17}/>{activeView.add}</NativeButton>}</NativeDiv></NativeDiv>
    {notice && <NativeDiv className={`cg-banner cg-banner--${notice.error ? 'error' : 'success'}`} role="status"><CompanyIcon name={notice.error ? 'info' : 'check'} size={18}/><NativeDiv>{notice.text}</NativeDiv><NativeButton type="button" className="cg-text-button" aria-label="Hinweis schließen" onClick={() => setNotice(null)}><CompanyIcon name="close" size={16}/></NativeButton></NativeDiv>}
    {(loadError || mutationError && dialog?.kind !== 'edit') && <NativeDiv className="cg-banner cg-banner--error" role="alert"><CompanyIcon name="info" size={19}/><NativeDiv><NativeStrong>{loadError ? 'Aktualisierung fehlgeschlagen' : 'Änderung nicht bestätigt'}</NativeStrong><NativeP>{loadError ?? mutationError}</NativeP>{reloadRequired && <NativeDiv className="cg-actions"><NativeButton type="button" className="cg-button" disabled={busy || loading} onClick={() => void reload()}>Aktuellen Stand laden</NativeButton></NativeDiv>}</NativeDiv></NativeDiv>}
    {limited && <NativeDiv className="cg-banner" role="status"><CompanyIcon name="shield" size={19}/><NativeDiv>Sie verwalten die für Sie freigegebenen Standorte und Organisationsbereiche. Übergreifende Gesellschaftsdaten und Zugriffsrechte bleiben bei der Unternehmensadministration.</NativeDiv></NativeDiv>}
    <NativeDiv className="cg-metrics"><Metric label="Standorte" value={count('sites')} note="Aktive Arbeits- und Leistungsorte" icon="pin" onClick={() => void changeView('sites')}/><Metric label="Abteilungen" value={count('departments')} note="Organisatorische Einheiten" icon="grid" onClick={() => void changeView('departments')}/><Metric label="Gesellschaften" value={count('entities')} note="Zusätzlich zum Hauptunternehmen" icon="building" onClick={() => void changeView('entities')}/>{permissions.viewEmployees && snapshot.employeesVisible ? <Metric label="Personal zugeordnet" value={new Set(activePlacements.map(placement => placement.employeeId)).size} note="Personen mit aktueller Zuordnung" icon="people" onClick={() => void changeView('placements')}/> : <Metric label="Beziehungen" value={count('relationships')} note="Aktive Beteiligungen und Partnerschaften" icon="transfer" onClick={() => void changeView('relationships')}/>}</NativeDiv>
    <NativeNav className="cg-tabs" aria-label="Organisation"><>{availableViews.map(tab => <NativeButton type="button" key={tab.id} aria-pressed={!accessActive && activeView.id === tab.id} onClick={() => void changeView(tab.id)}><CompanyIcon name={tab.icon} size={16}/>{tab.label}<NativeSmall>{count(tab.id)}</NativeSmall></NativeButton>)}{canManageScopes && !limited && <NativeButton type="button" aria-pressed={accessActive} onClick={() => void changeView('access')}><CompanyIcon name="shield" size={16}/>Zugriffe</NativeButton>}</></NativeNav>
    {accessActive ? accessContent : <>
    <NativeDiv className="cg-toolbar"><NativeLabel className="cg-search"><CompanyIcon name="search" size={18}/><NativeInput aria-label="Organisation durchsuchen" placeholder={`${activeView.label} durchsuchen …`} value={search} onChange={event => setSearch(event.target.value)}/></NativeLabel>{activeView.id !== 'entities' && <NativeLabel className="cg-filter"><NativeSpan>Gesellschaft</NativeSpan><NativeSelect value={entityFilter} onChange={event => setEntityFilter(event.target.value)}><NativeOption value="all">Alle Gesellschaften</NativeOption><NativeOption value="main">Hauptunternehmen</NativeOption>{snapshot.entities.map(entity => <NativeOption key={entity.id} value={entity.id}>{entity.name}</NativeOption>)}</NativeSelect></NativeLabel>}<NativeLabel className="cg-filter"><NativeSpan>Status</NativeSpan><NativeSelect value={status} onChange={event => setStatus(event.target.value)}><NativeOption value="current">Aktiv & inaktiv</NativeOption><NativeOption value="active">Aktiv</NativeOption><NativeOption value="inactive">Inaktiv</NativeOption><NativeOption value="archived">Archiviert</NativeOption><NativeOption value="all">Alle Einträge</NativeOption></NativeSelect></NativeLabel></NativeDiv>
    <NativeDiv className="cg-results"><NativeSpan>{filteredCounts[activeView.id]} {filteredCounts[activeView.id] === 1 ? 'Eintrag' : 'Einträge'}</NativeSpan><NativeSpan>{activeView.description}</NativeSpan></NativeDiv>
    {!filteredCounts[activeView.id] ? resultEmpty : <>
      {activeView.id === 'sites' && <NativeDiv className="cg-grid">{sites.map(site => <Card key={site.id} record={site} icon="pin" title={site.name} subtitle={`${SITE_KINDS[site.kind]}${site.code ? ` · ${site.code}` : ''}`} onOpen={() => openDetail('site', site.id)} onEdit={permissions.manage ? () => edit('site', site) : undefined} blocked={blocked} count={`${activePlacements.filter(placement => placement.siteId === site.id).length} aktuelle Zuordnungen`}><Data label="Gesellschaft" value={entityName(site.entityId)}/><Data label="Adresse" value={[site.street, [site.postalCode, site.city].filter(Boolean).join(' ')].filter(Boolean).join('\n') || 'Noch keine Adresse'}/><Data label="Leitung" value={person(site.leaderEmployeeId)}/><Data label="Kontakt" value={site.phone || site.email || 'Noch kein Kontakt'}/></Card>)}</NativeDiv>}
      {activeView.id === 'departments' && <NativeDiv className="cg-grid">{departments.map(department => <Card key={department.id} record={department} icon="grid" title={department.name} subtitle={department.code || entityName(department.entityId)} onOpen={() => openDetail('department', department.id)} onEdit={permissions.manage ? () => edit('department', department) : undefined} blocked={blocked} count={`${activePlacements.filter(placement => placement.departmentId === department.id).length} aktuelle Zuordnungen`}><Data label="Standort" value={siteName(department.siteId)}/><Data label="Leitung" value={person(department.leaderEmployeeId)}/><Data label="Übergeordnet" value={department.parentDepartmentId ? departmentName(department.parentDepartmentId) : 'Eigenständige Abteilung'}/><Data label="Kontakt" value={department.email || department.phone || 'Noch kein Kontakt'}/></Card>)}</NativeDiv>}
      {activeView.id === 'entities' && <NativeDiv className="cg-grid">{entities.map(entity => <Card key={entity.id} record={entity} icon="building" title={entity.name} subtitle={[entity.legalForm, entity.code].filter(Boolean).join(' · ') || 'Gesellschaft'} onOpen={() => openDetail('entity', entity.id)} onEdit={permissions.manage && snapshot.canManageEntities ? () => edit('entity', entity) : undefined} blocked={blocked} count={`${snapshot.sites.filter(site => site.entityId === entity.id && site.status === 'active').length} aktive Standorte`}><Data label="Sitz" value={[entity.postalCode, entity.city].filter(Boolean).join(' ') || 'Noch kein Sitz hinterlegt'}/><Data label="Übergeordnet" value={entity.parentEntityId ? entityName(entity.parentEntityId) : 'Keine übergeordnete Gesellschaft'}/><Data label="Leitung" value={person(entity.leaderEmployeeId)}/><Data label="Register" value={entity.registrationNumber || 'Nicht hinterlegt'}/></Card>)}</NativeDiv>}
      {activeView.id === 'relationships' && <NativeDiv className="cg-grid">{relationships.map(relationship => <NativeArticle className="cg-card" key={relationship.id}><NativeDiv className="cg-card-head"><NativeSpan className="cg-icon"><CompanyIcon name="transfer"/></NativeSpan><NativeDiv><NativeH3><NativeButton type="button" className="cg-card-name" onClick={() => openDetail('relationship', relationship.id)}>{relationship.partnerName}</NativeButton></NativeH3><NativeP>{RELATIONSHIP_KINDS[relationship.kind]}</NativeP></NativeDiv><Badge record={relationship}/></NativeDiv><NativeDiv className="cg-connection"><NativeDiv><NativeSmall>Ausgangsgesellschaft</NativeSmall>{entityName(relationship.entityId)}</NativeDiv><CompanyIcon name="arrow" size={20}/><NativeDiv><NativeSmall>Vertragspartner</NativeSmall>{relationship.partnerName}</NativeDiv></NativeDiv><NativeDl><Data label="Gebiet" value={relationship.territory || 'Kein Gebiet hinterlegt'}/><Data label="Beteiligung" value={relationship.ownershipPercent !== null ? `${relationship.ownershipPercent.toLocaleString('de-DE')} %` : 'Keine Beteiligung hinterlegt'}/><Data label="Vertrag" value={relationship.contractReference || 'Nicht hinterlegt'}/><Data label="Laufzeit" value={relationship.startsOn || relationship.endsOn ? `${relationship.startsOn ? organizationDate(relationship.startsOn) : 'Offener Beginn'} – ${relationship.endsOn ? organizationDate(relationship.endsOn) : 'unbefristet'}` : 'Nicht hinterlegt'}/></NativeDl><NativeDiv className="cg-card-footer"><NativeButton type="button" className="cg-text-button" onClick={() => openDetail('relationship', relationship.id)}>Details ansehen <CompanyIcon name="arrow" size={14}/></NativeButton>{permissions.manage && <NativeButton type="button" className="cg-button cg-button--quiet" disabled={blocked} onClick={() => edit('relationship', relationship)}>Bearbeiten</NativeButton>}</NativeDiv></NativeArticle>)}</NativeDiv>}
      {activeView.id === 'placements' && <NativeDiv className="cg-table-shell"><NativeTable className="cg-table"><NativeColgroup><NativeCol style={{ width: '24%' }}/><NativeCol style={{ width: '27%' }}/><NativeCol style={{ width: '23%' }}/><NativeCol style={{ width: '14%' }}/><NativeCol style={{ width: '12%' }}/></NativeColgroup><NativeThead><NativeTr><NativeTh>Person</NativeTh><NativeTh>Zuordnung</NativeTh><NativeTh>Zeitraum</NativeTh><NativeTh>Umfang</NativeTh><NativeTh>Aktion</NativeTh></NativeTr></NativeThead><NativeTbody>{placements.map(placement => <NativeTr key={placement.id}><NativeTd><NativeDiv className="cg-person"><NativeSpan className="cg-avatar">{person(placement.employeeId).split(' ').slice(0, 2).map(part => part[0]).join('')}</NativeSpan><NativeDiv><NativeButton type="button" className="cg-text-button" onClick={() => openDetail('placement', placement.id)}>{person(placement.employeeId)}</NativeButton><NativeSmall>{placement.roleTitle || 'Keine Funktion hinterlegt'}</NativeSmall></NativeDiv></NativeDiv></NativeTd><NativeTd>{siteName(placement.siteId)}<NativeSmall>{departmentName(placement.departmentId)}</NativeSmall><NativeSmall>{entityName(placement.entityId)}</NativeSmall></NativeTd><NativeTd>{organizationDate(placement.startsOn)} – {placement.endsOn ? organizationDate(placement.endsOn) : 'unbefristet'}<NativeSmall>{placementPeriod(placement)}</NativeSmall></NativeTd><NativeTd>{placement.allocationPercent === null ? 'Nicht festgelegt' : `${placement.allocationPercent.toLocaleString('de-DE')} %`}{placement.isPrimary && <NativeSmall><NativeSpan className="cg-badge">Hauptzuordnung</NativeSpan></NativeSmall>}</NativeTd><NativeTd>{permissions.managePlacements ? <NativeButton type="button" className="cg-button cg-button--quiet" disabled={blocked} onClick={() => edit('placement', placement)}>Bearbeiten</NativeButton> : <NativeButton type="button" className="cg-text-button" onClick={() => openDetail('placement', placement.id)}>Details</NativeButton>}</NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv>}
    </>}
    </>}
    {dialog?.kind === 'edit' && <CompanyOrganizationEditor key={`${dialog.edit.kind}:${dialog.edit.record?.id ?? 'new'}`} dialog={dialog.edit} scope={scope} snapshot={snapshot} permissions={permissions} busy={busy} blocked={reloadRequired} error={mutationError} run={run} onDirtyChange={setDirty} onClose={() => void close()} onSaved={() => { setDialog(null); setDirty(false); }} onReload={reload}/>}
    {dialog?.kind === 'detail' && <PlatformModal visible surfaceScope="company" title={detail ? organizationRecordTitle(snapshot, dialog.recordKind, detail, permissions.viewEmployees) : 'Eintrag nicht verfügbar'} subtitle="Unternehmensorganisation" onClose={() => void close()} dismissOnBackdrop={!busy} maxWidth={850} minWidth={260} maxHeightRatio={0.93} bodyStyle={{ backgroundColor: '#f4f8fd', padding: 22 }} sheetStyle={{ backgroundColor: '#f4f8fd' }} footerContent={<NativeDiv className="cg-dialog cg-form-footer"><NativeSpan>{detail ? `Zuletzt geändert am ${organizationDate(detail.updatedAt)}` : 'Bitte die Übersicht aktualisieren.'}</NativeSpan><NativeDiv className="cg-actions">{detail && permissions.manage && (dialog.recordKind !== 'entity' || snapshot.canManageEntities) && (dialog.recordKind !== 'placement' || permissions.managePlacements) && <><NativeButton type="button" className="cg-button cg-button--quiet" disabled={blocked} onClick={() => edit(dialog.recordKind, detail)}>{detail.status === 'archived' ? 'Bearbeiten & reaktivieren' : 'Bearbeiten'}</NativeButton>{detail.status !== 'archived' && <NativeButton type="button" className="cg-button cg-button--danger" disabled={blocked} onClick={() => void archive(dialog.recordKind, detail)}>Archivieren</NativeButton>}</>}<NativeButton type="button" className="cg-button" disabled={busy} onClick={() => void close()}>Schließen</NativeButton></NativeDiv></NativeDiv>}><NativeStyle>{companyOrganizationCss}</NativeStyle><NativeDiv className="cg-dialog">{mutationError && <NativeDiv className="cg-banner cg-banner--error" role="alert">{mutationError}</NativeDiv>}{detail ? <OrganizationDetails snapshot={snapshot} kind={dialog.recordKind} record={detail} employeeAccess={permissions.viewEmployees} onOpen={openDetail}/> : <Empty icon="info" title="Dieser Eintrag ist nicht mehr verfügbar" text="Schließen Sie die Ansicht und laden Sie die Unternehmensstruktur erneut."/>}</NativeDiv></PlatformModal>}
  </>);
}
function Empty({ icon, title, text, children }: {
    icon: string;
    title: string;
    text: string;
    children?: ReactNode;
}) { return <NativeWorkspaceStyleScope css={[companyOrganizationCss]}>{<NativeDiv className="cg-empty"><CompanyIcon name={icon} size={30}/><NativeH3>{title}</NativeH3><NativeP>{text}</NativeP>{children && <NativeDiv className="cg-actions">{children}</NativeDiv>}</NativeDiv>}</NativeWorkspaceStyleScope>; }
function Metric({ icon, label, value, note, onClick }: {
    icon: string;
    label: string;
    value: number;
    note: string;
    onClick: () => void;
}) { return <NativeWorkspaceStyleScope css={[companyOrganizationCss]}>{<NativeButton type="button" className="cg-metric" onClick={onClick}><NativeSpan><CompanyIcon name={icon} size={16}/>{label}</NativeSpan><NativeStrong>{value}</NativeStrong><NativeSmall>{note}</NativeSmall></NativeButton>}</NativeWorkspaceStyleScope>; }
function Badge({ record }: {
    record: OrganizationRecord;
}) { return <NativeWorkspaceStyleScope css={[companyOrganizationCss]}>{<NativeSpan className={`cg-badge cg-badge--${record.status}`}>{ORGANIZATION_STATUS[record.status]}</NativeSpan>}</NativeWorkspaceStyleScope>; }
function Data({ label, value }: {
    label: string;
    value: ReactNode;
}) { return <NativeWorkspaceStyleScope css={[companyOrganizationCss]}>{<NativeDiv><NativeDt>{label}</NativeDt><NativeDd>{value || 'Nicht hinterlegt'}</NativeDd></NativeDiv>}</NativeWorkspaceStyleScope>; }
function Card({ record, icon, title, subtitle, count, onOpen, onEdit, blocked, children }: {
    record: OrganizationRecord;
    icon: string;
    title: string;
    subtitle: string;
    count: string;
    onOpen: () => void;
    onEdit?: () => void;
    blocked: boolean;
    children: ReactNode;
}) {
    return <NativeWorkspaceStyleScope css={[companyOrganizationCss]}>{<NativeArticle className="cg-card"><NativeDiv className="cg-card-head"><NativeSpan className="cg-icon"><CompanyIcon name={icon}/></NativeSpan><NativeDiv><NativeH3><NativeButton type="button" className="cg-card-name" onClick={onOpen}>{title}</NativeButton></NativeH3><NativeP>{subtitle}</NativeP></NativeDiv><Badge record={record}/></NativeDiv><NativeDl>{children}</NativeDl><NativeDiv className="cg-card-footer"><NativeSpan>{count}</NativeSpan><NativeDiv className="cg-actions"><NativeButton type="button" className="cg-text-button" onClick={onOpen}>Details <CompanyIcon name="arrow" size={14}/></NativeButton>{onEdit && <NativeButton type="button" className="cg-button cg-button--quiet" disabled={blocked} onClick={onEdit}>Bearbeiten</NativeButton>}</NativeDiv></NativeDiv></NativeArticle>}</NativeWorkspaceStyleScope>;
}
function OrganizationDetails({ snapshot, kind, record, employeeAccess, onOpen }: {
    snapshot: CompanyOrganizationSnapshot;
    kind: CompanyOrganizationKind;
    record: OrganizationRecord;
    employeeAccess: boolean;
    onOpen: (kind: CompanyOrganizationKind, id: string) => void;
}) {
    const entity = record as CompanyLegalEntity;
    const site = record as CompanySite;
    const department = record as CompanyDepartment;
    const placement = record as CompanyEmployeePlacement;
    const relationship = record as CompanyRelationship;
    const named = kind === 'entity' || kind === 'site' || kind === 'department';
    const link = (targetKind: CompanyOrganizationKind, id: string | null | undefined, fallback: string) => {
        const target = id ? organizationRecordById(snapshot, targetKind, id) : undefined;
        return target ? <NativeButton type="button" className="cg-text-button" onClick={() => onOpen(targetKind, target.id)}>{organizationRecordTitle(snapshot, targetKind, target, employeeAccess)}</NativeButton> : fallback;
    };
    const relatedSites = kind === 'entity' ? snapshot.sites.filter(entry => entry.entityId === record.id) : [];
    const relatedDepartments = snapshot.departments.filter(entry => kind === 'entity' ? entry.entityId === record.id : kind === 'site' ? entry.siteId === record.id : kind === 'department' && entry.parentDepartmentId === record.id);
    const relatedPlacements = employeeAccess && snapshot.employeesVisible ? snapshot.placements.filter(entry => kind === 'entity' ? entry.entityId === record.id : kind === 'site' ? entry.siteId === record.id : kind === 'department' && entry.departmentId === record.id) : [];
    const events = snapshot.audit.filter(entry => entry.kind === kind && entry.recordId === record.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return <NativeWorkspaceStyleScope css={[companyOrganizationCss]}>{<><NativeDiv className="cg-detail-heading"><NativeSpan className="cg-icon"><CompanyIcon name={ORGANIZATION_VIEWS.find(view => view.kind === kind)?.icon ?? 'building'} size={24}/></NativeSpan><NativeDiv><NativeH3>{organizationRecordTitle(snapshot, kind, record, employeeAccess)}</NativeH3><NativeP>{kind === 'relationship' ? RELATIONSHIP_KINDS[relationship.kind] : kind === 'site' ? SITE_KINDS[site.kind] : kind === 'placement' ? placement.roleTitle || 'Organisatorische Zuordnung' : named ? entity.code || 'Unternehmensstruktur' : ''}</NativeP></NativeDiv><Badge record={record}/></NativeDiv><NativeDl className="cg-details">
    {kind !== 'entity' && <Data label="Gesellschaft" value={link('entity', site.entityId, 'Hauptunternehmen')}/>}
    {named && <Data label="Leitung" value={organizationPersonName(snapshot, entity.leaderEmployeeId, employeeAccess)}/>}
    {(kind === 'entity' || kind === 'site') && <><Data label="Adresse" value={[entity.street, [entity.postalCode, entity.city].filter(Boolean).join(' '), entity.country].filter(Boolean).join('\n')}/>{kind === 'site' && <Data label="Erreichbarkeit" value={site.openingHours}/>}</>}
    {kind === 'entity' && <><Data label="Rechtsform" value={entity.legalForm}/><Data label="Übergeordnete Gesellschaft" value={link('entity', entity.parentEntityId, 'Keine übergeordnete Gesellschaft')}/><Data label="Register" value={entity.registrationNumber}/><Data label="Steuernummer" value={entity.taxNumber}/><Data label="Umsatzsteuer-ID" value={entity.vatId}/><Data label="Website" value={entity.website}/></>}
    {kind === 'department' && <><Data label="Standort" value={link('site', department.siteId, 'Standortübergreifend')}/><Data label="Übergeordnete Abteilung" value={link('department', department.parentDepartmentId, 'Eigenständige Abteilung')}/></>}
    {(kind === 'site' || kind === 'department') && <Data label="Kostenstelle" value={snapshot.costCenters.find(entry => entry.id === site.costCenterId)?.name ?? 'Keine Kostenstelle zugeordnet'}/>}
    {kind !== 'placement' && <><Data label="Ansprechperson" value={entity.contactName}/><Data label="E-Mail" value={entity.email ? <NativeA className="cg-text-button" href={`mailto:${entity.email}`}>{entity.email}</NativeA> : null}/><Data label="Telefon" value={entity.phone ? <NativeA className="cg-text-button" href={`tel:${entity.phone.replace(/[^+\d]/g, '')}`}>{entity.phone}</NativeA> : null}/></>}
    {kind === 'placement' && <><Data label="Standort" value={link('site', placement.siteId, 'Standortübergreifend')}/><Data label="Abteilung" value={link('department', placement.departmentId, 'Keine Abteilung zugeordnet')}/><Data label="Gültig ab" value={organizationDate(placement.startsOn)}/><Data label="Gültig bis" value={placement.endsOn ? organizationDate(placement.endsOn) : 'Unbefristet'}/><Data label="Anteil" value={placement.allocationPercent === null ? 'Nicht festgelegt' : `${placement.allocationPercent.toLocaleString('de-DE')} %`}/><Data label="Zuordnungsart" value={placement.isPrimary ? 'Hauptzuordnung' : 'Weitere Zuordnung'}/><Data label="Zeitraumstatus" value={placementPeriod(placement)}/></>}
    {kind === 'relationship' && <><Data label="Partner" value={link('entity', relationship.partnerEntityId, relationship.partnerName)}/><Data label="Gebiet / Region" value={relationship.territory}/><Data label="Beteiligung" value={relationship.ownershipPercent !== null ? `${relationship.ownershipPercent.toLocaleString('de-DE')} %` : 'Nicht hinterlegt'}/><Data label="Beginn" value={relationship.startsOn ? organizationDate(relationship.startsOn) : 'Nicht hinterlegt'}/><Data label="Ende" value={relationship.endsOn ? organizationDate(relationship.endsOn) : 'Unbefristet / nicht hinterlegt'}/><Data label="Vertrag / Aktenzeichen" value={relationship.contractReference}/><Data label="Aufgaben und Zuständigkeiten" value={relationship.responsibilities}/></>}
    <Data label="Interne Hinweise" value={entity.notes}/>
  </NativeDl>{(relatedSites.length > 0 || relatedDepartments.length > 0 || relatedPlacements.length > 0) && <NativeSection className="cg-detail-section"><NativeH3>Verknüpfte Einträge</NativeH3><NativeDiv className="cg-linked-list">{relatedSites.map(entry => <NativeButton type="button" key={entry.id} onClick={() => onOpen('site', entry.id)}><NativeSpan>{entry.name}<NativeSmall>Standort · {ORGANIZATION_STATUS[entry.status]}</NativeSmall></NativeSpan><CompanyIcon name="arrow" size={16}/></NativeButton>)}{relatedDepartments.map(entry => <NativeButton type="button" key={entry.id} onClick={() => onOpen('department', entry.id)}><NativeSpan>{entry.name}<NativeSmall>Abteilung · {ORGANIZATION_STATUS[entry.status]}</NativeSmall></NativeSpan><CompanyIcon name="arrow" size={16}/></NativeButton>)}{relatedPlacements.map(entry => <NativeButton type="button" key={entry.id} onClick={() => onOpen('placement', entry.id)}><NativeSpan>{organizationPersonName(snapshot, entry.employeeId, employeeAccess)}<NativeSmall>{entry.roleTitle || 'Personalzuordnung'} · {placementPeriod(entry)}</NativeSmall></NativeSpan><CompanyIcon name="arrow" size={16}/></NativeButton>)}</NativeDiv></NativeSection>}{events.length > 0 && <NativeSection className="cg-detail-section"><NativeH3>Änderungsverlauf</NativeH3><NativeDiv className="cg-linked-list">{events.map(event => <NativeP key={event.id} className="cg-note">{organizationDate(event.createdAt)} · {({ created: 'Angelegt', updated: 'Bearbeitet', archived: 'Archiviert', restored: 'Reaktiviert' })[event.action]}</NativeP>)}</NativeDiv></NativeSection>}</>}</NativeWorkspaceStyleScope>;
}
