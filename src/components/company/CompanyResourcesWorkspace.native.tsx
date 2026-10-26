// Generated native presentation from src/components/company/CompanyResourcesWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeH3,NativeP,NativeSection,NativeStyle,NativeButton,NativeSpan,NativeArticle,NativeSmall,NativeDl,NativeDt,NativeDd,NativeFooter,NativeH2,NativeNav,NativeLabel,NativeSelect,NativeOption,NativeOl,NativeLi,NativeTime,NativeStrong,NativeAside,NativeUl,NativeInput,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { shareNativeFile } from '@/lib/platform/nativeFileDelivery.native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import type { PermissionKey, RoleKey } from '@/types';
import type { CompanyAssetLink, CompanyContract, CompanyInsurancePolicy, CompanyResourceScope, CompanyResourcesSnapshot, CompanyVehicle } from '@/types/tenant/companyResources';
import { useAuth } from '@/lib/auth/context';
import { PlatformModal } from "../layout/platform/platformmodal.tsx";
import { confirmAction } from '@/lib/platform/confirmAction';
import { useUnsavedWebChanges } from "../../hooks/useUnsavedWebChanges.native.ts";
import { archiveCompanyResource, getCompanyResourcesPermissions, loadCompanyResources } from "../../lib/tenant/companyResourcesService.ts";
import { companyDocumentCatalogHref, downloadCompanyLinkedDocument } from "../../lib/documents/companyDocumentLinks.ts";
import { CompanyIcon } from "./CompanyWorkspaceView.native.tsx";
import { CompanyResourcesEditor, type ResourcesEditDialog, type RunResourceMutation } from "./CompanyResourcesDialogs.native.tsx";
import { COMPANY_RESOURCES_VIEWS, PAYMENT_LABELS, RESOURCE_STATUS, annualResourceCost, companyResourceDeadlines, deadlineDays, deadlineLabel, isAllocationOpen, resourceDate, resourceFields, resourceMatches, resourceMoney, type CompanyResourcesView, type ResourceRecord, type ResourceRecordKind } from "./companyResourcesModel.ts";
import { companyResourcesCss } from "./companyResourcesCss.native.ts";
export type { CompanyResourcesView } from "./companyResourcesModel.ts";
export type CompanyResourcesWorkspaceProps = {
    tenantId: string;
    roleKey: RoleKey | null;
    actorProfileId?: string | null;
    effectivePermissions?: readonly PermissionKey[];
    initialView?: CompanyResourcesView;
    initialItemId?: string;
    scopeLimited?: boolean;
    onViewChange?: (view: CompanyResourcesView) => void;
    onNavigationGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
};
type Dialog = ResourcesEditDialog | {
    kind: 'detail';
    resourceKind: ResourceRecordKind;
    id: string;
};
export function CompanyResourcesWorkspace(props: CompanyResourcesWorkspaceProps) {
    const permissionsKey = props.effectivePermissions ? [...props.effectivePermissions].sort().join(',') : 'role';
    return <NativeWorkspaceStyleScope key={`${props.tenantId}:${props.roleKey}:${props.actorProfileId ?? ''}:${permissionsKey}:${Boolean(props.scopeLimited)}`} css={[companyResourcesCss]}>{<ResourcesScope key={`${props.tenantId}:${props.roleKey}:${props.actorProfileId ?? ''}:${permissionsKey}:${Boolean(props.scopeLimited)}`} {...props}/>}</NativeWorkspaceStyleScope>;
}
function ResourcesScope({ tenantId, roleKey, effectivePermissions, initialView = 'overview', initialItemId, scopeLimited, onViewChange, onNavigationGuardChange }: CompanyResourcesWorkspaceProps) {
    const router = useRouter();
    const { profile } = useAuth();
    const requestScope = useMemo<CompanyResourceScope>(() => ({ tenantId, actorRoleKey: roleKey, effectivePermissions }), [tenantId, roleKey, effectivePermissions]);
    const [snapshot, setSnapshot] = useState<CompanyResourcesSnapshot | null>(null);
    const [view, setView] = useState(initialView);
    const limited = Boolean(scopeLimited || snapshot?.scopeLimited);
    const scope = useMemo<CompanyResourceScope>(() => ({ ...requestScope, effectivePermissions: (snapshot?.permissions ?? effectivePermissions)?.filter(permission => !limited || permission !== 'office.documents.view') }), [requestScope, snapshot?.permissions, effectivePermissions, limited]);
    const permissions = useMemo(() => getCompanyResourcesPermissions(scope), [scope]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [reloadRequired, setReloadRequired] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const [dirty, setDirty] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('current');
    const [entityFilter, setEntityFilter] = useState('');
    const [siteFilter, setSiteFilter] = useState('');
    const [deadlineFilter, setDeadlineFilter] = useState('60');
    const alive = useRef(true);
    const sequence = useRef(0);
    const writeLock = useRef(false);
    const recovery = useRef(false);
    const initialItemOpened = useRef<string | null>(null);
    const confirmLeave = useUnsavedWebChanges(dirty, busy);
    useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current += 1; }; }, []);
    useEffect(() => { setView(initialView); }, [initialView]);
    useEffect(() => { onNavigationGuardChange?.(confirmLeave); return () => onNavigationGuardChange?.(null); }, [confirmLeave, onNavigationGuardChange]);
    const reload = useCallback(async () => {
        const current = ++sequence.current;
        setLoading(true);
        setLoadError(null);
        try {
            const result = await loadCompanyResources(requestScope);
            if (!alive.current || current !== sequence.current)
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
                setNotice('Aktueller Stand geladen. Bitte prüfen Sie den letzten Vorgang. Der bisherige Entwurf wurde geschlossen.');
            }
            return true;
        }
        catch {
            if (alive.current && current === sequence.current)
                setLoadError('Die Unternehmensressourcen konnten nicht geladen werden. Bitte versuchen Sie es erneut.');
            return false;
        }
        finally {
            if (alive.current && current === sequence.current)
                setLoading(false);
        }
    }, [requestScope]);
    useEffect(() => { void reload(); }, [reload]);
    useEffect(() => {
        if (!snapshot || !initialItemId || initialItemOpened.current === initialItemId || !permissions.manage || !permissions.viewInventory)
            return;
        initialItemOpened.current = initialItemId;
        const item = snapshot.inventoryItems.find(row => row.id === initialItemId);
        if (!item) {
            setNotice('Der verlinkte Inventareintrag ist nicht verfügbar oder für Sie nicht freigegeben.');
            return;
        }
        setView('assets');
        setDialog({ kind: 'asset', initialItemId, asset: snapshot.assetLinks.find(row => row.inventoryItemId === initialItemId && row.status === 'active') });
    }, [snapshot, initialItemId, permissions.manage, permissions.viewInventory]);
    const run: RunResourceMutation = async (operation, message) => {
        if (!alive.current || writeLock.current || recovery.current || loading)
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
                if (result.reloadRequired || result.conflict) {
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
                setNotice(`${message} Die aktualisierte Liste konnte noch nicht geladen werden.`);
            }
            else
                setNotice(message);
            return true;
        }
        catch {
            if (alive.current) {
                recovery.current = true;
                setReloadRequired(true);
                setMutationError('Der Speicherstand konnte nicht bestätigt werden. Bitte neu laden und den Vorgang prüfen.');
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
    async function switchView(next: CompanyResourcesView) { if (!(await confirmLeave()) || !alive.current)
        return; setDialog(null); setDirty(false); setSearch(''); setStatusFilter('current'); setView(next); setMutationError(null); onViewChange?.(next); }
    async function open(next: Dialog) { if (blocked || !(await confirmLeave()) || !alive.current)
        return; setDirty(false); setMutationError(null); setDialog(next); }
    async function close() { if (!(await confirmLeave()) || !alive.current)
        return; setDialog(null); setDirty(false); setMutationError(null); }
    function saved() { setDialog(null); setDirty(false); }
    async function refresh() { if (!(await confirmLeave()) || !alive.current)
        return; setDialog(null); setDirty(false); await reload(); }
    async function archive(kind: ResourceRecordKind | 'asset', record: ResourceRecord | CompanyAssetLink) {
        if (blocked)
            return;
        const accepted = await confirmAction({ title: 'Eintrag archivieren', message: 'Der Eintrag bleibt mit seinem Verlauf erhalten und wird aus den aktiven Übersichten ausgeblendet.', confirmLabel: 'Archivieren', cancelLabel: 'Abbrechen' });
        if (accepted && alive.current && await run(() => archiveCompanyResource(scope, kind, record.id, record.version), 'Eintrag wurde archiviert.'))
            saved();
    }
    async function download(documentId: string) {
        if (blocked || writeLock.current)
            return;
        writeLock.current = true;
        setBusy(true);
        setMutationError(null);
        try {
            const result = await downloadCompanyLinkedDocument({ tenantId, roleKey, profile, effectivePermissions }, documentId);
            if (!alive.current)
                return;
            if (!result.ok) {
                setMutationError(result.error);
                return;
            }
            await shareNativeFile(new Uint8Array(result.data.bytes), result.data.fileName, result.data.mimeType);
        }
        catch {
            if (alive.current)
                setMutationError('Die Unterlage konnte nicht heruntergeladen werden. Bitte erneut versuchen.');
        }
        finally {
            writeLock.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    const empty = (title: string, text: string, icon = 'building', children?: ReactNode) => <NativeDiv className="cr-empty"><CompanyIcon name={icon} size={30}/><NativeH3>{title}</NativeH3><NativeP>{text}</NativeP>{children}</NativeDiv>;
    if (!permissions.view)
        return <NativeWorkspaceStyleScope css={[companyResourcesCss, companyResourcesCss]}>{<NativeSection className="cr-workspace"><NativeStyle>{companyResourcesCss}</NativeStyle>{empty('Kein Zugriff auf Unternehmensressourcen', 'Für diesen Bereich fehlt die Berechtigung zur Unternehmensverwaltung.', 'shield')}</NativeSection>}</NativeWorkspaceStyleScope>;
    if (!snapshot)
        return <NativeWorkspaceStyleScope css={[companyResourcesCss, companyResourcesCss]}>{<NativeSection className="cr-workspace" aria-busy={loading}><NativeStyle>{companyResourcesCss}</NativeStyle>{loadError ? empty('Unternehmensressourcen nicht verfügbar', loadError, 'info', <NativeButton type="button" className="cr-button" disabled={loading} onClick={() => void reload()}>Erneut laden</NativeButton>) : <NativeDiv role="status">{empty('Unternehmensressourcen werden geladen …', 'Versicherungen, Verträge, Fuhrpark und Zuordnungen werden abgerufen.', 'refresh')}</NativeDiv>}</NativeSection>}</NativeWorkspaceStyleScope>;
    const label = (rows: {
        id: string;
        label: string;
    }[], id: string | null) => id ? rows.find(row => row.id === id)?.label ?? 'Zuordnung nicht verfügbar' : 'Nicht zugeordnet';
    const person = (id: string | null) => { if (!id)
        return 'Nicht zugeordnet'; if (!permissions.viewEmployees || !snapshot.employeesVisible)
        return 'Personaldaten geschützt'; const row = snapshot.employees.find(entry => entry.id === id); return row ? `${row.firstName} ${row.lastName}` : 'Person nicht mehr verfügbar'; };
    const placement = (record: {
        entityId: string | null;
        siteId: string | null;
        departmentId: string | null;
    }) => [record.entityId ? label(snapshot.entities, record.entityId) : null, record.siteId ? label(snapshot.sites, record.siteId) : null, record.departmentId ? label(snapshot.departments, record.departmentId) : null].filter(Boolean).join(' · ') || 'Unternehmensweit';
    const vehicleInUse = (id: string) => snapshot.allocations.some(row => row.vehicleId === id && row.status === 'active');
    const openAllocations = snapshot.allocations.filter(row => isAllocationOpen(row.status));
    const deadlines = companyResourceDeadlines(snapshot);
    const urgent = deadlines.filter(row => deadlineDays(row.dueOn) <= 60);
    const dueRows = deadlines.filter(row => deadlineFilter === 'all' || (deadlineFilter === 'overdue' ? row.overdue : deadlineDays(row.dueOn) <= Number(deadlineFilter)));
    const activePolicies = snapshot.policies.filter(row => row.status === 'active');
    const activeContracts = snapshot.contracts.filter(row => row.status === 'active');
    const activeVehicles = snapshot.vehicles.filter(row => row.status !== 'archived');
    const recordPlacementMatches = (record: {
        entityId: string | null;
        siteId: string | null;
        status: string;
    }) => (!entityFilter || record.entityId === entityFilter) && (!siteFilter || record.siteId === siteFilter) && (statusFilter === 'all' || (statusFilter === 'current' ? record.status !== 'archived' : record.status === statusFilter));
    const policies = snapshot.policies.filter(row => recordPlacementMatches(row) && resourceMatches(search, [row.title, row.provider, row.policyNumber, row.insuranceType, placement(row)]));
    const contracts = snapshot.contracts.filter(row => recordPlacementMatches(row) && resourceMatches(search, [row.title, row.counterparty, row.reference, row.contractType, placement(row)]));
    const vehicles = snapshot.vehicles.filter(row => recordPlacementMatches(row) && resourceMatches(search, [row.plate, row.make, row.model, row.vin, row.vehicleType, placement(row)]));
    const assets = snapshot.assetLinks.filter(row => recordPlacementMatches(row) && resourceMatches(search, [label(snapshot.inventoryItems, row.inventoryItemId), row.vehicleId ? snapshot.vehicles.find(vehicle => vehicle.id === row.vehicleId)?.plate : null, placement(row)]));
    const newKind = view === 'insurance' ? 'insurance' : view === 'contracts' ? 'contract' : view === 'fleet' ? 'vehicle' : view === 'assets' ? 'asset' : null;
    const newLabel = view === 'insurance' ? 'Versicherung anlegen' : view === 'contracts' ? 'Vertrag anlegen' : view === 'fleet' ? 'Fahrzeug anlegen' : 'Inventar zuordnen';
    const counts: Record<CompanyResourcesView, number> = { overview: urgent.length, insurance: snapshot.policies.filter(row => row.status !== 'archived').length, contracts: snapshot.contracts.filter(row => row.status !== 'archived').length, fleet: activeVehicles.length, assets: snapshot.assetLinks.filter(row => row.status === 'active').length };
    const detail = dialog?.kind === 'detail' ? dialog.resourceKind === 'insurance' ? snapshot.policies.find(row => row.id === dialog.id) : dialog.resourceKind === 'contract' ? snapshot.contracts.find(row => row.id === dialog.id) : snapshot.vehicles.find(row => row.id === dialog.id) : null;
    const badge = (status: string, custom?: string) => <NativeSpan className={`cr-badge ${status === 'active' || status === 'available' ? 'cr-badge--good' : status === 'archived' || status === 'ended' || status === 'cancelled' ? 'cr-badge--muted' : status === 'unavailable' ? 'cr-badge--bad' : 'cr-badge--warn'}`}>{custom ?? RESOURCE_STATUS[status] ?? status}</NativeSpan>;
    function detailField(key: string, value: unknown): ReactNode {
        if (value == null || value === '')
            return 'Nicht hinterlegt';
        if (key === 'entityId')
            return label(snapshot!.entities, String(value));
        if (key === 'siteId')
            return label(snapshot!.sites, String(value));
        if (key === 'departmentId')
            return label(snapshot!.departments, String(value));
        if (key === 'responsibleEmployeeId')
            return person(String(value));
        if (key === 'documentId')
            return permissions.viewDocuments ? label(snapshot!.documents, String(value)) : 'Dokumentzugriff geschützt';
        if (key === 'contractId')
            return snapshot!.contracts.find(row => row.id === value)?.title ?? 'Vertrag nicht verfügbar';
        if (key === 'insurancePolicyId')
            return snapshot!.policies.find(row => row.id === value)?.title ?? 'Versicherung nicht verfügbar';
        if (key === 'inventoryItemId')
            return permissions.viewInventory ? label(snapshot!.inventoryItems, String(value)) : 'Inventarzugriff geschützt';
        if (key.endsWith('Cents'))
            return resourceMoney(Number(value));
        if (key.endsWith('On'))
            return resourceDate(String(value));
        if (key === 'paymentInterval')
            return PAYMENT_LABELS[value as keyof typeof PAYMENT_LABELS];
        if (key === 'status')
            return badge(String(value));
        if (key === 'ownership')
            return ({ owned: 'Eigentum', leased: 'Leasing', rented: 'Miete' } as Record<string, string>)[String(value)];
        if (/mileage/i.test(key))
            return `${Number(value).toLocaleString('de-DE')} km`;
        return String(value);
    }
    const recordCard = (kind: ResourceRecordKind, record: ResourceRecord) => {
        const policy = kind === 'insurance' ? record as CompanyInsurancePolicy : null;
        const contract = kind === 'contract' ? record as CompanyContract : null;
        const vehicle = kind === 'vehicle' ? record as CompanyVehicle : null;
        const title = vehicle?.plate ?? policy?.title ?? contract?.title ?? '';
        const subtitle = vehicle ? [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicleType : policy ? `${policy.provider} · ${policy.insuranceType}` : `${contract!.counterparty} · ${contract!.contractType}`;
        const fields: [
            string,
            ReactNode
        ][] = vehicle ? [['Kilometerstand', `${vehicle.mileage.toLocaleString('de-DE')} km`], ['Hauptuntersuchung', resourceDate(vehicle.huDueOn)], ['Wartung', resourceDate(vehicle.serviceDueOn)], ['Zuweisungen', String(openAllocations.filter(row => row.vehicleId === vehicle.id).length)]] : policy ? [['Versicherungsnummer', policy.policyNumber], ['Deckung', resourceMoney(policy.coverageCents)], ['Beitrag', resourceMoney(policy.premiumCents)], ['Nächste Prüfung', resourceDate(policy.reviewOn)]] : [['Vertragsnummer', contract!.reference || 'Nicht hinterlegt'], ['Kosten', resourceMoney(contract!.costCents)], ['Vertragsende', resourceDate(contract!.endsOn)], ['Kündigungsstichtag', resourceDate(contract!.noticeOn)]];
        return <NativeWorkspaceStyleScope key={record.id} css={[companyResourcesCss]}>{<NativeArticle className="cr-record" key={record.id}><NativeDiv className="cr-record-header"><NativeSpan className="cr-record-icon"><CompanyIcon name={vehicle ? 'car' : policy ? 'shield' : 'receipt'}/></NativeSpan><NativeDiv className="cr-record-heading"><NativeButton type="button" className="cr-record-title" disabled={blocked} onClick={() => void open({ kind: 'detail', resourceKind: kind, id: record.id })}>{title}</NativeButton><NativeSmall>{subtitle}</NativeSmall></NativeDiv></NativeDiv><NativeDiv className="cr-tags">{badge(record.status, vehicle && vehicleInUse(vehicle.id) ? 'Ausgegeben' : undefined)}{deadlines.some(row => row.resourceId === record.id && row.overdue) && <NativeSpan className="cr-badge cr-badge--warn">Frist prüfen</NativeSpan>}</NativeDiv><NativeDl className="cr-record-fields">{fields.map(([key, value]) => <NativeDiv key={key}><NativeDt>{key}</NativeDt><NativeDd>{value}</NativeDd></NativeDiv>)}</NativeDl><NativeFooter className="cr-record-foot"><NativeSpan>{placement(record)}</NativeSpan><NativeButton type="button" className="cr-text-button" disabled={blocked} onClick={() => void open({ kind: 'detail', resourceKind: kind, id: record.id })}>Akte öffnen <CompanyIcon name="arrow" size={14}/></NativeButton></NativeFooter></NativeArticle>}</NativeWorkspaceStyleScope>;
    };
    return <NativeWorkspaceStyleScope css={[companyResourcesCss, companyResourcesCss, companyResourcesCss]}>{<NativeSection className="cr-workspace" aria-label="Unternehmensressourcen" aria-busy={busy || loading} data-testid="company-resources-workspace"><NativeStyle>{companyResourcesCss}</NativeStyle>
    <NativeDiv className="cr-heading"><NativeDiv><NativeSpan className="cr-eyebrow">Unternehmensressourcen</NativeSpan><NativeH2>{COMPANY_RESOURCES_VIEWS.find(row => row.id === view)?.label ?? 'Fristen & Überblick'}</NativeH2><NativeP>{limited ? 'Einträge innerhalb Ihres zugewiesenen Verantwortungsbereichs.' : 'Verträge, Absicherung und Ausstattung im Blick behalten.'}</NativeP></NativeDiv><NativeDiv className="cr-actions"><NativeButton type="button" className="cr-button cr-button--quiet" disabled={busy || loading} onClick={() => void refresh()}><CompanyIcon name="refresh" size={16}/>{loading ? 'Wird geladen …' : 'Aktualisieren'}</NativeButton>{newKind && permissions.manage && (newKind !== 'asset' || permissions.viewInventory) && <NativeButton type="button" className="cr-button cr-button--primary" disabled={blocked} onClick={() => void open({ kind: newKind })}><CompanyIcon name="plus" size={16}/>{newLabel}</NativeButton>}</NativeDiv></NativeDiv>
    <NativeNav className="cr-tabs" aria-label="Ressourcenbereiche">{COMPANY_RESOURCES_VIEWS.filter(tab => tab.id !== 'assets' || permissions.viewInventory).map(tab => <NativeButton type="button" key={tab.id} aria-pressed={view === tab.id} disabled={busy} onClick={() => void switchView(tab.id)}><CompanyIcon name={tab.icon} size={17}/>{tab.label}<NativeSmall>{counts[tab.id]}</NativeSmall></NativeButton>)}</NativeNav>
    {loadError && <NativeDiv className="cr-banner cr-banner--error" role="alert">{loadError}<NativeDiv className="cr-actions"><NativeButton type="button" className="cr-button" disabled={busy || loading} onClick={() => void refresh()}>Erneut laden</NativeButton></NativeDiv></NativeDiv>}
    {mutationError && <NativeDiv className="cr-banner cr-banner--error" role="alert">{mutationError}</NativeDiv>}{notice && <NativeDiv className="cr-banner cr-banner--success" role="status">{notice}</NativeDiv>}{reloadRequired && <NativeDiv className="cr-banner">Bitte laden Sie den aktuellen Stand, bevor Sie weitere Änderungen vornehmen.<NativeDiv className="cr-actions"><NativeButton type="button" className="cr-button" disabled={busy || loading} onClick={() => void reload()}>Aktuellen Stand laden</NativeButton></NativeDiv></NativeDiv>}
    {view === 'overview' ? <>
      <NativeDiv className="cr-metrics"><Metric title="Aktive Versicherungen" value={activePolicies.length} note={`${resourceMoney(activePolicies.reduce((sum, row) => sum + annualResourceCost(row.premiumCents, row.paymentInterval), 0))} bekannte laufende Jahresbeiträge`} icon="shield" onClick={() => void switchView('insurance')}/><Metric title="Aktive Verträge" value={activeContracts.length} note="Mit Fristen und Zuständigkeiten" icon="receipt" onClick={() => void switchView('contracts')}/><Metric title="Einsatzbereite Fahrzeuge" value={activeVehicles.filter(row => row.status === 'available' && !vehicleInUse(row.id)).length} note={`${activeVehicles.length} Fahrzeuge im Bestand`} icon="car" onClick={() => void switchView('fleet')}/><Metric title="Fristen bis in 60 Tagen" value={urgent.length} note={`${urgent.filter(row => row.overdue).length} davon überfällig`} icon="clock" warn={urgent.some(row => row.overdue)} onClick={() => setDeadlineFilter('60')}/></NativeDiv>
      <NativeDiv className="cr-overview"><NativeSection className="cr-panel"><NativeDiv className="cr-panel-heading"><NativeDiv><NativeH3>Was als Nächstes ansteht</NativeH3><NativeP>Gespeicherte Stichtage, Prüfungen und Fahrzeugrückgaben.</NativeP></NativeDiv><NativeLabel className="cr-filter"><NativeSpan>Zeitraum</NativeSpan><NativeSelect value={deadlineFilter} onChange={event => setDeadlineFilter(event.target.value)}><NativeOption value="60">Bis in 60 Tagen</NativeOption><NativeOption value="30">Bis in 30 Tagen</NativeOption><NativeOption value="overdue">Überfällig</NativeOption><NativeOption value="all">Alle Fristen</NativeOption></NativeSelect></NativeLabel></NativeDiv>{dueRows.length ? <NativeOl className="cr-deadlines">{dueRows.map(row => <NativeLi key={row.id}><NativeButton className="cr-deadline" type="button" disabled={blocked} onClick={() => void open({ kind: 'detail', resourceKind: row.resourceKind === 'allocation' ? 'vehicle' : row.resourceKind, id: row.resourceId })}><NativeTime dateTime={row.dueOn} className={`cr-date-tile${row.overdue ? ' cr-date-tile--late' : ''}`}><NativeStrong>{row.dueOn.slice(8, 10)}</NativeStrong>{new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(new Date(`${row.dueOn}T12:00:00`))}</NativeTime><NativeSpan className="cr-deadline-content"><NativeSpan className="cr-deadline-title">{row.title}</NativeSpan><NativeSmall>{row.label} · {resourceDate(row.dueOn)}</NativeSmall></NativeSpan><NativeSpan className="cr-deadline-days">{deadlineLabel(row.dueOn)}</NativeSpan></NativeButton></NativeLi>)}</NativeOl> : empty('Keine Fristen in diesem Zeitraum', 'Hinterlegte Kündigungsstichtage und Prüftermine erscheinen hier automatisch.', 'check')}</NativeSection>
      <NativeAside><NativeSection className="cr-panel"><NativeDiv className="cr-panel-heading"><NativeDiv><NativeH3>Unternehmensakte erweitern</NativeH3><NativeP>Neue Einträge direkt erfassen.</NativeP></NativeDiv></NativeDiv><NativeDiv className="cr-actions"><NativeButton type="button" className="cr-button" disabled={blocked} onClick={() => void open({ kind: 'insurance' })}><CompanyIcon name="shield" size={16}/>Versicherung</NativeButton><NativeButton type="button" className="cr-button" disabled={blocked} onClick={() => void open({ kind: 'contract' })}><CompanyIcon name="receipt" size={16}/>Vertrag</NativeButton><NativeButton type="button" className="cr-button" disabled={blocked} onClick={() => void open({ kind: 'vehicle' })}><CompanyIcon name="car" size={16}/>Fahrzeug</NativeButton></NativeDiv></NativeSection><NativeSection className="cr-panel"><NativeDiv className="cr-panel-heading"><NativeDiv><NativeH3>Zuletzt geändert</NativeH3><NativeP>Protokollierte Änderungen an den Ressourcen.</NativeP></NativeDiv></NativeDiv>{snapshot.audit.length ? <NativeUl className="cr-list">{[...snapshot.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map(row => <NativeLi key={row.id}><NativeStrong>{row.label}</NativeStrong><NativeSmall>{resourceDate(row.createdAt, true)}</NativeSmall></NativeLi>)}</NativeUl> : <NativeP className="cr-muted">Noch keine Änderungen protokolliert.</NativeP>}</NativeSection></NativeAside></NativeDiv>
    </> : <>
      <NativeDiv className="cr-toolbar"><NativeLabel className="cr-search"><CompanyIcon name="search" size={17}/><NativeSpan className="cr-sr">Ressourcen durchsuchen</NativeSpan><NativeInput aria-label="Ressourcen durchsuchen" placeholder={view === 'fleet' ? 'Kennzeichen, Modell oder Standort suchen …' : view === 'assets' ? 'Gegenstand oder Zuordnung suchen …' : 'Bezeichnung, Partner oder Nummer suchen …'} value={search} onChange={event => setSearch(event.target.value)}/></NativeLabel><NativeLabel className="cr-filter"><NativeSpan>Status</NativeSpan><NativeSelect value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><NativeOption value="current">Ohne Archiv</NativeOption><NativeOption value="all">Alle Einträge</NativeOption>{(view === 'fleet' ? ['available', 'maintenance', 'unavailable', 'archived'] : view === 'assets' ? ['active', 'archived'] : ['draft', 'active', 'ended', 'archived']).map(value => <NativeOption key={value} value={value}>{RESOURCE_STATUS[value]}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="cr-filter"><NativeSpan>Gesellschaft</NativeSpan><NativeSelect value={entityFilter} onChange={event => { setEntityFilter(event.target.value); setSiteFilter(''); }}><NativeOption value="">Alle Gesellschaften</NativeOption>{snapshot.entities.map(row => <NativeOption key={row.id} value={row.id}>{row.label}</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel className="cr-filter"><NativeSpan>Standort</NativeSpan><NativeSelect value={siteFilter} onChange={event => setSiteFilter(event.target.value)}><NativeOption value="">Alle Standorte</NativeOption>{snapshot.sites.filter(row => !entityFilter || row.entityId === entityFilter).map(row => <NativeOption key={row.id} value={row.id}>{row.label}</NativeOption>)}</NativeSelect></NativeLabel></NativeDiv>
      {view === 'assets' && !permissions.viewInventory ? empty('Inventarzugriff fehlt', 'Für die organisatorische Inventarzuordnung benötigen Sie Zugriff auf das Inventar.', 'shield') : <><NativeP className="cr-results">{view === 'insurance' ? policies.length : view === 'contracts' ? contracts.length : view === 'fleet' ? vehicles.length : assets.length} Einträge</NativeP><NativeDiv className="cr-record-grid">{view === 'insurance' ? policies.map(row => recordCard('insurance', row)) : view === 'contracts' ? contracts.map(row => recordCard('contract', row)) : view === 'fleet' ? vehicles.map(row => recordCard('vehicle', row)) : assets.map(row => <NativeArticle key={row.id} className="cr-record"><NativeDiv className="cr-record-header"><NativeSpan className="cr-record-icon"><CompanyIcon name="grid"/></NativeSpan><NativeDiv className="cr-record-heading"><NativeH3 className="cr-record-title">{label(snapshot.inventoryItems, row.inventoryItemId)}</NativeH3><NativeSmall>{row.vehicleId ? snapshot.vehicles.find(vehicle => vehicle.id === row.vehicleId)?.plate ?? 'Fahrzeug nicht verfügbar' : 'Organisatorische Zuordnung'}</NativeSmall></NativeDiv></NativeDiv>{badge(row.status)}<NativeDl className="cr-record-fields"><NativeDiv><NativeDt>Gesellschaft</NativeDt><NativeDd>{label(snapshot.entities, row.entityId)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Standort</NativeDt><NativeDd>{label(snapshot.sites, row.siteId)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Abteilung</NativeDt><NativeDd>{label(snapshot.departments, row.departmentId)}</NativeDd></NativeDiv></NativeDl>{row.notes && <NativeP className="cr-note">{row.notes}</NativeP>}<NativeFooter className="cr-record-foot"><NativeButton className="cr-text-button" type="button" disabled={blocked} onClick={() => router.push(`/unternehmen/inventar?itemId=${encodeURIComponent(row.inventoryItemId)}` as never)}>Inventarakte öffnen</NativeButton>{row.status !== 'archived' && <NativeDiv className="cr-actions"><NativeButton className="cr-button" type="button" disabled={blocked} onClick={() => void open({ kind: 'asset', asset: row })}>Bearbeiten</NativeButton><NativeButton className="cr-text-button" type="button" disabled={blocked} onClick={() => void archive('asset', row)}>Archivieren</NativeButton></NativeDiv>}</NativeFooter></NativeArticle>)}</NativeDiv>{!(view === 'insurance' ? policies.length : view === 'contracts' ? contracts.length : view === 'fleet' ? vehicles.length : assets.length) && empty(search || entityFilter || siteFilter || statusFilter !== 'current' ? 'Keine passenden Einträge' : 'Dieser Bereich ist noch leer', search || entityFilter || siteFilter || statusFilter !== 'current' ? 'Passen Sie die Suche oder Filter an.' : view === 'assets' ? 'Ordnen Sie vorhandenes Inventar einer Gesellschaft, einem Standort, einer Abteilung oder einem Fahrzeug zu.' : 'Legen Sie den ersten Eintrag mit Stammdaten, Zuständigkeit und Fristen an.', view === 'fleet' ? 'car' : view === 'insurance' ? 'shield' : 'receipt', newKind && <NativeButton className="cr-button cr-button--primary" type="button" disabled={blocked} onClick={() => void open({ kind: newKind })}>{newLabel}</NativeButton>)}</>}
    </>}
    {dialog && dialog.kind !== 'detail' && <CompanyResourcesEditor key={`${dialog.kind}:${'record' in dialog ? dialog.record?.id ?? 'new' : 'allocation' in dialog ? dialog.allocation?.id ?? 'new' : 'asset' in dialog ? dialog.asset?.id ?? 'new' : 'new'}`} dialog={dialog} scope={scope} snapshot={snapshot} busy={busy} blocked={reloadRequired} error={mutationError} onDirtyChange={setDirty} onClose={() => void close()} onSaved={saved} onReload={reload} run={run}/>}
    {dialog?.kind === 'detail' && <PlatformModal visible surfaceScope="company" title="Unternehmensakte" subtitle={dialog.resourceKind === 'insurance' ? 'Versicherung' : dialog.resourceKind === 'contract' ? 'Vertrag' : 'Fahrzeug'} onClose={() => void close()} dismissOnBackdrop={!busy} maxWidth={930} minWidth={260} maxHeightRatio={0.94} bodyStyle={{ backgroundColor: '#f4f8fd', padding: 23 }} sheetStyle={{ backgroundColor: '#f4f8fd' }} footerContent={<NativeDiv className="cr-dialog cr-form-footer"><NativeSpan>{detail ? `Zuletzt geändert: ${resourceDate(detail.updatedAt, true)}` : 'Eintrag nicht verfügbar'}</NativeSpan><NativeDiv className="cr-actions"><NativeButton type="button" className="cr-button cr-button--quiet" disabled={busy} onClick={() => void close()}>Schließen</NativeButton>{detail && detail.status !== 'archived' && <><NativeButton type="button" className="cr-button cr-button--danger" disabled={blocked} onClick={() => void archive(dialog.resourceKind, detail)}>Archivieren</NativeButton><NativeButton type="button" className="cr-button cr-button--primary" disabled={blocked} onClick={() => void open(dialog.resourceKind === 'vehicle' ? { kind: 'vehicle', record: detail as CompanyVehicle } : dialog.resourceKind === 'insurance' ? { kind: 'insurance', record: detail as CompanyInsurancePolicy } : { kind: 'contract', record: detail as CompanyContract })}>Bearbeiten</NativeButton></>}</NativeDiv></NativeDiv>}><NativeStyle>{companyResourcesCss}</NativeStyle><NativeDiv className="cr-dialog">{mutationError && <NativeDiv className="cr-banner cr-banner--error" role="alert">{mutationError}</NativeDiv>}{detail ? <><NativeDiv className="cr-detail-title"><NativeSpan className="cr-record-icon"><CompanyIcon name={dialog.resourceKind === 'vehicle' ? 'car' : dialog.resourceKind === 'insurance' ? 'shield' : 'receipt'} size={23}/></NativeSpan><NativeDiv><NativeH3>{'plate' in detail ? detail.plate : detail.title}</NativeH3><NativeP>{placement(detail)}</NativeP></NativeDiv>{badge(detail.status)}</NativeDiv>{resourceFields(dialog.resourceKind).map(group => <NativeSection className="cr-detail-section" key={group.title}><NativeH3>{group.title}</NativeH3><NativeDl className="cr-details">{group.fields.map(field => <NativeDiv key={field.key} className={field.wide ? 'cr-wide' : undefined}><NativeDt>{field.label}</NativeDt><NativeDd>{detailField(field.key, (detail as unknown as Record<string, unknown>)[field.key])}</NativeDd></NativeDiv>)}</NativeDl>{group.title === 'Unterlagen & Notizen' && <NativeDiv className="cr-actions" style={{ marginTop: 15 }}>{detail.documentId && permissions.viewDocuments && <NativeButton type="button" className="cr-button" disabled={blocked} onClick={() => void download(detail.documentId!)}>Unterlage herunterladen</NativeButton>}{permissions.viewDocuments && <NativeButton type="button" className="cr-text-button" disabled={busy} onClick={() => router.push(companyDocumentCatalogHref() as never)}>Dokumentenkatalog öffnen</NativeButton>}</NativeDiv>}</NativeSection>)}{'plate' in detail && <><NativeSection className="cr-detail-section"><NativeDiv className="cr-panel-heading"><NativeDiv><NativeH3>Fahrzeugzuordnungen</NativeH3><NativeP>Planung, dokumentierte Ausgabe und tatsächliche Rückgabe.</NativeP></NativeDiv>{permissions.viewEmployees && detail.status === 'available' && <NativeButton className="cr-button" type="button" disabled={blocked} onClick={() => void open({ kind: 'allocation', vehicle: detail })}>Fahrzeug zuordnen</NativeButton>}</NativeDiv>{snapshot.allocations.filter(row => row.vehicleId === detail.id).length ? <NativeUl className="cr-list">{snapshot.allocations.filter(row => row.vehicleId === detail.id).sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map(row => <NativeLi key={row.id}><NativeDiv className="cr-record-header"><NativeStrong>{person(row.employeeId)}</NativeStrong>{badge(row.status)}</NativeDiv><NativeSmall>{resourceDate(row.startsAt, true)} → {row.endsAt ? resourceDate(row.endsAt, true) : 'Ohne geplantes Ende'}</NativeSmall><NativeSmall>Ausgabe: {row.issueMileage.toLocaleString('de-DE')} km · {row.issueCondition}</NativeSmall>{row.returnedAt && <NativeSmall>Rückgabe: {resourceDate(row.returnedAt, true)} · {row.returnMileage?.toLocaleString('de-DE')} km · {row.returnCondition}</NativeSmall>}{permissions.viewEmployees && isAllocationOpen(row.status) && <NativeDiv className="cr-actions"><NativeButton className="cr-button" type="button" disabled={blocked} onClick={() => void open({ kind: 'allocation', vehicle: detail, allocation: row })}>Zuordnung bearbeiten</NativeButton>{row.status === 'active' && <NativeButton className="cr-button cr-button--primary" type="button" disabled={blocked} onClick={() => void open({ kind: 'return', vehicle: detail, allocation: row })}>Rückgabe dokumentieren</NativeButton>}</NativeDiv>}</NativeLi>)}</NativeUl> : <NativeP className="cr-muted">Für dieses Fahrzeug sind noch keine Zuordnungen gespeichert.</NativeP>}</NativeSection><NativeSection className="cr-detail-section"><NativeDiv className="cr-panel-heading"><NativeH3>Fahrzeugausstattung</NativeH3>{permissions.viewInventory && detail.status !== 'archived' && <NativeButton className="cr-button" type="button" disabled={blocked} onClick={() => void open({ kind: 'asset', vehicle: detail })}>Inventar zuordnen</NativeButton>}</NativeDiv>{snapshot.assetLinks.filter(row => row.vehicleId === detail.id && row.status === 'active').length ? <NativeUl className="cr-list">{snapshot.assetLinks.filter(row => row.vehicleId === detail.id && row.status === 'active').map(row => <NativeLi key={row.id}><NativeStrong>{permissions.viewInventory ? label(snapshot.inventoryItems, row.inventoryItemId) : 'Inventarzugriff geschützt'}</NativeStrong><NativeSmall>{row.notes || placement(row)}</NativeSmall></NativeLi>)}</NativeUl> : <NativeP className="cr-muted">Noch keine Ausstattung zugeordnet.</NativeP>}</NativeSection><NativeSection className="cr-detail-section"><NativeDiv className="cr-panel-heading"><NativeH3>Fahrtenbuch</NativeH3>{permissions.viewEmployees && detail.status !== 'archived' && <NativeButton className="cr-button" type="button" disabled={blocked} onClick={() => void open({ kind: 'logbook', vehicle: detail })}>Eintrag verknüpfen</NativeButton>}</NativeDiv>{snapshot.logbookVehicles.filter(row => row.companyVehicleId === detail.id).length ? <NativeUl className="cr-list">{snapshot.logbookVehicles.filter(row => row.companyVehicleId === detail.id).map(row => <NativeLi key={row.id}><NativeStrong>{row.plate}</NativeStrong><NativeSmall>{person(row.employeeId)} · {row.active ? 'Aktiv' : 'Inaktiv'}</NativeSmall></NativeLi>)}</NativeUl> : <NativeP className="cr-muted">Noch kein vorhandener Fahrtenbuch-Eintrag verknüpft.</NativeP>}</NativeSection></>}</> : empty('Eintrag nicht mehr verfügbar', 'Der Eintrag wurde zwischenzeitlich geändert oder ist für Sie nicht mehr zugänglich.', 'info')}</NativeDiv></PlatformModal>}
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
function Metric({ title, value, note, icon, warn, onClick }: {
    title: string;
    value: number;
    note: string;
    icon: string;
    warn?: boolean;
    onClick: () => void;
}) { return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<NativeButton type="button" className={`cr-metric${warn ? ' cr-metric--warn' : ''}`} onClick={onClick}><NativeSpan><CompanyIcon name={icon} size={17}/>{title}</NativeSpan><NativeStrong>{value}</NativeStrong><NativeSmall>{note}</NativeSmall></NativeButton>}</NativeWorkspaceStyleScope>; }
